import { BezierPoint, Point } from "@/types/bezier";
import { getPointOnCubicBezier } from "./bezierMath";
import { Path, util } from "fabric";

/**
 * Map slider value (0-100) to pixel tolerance for simplification
 */
function mapToleranceToPixels(sliderValue: number): number {
  if (sliderValue <= 33) {
    // Gentle: 2-5px
    return 2 + (sliderValue / 33) * 3;
  } else if (sliderValue <= 66) {
    // Moderate: 5-10px
    return 5 + ((sliderValue - 33) / 33) * 5;
  } else {
    // Aggressive: 10-20px
    return 10 + ((sliderValue - 66) / 34) * 10;
  }
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
 * Calculate perpendicular distance from point to line segment
 */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  // If the line segment is actually a point
  if (dx === 0 && dy === 0) {
    return distance(point, lineStart);
  }

  // Calculate perpendicular distance
  const numerator = Math.abs(
    dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x
  );
  const denominator = Math.sqrt(dx * dx + dy * dy);

  return numerator / denominator;
}

/**
 * Sample points along a bezier segment for accurate distance measurement
 */
function sampleBezierSegment(
  p0: BezierPoint,
  p1: BezierPoint,
  samples: number = 15
): Point[] {
  const cp1 = p0.controlPoint2 || p0;
  const cp2 = p1.controlPoint1 || p1;
  const points: Point[] = [];

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    points.push(getPointOnCubicBezier(t, p0, cp1, cp2, p1));
  }

  return points;
}

/**
 * Calculate importance score for an anchor point
 * Higher score = more important to keep
 */
function calculatePointImportance(
  point: BezierPoint,
  index: number,
  allPoints: BezierPoint[]
): number {
  // First and last points have infinite importance (always kept)
  if (index === 0 || index === allPoints.length - 1) {
    return Infinity;
  }

  // Corner points have infinite importance (always preserved)
  if (point.type === 'corner') {
    return Infinity;
  }

  // Calculate geometric deviation from straight line between neighbors
  const prev = allPoints[index - 1];
  const next = allPoints[index + 1];
  const deviation = perpendicularDistance(point, prev, next);

  // Calculate curvature contribution based on control point distances
  let curvature = 0;
  if (point.controlPoint1) {
    curvature += distance(point, point.controlPoint1);
  }
  if (point.controlPoint2) {
    curvature += distance(point, point.controlPoint2);
  }

  return deviation + curvature * 0.1; // Weight curvature lower than geometric position
}

/**
 * Simplify bezier path using importance-based Douglas-Peucker approach
 */
function douglasPeuckerBezier(
  points: BezierPoint[],
  tolerance: number,
  startIndex: number,
  endIndex: number
): boolean[] {
  // Create a boolean array to track which points to keep
  const keep = new Array(points.length).fill(false);
  keep[startIndex] = true;
  keep[endIndex] = true;

  // Sample the bezier curve between start and end for accurate measurement
  const sampledPoints: Point[] = [];
  for (let i = startIndex; i < endIndex; i++) {
    const segment = sampleBezierSegment(points[i], points[i + 1], 15);
    sampledPoints.push(...segment.slice(0, -1)); // Avoid duplicates at segment joins
  }
  sampledPoints.push(points[endIndex]); // Add the last point

  // Find the point with maximum distance from the line segment
  let maxDistance = 0;
  let maxIndex = startIndex;

  for (let i = startIndex + 1; i < endIndex; i++) {
    // Check importance first
    const importance = calculatePointImportance(points[i], i, points);
    if (importance === Infinity) {
      // Must keep this point
      keep[i] = true;
      continue;
    }

    // Calculate distance of sampled curve points from straight line
    let segmentMaxDist = 0;
    const anchor = points[i];

    // Find closest sampled point to this anchor
    for (const sampledPt of sampledPoints) {
      const distToAnchor = distance(sampledPt, anchor);
      if (distToAnchor < 5) { // Points near this anchor
        const dist = perpendicularDistance(sampledPt, points[startIndex], points[endIndex]);
        segmentMaxDist = Math.max(segmentMaxDist, dist);
      }
    }

    if (segmentMaxDist > maxDistance) {
      maxDistance = segmentMaxDist;
      maxIndex = i;
    }
  }

  // If maximum distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    keep[maxIndex] = true;

    // Recursively process left and right segments
    const leftKeep = douglasPeuckerBezier(points, tolerance, startIndex, maxIndex);
    const rightKeep = douglasPeuckerBezier(points, tolerance, maxIndex, endIndex);

    // Merge results
    for (let i = startIndex; i <= endIndex; i++) {
      if (leftKeep[i] || rightKeep[i]) {
        keep[i] = true;
      }
    }
  }

  return keep;
}

/**
 * Recalculate control points for remaining anchors using Catmull-Rom style
 */
function recalculateControlPoints(
  points: BezierPoint[],
  tension: number = 0.5
): BezierPoint[] {
  if (points.length < 2) return points;

  const result: BezierPoint[] = [];

  for (let i = 0; i < points.length; i++) {
    const point = { ...points[i] };

    // First point
    if (i === 0) {
      if (points.length > 1) {
        const next = points[1];
        const tangent = {
          x: (next.x - point.x) * tension,
          y: (next.y - point.y) * tension
        };
        point.controlPoint2 = {
          x: point.x + tangent.x,
          y: point.y + tangent.y
        };
      }
    }
    // Last point
    else if (i === points.length - 1) {
      const prev = points[i - 1];
      const tangent = {
        x: (point.x - prev.x) * tension,
        y: (point.y - prev.y) * tension
      };
      point.controlPoint1 = {
        x: point.x - tangent.x,
        y: point.y - tangent.y
      };
    }
    // Middle points
    else {
      const prev = points[i - 1];
      const next = points[i + 1];

      // Corner points keep their original control points if they exist
      if (point.type === 'corner') {
        // Keep existing control points or create simple ones
        if (!point.controlPoint1) {
          point.controlPoint1 = {
            x: point.x + (prev.x - point.x) * 0.3,
            y: point.y + (prev.y - point.y) * 0.3
          };
        }
        if (!point.controlPoint2) {
          point.controlPoint2 = {
            x: point.x + (next.x - point.x) * 0.3,
            y: point.y + (next.y - point.y) * 0.3
          };
        }
      } else {
        // Smooth points: calculate based on neighbors (Catmull-Rom style)
        const tangentX = (next.x - prev.x) * tension;
        const tangentY = (next.y - prev.y) * tension;

        point.controlPoint1 = {
          x: point.x - tangentX / 2,
          y: point.y - tangentY / 2
        };
        point.controlPoint2 = {
          x: point.x + tangentX / 2,
          y: point.y + tangentY / 2
        };
      }
    }

    result.push(point);
  }

  return result;
}

/**
 * Estimate how many points would remain after simplification
 */
export function estimateSimplifiedPointCount(
  bezierPoints: BezierPoint[],
  tolerance: number
): number {
  if (bezierPoints.length <= 3) return bezierPoints.length;

  const pixelTolerance = mapToleranceToPixels(tolerance);
  const keep = douglasPeuckerBezier(bezierPoints, pixelTolerance, 0, bezierPoints.length - 1);

  let count = 0;
  for (const k of keep) {
    if (k) count++;
  }

  // Ensure minimum of 3
  return Math.max(3, count);
}

/**
 * Simplify a bezier path by removing anchor points while preserving shape
 * @param bezierPoints Array of bezier anchor points
 * @param tolerance Slider value (0-100)
 * @returns Simplified array of bezier points with minimum 3 points
 */
export function simplifyBezierPath(
  bezierPoints: BezierPoint[],
  tolerance: number
): BezierPoint[] {
  // Must have at least 3 points
  if (bezierPoints.length <= 3) {
    return bezierPoints;
  }

  const pixelTolerance = mapToleranceToPixels(tolerance);

  // Run Douglas-Peucker with bezier awareness
  const keep = douglasPeuckerBezier(bezierPoints, pixelTolerance, 0, bezierPoints.length - 1);

  // Extract points to keep
  const simplified: BezierPoint[] = [];
  for (let i = 0; i < bezierPoints.length; i++) {
    if (keep[i]) {
      simplified.push({ ...bezierPoints[i] });
    }
  }

  // Ensure minimum of 3 points
  if (simplified.length < 3) {
    // Keep original if we can't simplify enough
    return bezierPoints;
  }

  // Recalculate control points for smooth curve
  const withControlPoints = recalculateControlPoints(simplified);

  return withControlPoints;
}

/**
 * Rebuild a fabric.Path from simplified bezier points
 * Updates the path's geometry to match the new bezier points
 */
export function rebuildPathFromBezierPoints(
  path: Path,
  bezierPoints: BezierPoint[]
): void {
  if (bezierPoints.length < 2) return;

  // Build SVG path data from bezier points
  let pathData = `M ${bezierPoints[0].x} ${bezierPoints[0].y}`;

  for (let i = 0; i < bezierPoints.length - 1; i++) {
    const curr = bezierPoints[i];
    const next = bezierPoints[i + 1];
    const cp1 = curr.controlPoint2 || curr;
    const cp2 = next.controlPoint1 || next;

    pathData += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${next.x} ${next.y}`;
  }

  // Parse and set new path
  const parsedPath = util.parsePath(pathData);

  // Capture old dimensions
  const oldWidth = path.width || 0;
  const oldHeight = path.height || 0;

  // Set new path
  path.path = parsedPath;
  (path as any)._setPath(parsedPath);

  // Get new dimensions
  const newWidth = path.width || 0;
  const newHeight = path.height || 0;

  // Get path offset
  const newPathOffset = { x: path.pathOffset?.x || 0, y: path.pathOffset?.y || 0 };

  // Shift bezierPoints by pathOffset
  for (const point of bezierPoints) {
    point.x -= newPathOffset.x;
    point.y -= newPathOffset.y;
    if (point.controlPoint1) {
      point.controlPoint1.x -= newPathOffset.x;
      point.controlPoint1.y -= newPathOffset.y;
    }
    if (point.controlPoint2) {
      point.controlPoint2.x -= newPathOffset.x;
      point.controlPoint2.y -= newPathOffset.y;
    }
  }

  // Rebuild with adjusted points
  let adjustedPathData = `M ${bezierPoints[0].x} ${bezierPoints[0].y}`;
  for (let i = 0; i < bezierPoints.length - 1; i++) {
    const curr = bezierPoints[i];
    const next = bezierPoints[i + 1];
    const cp1 = curr.controlPoint2 || curr;
    const cp2 = next.controlPoint1 || next;
    adjustedPathData += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${next.x} ${next.y}`;
  }

  // Set adjusted path
  path.set({
    path: util.parsePath(adjustedPathData),
    pathOffset: { x: 0, y: 0 } as any,
    dirty: true,
  });

  // Compensate for dimension changes
  const widthDelta = newWidth - oldWidth;
  const heightDelta = newHeight - oldHeight;

  path.set({
    left: (path.left || 0) + newPathOffset.x - widthDelta / 2,
    top: (path.top || 0) + newPathOffset.y - heightDelta / 2,
  });

  path.setCoords();
}
