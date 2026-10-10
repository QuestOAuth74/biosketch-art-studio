export interface Point {
  x: number;
  y: number;
}

/**
 * Simplify a path by removing points within tolerance
 * Uses Douglas-Peucker algorithm
 * @param points Array of points representing the path
 * @param tolerance Maximum distance a point can be from the simplified line
 * @returns Simplified array of points
 */
export function simplifyPath(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) {
    return points;
  }

  return douglasPeucker(points, tolerance);
}

/**
 * Douglas-Peucker algorithm for path simplification
 * Recursively removes points that are within tolerance of the line segment
 */
function douglasPeucker(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) {
    return points;
  }

  // Find the point with the maximum distance from line segment
  let maxDistance = 0;
  let maxIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];

  for (let i = 1; i < points.length - 1; i++) {
    const distance = perpendicularDistance(points[i], start, end);
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If the maximum distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    // Recursively simplify both parts
    const left = douglasPeucker(points.slice(0, maxIndex + 1), tolerance);
    const right = douglasPeucker(points.slice(maxIndex), tolerance);

    // Combine results (remove duplicate point at maxIndex)
    return [...left.slice(0, -1), ...right];
  } else {
    // All points are within tolerance, return just endpoints
    return [start, end];
  }
}

/**
 * Calculate perpendicular distance from point to line segment
 */
function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;

  // If the line segment is actually a point
  if (dx === 0 && dy === 0) {
    return Math.sqrt(
      Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2)
    );
  }

  // Calculate perpendicular distance
  const numerator = Math.abs(
    dy * point.x - dx * point.y + lineEnd.x * lineStart.y - lineEnd.y * lineStart.x
  );
  const denominator = Math.sqrt(dx * dx + dy * dy);

  return numerator / denominator;
}
