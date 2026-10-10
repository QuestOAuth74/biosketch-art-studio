import { Canvas, Path, Line as FabricLine, Point, util } from "fabric";
import { StraightLineTool } from "./straightLineTool";
import { CurvedLineTool } from "./curvedLineTool";
import { OrthogonalLineTool } from "./orthogonalLineTool";
import { EnhancedBezierTool } from "./enhancedBezierTool";
import { updateEndpointMarkers } from "./lineEndpointRenderer";

interface LineEndpoints {
  start: Point;
  end: Point;
  anchorPoints?: Point[];
}

/**
 * Extract endpoints from a line object
 */
export function extractLineEndpoints(lineObj: any): LineEndpoints | null {
  if (!lineObj) return null;

  // For straight lines, use the stored world coordinates
  if ((lineObj as any).isStraightLine && (lineObj as any).straightLineStart && (lineObj as any).straightLineEnd) {
    const start = new Point(
      (lineObj as any).straightLineStart.x,
      (lineObj as any).straightLineStart.y
    );
    const end = new Point(
      (lineObj as any).straightLineEnd.x,
      (lineObj as any).straightLineEnd.y
    );

    return {
      start,
      end,
      anchorPoints: [start, end],
    };
  }

  // For curved lines, use the stored world coordinates
  if ((lineObj as any).isCurvedLine && (lineObj as any).curvedLineStart && (lineObj as any).curvedLineEnd) {
    const start = new Point(
      (lineObj as any).curvedLineStart.x,
      (lineObj as any).curvedLineStart.y
    );
    const end = new Point(
      (lineObj as any).curvedLineEnd.x,
      (lineObj as any).curvedLineEnd.y
    );

    return {
      start,
      end,
      anchorPoints: [start, end],
    };
  }

  // For orthogonal lines, use the stored world waypoints (if in edit mode) or transform local waypoints
  if ((lineObj as any).isOrthogonalLine) {
    // First try world waypoints (set during edit mode)
    if ((lineObj as any).orthogonalWorldPoints) {
      const waypoints = (lineObj as any).orthogonalWorldPoints as Array<{ x: number; y: number }>;
      if (waypoints.length >= 2) {
        const start = new Point(waypoints[0].x, waypoints[0].y);
        const end = new Point(waypoints[waypoints.length - 1].x, waypoints[waypoints.length - 1].y);
        const anchorPoints = waypoints.map((wp: any) => new Point(wp.x, wp.y));

        return {
          start,
          end,
          anchorPoints,
        };
      }
    }

    // Fallback: transform local waypoints to world coordinates
    if ((lineObj as any).orthogonalLineLocalWaypoints) {
      const localWaypoints = (lineObj as any).orthogonalLineLocalWaypoints as Array<{ x: number; y: number }>;
      if (localWaypoints.length >= 2) {
        const matrix = lineObj.calcTransformMatrix();
        const worldWaypoints = localWaypoints.map((wp: any) => {
          const worldPoint = util.transformPoint(new Point(wp.x, wp.y), matrix);
          return new Point(worldPoint.x, worldPoint.y);
        });

        const start = worldWaypoints[0];
        const end = worldWaypoints[worldWaypoints.length - 1];

        return {
          start,
          end,
          anchorPoints: worldWaypoints,
        };
      }
    }
  }

  // For path objects (bezier, orthogonal, or lines without stored coords)
  if (lineObj.type === 'path' && lineObj.path) {
    const pathData = lineObj.path;
    if (pathData.length < 2) return null;

    const firstCmd = pathData[0];
    const localStart = new Point(firstCmd[1], firstCmd[2]);

    const lastCmd = pathData[pathData.length - 1];
    const localEnd = new Point(
      lastCmd[lastCmd.length - 2],
      lastCmd[lastCmd.length - 1]
    );

    // Transform local coordinates to world coordinates
    const matrix = lineObj.calcTransformMatrix();
    const pathOffset = lineObj.pathOffset || { x: 0, y: 0 };

    // Transform to object-local coordinates (accounting for pathOffset)
    const objectLocalStart = {
      x: localStart.x - pathOffset.x,
      y: localStart.y - pathOffset.y,
    };
    const objectLocalEnd = {
      x: localEnd.x - pathOffset.x,
      y: localEnd.y - pathOffset.y,
    };

    // Transform to world coordinates
    const worldStart = util.transformPoint(new Point(objectLocalStart.x, objectLocalStart.y), matrix);
    const worldEnd = util.transformPoint(new Point(objectLocalEnd.x, objectLocalEnd.y), matrix);

    // Extract all anchor points for multi-point lines and transform them
    const localAnchorPoints: Point[] = [];
    pathData.forEach((cmd: any) => {
      if (cmd[0] === 'M' || cmd[0] === 'L') {
        localAnchorPoints.push(new Point(cmd[1], cmd[2]));
      } else if (cmd[0] === 'Q') {
        localAnchorPoints.push(new Point(cmd[3], cmd[4]));
      } else if (cmd[0] === 'C') {
        localAnchorPoints.push(new Point(cmd[5], cmd[6]));
      }
    });

    // Transform anchor points to world coordinates
    const worldAnchorPoints = localAnchorPoints.map(localPoint => {
      const objectLocalPoint = {
        x: localPoint.x - pathOffset.x,
        y: localPoint.y - pathOffset.y,
      };
      return util.transformPoint(new Point(objectLocalPoint.x, objectLocalPoint.y), matrix);
    });

    return {
      start: worldStart,
      end: worldEnd,
      anchorPoints: worldAnchorPoints
    };
  }

  // For straight line objects
  if (lineObj.type === 'line') {
    return {
      start: new Point(lineObj.x1, lineObj.y1),
      end: new Point(lineObj.x2, lineObj.y2),
      anchorPoints: [
        new Point(lineObj.x1, lineObj.y1),
        new Point(lineObj.x2, lineObj.y2),
      ],
    };
  }

  // For custom line objects with anchorPoints property
  if ((lineObj as any).anchorPoints) {
    const points = (lineObj as any).anchorPoints;
    if (points.length >= 2) {
      return {
        start: new Point(points[0].x, points[0].y),
        end: new Point(points[points.length - 1].x, points[points.length - 1].y),
        anchorPoints: points.map((p: any) => new Point(p.x, p.y)),
      };
    }
  }

  return null;
}

/**
 * Get line properties to preserve during conversion
 */
export function extractLineProperties(lineObj: any): any {
  return {
    stroke: lineObj.stroke || '#000000',
    strokeWidth: lineObj.strokeWidth || 2,
    strokeDashArray: lineObj.strokeDashArray,
    strokeLineJoin: lineObj.strokeLineJoin,
    strokeLineCap: lineObj.strokeLineCap,
    opacity: lineObj.opacity || 1,
    // Preserve custom properties
    isStraightLine: (lineObj as any).isStraightLine,
    isCurvedLine: (lineObj as any).isCurvedLine,
    isOrthogonalLine: (lineObj as any).isOrthogonalLine,
    isBezierPath: (lineObj as any).isBezierPath,
    id: (lineObj as any).id,
    // Preserve marker properties
    startMarkerType: (lineObj as any).startMarkerType || 'none',
    endMarkerType: (lineObj as any).endMarkerType || 'none',
    // Preserve smart connector attachments
    startAttachment: (lineObj as any).startAttachment,
    endAttachment: (lineObj as any).endAttachment,
    // Preserve pathfinding properties
    autoPathfindingEnabled: (lineObj as any).autoPathfindingEnabled,
    manualPathOverride: (lineObj as any).manualPathOverride,
  };
}

/**
 * Convert line to straight line type
 */
export async function convertToStraightLine(
  canvas: Canvas,
  lineObj: any,
  saveState?: () => void
): Promise<any | null> {
  const endpoints = extractLineEndpoints(lineObj);
  if (!endpoints) return null;

  const props = extractLineProperties(lineObj);

  // Calculate control point for straight line (midpoint)
  const controlPoint = new Point(
    (endpoints.start.x + endpoints.end.x) / 2,
    (endpoints.start.y + endpoints.end.y) / 2
  );

  // Remove old line
  canvas.remove(lineObj);

  // Create the straight line path directly (similar to StraightLineTool.finish())
  const pathData = `M ${endpoints.start.x} ${endpoints.start.y} L ${endpoints.end.x} ${endpoints.end.y}`;

  const linePath = new Path(pathData, {
    stroke: props.stroke,
    strokeWidth: props.strokeWidth,
    fill: '',
    strokeDashArray: props.strokeDashArray,
    strokeLineJoin: props.strokeLineJoin,
    strokeLineCap: props.strokeLineCap,
    opacity: props.opacity,
    selectable: true,
    hasControls: true,
  } as any);

  // Store custom properties
  const { v4: uuidv4 } = await import('uuid');
  (linePath as any).isStraightLine = true;
  (linePath as any).id = props.id || uuidv4();
  (linePath as any).isEditMode = false;
  (linePath as any).straightLineStart = { x: endpoints.start.x, y: endpoints.start.y };
  (linePath as any).straightLineEnd = { x: endpoints.end.x, y: endpoints.end.y };
  (linePath as any).straightLineControlPoint = { x: controlPoint.x, y: controlPoint.y };
  (linePath as any).startMarkerType = props.startMarkerType;
  (linePath as any).endMarkerType = props.endMarkerType;
  (linePath as any).straightLineVersion = 3;

  // Preserve smart connector attachments
  if (props.startAttachment) (linePath as any).startAttachment = props.startAttachment;
  if (props.endAttachment) (linePath as any).endAttachment = props.endAttachment;

  // Preserve pathfinding properties
  if (props.autoPathfindingEnabled !== undefined) (linePath as any).autoPathfindingEnabled = props.autoPathfindingEnabled;
  if (props.manualPathOverride !== undefined) (linePath as any).manualPathOverride = props.manualPathOverride;

  // Add to canvas
  canvas.add(linePath);
  canvas.setActiveObject(linePath);

  // Re-register with ConnectionSyncManager if it has attachments
  if ((props.startAttachment || props.endAttachment) && (canvas as any).connectionSyncManager) {
    (canvas as any).connectionSyncManager.registerLine(
      (linePath as any).id,
      linePath,
      props.startAttachment,
      props.endAttachment
    );
  }

  // Update endpoint markers
  updateEndpointMarkers(canvas, linePath, props.startMarkerType, props.endMarkerType);

  canvas.requestRenderAll();

  return linePath;
}

/**
 * Convert line to curved line type
 */
export async function convertToCurvedLine(
  canvas: Canvas,
  lineObj: any,
  saveState?: () => void
): Promise<any | null> {
  const endpoints = extractLineEndpoints(lineObj);
  if (!endpoints) {
    return null;
  }

  const props = extractLineProperties(lineObj);

  // Calculate control point for the curve (perpendicular offset from midpoint)
  const midX = (endpoints.start.x + endpoints.end.x) / 2;
  const midY = (endpoints.start.y + endpoints.end.y) / 2;

  // Calculate perpendicular direction
  const dx = endpoints.end.x - endpoints.start.x;
  const dy = endpoints.end.y - endpoints.start.y;
  const length = Math.sqrt(dx * dx + dy * dy);

  // Offset perpendicular by 20% of line length
  const offsetRatio = 0.2;
  const perpX = -dy / length * length * offsetRatio;
  const perpY = dx / length * length * offsetRatio;

  const controlPoint = new Point(midX + perpX, midY + perpY);

  // Remove old line
  canvas.remove(lineObj);

  // Create the curved path directly (similar to CurvedLineTool.finish())
  const pathData = `M ${endpoints.start.x} ${endpoints.start.y} Q ${controlPoint.x} ${controlPoint.y} ${endpoints.end.x} ${endpoints.end.y}`;

  const curvePath = new Path(pathData, {
    stroke: props.stroke,
    strokeWidth: props.strokeWidth,
    fill: '',
    strokeDashArray: props.strokeDashArray,
    strokeLineJoin: props.strokeLineJoin,
    strokeLineCap: props.strokeLineCap,
    opacity: props.opacity,
    selectable: true,
    hasControls: true,
  } as any);

  // Store custom properties
  const { v4: uuidv4 } = await import('uuid');
  (curvePath as any).isCurvedLine = true;
  (curvePath as any).id = props.id || uuidv4();
  (curvePath as any).isEditMode = false;
  (curvePath as any).curvedLineStart = { x: endpoints.start.x, y: endpoints.start.y };
  (curvePath as any).curvedLineEnd = { x: endpoints.end.x, y: endpoints.end.y };
  (curvePath as any).curvedLineControlPoint = { x: controlPoint.x, y: controlPoint.y };
  (curvePath as any).startMarkerType = props.startMarkerType;
  (curvePath as any).endMarkerType = props.endMarkerType;
  (curvePath as any).curvedLineVersion = 3;

  // Preserve smart connector attachments
  if (props.startAttachment) (curvePath as any).startAttachment = props.startAttachment;
  if (props.endAttachment) (curvePath as any).endAttachment = props.endAttachment;

  // Preserve pathfinding properties
  if (props.autoPathfindingEnabled !== undefined) (curvePath as any).autoPathfindingEnabled = props.autoPathfindingEnabled;
  if (props.manualPathOverride !== undefined) (curvePath as any).manualPathOverride = props.manualPathOverride;

  // Add to canvas
  canvas.add(curvePath);
  canvas.setActiveObject(curvePath);

  // Re-register with ConnectionSyncManager if it has attachments
  if ((props.startAttachment || props.endAttachment) && (canvas as any).connectionSyncManager) {
    (canvas as any).connectionSyncManager.registerLine(
      (curvePath as any).id,
      curvePath,
      props.startAttachment,
      props.endAttachment
    );
  }

  // Update endpoint markers
  updateEndpointMarkers(canvas, curvePath, props.startMarkerType, props.endMarkerType);

  canvas.requestRenderAll();

  return curvePath;
}

/**
 * Convert line to orthogonal line type
 */
export async function convertToOrthogonalLine(
  canvas: Canvas,
  lineObj: any,
  saveState?: () => void
): Promise<any | null> {
  const endpoints = extractLineEndpoints(lineObj);
  if (!endpoints) return null;

  const props = extractLineProperties(lineObj);

  // Remove old line
  canvas.remove(lineObj);

  // Create orthogonal line tool
  const tool = new OrthogonalLineTool(
    canvas,
    {
      strokeWidth: props.strokeWidth,
      strokeColor: props.stroke,
      lineStyle: props.strokeDashArray ? 'dashed' : 'solid',
    },
    saveState
  );

  // Create the line - if we have multiple anchor points, add them
  tool.start();

  if (endpoints.anchorPoints && endpoints.anchorPoints.length > 2) {
    // Add all anchor points as waypoints
    endpoints.anchorPoints.forEach((point) => {
      tool.addPoint(point.x, point.y);
    });
    const newLine = tool.finish();

    if (newLine) {
      newLine.set({
        opacity: props.opacity,
        strokeLineJoin: props.strokeLineJoin,
        strokeLineCap: props.strokeLineCap,
      } as any);
      // Preserve ID and marker properties
      (newLine as any).id = props.id;
      (newLine as any).startMarkerType = props.startMarkerType;
      (newLine as any).endMarkerType = props.endMarkerType;

      // Preserve smart connector attachments
      if (props.startAttachment) (newLine as any).startAttachment = props.startAttachment;
      if (props.endAttachment) (newLine as any).endAttachment = props.endAttachment;

      // Preserve pathfinding properties
      if (props.autoPathfindingEnabled !== undefined) (newLine as any).autoPathfindingEnabled = props.autoPathfindingEnabled;
      if (props.manualPathOverride !== undefined) (newLine as any).manualPathOverride = props.manualPathOverride;

      // Re-register with ConnectionSyncManager if it has attachments
      if ((props.startAttachment || props.endAttachment) && (canvas as any).connectionSyncManager) {
        (canvas as any).connectionSyncManager.registerLine(
          (newLine as any).id,
          newLine,
          props.startAttachment,
          props.endAttachment
        );
      }

      // Update endpoint markers
      updateEndpointMarkers(canvas, newLine, props.startMarkerType, props.endMarkerType);

      canvas.requestRenderAll();
    }

    return newLine;
  } else {
    // Simple two-point line
    tool.addPoint(endpoints.start.x, endpoints.start.y);
    tool.addPoint(endpoints.end.x, endpoints.end.y);
    const newLine = tool.finish();

    if (newLine) {
      newLine.set({
        opacity: props.opacity,
        strokeLineJoin: props.strokeLineJoin,
        strokeLineCap: props.strokeLineCap,
      } as any);
      // Preserve ID and marker properties
      (newLine as any).id = props.id;
      (newLine as any).startMarkerType = props.startMarkerType;
      (newLine as any).endMarkerType = props.endMarkerType;

      // Preserve smart connector attachments
      if (props.startAttachment) (newLine as any).startAttachment = props.startAttachment;
      if (props.endAttachment) (newLine as any).endAttachment = props.endAttachment;

      // Preserve pathfinding properties
      if (props.autoPathfindingEnabled !== undefined) (newLine as any).autoPathfindingEnabled = props.autoPathfindingEnabled;
      if (props.manualPathOverride !== undefined) (newLine as any).manualPathOverride = props.manualPathOverride;

      // Re-register with ConnectionSyncManager if it has attachments
      if ((props.startAttachment || props.endAttachment) && (canvas as any).connectionSyncManager) {
        (canvas as any).connectionSyncManager.registerLine(
          (newLine as any).id,
          newLine,
          props.startAttachment,
          props.endAttachment
        );
      }

      // Update endpoint markers
      updateEndpointMarkers(canvas, newLine, props.startMarkerType, props.endMarkerType);

      canvas.requestRenderAll();
    }

    return newLine;
  }
}

/**
 * Convert line to bezier curve type
 */
export async function convertToBezierCurve(
  canvas: Canvas,
  lineObj: any,
  saveState?: () => void
): Promise<any | null> {
  const endpoints = extractLineEndpoints(lineObj);
  if (!endpoints) return null;

  const props = extractLineProperties(lineObj);

  // Remove old line
  canvas.remove(lineObj);

  // Create bezier tool
  const tool = new EnhancedBezierTool(canvas);

  // Create the bezier path
  tool.start();

  // Add anchor points
  if (endpoints.anchorPoints && endpoints.anchorPoints.length > 0) {
    endpoints.anchorPoints.forEach((point) => {
      tool.addPoint(point.x, point.y);
    });
  } else {
    // If no anchor points, just use start and end
    tool.addPoint(endpoints.start.x, endpoints.start.y);
    tool.addPoint(endpoints.end.x, endpoints.end.y);
  }

  const newLine = tool.finish();

  if (newLine) {
    // Apply preserved properties
    newLine.set({
      stroke: props.stroke,
      strokeWidth: props.strokeWidth,
      strokeDashArray: props.strokeDashArray,
      opacity: props.opacity,
      strokeLineJoin: props.strokeLineJoin,
      strokeLineCap: props.strokeLineCap,
    } as any);

    // Preserve ID and marker properties
    (newLine as any).id = props.id;
    (newLine as any).startMarkerType = props.startMarkerType;
    (newLine as any).endMarkerType = props.endMarkerType;

    // Preserve smart connector attachments
    if (props.startAttachment) (newLine as any).startAttachment = props.startAttachment;
    if (props.endAttachment) (newLine as any).endAttachment = props.endAttachment;

    // Preserve pathfinding properties
    if (props.autoPathfindingEnabled !== undefined) (newLine as any).autoPathfindingEnabled = props.autoPathfindingEnabled;
    if (props.manualPathOverride !== undefined) (newLine as any).manualPathOverride = props.manualPathOverride;

    // Re-register with ConnectionSyncManager if it has attachments
    if ((props.startAttachment || props.endAttachment) && (canvas as any).connectionSyncManager) {
      (canvas as any).connectionSyncManager.registerLine(
        (newLine as any).id,
        newLine,
        props.startAttachment,
        props.endAttachment
      );
    }

    // Update endpoint markers
    updateEndpointMarkers(canvas, newLine, props.startMarkerType, props.endMarkerType);

    // Note: tool.finish() already adds the line to canvas, so we don't call canvas.add() here
    canvas.requestRenderAll();
  }

  return newLine;
}

/**
 * Main conversion function that routes to appropriate converter
 */
export async function convertLineType(
  canvas: Canvas,
  lineObj: any,
  targetType: 'straight' | 'curved' | 'orthogonal' | 'bezier',
  saveState?: () => void
): Promise<any | null> {
  if (!canvas || !lineObj) return null;

  switch (targetType) {
    case 'straight':
      return convertToStraightLine(canvas, lineObj, saveState);
    case 'curved':
      return convertToCurvedLine(canvas, lineObj, saveState);
    case 'orthogonal':
      return convertToOrthogonalLine(canvas, lineObj, saveState);
    case 'bezier':
      return convertToBezierCurve(canvas, lineObj, saveState);
    default:
      return null;
  }
}

/**
 * Check if a line can be converted to a specific type
 */
export function canConvertTo(
  lineObj: any,
  targetType: 'straight' | 'curved' | 'orthogonal' | 'bezier'
): boolean {
  const endpoints = extractLineEndpoints(lineObj);
  if (!endpoints) return false;

  const anchorPointCount = endpoints.anchorPoints?.length || 2;

  // Lines with 2 anchor points can convert to any type
  if (anchorPointCount === 2) {
    return true;
  }

  // Lines with 3+ anchor points can only convert to orthogonal or bezier
  if (anchorPointCount > 2) {
    return targetType === 'orthogonal' || targetType === 'bezier';
  }

  return false;
}
