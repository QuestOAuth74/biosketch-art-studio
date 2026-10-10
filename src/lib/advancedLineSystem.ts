import { Path, Circle, Line, Canvas as FabricCanvas, Point, FabricObject } from "fabric";
import { ArrowMarkerType } from "@/types/connector";

// Enhanced arrow marker using SVG path (draw.io style)
export function createSVGArrowMarker(
  x: number,
  y: number,
  angle: number,
  markerType: ArrowMarkerType,
  color: string,
  size: number = 12
): Path | null {
  if (markerType === 'none') return null;

  let pathData = '';
  
  switch (markerType) {
    case 'arrow':
      // Classic arrow (draw.io style)
      pathData = `M ${x} ${y} L ${x - size} ${y - size/2} L ${x - size * 0.7} ${y} L ${x - size} ${y + size/2} Z`;
      break;
    case 'open-arrow':
      // Open arrow (V shape)
      pathData = `M ${x - size} ${y - size/2} L ${x} ${y} L ${x - size} ${y + size/2}`;
      break;
    case 'diamond':
      // Diamond (UML association)
      pathData = `M ${x} ${y} L ${x - size/2} ${y - size/2} L ${x - size} ${y} L ${x - size/2} ${y + size/2} Z`;
      break;
    case 'circle':
      // Circle marker
      const cx = x - size/2;
      const r = size/2;
      pathData = `M ${cx - r} ${y} A ${r} ${r} 0 1 1 ${cx + r} ${y} A ${r} ${r} 0 1 1 ${cx - r} ${y} Z`;
      break;
    case 'block':
      // Block arrow (filled rectangle)
      pathData = `M ${x} ${y - size/2} L ${x - size} ${y - size/2} L ${x - size} ${y + size/2} L ${x} ${y + size/2} Z`;
      break;
  }

  const marker = new Path(pathData, {
    fill: markerType === 'open-arrow' ? 'transparent' : color,
    stroke: color,
    strokeWidth: 2,
    angle: angle,
    originX: 'center',
    originY: 'center',
    selectable: false,
    evented: false,
    strokeUniform: true,
  } as any);

  return marker;
}

// Waypoint system for editing lines
export interface Waypoint {
  id: string;
  x: number;
  y: number;
  isControl: boolean; // true for bezier control points
}

// Create draggable waypoint handles
export function createWaypointHandles(
  canvas: FabricCanvas,
  waypoints: Waypoint[],
  onWaypointMove: (waypointId: string, x: number, y: number) => void
): Circle[] {
  const handles: Circle[] = [];

  waypoints.forEach((wp, index) => {
    const handle = new Circle({
      left: wp.x,
      top: wp.y,
      radius: wp.isControl ? 4 : 6,
      fill: wp.isControl ? '#ffffff' : '#0D9488',
      stroke: '#0D9488',
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
      selectable: true,
      evented: true,
      hasControls: false,
      hasBorders: false,
      hoverCursor: 'move',
    } as any);

    // Store waypoint id for reference
    (handle as any).waypointId = wp.id;
    (handle as any).isWaypointHandle = true;

    // Handle dragging
    handle.on('moving', (e: any) => {
      const obj = e.target;
      onWaypointMove((obj as any).waypointId, obj.left || 0, obj.top || 0);
    });

    canvas.add(handle);
    handles.push(handle);
  });

  return handles;
}

// Calculate smooth bezier curve through waypoints (draw.io smooth connector)
export function calculateSmoothCurve(points: Point[], tension: number = 0.4): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];

    // Calculate control points using Catmull-Rom to Bezier conversion
    const cp1x = p1.x + (p2.x - p0.x) / 6 * tension;
    const cp1y = p1.y + (p2.y - p0.y) / 6 * tension;
    const cp2x = p2.x - (p3.x - p1.x) / 6 * tension;
    const cp2y = p2.y - (p3.y - p1.y) / 6 * tension;

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  return path;
}

// Add middle handle to line for reshaping (like draw.io)
export function addLineMiddleHandle(
  canvas: FabricCanvas,
  line: FabricObject,
  onAddWaypoint: (x: number, y: number) => void
): Circle | null {
  if (!(line instanceof Path) && !(line instanceof Line)) return null;

  let midX = 0, midY = 0;

  if (line instanceof Line) {
    midX = ((line.x1 || 0) + (line.x2 || 0)) / 2 + (line.left || 0);
    midY = ((line.y1 || 0) + (line.y2 || 0)) / 2 + (line.top || 0);
  } else {
    // For paths, calculate approximate middle
    const pathData = (line as Path).path;
    if (pathData && pathData.length > 0) {
      const firstPoint = pathData[0];
      const lastPoint = pathData[pathData.length - 1];
      if (firstPoint && lastPoint) {
        midX = ((firstPoint[1] as number) + (lastPoint[lastPoint.length - 2] as number)) / 2;
        midY = ((firstPoint[2] as number) + (lastPoint[lastPoint.length - 1] as number)) / 2;
      }
    }
  }

  const middleHandle = new Circle({
    left: midX,
    top: midY,
    radius: 5,
    fill: '#ffffff',
    stroke: '#0D9488',
    strokeWidth: 2,
    strokeDashArray: [3, 3],
    originX: 'center',
    originY: 'center',
    opacity: 0.7,
    selectable: true,
    evented: true,
    hasControls: false,
    hasBorders: false,
    hoverCursor: 'copy',
  } as any);

  (middleHandle as any).isMiddleHandle = true;

  // On click/drag, add waypoint
  middleHandle.on('mousedown', (e: any) => {
    onAddWaypoint(middleHandle.left || 0, middleHandle.top || 0);
    canvas.remove(middleHandle);
  });

  canvas.add(middleHandle);
  return middleHandle;
}

// Calculate arc path for curved connectors (draw.io arc style)
export function calculateArcPath(
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  curvature: number = 20
): string {
  const dx = endX - startX;
  const dy = endY - startY;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Calculate arc parameters
  const curve = Math.min(curvature, distance / 2);
  const midX = (startX + endX) / 2;
  const midY = (startY + endY) / 2;
  
  // Perpendicular offset
  const perpX = -dy / distance * curve;
  const perpY = dx / distance * curve;
  
  const controlX = midX + perpX;
  const controlY = midY + perpY;
  
  return `M ${startX} ${startY} Q ${controlX} ${controlY}, ${endX} ${endY}`;
}

// Snap to grid helper (draw.io style snapping)
export function snapToGrid(value: number, gridSize: number = 10): number {
  return Math.round(value / gridSize) * gridSize;
}

// Calculate angle between two points
export function calculateAngle(x1: number, y1: number, x2: number, y2: number): number {
  return Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
}

// Check if line intersects with shape (for smart routing)
export function lineIntersectsShape(
  lineStart: Point,
  lineEnd: Point,
  shape: FabricObject
): boolean {
  const left = shape.left || 0;
  const top = shape.top || 0;
  const width = (shape.width || 0) * (shape.scaleX || 1);
  const height = (shape.height || 0) * (shape.scaleY || 1);
  const right = left + width;
  const bottom = top + height;

  // Check if line intersects rectangle using line-rectangle intersection
  const intersectsLeft = lineSegmentIntersects(lineStart, lineEnd, 
    new Point(left, top), new Point(left, bottom));
  const intersectsRight = lineSegmentIntersects(lineStart, lineEnd,
    new Point(right, top), new Point(right, bottom));
  const intersectsTop = lineSegmentIntersects(lineStart, lineEnd,
    new Point(left, top), new Point(right, top));
  const intersectsBottom = lineSegmentIntersects(lineStart, lineEnd,
    new Point(left, bottom), new Point(right, bottom));

  return intersectsLeft || intersectsRight || intersectsTop || intersectsBottom;
}

// Line segment intersection helper
function lineSegmentIntersects(
  p1: Point, p2: Point, p3: Point, p4: Point
): boolean {
  const denom = (p4.y - p3.y) * (p2.x - p1.x) - (p4.x - p3.x) * (p2.y - p1.y);
  if (denom === 0) return false;

  const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / denom;
  const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / denom;

  return ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1;
}
