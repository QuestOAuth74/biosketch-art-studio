import { Canvas, Path, FabricObject, util, Point as FabricPoint } from "fabric";
import { BezierPoint } from "@/types/bezier";
import { v4 as uuidv4 } from 'uuid';

// Kappa constant for approximating a quarter circle with a cubic bezier
const KAPPA = 4 * (Math.sqrt(2) - 1) / 3; // ~0.5522847498

/**
 * Check if an object is a basic shape that can be converted to an editable bezier path.
 */
export function isEditableShape(obj: any): boolean {
  const type = obj.type;
  if (type !== 'rect' && type !== 'circle' && type !== 'ellipse' && type !== 'polygon' && type !== 'triangle') return false;
  // Exclude objects that have their own specialized edit modes
  if (obj.isBezierPath || obj.isMembraneShape || obj.isRasterizedMembrane ||
      obj.isTripleMembrane || obj.isDNAHelix || obj.isImagePlaceholder ||
      obj.isCurvedLine || obj.isStraightLine || obj.isOrthogonalLine ||
      obj.isAnchorHandle || obj.isControlHandle || obj.isGuideLine ||
      obj.isGridLine || obj.isRuler || obj.isTableCell || obj.isLegendLabel ||
      obj.excludeFromExport || obj.isEndpointMarker || obj.isPortIndicator) return false;
  // Don't convert shapes that are children of a group
  if (obj.group) return false;
  return true;
}

/**
 * Convert a generic shape to a bezier Path with anchor points.
 * Returns the new Path (already added to canvas) or null if conversion failed.
 * The original shape is removed from canvas.
 */
export function convertShapeToBezierPath(shape: FabricObject, canvas: Canvas): Path | null {
  const type = shape.type;
  let worldPoints: BezierPoint[];

  try {
    if (type === 'rect') {
      worldPoints = rectToBezierPoints(shape);
    } else if (type === 'circle' || type === 'ellipse') {
      worldPoints = ellipseToBezierPoints(shape);
    } else if (type === 'polygon' || type === 'triangle') {
      worldPoints = polygonToBezierPoints(shape);
    } else {
      return null;
    }
  } catch (err) {
    console.warn('[shapeToBezierPath] Conversion failed:', err);
    return null;
  }

  if (worldPoints.length < 2) return null;

  // Build SVG path string from world-coordinate bezier points (closed path)
  const pathString = buildClosedPathString(worldPoints);

  // Create the Path
  const path = new Path(pathString, {
    fill: shape.fill as string || 'transparent',
    stroke: shape.stroke as string || '#000000',
    strokeWidth: shape.strokeWidth || 1,
    strokeDashArray: shape.strokeDashArray || undefined,
    strokeLineCap: shape.strokeLineCap || 'round',
    strokeLineJoin: shape.strokeLineJoin || 'round',
    strokeUniform: true,
    opacity: shape.opacity ?? 1,
    shadow: shape.shadow || undefined,
    selectable: true,
    evented: true,
  });

  // Attach bezier metadata
  (path as any).isBezierPath = true;
  (path as any).bezierPoints = worldPoints;
  (path as any).bezierPointsAreLocal = false;
  (path as any).isClosed = true;
  (path as any).id = uuidv4();

  // Override toObject to include custom properties in serialization
  const originalToObject = path.toObject.bind(path);
  (path as any).toObject = function(propertiesToInclude?: string[]) {
    return originalToObject([
      ...(propertiesToInclude || []),
      'bezierPoints',
      'bezierPointsAreLocal',
      'isBezierPath',
      'isClosed',
      'id',
    ]);
  };

  // Replace shape with path on canvas
  canvas.remove(shape);
  canvas.add(path);
  canvas.setActiveObject(path);

  return path;
}

/**
 * Convert a Rect to bezier points in world coordinates.
 * Handles rounded corners (rx/ry) by generating curve points at corners.
 */
function rectToBezierPoints(shape: FabricObject): BezierPoint[] {
  const s = shape as any;
  // Use raw dimensions — calcTransformMatrix() already includes scaleX/scaleY
  const w = s.width || 0;
  const h = s.height || 0;
  let rx = Math.min(s.rx || 0, w / 2);
  let ry = Math.min(s.ry || 0, h / 2);

  if (w === 0 || h === 0) return [];

  const matrix = shape.calcTransformMatrix();

  // Helper to transform local point (relative to center) to world coords
  const toWorld = (lx: number, ly: number) => {
    const wp = util.transformPoint(new FabricPoint(lx, ly), matrix);
    return { x: wp.x, y: wp.y };
  };

  // Local coordinates relative to center
  const left = -w / 2;
  const top = -h / 2;
  const right = w / 2;
  const bottom = h / 2;

  if (rx <= 0.5 && ry <= 0.5) {
    // No rounding — simple 4-corner rectangle
    const tl = toWorld(left, top);
    const tr = toWorld(right, top);
    const br = toWorld(right, bottom);
    const bl = toWorld(left, bottom);

    return [
      { x: tl.x, y: tl.y, type: 'corner', id: uuidv4() },
      { x: tr.x, y: tr.y, type: 'corner', id: uuidv4() },
      { x: br.x, y: br.y, type: 'corner', id: uuidv4() },
      { x: bl.x, y: bl.y, type: 'corner', id: uuidv4() },
    ];
  }

  // Rounded rectangle — 8 points (2 per corner with control handles)
  const kx = KAPPA * rx;
  const ky = KAPPA * ry;
  const points: BezierPoint[] = [];

  // Top-left corner: start on top edge, end on left edge
  const tlA = toWorld(left + rx, top);       // start of TL arc (on top edge)
  const tlAcp = toWorld(left + rx - kx, top); // control toward corner
  const tlB = toWorld(left, top + ry);       // end of TL arc (on left edge)
  const tlBcp = toWorld(left, top + ry - ky); // control toward corner

  // Top-right corner
  const trA = toWorld(right - rx, top);
  const trAcp = toWorld(right - rx + kx, top);
  const trB = toWorld(right, top + ry);
  const trBcp = toWorld(right, top + ry - ky);

  // Bottom-right corner
  const brA = toWorld(right, bottom - ry);
  const brAcp = toWorld(right, bottom - ry + ky);
  const brB = toWorld(right - rx, bottom);
  const brBcp = toWorld(right - rx + kx, bottom);

  // Bottom-left corner
  const blA = toWorld(left + rx, bottom);
  const blAcp = toWorld(left + rx - kx, bottom);
  const blB = toWorld(left, bottom - ry);
  const blBcp = toWorld(left, bottom - ry + ky);

  // Build points: go clockwise from top-left
  // Top edge start (TL arc endpoint)
  points.push({
    x: tlA.x, y: tlA.y, type: 'smooth', id: uuidv4(),
    controlPoint1: { x: tlAcp.x, y: tlAcp.y }, // incoming from arc
    controlPoint2: { x: tlA.x + (trA.x - tlA.x) * 0.01, y: tlA.y + (trA.y - tlA.y) * 0.01 }, // outgoing along top edge
  });

  // Top-right: start of TR arc
  points.push({
    x: trA.x, y: trA.y, type: 'smooth', id: uuidv4(),
    controlPoint1: { x: trA.x - (trA.x - tlA.x) * 0.01, y: trA.y - (trA.y - tlA.y) * 0.01 },
    controlPoint2: { x: trAcp.x, y: trAcp.y },
  });

  // Top-right: end of TR arc (right edge)
  points.push({
    x: trB.x, y: trB.y, type: 'smooth', id: uuidv4(),
    controlPoint1: { x: trBcp.x, y: trBcp.y },
    controlPoint2: { x: trB.x + (brA.x - trB.x) * 0.01, y: trB.y + (brA.y - trB.y) * 0.01 },
  });

  // Bottom-right: start of BR arc
  points.push({
    x: brA.x, y: brA.y, type: 'smooth', id: uuidv4(),
    controlPoint1: { x: brA.x - (brA.x - trB.x) * 0.01, y: brA.y - (brA.y - trB.y) * 0.01 },
    controlPoint2: { x: brAcp.x, y: brAcp.y },
  });

  // Bottom-right: end of BR arc (bottom edge)
  points.push({
    x: brB.x, y: brB.y, type: 'smooth', id: uuidv4(),
    controlPoint1: { x: brBcp.x, y: brBcp.y },
    controlPoint2: { x: brB.x + (blA.x - brB.x) * 0.01, y: brB.y + (blA.y - brB.y) * 0.01 },
  });

  // Bottom-left: start of BL arc
  points.push({
    x: blA.x, y: blA.y, type: 'smooth', id: uuidv4(),
    controlPoint1: { x: blA.x - (blA.x - brB.x) * 0.01, y: blA.y - (blA.y - brB.y) * 0.01 },
    controlPoint2: { x: blAcp.x, y: blAcp.y },
  });

  // Bottom-left: end of BL arc (left edge)
  points.push({
    x: blB.x, y: blB.y, type: 'smooth', id: uuidv4(),
    controlPoint1: { x: blBcp.x, y: blBcp.y },
    controlPoint2: { x: blB.x + (tlB.x - blB.x) * 0.01, y: blB.y + (tlB.y - blB.y) * 0.01 },
  });

  // Top-left: start of TL arc (left edge going up)
  points.push({
    x: tlB.x, y: tlB.y, type: 'smooth', id: uuidv4(),
    controlPoint1: { x: tlB.x - (tlB.x - blB.x) * 0.01, y: tlB.y - (tlB.y - blB.y) * 0.01 },
    controlPoint2: { x: tlBcp.x, y: tlBcp.y },
  });

  return points;
}

/**
 * Convert a Circle or Ellipse to bezier points in world coordinates.
 * Uses 4 cardinal anchor points with bezier control handles.
 */
function ellipseToBezierPoints(shape: FabricObject): BezierPoint[] {
  const s = shape as any;

  // Get radii — use raw values; calcTransformMatrix() already includes scale
  let rx: number, ry: number;
  if (s.type === 'ellipse') {
    rx = s.rx || 0;
    ry = s.ry || 0;
  } else {
    // Circle
    const r = s.radius || 0;
    rx = r;
    ry = r;
  }

  if (rx === 0 || ry === 0) return [];

  const matrix = shape.calcTransformMatrix();

  const toWorld = (lx: number, ly: number) => {
    const wp = util.transformPoint(new FabricPoint(lx, ly), matrix);
    return { x: wp.x, y: wp.y };
  };

  // Kappa offsets
  const kx = KAPPA * rx;
  const ky = KAPPA * ry;

  // 4 cardinal points in local coords (relative to center)
  // Top, Right, Bottom, Left — going clockwise
  const top = toWorld(0, -ry);
  const topCpL = toWorld(-kx, -ry); // left control of top point
  const topCpR = toWorld(kx, -ry);  // right control of top point

  const right = toWorld(rx, 0);
  const rightCpU = toWorld(rx, -ky);
  const rightCpD = toWorld(rx, ky);

  const bottom = toWorld(0, ry);
  const bottomCpR = toWorld(kx, ry);
  const bottomCpL = toWorld(-kx, ry);

  const left = toWorld(-rx, 0);
  const leftCpD = toWorld(-rx, ky);
  const leftCpU = toWorld(-rx, -ky);

  return [
    {
      x: top.x, y: top.y, type: 'smooth', id: uuidv4(),
      controlPoint1: { x: topCpL.x, y: topCpL.y },  // incoming from left arc
      controlPoint2: { x: topCpR.x, y: topCpR.y },   // outgoing to right arc
    },
    {
      x: right.x, y: right.y, type: 'smooth', id: uuidv4(),
      controlPoint1: { x: rightCpU.x, y: rightCpU.y },
      controlPoint2: { x: rightCpD.x, y: rightCpD.y },
    },
    {
      x: bottom.x, y: bottom.y, type: 'smooth', id: uuidv4(),
      controlPoint1: { x: bottomCpR.x, y: bottomCpR.y },
      controlPoint2: { x: bottomCpL.x, y: bottomCpL.y },
    },
    {
      x: left.x, y: left.y, type: 'smooth', id: uuidv4(),
      controlPoint1: { x: leftCpD.x, y: leftCpD.y },
      controlPoint2: { x: leftCpU.x, y: leftCpU.y },
    },
  ];
}

/**
 * Convert a Polygon or Triangle to bezier points in world coordinates.
 * Each vertex becomes a corner anchor with no control handles.
 */
function polygonToBezierPoints(shape: FabricObject): BezierPoint[] {
  const s = shape as any;
  const vertices = s.points as Array<{ x: number; y: number }>;
  if (!vertices || vertices.length < 3) return [];

  const matrix = shape.calcTransformMatrix();
  const pathOffset = s.pathOffset || { x: 0, y: 0 };

  return vertices.map(v => {
    // Transform vertex from local (relative to pathOffset) to world coordinates
    const local = new FabricPoint(v.x - pathOffset.x, v.y - pathOffset.y);
    const world = util.transformPoint(local, matrix);
    return {
      x: world.x,
      y: world.y,
      type: 'corner' as const,
      id: uuidv4(),
    };
  });
}

/**
 * Build an SVG closed path string from bezier points.
 * For corner points (no control handles), uses straight cubic bezier segments
 * where control points are at the anchor positions.
 */
function buildClosedPathString(points: BezierPoint[]): string {
  if (points.length < 2) return '';

  const parts: string[] = [];
  parts.push(`M ${points[0].x} ${points[0].y}`);

  for (let i = 0; i < points.length; i++) {
    const curr = points[i];
    const next = points[(i + 1) % points.length];

    // Outgoing control of current point
    const cp1x = curr.controlPoint2?.x ?? curr.x;
    const cp1y = curr.controlPoint2?.y ?? curr.y;

    // Incoming control of next point
    const cp2x = next.controlPoint1?.x ?? next.x;
    const cp2y = next.controlPoint1?.y ?? next.y;

    parts.push(`C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${next.x} ${next.y}`);
  }

  parts.push('Z');
  return parts.join(' ');
}
