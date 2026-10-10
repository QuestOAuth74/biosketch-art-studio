import { Point, BezierPoint } from "@/types/bezier";

/**
 * Evaluate a point on a cubic Bezier curve at parameter t (0 to 1)
 * Uses the cubic Bezier formula: B(t) = (1-t)³P0 + 3(1-t)²tP1 + 3(1-t)t²P2 + t³P3
 */
export function getPointOnCubicBezier(
  t: number,
  p0: Point,
  cp1: Point,
  cp2: Point,
  p1: Point
): Point {
  const t1 = 1 - t;
  const t1_2 = t1 * t1;
  const t1_3 = t1_2 * t1;
  const t_2 = t * t;
  const t_3 = t_2 * t;

  return {
    x: t1_3 * p0.x + 3 * t1_2 * t * cp1.x + 3 * t1 * t_2 * cp2.x + t_3 * p1.x,
    y: t1_3 * p0.y + 3 * t1_2 * t * cp1.y + 3 * t1 * t_2 * cp2.y + t_3 * p1.y
  };
}

/**
 * Get the tangent vector on a cubic Bezier curve at parameter t
 * Derivative of cubic Bezier: B'(t) = 3(1-t)²(P1-P0) + 6(1-t)t(P2-P1) + 3t²(P3-P2)
 */
export function getTangentOnCubicBezier(
  t: number,
  p0: Point,
  cp1: Point,
  cp2: Point,
  p1: Point
): Point {
  const t1 = 1 - t;
  const t1_2 = t1 * t1;
  const t_2 = t * t;

  return {
    x: 3 * t1_2 * (cp1.x - p0.x) + 6 * t1 * t * (cp2.x - cp1.x) + 3 * t_2 * (p1.x - cp2.x),
    y: 3 * t1_2 * (cp1.y - p0.y) + 6 * t1 * t * (cp2.y - cp1.y) + 3 * t_2 * (p1.y - cp2.y)
  };
}

/**
 * Subdivide a cubic Bezier curve at parameter t using De Casteljau's algorithm
 * Returns two new cubic Bezier curves: left (0 to t) and right (t to 1)
 */
export function subdivideCubicBezier(
  t: number,
  p0: Point,
  cp1: Point,
  cp2: Point,
  p1: Point
): {
  left: { p0: Point; cp1: Point; cp2: Point; p1: Point };
  right: { p0: Point; cp1: Point; cp2: Point; p1: Point };
} {
  // First level of interpolation
  const p01 = lerp(p0, cp1, t);
  const p12 = lerp(cp1, cp2, t);
  const p23 = lerp(cp2, p1, t);

  // Second level
  const p012 = lerp(p01, p12, t);
  const p123 = lerp(p12, p23, t);

  // Third level - the split point
  const p0123 = lerp(p012, p123, t);

  return {
    left: {
      p0: p0,
      cp1: p01,
      cp2: p012,
      p1: p0123
    },
    right: {
      p0: p0123,
      cp1: p123,
      cp2: p23,
      p1: p1
    }
  };
}

/**
 * Linear interpolation between two points
 */
function lerp(p0: Point, p1: Point, t: number): Point {
  return {
    x: p0.x + (p1.x - p0.x) * t,
    y: p0.y + (p1.y - p0.y) * t
  };
}

/**
 * Calculate distance between two points
 */
function distance(p1: Point, p2: Point): number {
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Find the closest point on a cubic Bezier curve to a given point
 * Returns the parameter t (0 to 1) of the closest point
 * Uses iterative sampling and refinement
 */
export function findClosestPointOnCubicBezier(
  x: number,
  y: number,
  p0: Point,
  cp1: Point,
  cp2: Point,
  p1: Point
): number {
  const targetPoint: Point = { x, y };
  let minDist = Infinity;
  let bestT = 0;

  // Coarse sampling
  const samples = 20;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const point = getPointOnCubicBezier(t, p0, cp1, cp2, p1);
    const dist = distance(targetPoint, point);

    if (dist < minDist) {
      minDist = dist;
      bestT = t;
    }
  }

  // Refine with smaller steps around best t
  const refineSamples = 10;
  const refineRange = 1 / samples;
  const refineStart = Math.max(0, bestT - refineRange);
  const refineEnd = Math.min(1, bestT + refineRange);

  for (let i = 0; i <= refineSamples; i++) {
    const t = refineStart + (refineEnd - refineStart) * (i / refineSamples);
    const point = getPointOnCubicBezier(t, p0, cp1, cp2, p1);
    const dist = distance(targetPoint, point);

    if (dist < minDist) {
      minDist = dist;
      bestT = t;
    }
  }

  return bestT;
}

/**
 * Find the closest point on a bezier path (multiple segments) to a given point
 * Returns { segmentIndex, t, point }
 */
export function findClosestPointOnPath(
  x: number,
  y: number,
  bezierPoints: BezierPoint[]
): { segmentIndex: number; t: number; point: Point } | null {
  if (bezierPoints.length < 2) return null;

  let minDist = Infinity;
  let bestSegment = 0;
  let bestT = 0;
  let bestPoint: Point = { x: 0, y: 0 };

  // Check each segment
  for (let i = 0; i < bezierPoints.length - 1; i++) {
    const p0 = bezierPoints[i];
    const p1 = bezierPoints[i + 1];
    const cp1 = p0.controlPoint2 || p0;
    const cp2 = p1.controlPoint1 || p1;

    const t = findClosestPointOnCubicBezier(x, y, p0, cp1, cp2, p1);
    const point = getPointOnCubicBezier(t, p0, cp1, cp2, p1);
    const dist = distance({ x, y }, point);

    if (dist < minDist) {
      minDist = dist;
      bestSegment = i;
      bestT = t;
      bestPoint = point;
    }
  }

  return {
    segmentIndex: bestSegment,
    t: bestT,
    point: bestPoint
  };
}

/**
 * Align control handles for a smooth anchor point
 * Makes the two control points mirror each other across the anchor
 * Maintains handle lengths, only aligns angles
 */
export function alignControlHandles(
  anchor: Point,
  cp1: Point,
  cp2: Point,
  maintainLengths: boolean = true
): { cp1: Point; cp2: Point } {
  // Calculate vector from anchor to cp2
  const dx = cp2.x - anchor.x;
  const dy = cp2.y - anchor.y;

  if (maintainLengths) {
    // Calculate current length of cp1 handle
    const cp1Len = distance(anchor, cp1);

    // Mirror cp2's direction for cp1, but keep cp1's length
    const len2 = Math.sqrt(dx * dx + dy * dy);
    if (len2 > 0) {
      return {
        cp1: {
          x: anchor.x - (dx / len2) * cp1Len,
          y: anchor.y - (dy / len2) * cp1Len
        },
        cp2: cp2
      };
    }
  }

  // Simple mirror (same length on both sides)
  return {
    cp1: {
      x: anchor.x - dx,
      y: anchor.y - dy
    },
    cp2: cp2
  };
}

/**
 * Calculate control handle position based on anchor, direction angle, and length
 */
export function calculateHandlePosition(
  anchor: Point,
  angle: number,  // Angle in radians
  length: number
): Point {
  return {
    x: anchor.x + Math.cos(angle) * length,
    y: anchor.y + Math.sin(angle) * length
  };
}

/**
 * Normalize a vector (make it unit length)
 */
export function normalizeVector(vec: Point): Point {
  const len = Math.sqrt(vec.x * vec.x + vec.y * vec.y);
  if (len === 0) return { x: 0, y: 0 };
  return {
    x: vec.x / len,
    y: vec.y / len
  };
}

/**
 * Calculate angle between two points in radians
 */
export function calculateAngle(from: Point, to: Point): number {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

/**
 * Get the length of a vector
 */
export function vectorLength(vec: Point): number {
  return Math.sqrt(vec.x * vec.x + vec.y * vec.y);
}
