import { Path, Group, FabricObject, Canvas as FabricCanvas, FabricImage, util } from "fabric";
import { EnhancedBezierTool } from "./enhancedBezierTool";
import { BezierPoint } from "@/types/bezier";
import { v4 as uuidv4 } from 'uuid';
import { pointsToCentripetalPathString } from "./pathSmoothing";

export interface TripleMembraneOptions {
  bandWidth: number;       // Width of each band (px)
  bandGap: number;         // Gap between bands (px)
  outerBandColor: string;  // Color of the two outer bands
  middleBandColor: string; // Color of the middle (lighter) band
  outerBandOpacity: number;
  middleBandOpacity: number;
  intracellular: {
    enabled: boolean;
    color: string;
    depth: number;          // How far the fill extends from the membrane
    opacity: number;
    side: 'left' | 'right'; // Which side of the membrane the fill goes
  };
}

const DEFAULT_OPTIONS: TripleMembraneOptions = {
  bandWidth: 6,
  bandGap: 2,
  outerBandColor: '#1e3a5f',
  middleBandColor: '#a8c8e8',
  outerBandOpacity: 1,
  middleBandOpacity: 0.8,
  intracellular: {
    enabled: false,
    color: '#fde68a',
    depth: 40,
    opacity: 0.15,
    side: 'left',
  },
};

export class TripleMembranePathTool {
  private canvas: FabricCanvas;
  private bezierTool: EnhancedBezierTool;
  private options: TripleMembraneOptions;
  private isDrawing: boolean = false;

  constructor(canvas: FabricCanvas, options?: Partial<TripleMembraneOptions>) {
    this.canvas = canvas;
    this.options = { ...DEFAULT_OPTIONS, ...options, intracellular: { ...DEFAULT_OPTIONS.intracellular, ...options?.intracellular } };
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

    // Generate band objects from the bezier path
    const bands = this.generateBands(worldBezierPoints, actualIsClosed);
    if (bands.length === 0) return null;

    const membrane = new Group(bands, {
      selectable: true,
      evented: true,
      subTargetCheck: false,
      interactive: false,
      objectCaching: false,
    });

    // Transform worldBezierPoints to relative space
    const invGroupMatrix = util.invertTransform(membrane.calcTransformMatrix());
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
    (membrane as any).isTripleMembrane = true;
    (membrane as any).tripleMembraneOptions = this.options;
    (membrane as any).bezierPoints = localBezierPoints;
    (membrane as any).worldBezierPoints = relativeWorldBezierPoints;
    (membrane as any).isClosed = actualIsClosed;
    (membrane as any).id = uuidv4();

    // Override toObject for serialization
    const originalToObject = membrane.toObject.bind(membrane);
    (membrane as any).toObject = function (propertiesToInclude?: string[]) {
      return originalToObject([
        ...(propertiesToInclude || []),
        'isTripleMembrane',
        'tripleMembraneOptions',
        'bezierPoints',
        'worldBezierPoints',
        'isClosed',
        'id',
      ]);
    };

    // Rasterize for performance
    const rasterized = await TripleMembranePathTool.rasterizeMembrane(membrane);

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

  // ---- Geometry helpers ----

  private sampleBezierCurve(bezierPoints: BezierPoint[], isClosed?: boolean): { x: number; y: number }[] {
    return this.sampleBezierCurveWithCorners(bezierPoints, isClosed).points;
  }

  /**
   * Like sampleBezierCurve, but also returns a parallel boolean mask marking
   * which samples coincide with a `corner`-type bezier anchor. Used by the
   * Catmull-Rom smoother to keep sharp corners sharp instead of rounding them.
   */
  private sampleBezierCurveWithCorners(
    bezierPoints: BezierPoint[],
    isClosed?: boolean
  ): { points: { x: number; y: number }[]; isCorner: boolean[] } {
    if (bezierPoints.length < 2) {
      return {
        points: bezierPoints.map(bp => ({ x: bp.x, y: bp.y })),
        isCorner: bezierPoints.map(bp => bp.type === 'corner'),
      };
    }

    const sampled: { x: number; y: number }[] = [];
    const isCorner: boolean[] = [];
    const samplesPerSegment = 30;

    for (let i = 0; i < bezierPoints.length - 1; i++) {
      const p0 = bezierPoints[i];
      const p1 = bezierPoints[i + 1];
      const cp1 = p0.controlPoint2 || { x: p0.x, y: p0.y };
      const cp2 = p1.controlPoint1 || { x: p1.x, y: p1.y };

      for (let t = 0; t <= samplesPerSegment; t++) {
        const u = t / samplesPerSegment;
        sampled.push(this.sampleCubicBezier(u, p0, cp1, cp2, p1));
        if (t === 0) {
          isCorner.push(p0.type === 'corner');
        } else if (t === samplesPerSegment) {
          isCorner.push(p1.type === 'corner');
        } else {
          isCorner.push(false);
        }
      }
    }

    if (isClosed && bezierPoints.length >= 3) {
      const p0 = bezierPoints[bezierPoints.length - 1];
      const p1 = bezierPoints[0];
      const cp1 = p0.controlPoint2 || { x: p0.x, y: p0.y };
      const cp2 = p1.controlPoint1 || { x: p1.x, y: p1.y };

      for (let t = 0; t <= samplesPerSegment; t++) {
        const u = t / samplesPerSegment;
        sampled.push(this.sampleCubicBezier(u, p0, cp1, cp2, p1));
        if (t === 0) {
          isCorner.push(p0.type === 'corner');
        } else if (t === samplesPerSegment) {
          isCorner.push(p1.type === 'corner');
        } else {
          isCorner.push(false);
        }
      }
    }

    return { points: sampled, isCorner };
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
    const normals: { nx: number; ny: number }[] = [];
    for (let i = 0; i < points.length; i++) {
      let dx: number, dy: number;
      if (i === 0) {
        dx = points[1].x - points[0].x;
        dy = points[1].y - points[0].y;
      } else if (i === points.length - 1) {
        dx = points[i].x - points[i - 1].x;
        dy = points[i].y - points[i - 1].y;
      } else {
        dx = points[i + 1].x - points[i - 1].x;
        dy = points[i + 1].y - points[i - 1].y;
      }
      const len = Math.sqrt(dx * dx + dy * dy) || 1;
      // Perpendicular: rotate tangent 90 deg CCW
      normals.push({ nx: -dy / len, ny: dx / len });
    }
    return normals;
  }

  private smoothNormals(normals: { nx: number; ny: number }[], windowSize: number = 5): { nx: number; ny: number }[] {
    const half = Math.floor(windowSize / 2);
    return normals.map((_, i) => {
      let sx = 0, sy = 0, count = 0;
      for (let j = i - half; j <= i + half; j++) {
        const idx = Math.max(0, Math.min(normals.length - 1, j));
        sx += normals[idx].nx;
        sy += normals[idx].ny;
        count++;
      }
      const len = Math.sqrt(sx * sx + sy * sy) || 1;
      return { nx: sx / len, ny: sy / len };
    });
  }

  /**
   * Compute signed curvature at each sample point.
   * Positive = curve bends in the normal direction (toward normal side).
   * Negative = curve bends opposite to the normal direction.
   */
  private computeSignedCurvatures(points: { x: number; y: number }[]): number[] {
    const curvatures: number[] = new Array(points.length);

    for (let i = 0; i < points.length; i++) {
      if (i === 0 || i === points.length - 1) {
        curvatures[i] = 0;
        continue;
      }

      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];

      const t1x = curr.x - prev.x;
      const t1y = curr.y - prev.y;
      const t2x = next.x - curr.x;
      const t2y = next.y - curr.y;

      const len1 = Math.sqrt(t1x * t1x + t1y * t1y);
      const len2 = Math.sqrt(t2x * t2x + t2y * t2y);

      if (len1 < 1e-6 || len2 < 1e-6) {
        curvatures[i] = 0;
        continue;
      }

      const cross = t1x * t2y - t1y * t2x;
      const avgSegLen = (len1 + len2) / 2;
      curvatures[i] = cross / (len1 * len2 * avgSegLen);
    }

    return curvatures;
  }

  /**
   * Smooth a scalar array with a moving-average window.
   * Used for curvatures (to ease clamp transitions) and for
   * clamped offsets (to smooth the inner edge at tight bends).
   */
  private smoothScalars(values: number[], windowSize: number = 7): number[] {
    const half = Math.floor(windowSize / 2);
    return values.map((_, i) => {
      let sum = 0;
      let count = 0;
      for (let j = i - half; j <= i + half; j++) {
        const idx = Math.max(0, Math.min(values.length - 1, j));
        sum += values[idx];
        count++;
      }
      return sum / count;
    });
  }

  /**
   * Clamp an offset so it doesn't exceed the local curvature radius
   * in the direction toward the center of curvature.
   * Offsets away from center are unclamped.
   */
  private clampOffset(offset: number, curvature: number): number {
    if (Math.abs(curvature) < 0.0001) return offset; // nearly straight

    const radius = 1 / Math.abs(curvature);
    const maxOffset = radius * 0.85;

    // Positive curvature = center on normal side → clamp positive offsets
    if (curvature > 0 && offset > maxOffset) {
      return maxOffset;
    }
    // Negative curvature = center on opposite-normal side → clamp negative offsets
    if (curvature < 0 && offset < -maxOffset) {
      return -maxOffset;
    }

    return offset;
  }

  /**
   * Generate band fill as a smooth ribbon: the inner offset edge is traced as
   * a centripetal Catmull-Rom cubic-Bezier curve, then the path bridges across
   * to the outer offset edge and traces back as another cubic-Bezier curve.
   * Closed shapes emit two subpaths (inner ring + outer ring) and rely on
   * `fillRule: 'evenodd'` at the Path callsite for the band fill.
   *
   * Per-point curvature clamping still prevents offset points from crossing
   * the center of curvature at tight bends; an additional minimum-band-width
   * guard prevents the smoothed ribbon from collapsing to zero thickness.
   */
  private generateStripFillPathData(
    points: { x: number; y: number }[],
    normals: { nx: number; ny: number }[],
    offsetA: number,
    offsetB: number,
    curvatures: number[],
    isClosed: boolean,
    cornerMask?: boolean[]
  ): string {
    const n = points.length;
    if (n < 2) return '';

    const rawA = new Array<number>(n);
    const rawB = new Array<number>(n);
    for (let i = 0; i < n; i++) {
      rawA[i] = this.clampOffset(offsetA, curvatures[i]);
      rawB[i] = this.clampOffset(offsetB, curvatures[i]);
    }

    // Minimum band-width guard: if curvature clamping has collapsed the
    // band below this width, push the edges apart symmetrically (keeping
    // their signs) so the smoothed ribbon never self-intersects.
    const MIN_BAND_WIDTH = 0.5;
    for (let i = 0; i < n; i++) {
      const width = Math.abs(rawA[i] - rawB[i]);
      if (width < MIN_BAND_WIDTH) {
        const mid = (rawA[i] + rawB[i]) / 2;
        const half = MIN_BAND_WIDTH / 2;
        if (rawA[i] <= rawB[i]) {
          rawA[i] = mid - half;
          rawB[i] = mid + half;
        } else {
          rawA[i] = mid + half;
          rawB[i] = mid - half;
        }
      }
    }

    const smoothA = this.smoothScalars(rawA, 7);
    const smoothB = this.smoothScalars(rawB, 7);

    const innerPts: { x: number; y: number }[] = new Array(n);
    const outerPts: { x: number; y: number }[] = new Array(n);
    for (let i = 0; i < n; i++) {
      innerPts[i] = {
        x: points[i].x + normals[i].nx * smoothA[i],
        y: points[i].y + normals[i].ny * smoothA[i],
      };
      outerPts[i] = {
        x: points[i].x + normals[i].nx * smoothB[i],
        y: points[i].y + normals[i].ny * smoothB[i],
      };
    }

    // Dedupe coincident neighbors (sampleBezierCurve emits duplicate
    // segment-junction points; closed paths repeat the start point at the
    // wrap). Preserve the corner mask alongside.
    const dedupedInner: { x: number; y: number }[] = [];
    const dedupedOuter: { x: number; y: number }[] = [];
    const dedupedCorner: boolean[] = [];
    const EPS = 1e-6;
    for (let i = 0; i < n; i++) {
      const lastInner = dedupedInner[dedupedInner.length - 1];
      if (
        !lastInner ||
        Math.abs(innerPts[i].x - lastInner.x) > EPS ||
        Math.abs(innerPts[i].y - lastInner.y) > EPS
      ) {
        dedupedInner.push(innerPts[i]);
        dedupedOuter.push(outerPts[i]);
        dedupedCorner.push(cornerMask ? !!cornerMask[i] : false);
      }
    }

    // For closed paths, drop a trailing duplicate of the first point so the
    // Catmull-Rom builder treats the seam via wrap neighbors.
    if (isClosed && dedupedInner.length > 1) {
      const first = dedupedInner[0];
      const last = dedupedInner[dedupedInner.length - 1];
      if (Math.abs(first.x - last.x) < EPS && Math.abs(first.y - last.y) < EPS) {
        dedupedInner.pop();
        dedupedOuter.pop();
        dedupedCorner.pop();
      }
    }

    const m = dedupedInner.length;
    if (m < 2) return '';

    const reversedOuter = dedupedOuter.slice().reverse();
    const reversedCorner = dedupedCorner.slice().reverse();

    if (isClosed) {
      const innerPath =
        `M ${dedupedInner[0].x} ${dedupedInner[0].y} ` +
        pointsToCentripetalPathString(dedupedInner, true, 0.5, dedupedCorner);
      const outerPath =
        `M ${reversedOuter[0].x} ${reversedOuter[0].y} ` +
        pointsToCentripetalPathString(reversedOuter, true, 0.5, reversedCorner);
      return `${innerPath} ${outerPath}`;
    }

    return (
      `M ${dedupedInner[0].x} ${dedupedInner[0].y} ` +
      pointsToCentripetalPathString(dedupedInner, false, 0.5, dedupedCorner) +
      ` L ${reversedOuter[0].x} ${reversedOuter[0].y} ` +
      pointsToCentripetalPathString(reversedOuter, false, 0.5, reversedCorner) +
      ' Z'
    );
  }

  // ---- Intracellular fill with polyline-side clipping ----

  /**
   * Clip a point to stay on the correct side of the center-line polyline.
   * Finds the nearest center-line segment and checks via cross product
   * whether the point is on the fill side. If on the wrong side, projects
   * the point back onto the nearest segment.
   *
   * This is the key to preventing intracellular fill from spilling across
   * the membrane at vesicle dips — unlike curvature clamping, this checks
   * against the GLOBAL center-line geometry, not just the local normal.
   *
   * fillSign: +1 = fill side is the +normal side (cross product > 0)
   *           -1 = fill side is the -normal side (cross product < 0)
   */
  private clipPointToFillSide(
    px: number, py: number,
    centerLine: { x: number; y: number }[],
    fillSign: number
  ): [number, number] {
    let bestDistSq = Infinity;
    let bestProjX = px;
    let bestProjY = py;
    let bestCross = 0;

    for (let j = 0; j < centerLine.length - 1; j++) {
      const ax = centerLine[j].x, ay = centerLine[j].y;
      const bx = centerLine[j + 1].x, by = centerLine[j + 1].y;
      const dx = bx - ax, dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      if (lenSq < 1e-12) continue;

      // Project point onto segment, clamped to [0, 1]
      let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
      t = Math.max(0, Math.min(1, t));

      const projX = ax + t * dx;
      const projY = ay + t * dy;
      const dSq = (px - projX) * (px - projX) + (py - projY) * (py - projY);

      if (dSq < bestDistSq) {
        bestDistSq = dSq;
        bestProjX = projX;
        bestProjY = projY;
        // Cross product of tangent × (point − projection)
        // Positive → point is on the +normal side of this segment
        bestCross = dx * (py - projY) - dy * (px - projX);
      }
    }

    // Point is on the wrong side when fillSign * bestCross < 0
    if (fillSign * bestCross < -0.01) {
      return [bestProjX, bestProjY];
    }
    return [px, py];
  }

  /**
   * Generate intracellular fill as strip quads with polyline-side clipping.
   * Every vertex is checked against the FULL center-line polyline to prevent
   * the fill from crossing to the wrong side at vesicle dips, where local
   * normals flip direction and curvature clamping is insufficient.
   */
  private generateIntracellularFillPathData(
    points: { x: number; y: number }[],
    normals: { nx: number; ny: number }[],
    innerOffset: number,
    outerOffset: number,
    side: 'left' | 'right'
  ): string {
    const fillSign = side === 'left' ? -1 : 1;
    const strips: string[] = [];

    for (let i = 0; i < points.length - 1; i++) {
      // Raw vertex positions from normal offsets
      const rax = points[i].x + normals[i].nx * innerOffset;
      const ray = points[i].y + normals[i].ny * innerOffset;
      const rbx = points[i + 1].x + normals[i + 1].nx * innerOffset;
      const rby = points[i + 1].y + normals[i + 1].ny * innerOffset;
      const rcx = points[i + 1].x + normals[i + 1].nx * outerOffset;
      const rcy = points[i + 1].y + normals[i + 1].ny * outerOffset;
      const rdx = points[i].x + normals[i].nx * outerOffset;
      const rdy = points[i].y + normals[i].ny * outerOffset;

      // Clip each vertex to stay on the correct side of the center line
      const [ax, ay] = this.clipPointToFillSide(rax, ray, points, fillSign);
      const [bx, by] = this.clipPointToFillSide(rbx, rby, points, fillSign);
      const [cx, cy] = this.clipPointToFillSide(rcx, rcy, points, fillSign);
      const [dx, dy] = this.clipPointToFillSide(rdx, rdy, points, fillSign);

      strips.push(`M ${ax} ${ay} L ${bx} ${by} L ${cx} ${cy} L ${dx} ${dy} Z`);
    }

    return strips.join(' ');
  }

  /**
   * Generate all band + optional intracellular Path objects.
   */
  generateBands(bezierPoints: BezierPoint[], isClosed?: boolean): FabricObject[] {
    const sampleResult = this.sampleBezierCurveWithCorners(bezierPoints, isClosed);
    const points = sampleResult.points;
    const cornerMask = sampleResult.isCorner;
    if (points.length < 2) return [];

    const rawNormals = this.computeNormals(points);
    const normals = this.smoothNormals(rawNormals, 7);
    const rawCurvatures = this.computeSignedCurvatures(points);
    const curvatures = this.smoothScalars(rawCurvatures, 7);
    const closed = !!isClosed;
    const closedFillRule = closed ? 'evenodd' : 'nonzero';

    const { bandWidth, bandGap, outerBandColor, middleBandColor, outerBandOpacity, middleBandOpacity } = this.options;
    const halfMiddle = bandWidth / 2;
    const outerStart = halfMiddle + bandGap;
    const outerEnd = outerStart + bandWidth;

    const objects: FabricObject[] = [];

    // Interior / intracellular fill (drawn first, behind bands)
    if (this.options.intracellular.enabled) {
      const { color, opacity } = this.options.intracellular;

      if (isClosed) {
        // Closed shape: smooth interior fill via centripetal Catmull-Rom.
        // Drop the trailing duplicate-of-start that sampleBezierCurve emits
        // for closed paths so the wrap neighbors are real points.
        const interiorPts = points.slice();
        const EPS = 1e-6;
        if (interiorPts.length > 1) {
          const first = interiorPts[0];
          const last = interiorPts[interiorPts.length - 1];
          if (Math.abs(first.x - last.x) < EPS && Math.abs(first.y - last.y) < EPS) {
            interiorPts.pop();
          }
        }
        const fillPath =
          `M ${interiorPts[0].x} ${interiorPts[0].y} ` +
          pointsToCentripetalPathString(interiorPts, true, 0.5, cornerMask);
        objects.push(new Path(fillPath, {
          fill: color,
          stroke: '',
          strokeWidth: 0,
          opacity: opacity,
          selectable: false,
          evented: false,
        }));
      } else {
        // Open path: directional fill with depth and side
        // Uses polyline-side clipping to prevent fill from crossing the membrane
        const { depth, side } = this.options.intracellular;
        const sign = side === 'left' ? -1 : 1;
        const innerEdge = sign * outerEnd;
        const outerEdge = sign * (outerEnd + depth);
        const icPathData = this.generateIntracellularFillPathData(points, normals, innerEdge, outerEdge, side);
        objects.push(new Path(icPathData, {
          fill: color,
          stroke: '',
          strokeWidth: 0,
          opacity: opacity,
          selectable: false,
          evented: false,
        }));
      }
    }

    // Outer band 1 (negative side)
    const outer1Data = this.generateStripFillPathData(points, normals, -outerEnd, -outerStart, curvatures, closed, cornerMask);
    objects.push(new Path(outer1Data, {
      fill: outerBandColor,
      stroke: '',
      strokeWidth: 0,
      opacity: outerBandOpacity,
      selectable: false,
      evented: false,
      fillRule: closedFillRule,
    }));

    // Middle band
    const middleData = this.generateStripFillPathData(points, normals, -halfMiddle, halfMiddle, curvatures, closed, cornerMask);
    objects.push(new Path(middleData, {
      fill: middleBandColor,
      stroke: '',
      strokeWidth: 0,
      opacity: middleBandOpacity,
      selectable: false,
      evented: false,
      fillRule: closedFillRule,
    }));

    // Outer band 2 (positive side)
    const outer2Data = this.generateStripFillPathData(points, normals, outerStart, outerEnd, curvatures, closed, cornerMask);
    objects.push(new Path(outer2Data, {
      fill: outerBandColor,
      stroke: '',
      strokeWidth: 0,
      opacity: outerBandOpacity,
      selectable: false,
      evented: false,
      fillRule: closedFillRule,
    }));

    return objects;
  }

  // ---- Static helpers (regenerate, rasterize) ----

  static async regenerate(
    canvas: FabricCanvas,
    oldMembrane: Group | FabricImage,
    newBezierPoints?: BezierPoint[],
    isClosedOverride?: boolean
  ): Promise<FabricImage> {
    const options: TripleMembraneOptions = (oldMembrane as any).tripleMembraneOptions;
    const isClosed = isClosedOverride !== undefined ? isClosedOverride : (oldMembrane as any).isClosed;
    const id = (oldMembrane as any).id;

    const bzPts = newBezierPoints || (() => {
      // Convert stored relative points back to world
      const relativePts = (oldMembrane as any).worldBezierPoints;
      if (!relativePts) return [];

      const isRasterized = (oldMembrane as any).isRasterizedMembrane;
      let transformMatrix: any;

      if (isRasterized) {
        const bounds = oldMembrane.getBoundingRect();
        const centerX = bounds.left + bounds.width / 2;
        const centerY = bounds.top + bounds.height / 2;
        // The rasterized image's scaleX = (1/2) * originalScaleX at creation.
        // When the user resizes, scaleX changes. To reconstruct world-space bezier
        // points at the new size, multiply current image scale by the rasterization
        // multiplier (2) to get the effective world-space scale.
        const scaleX = (oldMembrane.scaleX || 0.5) * 2;
        const scaleY = (oldMembrane.scaleY || 0.5) * 2;
        const angle = (oldMembrane as any).angle || 0;
        const cos = Math.cos(angle * Math.PI / 180);
        const sin = Math.sin(angle * Math.PI / 180);
        transformMatrix = [cos * scaleX, sin * scaleX, -sin * scaleY, cos * scaleY, centerX, centerY];
      } else {
        transformMatrix = oldMembrane.calcTransformMatrix();
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

    const tool = new TripleMembranePathTool(canvas, options);
    const bands = tool.generateBands(bzPts, isClosed);

    const newGroup = new Group(bands, {
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

    (newGroup as any).isTripleMembrane = true;
    (newGroup as any).tripleMembraneOptions = options;
    (newGroup as any).worldBezierPoints = relativeWorldBezierPoints;
    (newGroup as any).bezierPoints = relativeWorldBezierPoints;
    (newGroup as any).isClosed = isClosed;
    (newGroup as any).id = id;

    const origToObj = newGroup.toObject.bind(newGroup);
    (newGroup as any).toObject = function (propertiesToInclude?: string[]) {
      return origToObj([
        ...(propertiesToInclude || []),
        'isTripleMembrane', 'tripleMembraneOptions', 'bezierPoints',
        'worldBezierPoints', 'isClosed', 'id',
      ]);
    };

    const rasterized = await TripleMembranePathTool.rasterizeMembrane(newGroup);

    // Replace on canvas
    const wasOnCanvas = canvas.contains(oldMembrane);
    if (wasOnCanvas) {
      canvas.remove(oldMembrane);
      canvas.add(rasterized);
      canvas.setActiveObject(rasterized);
    }

    rasterized.setCoords();
    canvas.requestRenderAll();
    return rasterized;
  }

  static async rasterizeMembrane(membraneGroup: Group | FabricImage): Promise<FabricImage> {
    if ((membraneGroup as any).isRasterizedMembrane) {
      return membraneGroup as FabricImage;
    }

    const boundingRect = membraneGroup.getBoundingRect();
    const metadata = {
      isTripleMembrane: true,
      tripleMembraneOptions: (membraneGroup as any).tripleMembraneOptions,
      bezierPoints: (membraneGroup as any).bezierPoints,
      worldBezierPoints: (membraneGroup as any).worldBezierPoints,
      isClosed: (membraneGroup as any).isClosed,
      id: (membraneGroup as any).id,
      originalScaleX: membraneGroup.scaleX || 1,
      originalScaleY: membraneGroup.scaleY || 1,
    };

    const multiplier = 2;
    const dataURL = membraneGroup.toDataURL({ format: 'png', quality: 1, multiplier });
    const image = await FabricImage.fromURL(dataURL, { crossOrigin: 'anonymous' });

    const scale = 1 / multiplier;
    image.set({
      left: boundingRect.left + boundingRect.width / 2,
      top: boundingRect.top + boundingRect.height / 2,
      originX: 'center',
      originY: 'center',
      scaleX: scale * (membraneGroup.scaleX || 1),
      scaleY: scale * (membraneGroup.scaleY || 1),
      angle: membraneGroup.angle || 0,
      selectable: true,
      evented: true,
    });

    Object.assign(image, metadata);
    (image as any).isRasterizedMembrane = true;

    const originalToObject = image.toObject.bind(image);
    (image as any).toObject = function (this: any, propertiesToInclude?: string[]) {
      const result = originalToObject([
        ...(propertiesToInclude || []),
        'isTripleMembrane', 'tripleMembraneOptions', 'bezierPoints',
        'worldBezierPoints', 'isClosed', 'id',
        'originalScaleX', 'originalScaleY', 'isRasterizedMembrane',
      ]);
      // When inside a user group, keep the real image src so it survives
      // deserialization (regeneration doesn't work reliably for nested objects).
      // For top-level membranes, use a placeholder to reduce save size —
      // the image is regenerated from worldBezierPoints in runPostLoadGlobalSteps.
      const isInsideUserGroup = this.group && !(this.group as any).isTripleMembrane && !(this.group as any).isMembraneShape;
      if (!isInsideUserGroup) {
        result.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRElEQkSuQmCC';
      }
      return result;
    };

    return image;
  }

  // ---- Shape generation helpers ----

  static computeBezierBounds(
    membrane: Group | FabricImage
  ): { cx: number; cy: number; width: number; height: number } {
    const relativePts = (membrane as any).worldBezierPoints as BezierPoint[];
    if (!relativePts || relativePts.length === 0) {
      const bounds = membrane.getBoundingRect();
      return {
        cx: bounds.left + bounds.width / 2,
        cy: bounds.top + bounds.height / 2,
        width: bounds.width || 100,
        height: bounds.height || 100,
      };
    }

    let transformMatrix: number[];
    if ((membrane as any).isRasterizedMembrane) {
      const bounds = membrane.getBoundingRect();
      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;
      const scaleX = (membrane.scaleX || 0.5) * 2;
      const scaleY = (membrane.scaleY || 0.5) * 2;
      const angle = (membrane as any).angle || 0;
      const cos = Math.cos(angle * Math.PI / 180);
      const sin = Math.sin(angle * Math.PI / 180);
      transformMatrix = [cos * scaleX, sin * scaleX, -sin * scaleY, cos * scaleY, centerX, centerY];
    } else {
      transformMatrix = membrane.calcTransformMatrix();
    }

    const worldPts = relativePts.map(p =>
      util.transformPoint({ x: p.x, y: p.y }, transformMatrix)
    );

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const p of worldPts) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    return {
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
      width: maxX - minX || 100,
      height: maxY - minY || 100,
    };
  }

  static generateCirclePoints(cx: number, cy: number, radius: number): BezierPoint[] {
    const K = 0.5522847498 * radius;
    return [
      {
        x: cx + radius, y: cy, type: 'smooth', id: uuidv4(),
        controlPoint1: { x: cx + radius, y: cy - K },
        controlPoint2: { x: cx + radius, y: cy + K },
      },
      {
        x: cx, y: cy + radius, type: 'smooth', id: uuidv4(),
        controlPoint1: { x: cx + K, y: cy + radius },
        controlPoint2: { x: cx - K, y: cy + radius },
      },
      {
        x: cx - radius, y: cy, type: 'smooth', id: uuidv4(),
        controlPoint1: { x: cx - radius, y: cy + K },
        controlPoint2: { x: cx - radius, y: cy - K },
      },
      {
        x: cx, y: cy - radius, type: 'smooth', id: uuidv4(),
        controlPoint1: { x: cx - K, y: cy - radius },
        controlPoint2: { x: cx + K, y: cy - radius },
      },
    ];
  }

  static generateEllipsePoints(cx: number, cy: number, rx: number, ry: number): BezierPoint[] {
    const kx = 0.5522847498 * rx;
    const ky = 0.5522847498 * ry;
    return [
      {
        x: cx + rx, y: cy, type: 'smooth', id: uuidv4(),
        controlPoint1: { x: cx + rx, y: cy - ky },
        controlPoint2: { x: cx + rx, y: cy + ky },
      },
      {
        x: cx, y: cy + ry, type: 'smooth', id: uuidv4(),
        controlPoint1: { x: cx + kx, y: cy + ry },
        controlPoint2: { x: cx - kx, y: cy + ry },
      },
      {
        x: cx - rx, y: cy, type: 'smooth', id: uuidv4(),
        controlPoint1: { x: cx - rx, y: cy + ky },
        controlPoint2: { x: cx - rx, y: cy - ky },
      },
      {
        x: cx, y: cy - ry, type: 'smooth', id: uuidv4(),
        controlPoint1: { x: cx - kx, y: cy - ry },
        controlPoint2: { x: cx + kx, y: cy - ry },
      },
    ];
  }

  static generateRoundedRectPoints(
    cx: number, cy: number,
    width: number, height: number,
    cornerRadius: number
  ): BezierPoint[] {
    const hw = width / 2;
    const hh = height / 2;
    const r = Math.min(cornerRadius, hw, hh);
    const k = 0.5522847498 * r;

    return [
      // Top edge → top-right corner start
      {
        x: cx + hw - r, y: cy - hh, type: 'smooth', id: uuidv4(),
        controlPoint2: { x: cx + hw - r + k, y: cy - hh },
      },
      // Top-right corner end → right edge
      {
        x: cx + hw, y: cy - hh + r, type: 'smooth', id: uuidv4(),
        controlPoint1: { x: cx + hw, y: cy - hh + r - k },
      },
      // Right edge → bottom-right corner start
      {
        x: cx + hw, y: cy + hh - r, type: 'smooth', id: uuidv4(),
        controlPoint2: { x: cx + hw, y: cy + hh - r + k },
      },
      // Bottom-right corner end → bottom edge
      {
        x: cx + hw - r, y: cy + hh, type: 'smooth', id: uuidv4(),
        controlPoint1: { x: cx + hw - r + k, y: cy + hh },
      },
      // Bottom edge → bottom-left corner start
      {
        x: cx - hw + r, y: cy + hh, type: 'smooth', id: uuidv4(),
        controlPoint2: { x: cx - hw + r - k, y: cy + hh },
      },
      // Bottom-left corner end → left edge
      {
        x: cx - hw, y: cy + hh - r, type: 'smooth', id: uuidv4(),
        controlPoint1: { x: cx - hw, y: cy + hh - r + k },
      },
      // Left edge → top-left corner start
      {
        x: cx - hw, y: cy - hh + r, type: 'smooth', id: uuidv4(),
        controlPoint2: { x: cx - hw, y: cy - hh + r - k },
      },
      // Top-left corner end → top edge
      {
        x: cx - hw + r, y: cy - hh, type: 'smooth', id: uuidv4(),
        controlPoint1: { x: cx - hw + r - k, y: cy - hh },
      },
    ];
  }

  /**
   * Closed-shape preset: axon terminal with synaptic bouton, club style.
   * A straight thin shaft widens through a horizontal-tangent taper into a
   * kappa-correct circular bouton — no S-flare, every anchor at a tangent
   * match. 7 anchors: top-cap corner, top shaft elbow, north pole, far tip,
   * south pole, bottom shaft elbow, bottom-cap corner. The closing segment
   * P6 → P0 is the flat axon end-cap (vertical line via degenerate cap
   * handles).
   */
  static generateNeuronSynapsePoints(
    cx: number,
    cy: number,
    axonLength: number = 110,
    axonWidth: number = 14,
    boutonRadius: number = 26,
    taperLength: number = 40,
    orientation: 'horizontal' | 'vertical' = 'horizontal'
  ): BezierPoint[] {
    const aw = Math.max(axonWidth, 4);
    const br = Math.max(boutonRadius, aw / 2 + 4);
    const aL = Math.max(axonLength, 20);
    const tL = Math.max(taperLength, br * 0.6);

    const hw = aw / 2;
    const Kb = 0.5522847498 * br;
    const Kt = tL * 0.55;

    const totalLen = aL + tL + br;
    const xOpen = cx - totalLen / 2;
    const xTaper = xOpen + aL;
    const xEquator = xTaper + tL;
    const xTip = xEquator + br;

    const apply = orientation === 'vertical'
      ? (p: { x: number; y: number }) => ({ x: cx + (p.y - cy), y: cy - (p.x - cx) })
      : (p: { x: number; y: number }) => p;

    const mk = (
      x: number, y: number,
      type: 'corner' | 'smooth',
      cp1?: { x: number; y: number },
      cp2?: { x: number; y: number }
    ): BezierPoint => {
      const out: BezierPoint = {
        ...apply({ x, y }),
        type,
        id: uuidv4(),
      };
      if (cp1) out.controlPoint1 = apply(cp1);
      if (cp2) out.controlPoint2 = apply(cp2);
      return out;
    };

    return [
      // P0 — top-left of flat cap (axon open end, top)
      mk(
        xOpen, cy - hw, 'corner',
        undefined,
        { x: xOpen + aL * 0.4, y: cy - hw }
      ),
      // P1 — top shaft → taper elbow
      mk(
        xTaper, cy - hw, 'smooth',
        { x: xTaper - aL * 0.4, y: cy - hw },
        { x: xTaper + Kt,       y: cy - hw }
      ),
      // P2 — bouton north pole (taper lands tangent-horizontal here)
      mk(
        xEquator, cy - br, 'smooth',
        { x: xEquator - Kt, y: cy - br },
        { x: xEquator + Kb, y: cy - br }
      ),
      // P3 — bouton east (far tip)
      mk(
        xTip, cy, 'smooth',
        { x: xTip, y: cy - Kb },
        { x: xTip, y: cy + Kb }
      ),
      // P4 — bouton south pole
      mk(
        xEquator, cy + br, 'smooth',
        { x: xEquator + Kb, y: cy + br },
        { x: xEquator - Kt, y: cy + br }
      ),
      // P5 — bottom taper → shaft elbow
      mk(
        xTaper, cy + hw, 'smooth',
        { x: xTaper + Kt,       y: cy + hw },
        { x: xTaper - aL * 0.4, y: cy + hw }
      ),
      // P6 — bottom-left of flat cap (axon open end, bottom)
      mk(
        xOpen, cy + hw, 'corner',
        { x: xOpen + aL * 0.4, y: cy + hw },
        undefined
      ),
    ];
  }

  /**
   * Extract the first and last world-space bezier anchor points from a membrane.
   */
  static getWorldEndpoints(
    membrane: Group | FabricImage
  ): { start: { x: number; y: number }; end: { x: number; y: number } } | null {
    const relativePts = (membrane as any).worldBezierPoints as BezierPoint[];
    if (!relativePts || relativePts.length < 2) return null;

    let transformMatrix: number[];
    if ((membrane as any).isRasterizedMembrane) {
      const bounds = membrane.getBoundingRect();
      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;
      const scaleX = (membrane.scaleX || 0.5) * 2;
      const scaleY = (membrane.scaleY || 0.5) * 2;
      const angle = (membrane as any).angle || 0;
      const cos = Math.cos(angle * Math.PI / 180);
      const sin = Math.sin(angle * Math.PI / 180);
      transformMatrix = [cos * scaleX, sin * scaleX, -sin * scaleY, cos * scaleY, centerX, centerY];
    } else {
      transformMatrix = membrane.calcTransformMatrix();
    }

    const first = relativePts[0];
    const last = relativePts[relativePts.length - 1];
    const start = util.transformPoint({ x: first.x, y: first.y }, transformMatrix);
    const end = util.transformPoint({ x: last.x, y: last.y }, transformMatrix);

    return { start, end };
  }

  /**
   * Generate a straight line between two points as 2 BezierPoints with no control handles.
   */
  static generateStraightLinePoints(
    start: { x: number; y: number },
    end: { x: number; y: number }
  ): BezierPoint[] {
    return [
      { x: start.x, y: start.y, type: 'corner', id: uuidv4() },
      { x: end.x, y: end.y, type: 'corner', id: uuidv4() },
    ];
  }

  /**
   * Generate a true circular arc between two endpoints.
   * Computes the circle passing through both points with a given sagitta (arc height),
   * then splits the arc into ≤90° bezier segments using the exact kappa formula
   * so the result is geometrically identical to a section of a circle.
   */
  static generateArcPoints(
    start: { x: number; y: number },
    end: { x: number; y: number },
    arcHeight?: number
  ): BezierPoint[] {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const chordLen = Math.sqrt(dx * dx + dy * dy);
    if (chordLen < 1e-6) {
      return [
        { x: start.x, y: start.y, type: 'corner', id: uuidv4() },
        { x: end.x, y: end.y, type: 'corner', id: uuidv4() },
      ];
    }

    // Sagitta (height of arc above chord midpoint)
    const h = arcHeight ?? chordLen / 3;

    // Chord unit vector and perpendicular (pointing toward arc bulge)
    const ux = dx / chordLen;
    const uy = dy / chordLen;
    const nx = -uy; // perpendicular, 90° CCW
    const ny = ux;

    // Circle radius from chord and sagitta: R = h/2 + L²/(8h)
    const halfChord = chordLen / 2;
    const R = h / 2 + (halfChord * halfChord) / (2 * h);

    // Circle center: from chord midpoint, offset toward center of curvature
    // Center is at distance (R - h) from midpoint, opposite the bulge direction
    const mx = (start.x + end.x) / 2;
    const my = (start.y + end.y) / 2;
    const centerDist = R - h; // distance from midpoint to center (negative if arc > semicircle)
    const cx = mx - nx * centerDist;
    const cy = my - ny * centerDist;

    // Angles of start and end relative to circle center
    const startAngle = Math.atan2(start.y - cy, start.x - cx);
    let endAngle = Math.atan2(end.y - cy, end.x - cx);

    // Ensure we sweep in the correct direction (toward the bulge side)
    let sweep = endAngle - startAngle;
    // Normalize sweep to the arc on the bulge side
    // The bulge is on the +normal side, so we want the arc that goes "the short way"
    // when h < R (less than semicircle), or "the long way" when h > R
    if (sweep > Math.PI) sweep -= 2 * Math.PI;
    if (sweep < -Math.PI) sweep += 2 * Math.PI;

    // Split the arc into segments of at most 90° each
    const segCount = Math.max(1, Math.ceil(Math.abs(sweep) / (Math.PI / 2)));
    const segAngle = sweep / segCount;

    // Kappa for a circular arc of angle θ: (4/3) * tan(θ/4)
    const kappa = (4 / 3) * Math.tan(segAngle / 4);

    const points: BezierPoint[] = [];

    for (let i = 0; i <= segCount; i++) {
      const angle = startAngle + i * segAngle;
      const px = cx + R * Math.cos(angle);
      const py = cy + R * Math.sin(angle);

      // Tangent direction at this point on the circle (perpendicular to radius, in sweep direction)
      const tx = -Math.sin(angle) * (sweep > 0 ? 1 : -1);
      const ty = Math.cos(angle) * (sweep > 0 ? 1 : -1);

      const handleLen = R * Math.abs(kappa);

      const point: BezierPoint = {
        x: px,
        y: py,
        type: 'smooth',
        id: uuidv4(),
      };

      // controlPoint1 = incoming handle (from previous segment)
      if (i > 0) {
        point.controlPoint1 = {
          x: px - tx * handleLen,
          y: py - ty * handleLen,
        };
      }

      // controlPoint2 = outgoing handle (to next segment)
      if (i < segCount) {
        point.controlPoint2 = {
          x: px + tx * handleLen,
          y: py + ty * handleLen,
        };
      }

      points.push(point);
    }

    return points;
  }
}
