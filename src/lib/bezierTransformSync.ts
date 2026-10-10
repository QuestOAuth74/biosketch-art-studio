import { Canvas, Path, util, Point as FabricPoint } from "fabric";
import { BezierPoint, BezierPath } from "@/types/bezier";
import { BezierEditMode } from "./bezierEditMode";

/**
 * Attach transform synchronization to a bezier path
 * Keeps anchor handles and control handles synchronized with path transforms
 * Pattern based on attachCurvedLineTransformSync from curvedLineTool.ts
 */
export function attachBezierTransformSync(
  canvas: Canvas,
  path: BezierPath,
  editMode: BezierEditMode
): void {
  // Initialize local coordinates on first attach
  initializeLocalCoordinates(path);

  const syncHandles = () => {
    if (!(path as any).isEditMode || !editMode.isActive()) {
      return; // Don't sync if not in edit mode
    }

    const bezierPoints = (path as any).bezierPoints as BezierPoint[];
    const localBezierPoints = (path as any).localBezierPoints as BezierPoint[];

    if (!bezierPoints || !localBezierPoints) return;

    const scaleX = path.scaleX || 1;
    const scaleY = path.scaleY || 1;
    const matrix = path.calcTransformMatrix();

    // Update world coordinates from local coordinates
    for (let i = 0; i < localBezierPoints.length; i++) {
      const localPoint = localBezierPoints[i];
      const worldPoint = bezierPoints[i];

      // Transform anchor point
      const transformedAnchor = util.transformPoint(
        new FabricPoint(localPoint.x, localPoint.y),
        matrix
      );
      worldPoint.x = transformedAnchor.x;
      worldPoint.y = transformedAnchor.y;

      // Transform control point 1
      if (localPoint.controlPoint1 && worldPoint.controlPoint1) {
        const transformedCp1 = util.transformPoint(
          new FabricPoint(localPoint.controlPoint1.x, localPoint.controlPoint1.y),
          matrix
        );
        worldPoint.controlPoint1.x = transformedCp1.x;
        worldPoint.controlPoint1.y = transformedCp1.y;
      }

      // Transform control point 2
      if (localPoint.controlPoint2 && worldPoint.controlPoint2) {
        const transformedCp2 = util.transformPoint(
          new FabricPoint(localPoint.controlPoint2.x, localPoint.controlPoint2.y),
          matrix
        );
        worldPoint.controlPoint2.x = transformedCp2.x;
        worldPoint.controlPoint2.y = transformedCp2.y;
      }
    }

    // Update visual handles (this will be called by editMode)
    updateVisualHandles(editMode, bezierPoints);

    // Update path geometry
    rebuildPathGeometry(path, bezierPoints);

    path.setCoords();
    canvas.requestRenderAll();
  };

  // Attach to all transform events
  path.on('scaling', syncHandles);
  path.on('rotating', syncHandles);
  path.on('moving', syncHandles);
  path.on('modified', syncHandles);
  path.on('skewing', syncHandles);

  // Initial sync
  syncHandles();
}

/**
 * Initialize local coordinate space for bezier points
 * Stores points in path's local coordinate system
 */
function initializeLocalCoordinates(path: BezierPath): void {
  const bezierPoints = (path as any).bezierPoints as BezierPoint[];
  if (!bezierPoints) return;

  // Calculate inverse transform matrix
  const matrix = path.calcTransformMatrix();
  const invMatrix = util.invertTransform(matrix);

  // Convert all points to local coordinates
  const localBezierPoints: BezierPoint[] = bezierPoints.map(point => {
    const localAnchor = util.transformPoint(
      new FabricPoint(point.x, point.y),
      invMatrix
    );

    const localPoint: BezierPoint = {
      x: localAnchor.x,
      y: localAnchor.y,
      type: point.type,
      id: point.id,
    };

    // Transform control point 1
    if (point.controlPoint1) {
      const localCp1 = util.transformPoint(
        new FabricPoint(point.controlPoint1.x, point.controlPoint1.y),
        invMatrix
      );
      localPoint.controlPoint1 = { x: localCp1.x, y: localCp1.y };
    }

    // Transform control point 2
    if (point.controlPoint2) {
      const localCp2 = util.transformPoint(
        new FabricPoint(point.controlPoint2.x, point.controlPoint2.y),
        invMatrix
      );
      localPoint.controlPoint2 = { x: localCp2.x, y: localCp2.y };
    }

    return localPoint;
  });

  (path as any).localBezierPoints = localBezierPoints;
}

/**
 * Update local coordinates after manual edit
 * Called when user drags anchor or control handles
 */
export function updateLocalCoordinates(path: BezierPath): void {
  const bezierPoints = (path as any).bezierPoints as BezierPoint[];
  if (!bezierPoints) return;

  // Recalculate inverse transform
  const matrix = path.calcTransformMatrix();
  const invMatrix = util.invertTransform(matrix);

  // Update local coordinates
  const localBezierPoints = (path as any).localBezierPoints as BezierPoint[];

  for (let i = 0; i < bezierPoints.length; i++) {
    const worldPoint = bezierPoints[i];
    const localPoint = localBezierPoints[i];

    // Transform anchor point
    const localAnchor = util.transformPoint(
      new FabricPoint(worldPoint.x, worldPoint.y),
      invMatrix
    );
    localPoint.x = localAnchor.x;
    localPoint.y = localAnchor.y;

    // Transform control point 1
    if (worldPoint.controlPoint1 && localPoint.controlPoint1) {
      const localCp1 = util.transformPoint(
        new FabricPoint(worldPoint.controlPoint1.x, worldPoint.controlPoint1.y),
        invMatrix
      );
      localPoint.controlPoint1.x = localCp1.x;
      localPoint.controlPoint1.y = localCp1.y;
    }

    // Transform control point 2
    if (worldPoint.controlPoint2 && localPoint.controlPoint2) {
      const localCp2 = util.transformPoint(
        new FabricPoint(worldPoint.controlPoint2.x, worldPoint.controlPoint2.y),
        invMatrix
      );
      localPoint.controlPoint2.x = localCp2.x;
      localPoint.controlPoint2.y = localCp2.y;
    }
  }
}

/**
 * Update visual handles (anchor handles and control handles)
 * This communicates with the BezierEditMode to update handle positions
 */
function updateVisualHandles(editMode: BezierEditMode, bezierPoints: BezierPoint[]): void {
  // The BezierEditMode class will handle updating its internal handles
  // This is a hook for future enhancements
  // For now, the handles are updated through the editMode's existing methods
}

/**
 * Rebuild path geometry from bezier points
 */
function rebuildPathGeometry(path: Path, bezierPoints: BezierPoint[]): void {
  if (bezierPoints.length < 2) return;

  // Build SVG path data
  let pathData = `M ${bezierPoints[0].x} ${bezierPoints[0].y}`;

  for (let i = 0; i < bezierPoints.length - 1; i++) {
    const curr = bezierPoints[i];
    const next = bezierPoints[i + 1];
    const cp1 = curr.controlPoint2 || curr;
    const cp2 = next.controlPoint1 || next;

    pathData += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${next.x} ${next.y}`;
  }

  // Update the path
  path.path = pathData as any;
}

/**
 * Detach transform synchronization from a bezier path
 */
export function detachBezierTransformSync(path: BezierPath): void {
  path.off('scaling');
  path.off('rotating');
  path.off('moving');
  path.off('modified');
  path.off('skewing');
}
