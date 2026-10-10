import { Path } from 'fabric';

export interface LineSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface IntersectionResult {
  point: Point;
  t1: number;  // Parameter on first line (0-1)
  t2: number;  // Parameter on second line (0-1)
  segment1Index: number;  // Which segment in the path
  segment2Index: number;
}

/**
 * Calculate intersection point between two line segments
 * Uses parametric line equation: P = P1 + t(P2 - P1)
 *
 * @param line1 First line segment
 * @param line2 Second line segment
 * @returns Intersection point or null if no intersection
 */
export function lineIntersection(
  line1: LineSegment,
  line2: LineSegment
): Point | null {
  const { x1, y1, x2, y2 } = line1;
  const { x1: x3, y1: y3, x2: x4, y2: y4 } = line2;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);

  // Lines are parallel or coincident
  if (Math.abs(denom) < 1e-10) return null;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  // Check if intersection is within both line segments
  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    return {
      x: x1 + t * (x2 - x1),
      y: y1 + t * (y2 - y1)
    };
  }

  return null;
}

/**
 * Calculate the t parameter for a point on a line segment
 *
 * @param segment Line segment
 * @param point Point on the segment
 * @returns t parameter (0-1)
 */
function calculateT(segment: LineSegment, point: Point): number {
  const dx = segment.x2 - segment.x1;
  const dy = segment.y2 - segment.y1;

  // Use the dimension with larger change to avoid division by near-zero
  if (Math.abs(dx) > Math.abs(dy)) {
    return (point.x - segment.x1) / dx;
  } else {
    return (point.y - segment.y1) / dy;
  }
}

/**
 * Find all self-intersections in a path
 * Returns array of intersection points with metadata
 *
 * @param segments Array of line segments
 * @returns Array of intersection results
 */
export function findSelfIntersections(
  segments: LineSegment[]
): IntersectionResult[] {
  const intersections: IntersectionResult[] = [];

  // Compare each segment with all later segments (avoid duplicates)
  for (let i = 0; i < segments.length; i++) {
    for (let j = i + 2; j < segments.length; j++) {
      // Skip adjacent segments (they share an endpoint)
      if (j === i + 1) continue;

      const point = lineIntersection(segments[i], segments[j]);
      if (point) {
        // Skip intersections at segment endpoints (within small tolerance)
        const tolerance = 0.01;
        const t1 = calculateT(segments[i], point);
        const t2 = calculateT(segments[j], point);

        // Skip if intersection is very close to segment endpoints
        if (t1 < tolerance || t1 > 1 - tolerance ||
            t2 < tolerance || t2 > 1 - tolerance) {
          continue;
        }

        intersections.push({
          point,
          t1,
          t2,
          segment1Index: i,
          segment2Index: j
        });
      }
    }
  }

  return intersections;
}

/**
 * Calculate optimal number of segments for Bezier approximation
 * based on curve length
 *
 * @param startX Starting x coordinate
 * @param startY Starting y coordinate
 * @param endX Ending x coordinate
 * @param endY Ending y coordinate
 * @returns Number of segments to use
 */
function calculateOptimalSteps(
  startX: number,
  startY: number,
  endX: number,
  endY: number
): number {
  const distance = Math.sqrt(
    Math.pow(endX - startX, 2) + Math.pow(endY - startY, 2)
  );

  // More segments for longer curves (better precision)
  // Fewer for short curves (better performance)
  if (distance < 50) return 5;
  if (distance < 150) return 10;
  if (distance < 300) return 15;
  return 20;
}

/**
 * Approximate a quadratic Bezier curve as line segments
 *
 * @param x0 Start x
 * @param y0 Start y
 * @param cx Control point x
 * @param cy Control point y
 * @param x1 End x
 * @param y1 End y
 * @param steps Number of segments (optional, calculated if not provided)
 * @returns Array of line segments
 */
function approximateQuadraticBezier(
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
  steps?: number
): LineSegment[] {
  const numSteps = steps || calculateOptimalSteps(x0, y0, x1, y1);
  const segments: LineSegment[] = [];
  let prevX = x0;
  let prevY = y0;

  for (let i = 1; i <= numSteps; i++) {
    const t = i / numSteps;
    const t1 = 1 - t;

    // Quadratic bezier formula: B(t) = (1-t)²P₀ + 2(1-t)tP₁ + t²P₂
    const x = t1 * t1 * x0 + 2 * t1 * t * cx + t * t * x1;
    const y = t1 * t1 * y0 + 2 * t1 * t * cy + t * t * y1;

    segments.push({
      x1: prevX,
      y1: prevY,
      x2: x,
      y2: y
    });

    prevX = x;
    prevY = y;
  }

  return segments;
}

/**
 * Approximate a cubic Bezier curve as line segments
 *
 * @param x0 Start x
 * @param y0 Start y
 * @param cx1 First control point x
 * @param cy1 First control point y
 * @param cx2 Second control point x
 * @param cy2 Second control point y
 * @param x1 End x
 * @param y1 End y
 * @param steps Number of segments (optional, calculated if not provided)
 * @returns Array of line segments
 */
function approximateCubicBezier(
  x0: number,
  y0: number,
  cx1: number,
  cy1: number,
  cx2: number,
  cy2: number,
  x1: number,
  y1: number,
  steps?: number
): LineSegment[] {
  const numSteps = steps || calculateOptimalSteps(x0, y0, x1, y1);
  const segments: LineSegment[] = [];
  let prevX = x0;
  let prevY = y0;

  for (let i = 1; i <= numSteps; i++) {
    const t = i / numSteps;
    const t1 = 1 - t;

    // Cubic bezier formula
    const x =
      t1 * t1 * t1 * x0 +
      3 * t1 * t1 * t * cx1 +
      3 * t1 * t * t * cx2 +
      t * t * t * x1;
    const y =
      t1 * t1 * t1 * y0 +
      3 * t1 * t1 * t * cy1 +
      3 * t1 * t * t * cy2 +
      t * t * t * y1;

    segments.push({
      x1: prevX,
      y1: prevY,
      x2: x,
      y2: y
    });

    prevX = x;
    prevY = y;
  }

  return segments;
}

/**
 * Convert Fabric Path object to array of line segments
 * Handles straight lines, curves (approximated), and bezier paths
 *
 * @param path Fabric Path object
 * @returns Array of line segments
 */
export function pathToSegments(path: Path): LineSegment[] {
  const segments: LineSegment[] = [];
  const pathData = path.path;

  if (!pathData || pathData.length === 0) return segments;

  let currentX = 0;
  let currentY = 0;

  pathData.forEach((cmd) => {
    const type = cmd[0];

    switch (type) {
      case 'M': // Move to
        currentX = cmd[1] as number;
        currentY = cmd[2] as number;
        break;

      case 'L': // Line to
        const endX = cmd[1] as number;
        const endY = cmd[2] as number;
        segments.push({
          x1: currentX,
          y1: currentY,
          x2: endX,
          y2: endY
        });
        currentX = endX;
        currentY = endY;
        break;

      case 'Q': // Quadratic bezier
        // Approximate curve with multiple line segments
        const cpX = cmd[1] as number;
        const cpY = cmd[2] as number;
        const qEndX = cmd[3] as number;
        const qEndY = cmd[4] as number;

        const qSegments = approximateQuadraticBezier(
          currentX,
          currentY,
          cpX,
          cpY,
          qEndX,
          qEndY
        );
        segments.push(...qSegments);

        currentX = qEndX;
        currentY = qEndY;
        break;

      case 'C': // Cubic bezier
        const cp1X = cmd[1] as number;
        const cp1Y = cmd[2] as number;
        const cp2X = cmd[3] as number;
        const cp2Y = cmd[4] as number;
        const cEndX = cmd[5] as number;
        const cEndY = cmd[6] as number;

        const cSegments = approximateCubicBezier(
          currentX,
          currentY,
          cp1X,
          cp1Y,
          cp2X,
          cp2Y,
          cEndX,
          cEndY
        );
        segments.push(...cSegments);

        currentX = cEndX;
        currentY = cEndY;
        break;
    }
  });

  return segments;
}
