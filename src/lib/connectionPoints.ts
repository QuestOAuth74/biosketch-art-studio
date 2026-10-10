import { Canvas, Circle, FabricObject } from "fabric";
import { ConnectionPoint } from "@/types/effects";
import { v4 as uuidv4 } from 'uuid';

/**
 * Calculate connection points for a canvas object
 * Returns 8 points: 4 corners and 4 mid-points
 */
export function calculateConnectionPoints(obj: FabricObject): ConnectionPoint[] {
  if (!obj.width || !obj.height) return [];

  const points: ConnectionPoint[] = [];
  const objId = (obj as any).id || uuidv4();

  // Get object bounds
  const bounds = obj.getBoundingRect();
  const { left, top, width, height } = bounds;

  // Define connection point positions
  const positions = [
    { position: 'top-left' as const, x: left, y: top, relX: 0, relY: 0 },
    { position: 'top' as const, x: left + width / 2, y: top, relX: 0.5, relY: 0 },
    { position: 'top-right' as const, x: left + width, y: top, relX: 1, relY: 0 },
    { position: 'right' as const, x: left + width, y: top + height / 2, relX: 1, relY: 0.5 },
    { position: 'bottom-right' as const, x: left + width, y: top + height, relX: 1, relY: 1 },
    { position: 'bottom' as const, x: left + width / 2, y: top + height, relX: 0.5, relY: 1 },
    { position: 'bottom-left' as const, x: left, y: top + height, relX: 0, relY: 1 },
    { position: 'left' as const, x: left, y: top + height / 2, relX: 0, relY: 0.5 },
  ];

  positions.forEach(pos => {
    points.push({
      id: `${objId}-${pos.position}`,
      objectId: objId,
      x: pos.x,
      y: pos.y,
      relX: pos.relX,
      relY: pos.relY,
      position: pos.position,
    });
  });

  return points;
}

/**
 * Render connection points on canvas for a given object
 */
export function renderConnectionPoints(canvas: Canvas, obj: FabricObject): Circle[] {
  const points = calculateConnectionPoints(obj);
  const circles: Circle[] = [];

  points.forEach(point => {
    const circle = new Circle({
      left: point.x,
      top: point.y,
      radius: 5,
      fill: '#3b82f6',
      stroke: '#ffffff',
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
      hoverCursor: 'default',
    } as any);

    // Store connection point data on the circle
    (circle as any).isConnectionPoint = true;
    (circle as any).connectionPointData = point;

    circles.push(circle);
    canvas.add(circle);
  });

  return circles;
}

/**
 * Show connection points for all objects on canvas (except temp objects and lines)
 */
export function showAllConnectionPoints(canvas: Canvas): Circle[] {
  const allCircles: Circle[] = [];

  canvas.forEachObject((obj) => {
    const objData = obj as any;

    // Skip temporary objects, connection point circles, lines, and grid/ruler elements
    if (
      objData.isTemp ||
      objData.isConnectionPoint ||
      objData.isControlHandle ||
      objData.isAnchorHandle ||
      objData.isHandleLine ||
      objData.isGridLine ||
      objData.isRuler ||
      objData.isEndpointMarker ||
      obj.type === 'line' ||
      obj.type === 'path' ||
      objData.isFreeformLine ||
      objData.isConnector ||
      objData.isCurvedLine ||
      objData.isOrthogonalLine ||
      objData.isStraightLine ||
      objData.isBezierPath
    ) {
      return;
    }

    const circles = renderConnectionPoints(canvas, obj);
    allCircles.push(...circles);
  });

  canvas.requestRenderAll();
  return allCircles;
}

/**
 * Hide all connection points on canvas
 */
export function hideAllConnectionPoints(canvas: Canvas): void {
  const toRemove: FabricObject[] = [];

  canvas.forEachObject((obj) => {
    if ((obj as any).isConnectionPoint) {
      toRemove.push(obj);
    }
  });

  toRemove.forEach(obj => canvas.remove(obj));
  canvas.requestRenderAll();
}

/**
 * Find the nearest connection point to a given position
 * Returns the connection point and distance, or null if none within threshold
 */
export function findNearestConnectionPoint(
  canvas: Canvas,
  x: number,
  y: number,
  threshold: number = 15
): { point: ConnectionPoint; distance: number } | null {
  let nearestPoint: ConnectionPoint | null = null;
  let minDistance = threshold;

  canvas.forEachObject((obj) => {
    if ((obj as any).isConnectionPoint) {
      const circle = obj as Circle;
      const pointData = (circle as any).connectionPointData as ConnectionPoint;

      if (pointData) {
        const distance = Math.sqrt(
          Math.pow(pointData.x - x, 2) + Math.pow(pointData.y - y, 2)
        );

        if (distance < minDistance) {
          minDistance = distance;
          nearestPoint = pointData;
        }
      }
    }
  });

  return nearestPoint ? { point: nearestPoint, distance: minDistance } : null;
}

/**
 * Snap a point to the nearest connection point if within threshold
 */
export function snapToConnectionPoint(
  canvas: Canvas,
  x: number,
  y: number,
  threshold: number = 15
): { x: number; y: number; connectionPoint?: ConnectionPoint } {
  const nearest = findNearestConnectionPoint(canvas, x, y, threshold);

  if (nearest) {
    return {
      x: nearest.point.x,
      y: nearest.point.y,
      connectionPoint: nearest.point,
    };
  }

  return { x, y };
}

/**
 * Update connection points when an object moves
 * This should be called in the object:modified event
 */
export function updateConnectionPointsForObject(canvas: Canvas, obj: FabricObject): void {
  const objId = (obj as any).id;
  if (!objId) return;

  // Find all connection point circles for this object
  const connectionCircles: Circle[] = [];
  canvas.forEachObject((canvasObj) => {
    if ((canvasObj as any).isConnectionPoint) {
      const pointData = (canvasObj as any).connectionPointData as ConnectionPoint;
      if (pointData && pointData.objectId === objId) {
        connectionCircles.push(canvasObj as Circle);
      }
    }
  });

  // Recalculate connection points
  const newPoints = calculateConnectionPoints(obj);

  // Update each circle position
  connectionCircles.forEach((circle, index) => {
    if (newPoints[index]) {
      circle.set({
        left: newPoints[index].x,
        top: newPoints[index].y,
      });
      circle.setCoords();
      (circle as any).connectionPointData = newPoints[index];
    }
  });

  canvas.requestRenderAll();
}

/**
 * Highlight a connection point (make it larger/different color)
 */
export function highlightConnectionPoint(canvas: Canvas, pointId: string): void {
  canvas.forEachObject((obj) => {
    if ((obj as any).isConnectionPoint) {
      const pointData = (obj as any).connectionPointData as ConnectionPoint;
      if (pointData && pointData.id === pointId) {
        const circle = obj as Circle;
        circle.set({
          radius: 7,
          fill: '#10b981',
        } as any);
        circle.setCoords();
      }
    }
  });
  canvas.requestRenderAll();
}

/**
 * Unhighlight a connection point (return to normal appearance)
 */
export function unhighlightConnectionPoint(canvas: Canvas, pointId: string): void {
  canvas.forEachObject((obj) => {
    if ((obj as any).isConnectionPoint) {
      const pointData = (obj as any).connectionPointData as ConnectionPoint;
      if (pointData && pointData.id === pointId) {
        const circle = obj as Circle;
        circle.set({
          radius: 5,
          fill: '#3b82f6',
        } as any);
        circle.setCoords();
      }
    }
  });
  canvas.requestRenderAll();
}

/**
 * Check if a line endpoint is attached to a connection point
 */
export function isAttachedToConnectionPoint(
  lineEndpoint: { x: number; y: number },
  connectionPoint: ConnectionPoint,
  threshold: number = 2
): boolean {
  const distance = Math.sqrt(
    Math.pow(lineEndpoint.x - connectionPoint.x, 2) +
    Math.pow(lineEndpoint.y - connectionPoint.y, 2)
  );
  return distance < threshold;
}

/**
 * Get the object that a connection point belongs to
 */
export function getObjectForConnectionPoint(canvas: Canvas, pointId: string): FabricObject | null {
  let foundObject: FabricObject | null = null;

  canvas.forEachObject((obj) => {
    if ((obj as any).isConnectionPoint) {
      const pointData = (obj as any).connectionPointData as ConnectionPoint;
      if (pointData && pointData.id === pointId) {
        // Now find the actual object with this objectId
        canvas.forEachObject((canvasObj) => {
          if ((canvasObj as any).id === pointData.objectId) {
            foundObject = canvasObj;
          }
        });
      }
    }
  });

  return foundObject;
}
