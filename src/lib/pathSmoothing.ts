import { Path } from "fabric";

export interface Point {
  x: number;
  y: number;
}

/**
 * Convert points to simple linear path (no smoothing)
 * Used for 0% smoothing to show the exact original freehand line
 */
export function pointsToLinearPath(points: Point[]): any[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [['M', points[0].x, points[0].y]];

  const pathData: any[] = [['M', points[0].x, points[0].y]];

  for (let i = 1; i < points.length; i++) {
    pathData.push(['L', points[i].x, points[i].y]);
  }

  return pathData;
}

/**
 * Simplify a path by removing redundant points
 * Uses Ramer-Douglas-Peucker algorithm
 */
export function simplifyPath(points: Point[], tolerance: number = 2): Point[] {
  if (points.length <= 2) return points;

  // Find the point with maximum distance from the line segment
  let maxDistance = 0;
  let maxIndex = 0;
  const end = points.length - 1;
  
  for (let i = 1; i < end; i++) {
    const distance = perpendicularDistance(
      points[i],
      points[0],
      points[end]
    );
    if (distance > maxDistance) {
      maxDistance = distance;
      maxIndex = i;
    }
  }

  // If max distance is greater than tolerance, recursively simplify
  if (maxDistance > tolerance) {
    const left = simplifyPath(points.slice(0, maxIndex + 1), tolerance);
    const right = simplifyPath(points.slice(maxIndex), tolerance);
    return [...left.slice(0, -1), ...right];
  } else {
    return [points[0], points[end]];
  }
}

function perpendicularDistance(point: Point, lineStart: Point, lineEnd: Point): number {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  const mag = Math.sqrt(dx * dx + dy * dy);
  
  if (mag === 0) return Math.sqrt(
    Math.pow(point.x - lineStart.x, 2) + Math.pow(point.y - lineStart.y, 2)
  );
  
  const u = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (mag * mag);
  
  let closestPoint: Point;
  if (u < 0) {
    closestPoint = lineStart;
  } else if (u > 1) {
    closestPoint = lineEnd;
  } else {
    closestPoint = {
      x: lineStart.x + u * dx,
      y: lineStart.y + u * dy
    };
  }
  
  return Math.sqrt(
    Math.pow(point.x - closestPoint.x, 2) + Math.pow(point.y - closestPoint.y, 2)
  );
}

/**
 * Apply Chaikin's corner cutting algorithm for smooth curves
 */
export function chaikinSmooth(points: Point[], iterations: number = 1): Point[] {
  if (points.length < 2 || iterations === 0) return points;

  let smoothed = [...points];
  
  for (let iter = 0; iter < iterations; iter++) {
    const newPoints: Point[] = [];
    
    // Keep the first point
    newPoints.push(smoothed[0]);
    
    // Create new points between each pair
    for (let i = 0; i < smoothed.length - 1; i++) {
      const p1 = smoothed[i];
      const p2 = smoothed[i + 1];
      
      // Point at 25% along the segment
      newPoints.push({
        x: 0.75 * p1.x + 0.25 * p2.x,
        y: 0.75 * p1.y + 0.25 * p2.y
      });
      
      // Point at 75% along the segment
      newPoints.push({
        x: 0.25 * p1.x + 0.75 * p2.x,
        y: 0.25 * p1.y + 0.75 * p2.y
      });
    }
    
    // Keep the last point
    newPoints.push(smoothed[smoothed.length - 1]);
    smoothed = newPoints;
  }
  
  return smoothed;
}

/**
 * Sample points along a quadratic bezier curve
 */
function sampleQuadraticCurve(p0: Point, cp: Point, p1: Point, samples: number = 5): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const t1 = 1 - t;
    points.push({
      x: t1 * t1 * p0.x + 2 * t1 * t * cp.x + t * t * p1.x,
      y: t1 * t1 * p0.y + 2 * t1 * t * cp.y + t * t * p1.y
    });
  }
  return points;
}

/**
 * Sample points along a cubic bezier curve
 */
function sampleCubicCurve(p0: Point, cp1: Point, cp2: Point, p1: Point, samples: number = 5): Point[] {
  const points: Point[] = [];
  for (let i = 0; i <= samples; i++) {
    const t = i / samples;
    const t1 = 1 - t;
    const t1_2 = t1 * t1;
    const t1_3 = t1_2 * t1;
    const t_2 = t * t;
    const t_3 = t_2 * t;
    
    points.push({
      x: t1_3 * p0.x + 3 * t1_2 * t * cp1.x + 3 * t1 * t_2 * cp2.x + t_3 * p1.x,
      y: t1_3 * p0.y + 3 * t1_2 * t * cp1.y + 3 * t1 * t_2 * cp2.y + t_3 * p1.y
    });
  }
  return points;
}

/**
 * Extract points from a Fabric.js Path object with curve sampling
 */
export function extractPathPoints(path: Path): Point[] {
  const pathData = path.path as any[];
  if (!pathData || pathData.length === 0) return [];

  const points: Point[] = [];
  let lastPoint: Point = { x: 0, y: 0 };
  
  for (let i = 0; i < pathData.length; i++) {
    const cmd = pathData[i];
    const cmdType = cmd[0];
    
    if (cmdType === 'M') {
      // Move command: [cmd, x, y]
      lastPoint = { x: cmd[1], y: cmd[2] };
      points.push(lastPoint);
    } else if (cmdType === 'L') {
      // Line command: [cmd, x, y]
      lastPoint = { x: cmd[1], y: cmd[2] };
      points.push(lastPoint);
    } else if (cmdType === 'Q') {
      // Quadratic curve: [cmd, cpx, cpy, x, y]
      const sampledPoints = sampleQuadraticCurve(
        lastPoint,
        { x: cmd[1], y: cmd[2] },
        { x: cmd[3], y: cmd[4] },
        3
      );
      points.push(...sampledPoints.slice(1)); // Skip first point (it's lastPoint)
      lastPoint = { x: cmd[3], y: cmd[4] };
    } else if (cmdType === 'C') {
      // Cubic curve: [cmd, cp1x, cp1y, cp2x, cp2y, x, y]
      const sampledPoints = sampleCubicCurve(
        lastPoint,
        { x: cmd[1], y: cmd[2] },
        { x: cmd[3], y: cmd[4] },
        { x: cmd[5], y: cmd[6] },
        3
      );
      points.push(...sampledPoints.slice(1)); // Skip first point (it's lastPoint)
      lastPoint = { x: cmd[5], y: cmd[6] };
    }
  }
  
  return points;
}

/**
 * Convert Catmull-Rom control points to Cubic Bezier control points
 */
function catmullRomToBezier(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  tension: number = 0.5
): { cp1: Point; cp2: Point } {
  const t = tension / 6;
  
  return {
    cp1: {
      x: p1.x + (p2.x - p0.x) * t,
      y: p1.y + (p2.y - p0.y) * t
    },
    cp2: {
      x: p2.x - (p3.x - p1.x) * t,
      y: p2.y - (p3.y - p1.y) * t
    }
  };
}

/**
 * Convert points to smooth Catmull-Rom SVG path data
 */
export function pointsToPathData(points: Point[], tension: number = 1.0): any[] {
  if (points.length === 0) return [];
  if (points.length === 1) return [['M', points[0].x, points[0].y]];
  if (points.length === 2) {
    return [
      ['M', points[0].x, points[0].y],
      ['L', points[1].x, points[1].y]
    ];
  }
  
  const pathData: any[] = [];
  
  // Start with Move command
  pathData.push(['M', points[0].x, points[0].y]);
  
  // For first segment, use ghost point
  const p0_ghost = {
    x: 2 * points[0].x - points[1].x,
    y: 2 * points[0].y - points[1].y
  };
  
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i === 0 ? p0_ghost : points[i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i === points.length - 2 
      ? { x: 2 * p2.x - p1.x, y: 2 * p2.y - p1.y } // Ghost point for end
      : points[i + 2];
    
    const { cp1, cp2 } = catmullRomToBezier(p0, p1, p2, p3, tension);
    
    pathData.push(['C', cp1.x, cp1.y, cp2.x, cp2.y, p2.x, p2.y]);
  }

  return pathData;
}

/**
 * Centripetal Catmull-Rom (alpha=0.5) → cubic Bezier as an SVG path-data
 * string fragment, **without** a leading "M" command. Caller is responsible
 * for emitting the initial `M points[0]`.
 *
 * Closed-aware: when isClosed is true, the wrap-neighbors at the seam are
 * the actual previous/next points (no phantom reflection), giving C1
 * continuity. Open paths use phantom-point reflection at the endpoints.
 *
 * Centripetal (vs. uniform) Catmull-Rom is provably free of self-intersections
 * and cusps — important when this is used for the inner offset edge of a
 * membrane band where a swing across the centerline would create a "bowtie"
 * fill artifact.
 *
 * cornerMask, when provided, marks samples that came from a `corner`-type
 * bezier anchor: the segment ENDING at a corner emits an `L` instead of a `C`
 * so user-placed sharp corners stay sharp.
 */
export function pointsToCentripetalPathString(
  points: Point[],
  isClosed: boolean = false,
  alpha: number = 0.5,
  cornerMask?: boolean[]
): string {
  const n = points.length;
  if (n < 2) return '';
  if (n === 2) return `L ${points[1].x} ${points[1].y}`;

  const segs: string[] = [];
  const lastIndex = isClosed ? n - 1 : n - 2;

  for (let i = 0; i <= lastIndex; i++) {
    const p1 = points[i];
    const p2 = points[(i + 1) % n];

    let p0: Point;
    if (i === 0) {
      p0 = isClosed
        ? points[n - 1]
        : { x: 2 * p1.x - p2.x, y: 2 * p1.y - p2.y };
    } else {
      p0 = points[i - 1];
    }

    let p3: Point;
    const nextNext = i + 2;
    if (nextNext > n - 1) {
      if (isClosed) {
        p3 = points[nextNext % n];
      } else {
        p3 = { x: 2 * p2.x - p1.x, y: 2 * p2.y - p1.y };
      }
    } else {
      p3 = points[nextNext];
    }

    const endIsCorner = !!cornerMask && !!cornerMask[(i + 1) % n];
    if (endIsCorner) {
      segs.push(`L ${p2.x} ${p2.y}`);
      continue;
    }

    const eps = 1e-8;
    const d01 = Math.sqrt((p1.x - p0.x) ** 2 + (p1.y - p0.y) ** 2);
    const d12 = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
    const d23 = Math.sqrt((p3.x - p2.x) ** 2 + (p3.y - p2.y) ** 2);
    const t01 = Math.max(Math.pow(d01, alpha), eps);
    const t12 = Math.max(Math.pow(d12, alpha), eps);
    const t23 = Math.max(Math.pow(d23, alpha), eps);

    const f1 = t12 / (3 * (t01 + t12));
    const f2 = t12 / (3 * (t12 + t23));

    const cp1x = p1.x + (p2.x - p0.x) * f1;
    const cp1y = p1.y + (p2.y - p0.y) * f1;
    const cp2x = p2.x - (p3.x - p1.x) * f2;
    const cp2y = p2.y - (p3.y - p1.y) * f2;

    segs.push(`C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`);
  }

  return segs.join(' ');
}

// Segment classification for beautification
interface Segment {
  type: 'line' | 'curve';
  startIndex: number;
  endIndex: number;
  points: Point[];
}

/**
 * Calculate straightness of a segment using perpendicular distance from best-fit line
 */
function calculateStraightness(points: Point[]): number {
  if (points.length < 3) return 1.0; // Too few points - assume straight
  
  const start = points[0];
  const end = points[points.length - 1];
  
  // Calculate line of best fit (from start to end)
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lineLength = Math.sqrt(dx * dx + dy * dy);
  
  if (lineLength < 0.1) return 1.0; // Degenerate line
  
  // Calculate maximum perpendicular distance
  let maxDistance = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i];
    // Calculate perpendicular distance from point to line
    const distance = Math.abs((dy * point.x - dx * point.y + end.x * start.y - end.y * start.x) / lineLength);
    maxDistance = Math.max(maxDistance, distance);
  }
  
  return maxDistance;
}

/**
 * Detect straight segments in the path
 */
function detectStraightSegments(points: Point[], threshold: number): Segment[] {
  if (points.length < 3) {
    return [{ type: 'line', startIndex: 0, endIndex: points.length - 1, points }];
  }
  
  const segments: Segment[] = [];
  const windowSize = Math.min(15, Math.floor(points.length / 3)); // Adaptive window size
  let currentSegmentStart = 0;
  let currentType: 'line' | 'curve' = 'line';
  
  for (let i = 0; i < points.length; i++) {
    const end = Math.min(i + windowSize, points.length);
    const window = points.slice(i, end);
    const straightness = calculateStraightness(window);
    const isStraight = straightness < threshold;
    
    // Detect type change
    if ((isStraight && currentType === 'curve') || (!isStraight && currentType === 'line')) {
      // Save current segment
      if (i > currentSegmentStart) {
        segments.push({
          type: currentType,
          startIndex: currentSegmentStart,
          endIndex: i,
          points: points.slice(currentSegmentStart, i + 1)
        });
      }
      currentSegmentStart = i;
      currentType = isStraight ? 'line' : 'curve';
    }
  }
  
  // Add final segment
  segments.push({
    type: currentType,
    startIndex: currentSegmentStart,
    endIndex: points.length - 1,
    points: points.slice(currentSegmentStart)
  });
  
  return segments;
}

/**
 * Beautify path: straighten near-straight segments, smooth curves
 */
export function beautifyPath(points: Point[], strength: number): any[] {
  if (points.length < 2) {
    return [['M', points[0]?.x || 0, points[0]?.y || 0]];
  }

  // Map strength (0-100) to parameters
  // Use 5 discrete levels for predictable, consistent behavior
  let straightnessThreshold = 5;
  let curveTension = 0.8;

  if (strength < 20) {
    // Very light
    straightnessThreshold = 3;
    curveTension = 0.7;
  } else if (strength < 40) {
    // Light
    straightnessThreshold = 5;
    curveTension = 0.8;
  } else if (strength < 60) {
    // Medium
    straightnessThreshold = 8;
    curveTension = 0.95;
  } else if (strength < 80) {
    // Medium-Heavy
    straightnessThreshold = 11;
    curveTension = 1.05;
  } else {
    // Heavy
    straightnessThreshold = 14;
    curveTension = 1.15;
  }
  
  // Simplify first to remove noise
  const simplified = simplifyPath(points, Math.max(1, straightnessThreshold / 5));
  
  // Detect segments
  const segments = detectStraightSegments(simplified, straightnessThreshold);
  
  // Reconstruct path
  const pathData: any[] = [];
  
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    
    if (i === 0) {
      // Start with M command
      pathData.push(['M', segment.points[0].x, segment.points[0].y]);
    }
    
    if (segment.type === 'line') {
      // Draw straight line to end
      const end = segment.points[segment.points.length - 1];
      pathData.push(['L', end.x, end.y]);
    } else {
      // Draw smooth curve
      const curvePoints = segment.points;
      
      // Apply light Chaikin smoothing for curve regularization
      const smoothed = chaikinSmooth(curvePoints, 1);
      
      // Convert to Catmull-Rom curves
      const curveData = pointsToPathData(smoothed, curveTension);
      
      // Skip the 'M' command and add the rest
      for (let j = 1; j < curveData.length; j++) {
        pathData.push(curveData[j]);
      }
    }
  }
  
  return pathData;
}

/**
 * Main smoothing function for Fabric.js Path objects
 */
export function smoothFabricPath(path: Path, strength: number): void {
  // Extract points from the path
  const points = extractPathPoints(path);
  
  if (points.length < 2) {
    console.warn('Not enough points to beautify');
    return;
  }

  // Use beautification algorithm
  const newPathData = beautifyPath(points, strength);

  // Update the path
  path.path = newPathData as any;
  path.setCoords();
}
