import { Canvas as FabricCanvas, Path } from 'fabric';
import { pathToSegments, IntersectionResult, Point } from './lineIntersection';

/**
 * Setup canvas rendering hook for bridge-mode intersections
 * This draws the white outline under crossing lines
 *
 * @param canvas Fabric canvas instance
 */
export function setupIntersectionRendering(canvas: FabricCanvas): void {
  // Use after:render event to draw bridge effects
  canvas.on('after:render', () => {
    const ctx = canvas.getContext();
    if (!ctx) return;

    // Find all paths with bridge intersections
    canvas.getObjects().forEach(obj => {
      if (!(obj instanceof Path)) return;

      const bridgeIntersections = (obj as any).bridgeIntersections;
      const bridgeConfig = (obj as any).bridgeConfig;

      if (!bridgeIntersections || !bridgeConfig) return;
      // Draw bridge effect for each intersection
      bridgeIntersections.forEach((inter: IntersectionResult) => {
        drawBridgeEffect(ctx, obj, inter, bridgeConfig);
      });
    });
  });
}

/**
 * Draw bridge effect at a single intersection point
 *
 * @param ctx Canvas rendering context
 * @param path Path object
 * @param intersection Intersection data
 * @param config Bridge configuration
 */
function drawBridgeEffect(
  ctx: CanvasRenderingContext2D,
  path: Path,
  intersection: IntersectionResult,
  config: { width: number; color: string }
): void {
  const { point, segment2Index } = intersection;

  ctx.save();

  // Transform to account for object transformations
  const matrix = path.calcTransformMatrix();
  if (matrix) {
    ctx.transform(matrix[0], matrix[1], matrix[2], matrix[3], matrix[4], matrix[5]);
  }

  // Get the segment that goes "under"
  const segments = pathToSegments(path);
  if (segment2Index >= segments.length) {
    ctx.restore();
    return;
  }

  const underSegment = segments[segment2Index];

  // Create bridge effect: draw thick background-colored stroke to create gap
  const bridgeLength = config.width * 1.5; // Length of the bridge gap
  const dx = underSegment.x2 - underSegment.x1;
  const dy = underSegment.y2 - underSegment.y1;
  const len = Math.sqrt(dx * dx + dy * dy);

  if (len === 0) {
    ctx.restore();
    return;
  }

  const startX = point.x - (dx / len) * (bridgeLength / 2);
  const startY = point.y - (dy / len) * (bridgeLength / 2);
  const endX = point.x + (dx / len) * (bridgeLength / 2);
  const endY = point.y + (dy / len) * (bridgeLength / 2);

  // Use destination-out to erase the under-line segment
  ctx.globalCompositeOperation = 'destination-out';
  ctx.strokeStyle = 'rgba(0,0,0,1)'; // Color doesn't matter with destination-out
  ctx.lineWidth = config.width;
  ctx.lineCap = 'round';

  ctx.beginPath();
  ctx.moveTo(startX, startY);
  ctx.lineTo(endX, endY);
  ctx.stroke();
  ctx.restore();
}
