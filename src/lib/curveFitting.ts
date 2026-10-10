/**
 * Curve Fitting Utilities
 * Fits Bezier curves to sets of points for smooth path generation
 */

export interface Point {
  x: number;
  y: number;
}

export interface BezierCurve {
  start: Point;
  end: Point;
  cp1: Point; // First control point
  cp2: Point; // Second control point
}

/**
 * Fit cubic Bezier curves to a series of points
 * Uses adaptive algorithm to convert polylines into smooth curves
 * @param points Array of points to fit
 * @param tolerance Maximum allowed deviation from original points
 * @returns Array of cubic Bezier curves
 */
export function curveFitting(points: Point[], tolerance: number = 1.0): BezierCurve[] {
  if (points.length < 2) {
    return [];
  }

  if (points.length === 2) {
    // For two points, create a straight line as a Bezier curve
    return [{
      start: points[0],
      end: points[1],
      cp1: {
        x: points[0].x + (points[1].x - points[0].x) / 3,
        y: points[0].y + (points[1].y - points[0].y) / 3,
      },
      cp2: {
        x: points[0].x + 2 * (points[1].x - points[0].x) / 3,
        y: points[0].y + 2 * (points[1].y - points[0].y) / 3,
      },
    }];
  }

  // Use adaptive fitting - smaller segments for tighter tolerance
  return adaptiveFit(points, 0, points.length - 1, tolerance);
}

/**
 * Recursively fit curves with adaptive segmentation
 */
function adaptiveFit(points: Point[], start: number, end: number, tolerance: number): BezierCurve[] {
  if (end - start < 2) {
    // Just two points, create a simple curve
    return [{
      start: points[start],
      end: points[end],
      cp1: {
        x: points[start].x + (points[end].x - points[start].x) / 3,
        y: points[start].y + (points[end].y - points[start].y) / 3,
      },
      cp2: {
        x: points[start].x + 2 * (points[end].x - points[start].x) / 3,
        y: points[start].y + 2 * (points[end].y - points[start].y) / 3,
      },
    }];
  }

  // Try to fit a single curve to this segment
  const segmentPoints = points.slice(start, end + 1);
  const curve = fitCubicBezier(segmentPoints);

  // Check if all points are within tolerance
  let maxError = 0;
  let worstIndex = -1;

  for (let i = start + 1; i < end; i++) {
    const error = distanceToQuadraticBezier(points[i], curve);
    if (error > maxError) {
      maxError = error;
      worstIndex = i;
    }
  }

  // Use stricter tolerance check (70% of tolerance) to ensure we stay within bounds
  // This accounts for sampling inaccuracies and ensures all points stay within tolerance
  if (maxError <= tolerance * 0.7) {
    // Fit is good enough
    return [curve];
  }

  // Split at the worst point and recurse
  const splitPoint = worstIndex !== -1 ? worstIndex : Math.floor((start + end) / 2);
  const leftCurves = adaptiveFit(points, start, splitPoint, tolerance);
  const rightCurves = adaptiveFit(points, splitPoint, end, tolerance);

  return [...leftCurves, ...rightCurves];
}

/**
 * Fit a single cubic Bezier curve to a set of points
 * Uses tangent-based approach for better fitting
 */
function fitCubicBezier(points: Point[]): BezierCurve {
  const start = points[0];
  const end = points[points.length - 1];

  if (points.length === 2) {
    // Straight line
    return {
      start,
      end,
      cp1: {
        x: start.x + (end.x - start.x) / 3,
        y: start.y + (end.y - start.y) / 3,
      },
      cp2: {
        x: start.x + 2 * (end.x - start.x) / 3,
        y: start.y + 2 * (end.y - start.y) / 3,
      },
    };
  }

  // Use weighted average of nearby points for better curve fitting
  const third = points.length / 3;

  // Weight points near 1/3 and 2/3 positions more heavily
  let cp1x = 0, cp1y = 0, cp2x = 0, cp2y = 0;
  let cp1Weight = 0, cp2Weight = 0;

  points.forEach((p, i) => {
    const t = i / (points.length - 1);

    // Weight for first control point (peaks around t=0.33)
    const w1 = Math.exp(-Math.pow((t - 0.33) * 3, 2));
    cp1x += p.x * w1;
    cp1y += p.y * w1;
    cp1Weight += w1;

    // Weight for second control point (peaks around t=0.67)
    const w2 = Math.exp(-Math.pow((t - 0.67) * 3, 2));
    cp2x += p.x * w2;
    cp2y += p.y * w2;
    cp2Weight += w2;
  });

  const cp1 = {
    x: cp1x / cp1Weight,
    y: cp1y / cp1Weight,
  };

  const cp2 = {
    x: cp2x / cp2Weight,
    y: cp2y / cp2Weight,
  };

  return { start, end, cp1, cp2 };
}

/**
 * Calculate the minimum distance from a point to a cubic Bezier curve
 * Uses high-resolution sampling for accurate distance measurement
 */
export function distanceToQuadraticBezier(point: Point, curve: BezierCurve): number {
  let minDistance = Infinity;
  const samples = 100; // High number of samples for accuracy

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const curvePoint = evaluateCubicBezier(curve, t);
    const distance = Math.sqrt(
      Math.pow(point.x - curvePoint.x, 2) + Math.pow(point.y - curvePoint.y, 2)
    );
    minDistance = Math.min(minDistance, distance);
  }

  return minDistance;
}

/**
 * Evaluate a cubic Bezier curve at parameter t (0 to 1)
 */
function evaluateCubicBezier(curve: BezierCurve, t: number): Point {
  const { start, cp1, cp2, end } = curve;
  const oneMinusT = 1 - t;
  const oneMinusTSquared = oneMinusT * oneMinusT;
  const oneMinusTCubed = oneMinusTSquared * oneMinusT;
  const tSquared = t * t;
  const tCubed = tSquared * t;

  return {
    x:
      oneMinusTCubed * start.x +
      3 * oneMinusTSquared * t * cp1.x +
      3 * oneMinusT * tSquared * cp2.x +
      tCubed * end.x,
    y:
      oneMinusTCubed * start.y +
      3 * oneMinusTSquared * t * cp1.y +
      3 * oneMinusT * tSquared * cp2.y +
      tCubed * end.y,
  };
}
