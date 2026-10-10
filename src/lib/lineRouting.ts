import { Point } from "fabric";
import { Port } from "@/types/connector";

// Straight line routing - direct line between two points
export function routeStraight(start: Point, end: Point): Point[] {
  return [start, end];
}

// Curved line routing - simple bezier curve
export function routeCurved(
  start: Point,
  end: Point,
  curvature: number = 0.5
): string {
  const midX = (start.x + end.x) / 2;
  const midY = (start.y + end.y) / 2;
  
  // Calculate control points for smooth curve
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  const offset = distance * curvature;

  // Perpendicular offset for control points
  const cx1 = start.x + offset;
  const cy1 = start.y;
  const cx2 = end.x - offset;
  const cy2 = end.y;

  return `M ${start.x} ${start.y} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${end.x} ${end.y}`;
}

// Orthogonal/Manhattan routing with 90-degree angles and port-aware stubs
export function routeOrthogonal(
  start: Point,
  end: Point,
  startPort?: Port,
  endPort?: Port
): Point[] {
  const points: Point[] = [];
  const stubLength = 12; // Length of orthogonal stub from port
  
  // Calculate stub directions based on port positions
  let startStubX = start.x;
  let startStubY = start.y;
  let endStubX = end.x;
  let endStubY = end.y;
  
  // Add start stub based on port direction
  if (startPort) {
    const angle = startPort.angle || 0;
    if (angle === -90 || startPort.position === 'top') {
      startStubY = start.y - stubLength;
    } else if (angle === 90 || startPort.position === 'bottom') {
      startStubY = start.y + stubLength;
    } else if (angle === 0 || startPort.position === 'right') {
      startStubX = start.x + stubLength;
    } else if (angle === 180 || startPort.position === 'left') {
      startStubX = start.x - stubLength;
    }
  }
  
  // Add end stub based on port direction
  if (endPort) {
    const angle = endPort.angle || 0;
    if (angle === -90 || endPort.position === 'top') {
      endStubY = end.y - stubLength;
    } else if (angle === 90 || endPort.position === 'bottom') {
      endStubY = end.y + stubLength;
    } else if (angle === 0 || endPort.position === 'right') {
      endStubX = end.x + stubLength;
    } else if (angle === 180 || endPort.position === 'left') {
      endStubX = end.x - stubLength;
    }
  }
  
  points.push(start);
  
  // Add start stub point if different
  if (startStubX !== start.x || startStubY !== start.y) {
    points.push(new Point(startStubX, startStubY));
  }
  
  // Middle routing based on direction
  const dx = endStubX - startStubX;
  const dy = endStubY - startStubY;
  
  if (startPort?.position === 'bottom' || startPort?.position === 'top') {
    // Vertical start: go vertical first, then horizontal
    if (Math.abs(dy) > stubLength * 2) {
      const midY = startStubY + dy / 2;
      points.push(new Point(startStubX, midY));
      points.push(new Point(endStubX, midY));
    } else {
      points.push(new Point(startStubX, endStubY));
    }
  } else {
    // Horizontal start: go horizontal first, then vertical
    if (Math.abs(dx) > stubLength * 2) {
      const midX = startStubX + dx / 2;
      points.push(new Point(midX, startStubY));
      points.push(new Point(midX, endStubY));
    } else {
      points.push(new Point(endStubX, startStubY));
    }
  }
  
  // Add end stub point if different
  if (endStubX !== end.x || endStubY !== end.y) {
    points.push(new Point(endStubX, endStubY));
  }
  
  points.push(end);
  
  // Remove duplicate consecutive points
  return points.filter((p, i) => 
    i === 0 || p.x !== points[i-1].x || p.y !== points[i-1].y
  );
}

// Elbow connector with custom waypoint
export function routeElbow(
  start: Point,
  end: Point,
  direction: 'horizontal' | 'vertical' = 'horizontal'
): Point[] {
  const points: Point[] = [start];
  
  if (direction === 'horizontal') {
    const midX = (start.x + end.x) / 2;
    points.push(new Point(midX, start.y));
    points.push(new Point(midX, end.y));
  } else {
    const midY = (start.y + end.y) / 2;
    points.push(new Point(start.x, midY));
    points.push(new Point(end.x, midY));
  }
  
  points.push(end);
  return points;
}

// Convert points array to SVG path string
export function pointsToPath(points: Point[]): string {
  if (points.length === 0) return '';
  
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  
  return path;
}

// Calculate smooth corners for orthogonal paths
export function smoothOrthogonalPath(points: Point[], cornerRadius: number = 10): string {
  if (points.length < 3) return pointsToPath(points);
  
  let path = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    
    // Calculate distances
    const d1x = curr.x - prev.x;
    const d1y = curr.y - prev.y;
    const d2x = next.x - curr.x;
    const d2y = next.y - curr.y;
    
    const len1 = Math.sqrt(d1x * d1x + d1y * d1y);
    const len2 = Math.sqrt(d2x * d2x + d2y * d2y);
    
    const radius = Math.min(cornerRadius, len1 / 2, len2 / 2);
    
    // Calculate corner points
    const ratio1 = radius / len1;
    const ratio2 = radius / len2;
    
    const p1x = curr.x - d1x * ratio1;
    const p1y = curr.y - d1y * ratio1;
    const p2x = curr.x + d2x * ratio2;
    const p2y = curr.y + d2y * ratio2;
    
    path += ` L ${p1x} ${p1y}`;
    path += ` Q ${curr.x} ${curr.y} ${p2x} ${p2y}`;
  }
  
  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;
  
  return path;
}

// Calculate beveled corners for orthogonal paths (diagonal cut at each corner)
export function bevelOrthogonalPath(points: Point[], bevelSize: number = 10): string {
  if (points.length < 3) return pointsToPath(points);

  let path = `M ${points[0].x} ${points[0].y}`;

  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];

    const d1x = curr.x - prev.x;
    const d1y = curr.y - prev.y;
    const d2x = next.x - curr.x;
    const d2y = next.y - curr.y;

    const len1 = Math.sqrt(d1x * d1x + d1y * d1y);
    const len2 = Math.sqrt(d2x * d2x + d2y * d2y);

    const bevel = Math.min(bevelSize, len1 / 2, len2 / 2);

    const p1x = curr.x - (d1x / len1) * bevel;
    const p1y = curr.y - (d1y / len1) * bevel;
    const p2x = curr.x + (d2x / len2) * bevel;
    const p2y = curr.y + (d2y / len2) * bevel;

    path += ` L ${p1x} ${p1y}`;
    path += ` L ${p2x} ${p2y}`;
  }

  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;

  return path;
}

// Straight line with port stubs for clean connections
export function routeStraightWithStubs(
  start: Point,
  end: Point,
  startPort?: Port,
  endPort?: Port
): Point[] {
  const points: Point[] = [start];
  const stubLength = 8;
  
  // Add start stub based on port angle
  if (startPort && startPort.angle !== undefined) {
    const angle = startPort.angle * (Math.PI / 180);
    points.push(new Point(
      start.x + Math.cos(angle) * stubLength,
      start.y + Math.sin(angle) * stubLength
    ));
  }
  
  // Add end stub based on port angle
  if (endPort && endPort.angle !== undefined) {
    const angle = (endPort.angle + 180) * (Math.PI / 180); // Opposite direction
    points.push(new Point(
      end.x + Math.cos(angle) * stubLength,
      end.y + Math.sin(angle) * stubLength
    ));
  }
  
  points.push(end);
  
  // Remove duplicate consecutive points
  return points.filter((p, i) => 
    i === 0 || p.x !== points[i-1].x || p.y !== points[i-1].y
  );
}
