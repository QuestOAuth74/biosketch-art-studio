import { Point, LineSegment, IntersectionResult } from './lineIntersection';

/**
 * Calculate distance between two points
 *
 * @param p1 First point
 * @param p2 Second point
 * @returns Distance
 */
function distance(p1: Point, p2: Point): number {
  return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
}

/**
 * Create an SVG path segment with jump arc at intersection
 * Takes a line segment and creates an arc at the specified position
 *
 * @param arcStart Starting point of the arc
 * @param intersection Intersection point (middle of arc)
 * @param arcEnd Ending point of the arc
 * @param radius Arc height/radius
 * @returns SVG path string for the arc segment
 */
export function createJumpArcSegment(
  arcStart: Point,
  intersection: Point,
  arcEnd: Point,
  radius: number
): string {
  // Calculate midpoint (should be at intersection)
  const midX = (arcStart.x + arcEnd.x) / 2;
  const midY = (arcStart.y + arcEnd.y) / 2;

  // Calculate perpendicular direction
  const dx = arcEnd.x - arcStart.x;
  const dy = arcEnd.y - arcStart.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len === 0) return `L ${arcEnd.x} ${arcEnd.y} `;

  // Perpendicular unit vector
  const perpX = -dy / len;
  const perpY = dx / len;

  // Control point for quadratic bezier
  // Make height scale based on both the actual arc width AND the radius parameter
  // This keeps the arc balanced even when width is constrained by segment boundaries
  const controlHeight = (len / 2) + radius;
  const controlX = midX + perpX * controlHeight;
  const controlY = midY + perpY * controlHeight;

  // Create quadratic bezier curve
  return `Q ${controlX} ${controlY}, ${arcEnd.x} ${arcEnd.y} `;
}

/**
 * Insert jump arcs into a path at all intersection points
 * Modifies the path to create "jump over" effects at crossings
 *
 * @param segments Array of line segments
 * @param intersections Array of intersection results
 * @param arcRadius Radius of the jump arc
 * @returns SVG path string with arcs inserted
 */
export function insertJumpArcs(
  segments: LineSegment[],
  intersections: IntersectionResult[],
  arcRadius: number
): string {
  if (intersections.length === 0) {
    // No intersections, return original path
    return segmentsToPathString(segments);
  }

  // Sort intersections by segment index and t parameter
  const sortedIntersections = [...intersections].sort((a, b) => {
    if (a.segment1Index !== b.segment1Index) {
      return a.segment1Index - b.segment1Index;
    }
    return a.t1 - b.t1;
  });

  let pathData = '';
  const processedSegments = new Set<number>();

  segments.forEach((segment, segmentIndex) => {
    // Find all intersections on this segment
    const segmentIntersections = sortedIntersections.filter(
      inter => inter.segment1Index === segmentIndex || inter.segment2Index === segmentIndex
    );

    if (segmentIntersections.length === 0 || processedSegments.has(segmentIndex)) {
      // No intersections on this segment, draw normally
      if (segmentIndex === 0 || !pathData.trim().endsWith(`L ${segment.x1} ${segment.y1}`)) {
        pathData += `M ${segment.x1} ${segment.y1} `;
      }
      pathData += `L ${segment.x2} ${segment.y2} `;
    } else {
      // Process segment with intersections
      const segmentLength = distance(
        { x: segment.x1, y: segment.y1 },
        { x: segment.x2, y: segment.y2 }
      );

      // Filter to only intersections where this is segment1
      const inters = segmentIntersections.filter(
        inter => inter.segment1Index === segmentIndex
      );

      if (inters.length === 0) {
        // This segment is segment2, not segment1, draw normally
        if (segmentIndex === 0 || !pathData.trim().endsWith(`L ${segment.x1} ${segment.y1}`)) {
          pathData += `M ${segment.x1} ${segment.y1} `;
        }
        pathData += `L ${segment.x2} ${segment.y2} `;
      } else {
        // Sort by t1 parameter
        inters.sort((a, b) => a.t1 - b.t1);

        let currentStart = { x: segment.x1, y: segment.y1 };
        pathData += `M ${currentStart.x} ${currentStart.y} `;

        inters.forEach(inter => {
          const t = inter.t1;
          // Arc span determines the width of the arc along the line
          // Width should scale with radius to keep a balanced arc shape
          // Using arcRadius gives width = 2*arcRadius, height = arcRadius (ratio 2:1)
          const arcSpan = arcRadius / segmentLength;

          // Calculate arc start point (before intersection)
          const t1 = Math.max(0, t - arcSpan);
          const arcStartX = segment.x1 + t1 * (segment.x2 - segment.x1);
          const arcStartY = segment.y1 + t1 * (segment.y2 - segment.y1);

          // Calculate arc end point (after intersection)
          const t2 = Math.min(1, t + arcSpan);
          const arcEndX = segment.x1 + t2 * (segment.x2 - segment.x1);
          const arcEndY = segment.y1 + t2 * (segment.y2 - segment.y1);

          // Draw line to arc start
          if (currentStart.x !== arcStartX || currentStart.y !== arcStartY) {
            pathData += `L ${arcStartX} ${arcStartY} `;
          }

          // Draw arc
          pathData += createJumpArcSegment(
            { x: arcStartX, y: arcStartY },
            inter.point,
            { x: arcEndX, y: arcEndY },
            arcRadius
          );

          currentStart = { x: arcEndX, y: arcEndY };
        });

        // Draw remaining part of segment
        if (currentStart.x !== segment.x2 || currentStart.y !== segment.y2) {
          pathData += `L ${segment.x2} ${segment.y2} `;
        }
      }

      processedSegments.add(segmentIndex);
    }
  });

  return pathData.trim();
}

/**
 * Convert array of line segments to SVG path string
 * Helper function to create path data from segments
 *
 * @param segments Array of line segments
 * @returns SVG path string
 */
function segmentsToPathString(segments: LineSegment[]): string {
  if (segments.length === 0) return '';

  let pathData = `M ${segments[0].x1} ${segments[0].y1} `;

  segments.forEach(segment => {
    pathData += `L ${segment.x2} ${segment.y2} `;
  });

  return pathData.trim();
}

/**
 * Create a jump arc for a simple line crossing
 * Used for basic line-to-line crossings
 *
 * @param startPoint Starting point of the arc
 * @param endPoint Ending point of the arc
 * @param arcHeight Height of the jump arc
 * @returns SVG path string
 */
export function createJumpArc(
  startPoint: Point,
  endPoint: Point,
  arcHeight: number
): string {
  // Calculate midpoint
  const midX = (startPoint.x + endPoint.x) / 2;
  const midY = (startPoint.y + endPoint.y) / 2;

  // Calculate perpendicular direction
  const dx = endPoint.x - startPoint.x;
  const dy = endPoint.y - startPoint.y;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len === 0) return `M ${startPoint.x} ${startPoint.y}`;

  // Perpendicular unit vector
  const perpX = -dy / len;
  const perpY = dx / len;

  // Control point for quadratic bezier
  // Make height scale based on both the arc width and the height parameter
  const controlHeight = (len / 2) + arcHeight;
  const controlX = midX + perpX * controlHeight;
  const controlY = midY + perpY * controlHeight;

  // Create quadratic bezier curve
  return `M ${startPoint.x} ${startPoint.y} Q ${controlX} ${controlY}, ${endPoint.x} ${endPoint.y}`;
}
