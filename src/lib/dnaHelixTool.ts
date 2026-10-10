import { Path, Group, FabricObject, Canvas as FabricCanvas, FabricImage, util } from "fabric";
import { EnhancedBezierTool } from "./enhancedBezierTool";
import { BezierPoint } from "@/types/bezier";
import { v4 as uuidv4 } from 'uuid';

export interface DNAHelixOptions {
  strand1Color: string;
  strand2Color: string;
  rungColor: string;
  strandWidth: number;
  rungWidth: number;
  amplitude: number;
  wavelength: number;
  forkType: 'none' | 'end' | 'middle';
  forkPosition: number;
  forkLength: number;
  forkSpread: number;
}

const DEFAULT_OPTIONS: DNAHelixOptions = {
  strand1Color: '#cc0000',
  strand2Color: '#0000cc',
  rungColor: '#888888',
  strandWidth: 3,
  rungWidth: 2,
  amplitude: 15,
  wavelength: 60,
  forkType: 'none',
  forkPosition: 0.8,
  forkLength: 0.2,
  forkSpread: 30,
};

export class DNAHelixTool {
  private canvas: FabricCanvas;
  private bezierTool: EnhancedBezierTool;
  private options: DNAHelixOptions;
  private isDrawing: boolean = false;

  constructor(canvas: FabricCanvas, options?: Partial<DNAHelixOptions>) {
    this.canvas = canvas;
    this.options = { ...DEFAULT_OPTIONS, ...options };
    this.bezierTool = new EnhancedBezierTool(canvas);
  }

  start(): void {
    this.isDrawing = true;
    this.bezierTool.start();
  }

  async addPoint(x: number, y: number): Promise<FabricImage | null> {
    if (!this.isDrawing) return null;

    const wasDrawing = this.bezierTool.getState().isDrawing;
    this.bezierTool.addPoint(x, y);
    const isStillDrawing = this.bezierTool.getState().isDrawing;

    if (wasDrawing && !isStillDrawing) {
      return await this.finish();
    }
    return null;
  }

  async finish(): Promise<FabricImage | null> {
    if (!this.isDrawing) return null;

    const worldBezierPoints = this.bezierTool.getWorldPoints();
    let path = this.bezierTool.getFinishedPath();

    if (!path) {
      path = this.bezierTool.finish();
      if (!path) return null;
    }

    const actualIsClosed = (path as any).isClosed || false;
    const localBezierPoints = (path as any).bezierPoints as BezierPoint[];

    this.canvas.remove(path);

    const helixPaths = this.generateHelix(worldBezierPoints, actualIsClosed);
    if (helixPaths.length === 0) return null;

    const helixGroup = new Group(helixPaths, {
      selectable: true,
      evented: true,
      subTargetCheck: false,
      interactive: false,
      objectCaching: false,
    });

    // Transform worldBezierPoints to relative space
    const invGroupMatrix = util.invertTransform(helixGroup.calcTransformMatrix());
    const relativeWorldBezierPoints = worldBezierPoints.map(point => {
      const relativeAnchor = util.transformPoint(
        { x: point.x, y: point.y },
        invGroupMatrix
      );
      const relativePoint: BezierPoint = {
        x: relativeAnchor.x,
        y: relativeAnchor.y,
        type: point.type,
        id: point.id,
      };
      if (point.controlPoint1) {
        const relativeCp1 = util.transformPoint(
          { x: point.controlPoint1.x, y: point.controlPoint1.y },
          invGroupMatrix
        );
        relativePoint.controlPoint1 = { x: relativeCp1.x, y: relativeCp1.y };
      }
      if (point.controlPoint2) {
        const relativeCp2 = util.transformPoint(
          { x: point.controlPoint2.x, y: point.controlPoint2.y },
          invGroupMatrix
        );
        relativePoint.controlPoint2 = { x: relativeCp2.x, y: relativeCp2.y };
      }
      return relativePoint;
    });

    // Store metadata
    (helixGroup as any).isDNAHelix = true;
    (helixGroup as any).dnaHelixOptions = this.options;
    (helixGroup as any).bezierPoints = localBezierPoints;
    (helixGroup as any).worldBezierPoints = relativeWorldBezierPoints;
    (helixGroup as any).isClosed = actualIsClosed;
    (helixGroup as any).id = uuidv4();

    // Override toObject for serialization
    const originalToObject = helixGroup.toObject.bind(helixGroup);
    (helixGroup as any).toObject = function (propertiesToInclude?: string[]) {
      return originalToObject([
        ...(propertiesToInclude || []),
        'isDNAHelix',
        'dnaHelixOptions',
        'bezierPoints',
        'worldBezierPoints',
        'isClosed',
        'id',
      ]);
    };

    // Rasterize for performance
    const rasterized = await DNAHelixTool.rasterizeHelix(helixGroup);

    this.canvas.add(rasterized);
    this.canvas.setActiveObject(rasterized);
    this.canvas.requestRenderAll();
    this.isDrawing = false;

    (this.bezierTool as any).finishedPath = null;
    return rasterized;
  }

  cancel(): void {
    this.isDrawing = false;
    this.bezierTool.cancel();
  }

  // ---- Geometry ----

  generateHelix(bezierPoints: BezierPoint[], isClosed?: boolean): FabricObject[] {
    const spinePoints = this.sampleBezierCurve(bezierPoints, isClosed);
    if (spinePoints.length < 2) return [];

    const normals = this.computeNormals(spinePoints);
    const arcLengths = this.computeArcLengths(spinePoints);
    const totalLength = arcLengths[arcLengths.length - 1];
    if (totalLength < 1) return [];

    const { amplitude, forkType, forkPosition, forkLength, forkSpread } = this.options;

    // Adjust wavelength so an integer number of full turns fits the path length.
    // This eliminates partial/ugly loops at the start and end.
    const requestedWavelength = this.options.wavelength;
    const fullTurns = Math.max(1, Math.round(totalLength / requestedWavelength));
    const wavelength = totalLength / fullTurns;

    // Compute strand positions at each sample point
    const strand1Points: { x: number; y: number }[] = [];
    const strand2Points: { x: number; y: number }[] = [];

    for (let i = 0; i < spinePoints.length; i++) {
      const t = arcLengths[i] / totalLength; // normalized position 0-1
      const phase = (2 * Math.PI * arcLengths[i]) / wavelength;

      let offset1 = amplitude * Math.sin(phase);
      let offset2 = amplitude * Math.sin(phase + Math.PI);

      // Apply fork modifications — freeze oscillation at the fork boundary and
      // smoothly interpolate to the fully separated position so the strands
      // diverge cleanly without trying to loop again.
      if (forkType === 'end' && t >= forkPosition) {
        const forkProgress = Math.min((t - forkPosition) / (1 - forkPosition || 0.001), 1);
        const eased = 1 - (1 - forkProgress) * (1 - forkProgress); // ease-out

        // Freeze the helix offsets at the fork start — no more oscillation
        const forkStartArc = forkPosition * totalLength;
        const forkStartPhase = (2 * Math.PI * forkStartArc) / wavelength;
        const frozenOffset1 = amplitude * Math.sin(forkStartPhase);
        const frozenOffset2 = amplitude * Math.sin(forkStartPhase + Math.PI);

        // Smoothly interpolate from frozen helix position to separated position
        offset1 = frozenOffset1 + (forkSpread - frozenOffset1) * eased;
        offset2 = frozenOffset2 + (-forkSpread - frozenOffset2) * eased;
      } else if (forkType === 'middle') {
        const forkStart = forkPosition;
        const forkEnd = Math.min(forkPosition + forkLength, 1);
        const forkMid = (forkStart + forkEnd) / 2;

        if (t >= forkStart && t <= forkEnd) {
          let forkProgress: number;
          if (t < forkMid) {
            forkProgress = (t - forkStart) / (forkMid - forkStart || 0.001);
          } else {
            forkProgress = 1 - (t - forkMid) / (forkEnd - forkMid || 0.001);
          }
          const eased = Math.sin(Math.min(forkProgress, 1) * Math.PI / 2);

          // Freeze at the entry/exit boundary of the fork region
          const refArc = (t < forkMid ? forkStart : forkEnd) * totalLength;
          const refPhase = (2 * Math.PI * refArc) / wavelength;
          const frozenOffset1 = amplitude * Math.sin(refPhase);
          const frozenOffset2 = amplitude * Math.sin(refPhase + Math.PI);

          offset1 = frozenOffset1 + (forkSpread - frozenOffset1) * eased;
          offset2 = frozenOffset2 + (-forkSpread - frozenOffset2) * eased;
        }
      }

      const nx = normals[i].nx;
      const ny = normals[i].ny;
      strand1Points.push({
        x: spinePoints[i].x + nx * offset1,
        y: spinePoints[i].y + ny * offset1,
      });
      strand2Points.push({
        x: spinePoints[i].x + nx * offset2,
        y: spinePoints[i].y + ny * offset2,
      });
    }

    // Find crossing indices (where sin(phase) crosses zero)
    const crossingIndices: number[] = [0];
    for (let i = 1; i < spinePoints.length; i++) {
      const phasePrev = (2 * Math.PI * arcLengths[i - 1]) / wavelength;
      const phaseCurr = (2 * Math.PI * arcLengths[i]) / wavelength;
      const sinPrev = Math.sin(phasePrev);
      const sinCurr = Math.sin(phaseCurr);
      if (sinPrev * sinCurr < 0) {
        crossingIndices.push(i);
      }
    }
    crossingIndices.push(spinePoints.length - 1);

    // Build path segments with correct front/back ordering
    const objects: FabricObject[] = [];
    const { strand1Color, strand2Color, strandWidth, rungColor, rungWidth } = this.options;

    for (let seg = 0; seg < crossingIndices.length - 1; seg++) {
      const startIdx = crossingIndices[seg];
      const endIdx = crossingIndices[seg + 1];
      if (endIdx <= startIdx) continue;

      // Determine which strand is in front in this segment
      const midIdx = Math.floor((startIdx + endIdx) / 2);
      const midPhase = (2 * Math.PI * arcLengths[midIdx]) / wavelength;
      const strand1InFront = Math.sin(midPhase) > 0;

      const s1Slice = strand1Points.slice(startIdx, endIdx + 1);
      const s2Slice = strand2Points.slice(startIdx, endIdx + 1);

      const s1PathData = this.buildStrandPathData(s1Slice);
      const s2PathData = this.buildStrandPathData(s2Slice);

      if (!s1PathData || !s2PathData) continue;

      const backPathData = strand1InFront ? s2PathData : s1PathData;
      const frontPathData = strand1InFront ? s1PathData : s2PathData;
      const backColor = strand1InFront ? strand2Color : strand1Color;
      const frontColor = strand1InFront ? strand1Color : strand2Color;

      // Draw back strand
      objects.push(new Path(backPathData, {
        stroke: backColor,
        strokeWidth: strandWidth,
        fill: '',
        selectable: false,
        evented: false,
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
      }));

      // Draw rungs between back and front strands
      this.addRungs(
        objects, spinePoints, strand1Points, strand2Points,
        startIdx, endIdx, arcLengths, totalLength,
        rungColor, rungWidth
      );

      // Draw front strand
      objects.push(new Path(frontPathData, {
        stroke: frontColor,
        strokeWidth: strandWidth,
        fill: '',
        selectable: false,
        evented: false,
        strokeLineCap: 'round',
        strokeLineJoin: 'round',
      }));
    }

    return objects;
  }

  private buildStrandPathData(points: { x: number; y: number }[]): string {
    if (points.length < 2) return '';

    // Subsample to reduce point count while keeping smoothness
    // With 100 samples/segment, take every 3rd point for Catmull-Rom input
    const step = 3;
    const sparse: { x: number; y: number }[] = [points[0]];
    for (let i = step; i < points.length - 1; i += step) {
      sparse.push(points[i]);
    }
    sparse.push(points[points.length - 1]);

    if (sparse.length < 3) {
      // Too few points for curves — fall back to lines
      let d = `M ${sparse[0].x} ${sparse[0].y}`;
      for (let i = 1; i < sparse.length; i++) {
        d += ` L ${sparse[i].x} ${sparse[i].y}`;
      }
      return d;
    }

    // Catmull-Rom to cubic bezier conversion
    let d = `M ${sparse[0].x} ${sparse[0].y}`;
    for (let i = 0; i < sparse.length - 1; i++) {
      const p0 = sparse[Math.max(i - 1, 0)];
      const p1 = sparse[i];
      const p2 = sparse[i + 1];
      const p3 = sparse[Math.min(i + 2, sparse.length - 1)];

      // Catmull-Rom tangents → cubic bezier control points
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }

  /**
   * Interpolate strand position at a target arc length by finding the
   * surrounding sample points and lerping between them.
   */
  private interpolateAtArcLen(
    targetArc: number,
    arcLengths: number[],
    strandPoints: { x: number; y: number }[]
  ): { x: number; y: number } {
    // Binary search for the segment containing targetArc
    let lo = 0, hi = arcLengths.length - 1;
    while (lo < hi - 1) {
      const mid = (lo + hi) >> 1;
      if (arcLengths[mid] <= targetArc) lo = mid; else hi = mid;
    }
    const segLen = arcLengths[hi] - arcLengths[lo];
    const frac = segLen > 0 ? (targetArc - arcLengths[lo]) / segLen : 0;
    return {
      x: strandPoints[lo].x + (strandPoints[hi].x - strandPoints[lo].x) * frac,
      y: strandPoints[lo].y + (strandPoints[hi].y - strandPoints[lo].y) * frac,
    };
  }

  private addRungs(
    objects: FabricObject[],
    _spinePoints: { x: number; y: number }[],
    strand1Points: { x: number; y: number }[],
    strand2Points: { x: number; y: number }[],
    startIdx: number,
    endIdx: number,
    arcLengths: number[],
    totalLength: number,
    rungColor: string,
    rungWidth: number
  ): void {
    const { forkType, forkPosition, forkLength, wavelength } = this.options;

    // Each half-turn (between two strand crossovers) is one visible "loop".
    // Place 3 rungs per half-turn: near the start (15%), middle (50%), near the end (85%).
    const RUNG_FRACTIONS = [0.15, 0.50, 0.85];

    const arcStart = arcLengths[startIdx];
    const arcEnd = arcLengths[endIdx];
    const segLen = arcEnd - arcStart;
    if (segLen < 1) return;

    for (const frac of RUNG_FRACTIONS) {
      const rungArc = arcStart + segLen * frac;

      // Skip rungs in fork regions
      const t = rungArc / totalLength;
      if (forkType === 'end' && t > forkPosition + 0.02) continue;
      if (forkType === 'middle' && t > forkPosition + 0.02 && t < forkPosition + forkLength - 0.02) continue;

      // Depth factor: scale rung length by how far the strands are apart
      const phase = (2 * Math.PI * rungArc) / wavelength;
      const depthFactor = Math.abs(Math.sin(phase));
      if (depthFactor < 0.1) continue;

      // Interpolate exact strand positions at this arc length
      const p1 = this.interpolateAtArcLen(rungArc, arcLengths, strand1Points);
      const p2 = this.interpolateAtArcLen(rungArc, arcLengths, strand2Points);

      // Shorten the rung toward the spine center based on depthFactor
      const midX = (p1.x + p2.x) / 2;
      const midY = (p1.y + p2.y) / 2;
      const r1x = midX + (p1.x - midX) * depthFactor;
      const r1y = midY + (p1.y - midY) * depthFactor;
      const r2x = midX + (p2.x - midX) * depthFactor;
      const r2y = midY + (p2.y - midY) * depthFactor;

      objects.push(new Path(`M ${r1x} ${r1y} L ${r2x} ${r2y}`, {
        stroke: rungColor,
        strokeWidth: rungWidth,
        fill: '',
        selectable: false,
        evented: false,
        strokeLineCap: 'round',
      }));
    }
  }

  // ---- Bezier sampling (same as TripleMembranePathTool) ----

  private sampleBezierCurve(bezierPoints: BezierPoint[], isClosed?: boolean): { x: number; y: number }[] {
    if (bezierPoints.length < 2) return bezierPoints.map(bp => ({ x: bp.x, y: bp.y }));

    const sampled: { x: number; y: number }[] = [];
    const samplesPerSegment = 100;

    for (let i = 0; i < bezierPoints.length - 1; i++) {
      const p0 = bezierPoints[i];
      const p1 = bezierPoints[i + 1];
      const cp1 = p0.controlPoint2 || { x: p0.x, y: p0.y };
      const cp2 = p1.controlPoint1 || { x: p1.x, y: p1.y };

      // Skip t=0 for segments after the first to avoid duplicate points at boundaries
      const tStart = (i === 0) ? 0 : 1;
      for (let t = tStart; t <= samplesPerSegment; t++) {
        const u = t / samplesPerSegment;
        sampled.push(this.sampleCubicBezier(u, p0, cp1, cp2, p1));
      }
    }

    if (isClosed && bezierPoints.length >= 3) {
      const p0 = bezierPoints[bezierPoints.length - 1];
      const p1 = bezierPoints[0];
      const cp1 = p0.controlPoint2 || { x: p0.x, y: p0.y };
      const cp2 = p1.controlPoint1 || { x: p1.x, y: p1.y };

      for (let t = 1; t <= samplesPerSegment; t++) {
        const u = t / samplesPerSegment;
        sampled.push(this.sampleCubicBezier(u, p0, cp1, cp2, p1));
      }
    }

    return sampled;
  }

  private sampleCubicBezier(
    t: number,
    p0: { x: number; y: number },
    cp1: { x: number; y: number },
    cp2: { x: number; y: number },
    p1: { x: number; y: number }
  ): { x: number; y: number } {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;
    return {
      x: uuu * p0.x + 3 * uu * t * cp1.x + 3 * u * tt * cp2.x + ttt * p1.x,
      y: uuu * p0.y + 3 * uu * t * cp1.y + 3 * u * tt * cp2.y + ttt * p1.y,
    };
  }

  private computeNormals(points: { x: number; y: number }[]): { nx: number; ny: number }[] {
    // Pad the spine with extrapolated ghost points so that boundary normals
    // get proper central differences and the smoothing window doesn't collapse.
    const PAD = 5;
    const padded: { x: number; y: number }[] = [];

    // Extrapolate before the start using the initial tangent
    const startDx = points[1].x - points[0].x;
    const startDy = points[1].y - points[0].y;
    for (let k = PAD; k > 0; k--) {
      padded.push({ x: points[0].x - startDx * k, y: points[0].y - startDy * k });
    }
    // Original points
    for (const p of points) padded.push(p);
    // Extrapolate after the end using the final tangent
    const n = points.length;
    const endDx = points[n - 1].x - points[n - 2].x;
    const endDy = points[n - 1].y - points[n - 2].y;
    for (let k = 1; k <= PAD; k++) {
      padded.push({ x: points[n - 1].x + endDx * k, y: points[n - 1].y + endDy * k });
    }

    // Compute raw normals on the padded array (all points have central diffs)
    const rawAll: { nx: number; ny: number }[] = [];
    for (let i = 0; i < padded.length; i++) {
      let dx: number, dy: number;
      if (i === 0) {
        dx = padded[1].x - padded[0].x;
        dy = padded[1].y - padded[0].y;
      } else if (i === padded.length - 1) {
        dx = padded[i].x - padded[i - 1].x;
        dy = padded[i].y - padded[i - 1].y;
      } else {
        dx = padded[i + 1].x - padded[i - 1].x;
        dy = padded[i + 1].y - padded[i - 1].y;
      }
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      rawAll.push({ nx: -dy / len, ny: dx / len });
    }

    // Enforce consistency on the full padded array
    for (let i = 1; i < rawAll.length; i++) {
      const dot = rawAll[i].nx * rawAll[i - 1].nx + rawAll[i].ny * rawAll[i - 1].ny;
      if (dot < 0) {
        rawAll[i].nx = -rawAll[i].nx;
        rawAll[i].ny = -rawAll[i].ny;
      }
    }

    // Smooth the padded normals, then trim back to the original range
    const smoothedAll = this.smoothNormals(rawAll, 7);
    return smoothedAll.slice(PAD, PAD + points.length);
  }

  private smoothNormals(normals: { nx: number; ny: number }[], windowSize: number): { nx: number; ny: number }[] {
    const half = Math.floor(windowSize / 2);
    return normals.map((_, i) => {
      let sx = 0, sy = 0;
      for (let j = i - half; j <= i + half; j++) {
        const idx = Math.max(0, Math.min(normals.length - 1, j));
        sx += normals[idx].nx;
        sy += normals[idx].ny;
      }
      const len = Math.sqrt(sx * sx + sy * sy) || 1;
      return { nx: sx / len, ny: sy / len };
    });
  }

  private computeArcLengths(points: { x: number; y: number }[]): number[] {
    const arcLengths = [0];
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      arcLengths.push(arcLengths[i - 1] + Math.sqrt(dx * dx + dy * dy));
    }
    return arcLengths;
  }

  // ---- Static helpers (regenerate, rasterize) ----

  static async regenerate(
    canvas: FabricCanvas,
    oldHelix: Group | FabricImage,
    newBezierPoints?: BezierPoint[],
    isClosedOverride?: boolean
  ): Promise<FabricImage> {
    const options: DNAHelixOptions = (oldHelix as any).dnaHelixOptions;
    const isClosed = isClosedOverride !== undefined ? isClosedOverride : (oldHelix as any).isClosed;
    const id = (oldHelix as any).id;

    const bzPts = newBezierPoints || (() => {
      const relativePts = (oldHelix as any).worldBezierPoints;
      if (!relativePts) return [];

      const isRasterized = (oldHelix as any).isRasterizedHelix;
      let transformMatrix: any;

      if (isRasterized) {
        const bounds = oldHelix.getBoundingRect();
        const centerX = bounds.left + bounds.width / 2;
        const centerY = bounds.top + bounds.height / 2;
        const scaleX = (oldHelix as any).originalScaleX || 1;
        const scaleY = (oldHelix as any).originalScaleY || 1;
        const angle = (oldHelix as any).angle || 0;
        const cos = Math.cos(angle * Math.PI / 180);
        const sin = Math.sin(angle * Math.PI / 180);
        transformMatrix = [cos * scaleX, sin * scaleX, -sin * scaleY, cos * scaleY, centerX, centerY];
      } else {
        transformMatrix = oldHelix.calcTransformMatrix();
      }

      return relativePts.map((point: any) => {
        const abs = util.transformPoint({ x: point.x, y: point.y }, transformMatrix);
        const p: any = { x: abs.x, y: abs.y, type: point.type, id: point.id };
        if (point.controlPoint1) {
          const cp = util.transformPoint({ x: point.controlPoint1.x, y: point.controlPoint1.y }, transformMatrix);
          p.controlPoint1 = { x: cp.x, y: cp.y };
        }
        if (point.controlPoint2) {
          const cp = util.transformPoint({ x: point.controlPoint2.x, y: point.controlPoint2.y }, transformMatrix);
          p.controlPoint2 = { x: cp.x, y: cp.y };
        }
        return p;
      });
    })();

    const tool = new DNAHelixTool(canvas, options);
    const helixPaths = tool.generateHelix(bzPts, isClosed);

    const newGroup = new Group(helixPaths, {
      selectable: true,
      evented: true,
      subTargetCheck: false,
      interactive: false,
      objectCaching: false,
    });

    // Store bezier points in relative space
    const invGroupMatrix = util.invertTransform(newGroup.calcTransformMatrix());
    const relativeWorldBezierPoints = bzPts.map((point: any) => {
      const rel = util.transformPoint({ x: point.x, y: point.y }, invGroupMatrix);
      const p: any = { x: rel.x, y: rel.y, type: point.type, id: point.id };
      if (point.controlPoint1) {
        const cp = util.transformPoint({ x: point.controlPoint1.x, y: point.controlPoint1.y }, invGroupMatrix);
        p.controlPoint1 = { x: cp.x, y: cp.y };
      }
      if (point.controlPoint2) {
        const cp = util.transformPoint({ x: point.controlPoint2.x, y: point.controlPoint2.y }, invGroupMatrix);
        p.controlPoint2 = { x: cp.x, y: cp.y };
      }
      return p;
    });

    (newGroup as any).isDNAHelix = true;
    (newGroup as any).dnaHelixOptions = options;
    (newGroup as any).worldBezierPoints = relativeWorldBezierPoints;
    (newGroup as any).bezierPoints = relativeWorldBezierPoints;
    (newGroup as any).isClosed = isClosed;
    (newGroup as any).id = id;

    const origToObj = newGroup.toObject.bind(newGroup);
    (newGroup as any).toObject = function (propertiesToInclude?: string[]) {
      return origToObj([
        ...(propertiesToInclude || []),
        'isDNAHelix', 'dnaHelixOptions', 'bezierPoints',
        'worldBezierPoints', 'isClosed', 'id',
      ]);
    };

    const rasterized = await DNAHelixTool.rasterizeHelix(newGroup);

    // Replace on canvas
    const wasOnCanvas = canvas.contains(oldHelix);
    if (wasOnCanvas) {
      canvas.remove(oldHelix);
      canvas.add(rasterized);
      canvas.setActiveObject(rasterized);
    }

    rasterized.setCoords();
    canvas.requestRenderAll();
    return rasterized;
  }

  static async rasterizeHelix(helixGroup: Group | FabricImage): Promise<FabricImage> {
    if ((helixGroup as any).isRasterizedHelix) {
      return helixGroup as FabricImage;
    }

    const boundingRect = helixGroup.getBoundingRect();
    const metadata = {
      isDNAHelix: true,
      dnaHelixOptions: (helixGroup as any).dnaHelixOptions,
      bezierPoints: (helixGroup as any).bezierPoints,
      worldBezierPoints: (helixGroup as any).worldBezierPoints,
      isClosed: (helixGroup as any).isClosed,
      id: (helixGroup as any).id,
      originalScaleX: helixGroup.scaleX || 1,
      originalScaleY: helixGroup.scaleY || 1,
    };

    const multiplier = 2;
    const dataURL = helixGroup.toDataURL({ format: 'png', quality: 1, multiplier });
    const image = await FabricImage.fromURL(dataURL, { crossOrigin: 'anonymous' });

    const scale = 1 / multiplier;
    image.set({
      left: boundingRect.left + boundingRect.width / 2,
      top: boundingRect.top + boundingRect.height / 2,
      originX: 'center',
      originY: 'center',
      scaleX: scale * (helixGroup.scaleX || 1),
      scaleY: scale * (helixGroup.scaleY || 1),
      angle: helixGroup.angle || 0,
      selectable: true,
      evented: true,
    });

    Object.assign(image, metadata);
    (image as any).isRasterizedHelix = true;

    const originalToObject = image.toObject.bind(image);
    (image as any).toObject = function (propertiesToInclude?: string[]) {
      const result = originalToObject([
        ...(propertiesToInclude || []),
        'isDNAHelix', 'dnaHelixOptions', 'bezierPoints',
        'worldBezierPoints', 'isClosed', 'id',
        'originalScaleX', 'originalScaleY', 'isRasterizedHelix',
      ]);
      // Use a 1x1 transparent PNG placeholder so Fabric.js still loads
      // the FabricImage on deserialization. The real image is regenerated
      // from worldBezierPoints in runPostLoadGlobalSteps.
      result.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRElEQkSuQmCC';
      return result;
    };

    return image;
  }
}
