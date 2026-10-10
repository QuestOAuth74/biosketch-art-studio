import { Canvas, FabricObject, Path, util, Group, Point as FabricPoint } from "fabric";
import { ConnectionPoint } from "@/types/effects";
import { calculateConnectionPoints } from "./connectionPoints";
import { routeOrthogonal } from "./lineRouting";
import { findOrthogonalPath, findMinimalBezierWaypoints, waypointsToSmoothBezierPoints } from "./pathfinding";
import { updateEndpointMarkers } from "./lineEndpointRenderer";
import { applyCornerStyle } from "./lineStyleApplicator";

/**
 * Line attachment data structure
 */
export interface LineAttachment {
  objectId: string;
  pointPosition: 'top-left' | 'top' | 'top-right' | 'right' |
                 'bottom-right' | 'bottom' | 'bottom-left' | 'left';
  pointId: string;
}

/**
 * Manages line-to-object attachments and maintains connections when objects move
 */
export class ConnectionSyncManager {
  private canvas: Canvas;
  // Attachment index: Map<objectId, Set<lineId>>
  // Allows O(1) lookup of which lines are attached to an object
  private attachmentIndex: Map<string, Set<string>> = new Map();

  constructor(canvas: Canvas) {
    this.canvas = canvas;
  }

  /**
   * Register a line with its attachments in the index
   */
  registerLine(line: FabricObject): void {
    const lineData = line as any;
    const lineId = lineData.id;

    if (!lineId) return;

    // Register start attachment
    if (lineData.startAttachment) {
      const objectId = lineData.startAttachment.objectId;
      if (!this.attachmentIndex.has(objectId)) {
        this.attachmentIndex.set(objectId, new Set());
      }
      this.attachmentIndex.get(objectId)!.add(lineId);
    }

    // Register end attachment
    if (lineData.endAttachment) {
      const objectId = lineData.endAttachment.objectId;
      if (!this.attachmentIndex.has(objectId)) {
        this.attachmentIndex.set(objectId, new Set());
      }
      this.attachmentIndex.get(objectId)!.add(lineId);
    }
  }

  /**
   * Unregister a line from the attachment index
   */
  unregisterLine(line: FabricObject): void {
    const lineData = line as any;
    const lineId = lineData.id;

    if (!lineId) return;

    // Remove from all attachment sets
    this.attachmentIndex.forEach((lineIds, objectId) => {
      lineIds.delete(lineId);
      if (lineIds.size === 0) {
        this.attachmentIndex.delete(objectId);
      }
    });
  }

  /**
   * Update all lines attached to a moved object
   */
  updateAttachedLines(movedObject: FabricObject): void {
    const objectId = (movedObject as any).id;

    if (!objectId) return;

    const attachedLineIds = this.attachmentIndex.get(objectId);

    if (!attachedLineIds || attachedLineIds.size === 0) return;

    // Recalculate connection points for the moved object
    const connectionPoints = calculateConnectionPoints(movedObject);

    // Update each attached line
    attachedLineIds.forEach(lineId => {
      const line = this.findObjectById(lineId);
      if (line) {
        this.updateLineEndpoints(line, objectId, connectionPoints);
      }
    });

    this.canvas.requestRenderAll();
  }

  /**
   * Update line endpoints based on current connection point positions
   */
  private updateLineEndpoints(line: FabricObject, objectId: string, connectionPoints: ConnectionPoint[]): void {
    const lineData = line as any;
    const path = line as Path;

    // Track which endpoints were updated
    let startUpdated = false;
    let endUpdated = false;

    // Get current start/end positions
    let newStart: { x: number; y: number } | null = null;
    let newEnd: { x: number; y: number } | null = null;

    // Update start point if attached to this object
    if (lineData.startAttachment?.objectId === objectId) {
      const point = connectionPoints.find(
        cp => cp.position === lineData.startAttachment.pointPosition
      );
      if (point) {
        newStart = { x: point.x, y: point.y };
        startUpdated = true;
      }
    }

    // Update end point if attached to this object
    if (lineData.endAttachment?.objectId === objectId) {
      const point = connectionPoints.find(
        cp => cp.position === lineData.endAttachment.pointPosition
      );
      if (point) {
        newEnd = { x: point.x, y: point.y };
        endUpdated = true;
      }
    }

    // Only proceed if at least one endpoint needs updating
    if (!startUpdated && !endUpdated) return;

    // Handle different line types
    if (lineData.isStraightLine) {
      this.updateStraightLine(path, lineData, newStart, newEnd, startUpdated, endUpdated);
    } else if (lineData.isCurvedLine) {
      this.updateCurvedLine(path, lineData, newStart, newEnd, startUpdated, endUpdated);
    } else if (lineData.isOrthogonalLine) {
      this.updateOrthogonalLine(line, lineData, newStart, newEnd, startUpdated, endUpdated);
    } else if (lineData.isBezierPath) {
      this.updateBezierPath(line, lineData, newStart, newEnd, startUpdated, endUpdated);
    }

    // Update endpoint markers after line position changes
    if (lineData.startMarkerType || lineData.endMarkerType) {
      updateEndpointMarkers(
        this.canvas,
        line,
        lineData.startMarkerType || 'none',
        lineData.endMarkerType || 'none'
      );
    }
  }

  /**
   * Update a straight line's endpoints
   */
  private updateStraightLine(
    path: Path,
    lineData: any,
    newStart: { x: number; y: number } | null,
    newEnd: { x: number; y: number } | null,
    startUpdated: boolean,
    endUpdated: boolean
  ): void {
    // Get current coordinates - ALWAYS use stored coordinates for unattached endpoints
    const start = startUpdated && newStart ? newStart : lineData.straightLineStart;
    const end = endUpdated && newEnd ? newEnd : lineData.straightLineEnd;

    if (!start || !end) {
      console.warn('[ConnectionSync] Missing start or end coordinates');
      return;
    }

    // IMPORTANT: Only update stored coordinates if they were actually updated
    // This prevents drift from accumulated rounding errors
    if (startUpdated && newStart) {
      lineData.straightLineStart = { x: newStart.x, y: newStart.y };
    }
    if (endUpdated && newEnd) {
      lineData.straightLineEnd = { x: newEnd.x, y: newEnd.y };
    }

    // Create new path string with updated coordinates
    const newPathString = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;

    // Create a temporary path to get properly calculated dimensions
    const tempPath = new Path(newPathString);

    // Copy the calculated path properties from temp to existing path
    path.set({
      path: tempPath.path,
      pathOffset: tempPath.pathOffset,
      left: tempPath.left,
      top: tempPath.top,
      width: tempPath.width,
      height: tempPath.height,
    });

    path.setCoords();
    path.dirty = true;

    // CRITICAL FIX: Re-store the correct world coordinates AFTER updating the path
    // This prevents drift caused by the coordinate system change
    lineData.straightLineStart = { x: start.x, y: start.y };
    lineData.straightLineEnd = { x: end.x, y: end.y };

    // CRITICAL: Set flag to prevent transform sync from overwriting our coordinates
    // The transform sync extracts coords from path geometry with rounding errors
    lineData._skipTransformSync = true;

    // Fire modified event to trigger marker sync
    path.fire('modified');

    // Clear flag after event handlers run
    delete lineData._skipTransformSync;
  }

  /**
   * Update a curved line's endpoints
   */
  private updateCurvedLine(
    path: Path,
    lineData: any,
    newStart: { x: number; y: number } | null,
    newEnd: { x: number; y: number } | null,
    startUpdated: boolean,
    endUpdated: boolean
  ): void {
    // Get current coordinates - ALWAYS use stored coordinates for unattached endpoints
    const start = startUpdated && newStart ? newStart : lineData.curvedLineStart;
    const end = endUpdated && newEnd ? newEnd : lineData.curvedLineEnd;
    const control = lineData.curvedLineControlPoint;

    if (!start || !end || !control) {
      console.warn('[ConnectionSync] Missing coordinates');
      return;
    }

    // IMPORTANT: Only update stored coordinates if they were actually updated
    if (startUpdated && newStart) {
      lineData.curvedLineStart = { x: newStart.x, y: newStart.y };
    }
    if (endUpdated && newEnd) {
      lineData.curvedLineEnd = { x: newEnd.x, y: newEnd.y };
    }

    // Create new path string with updated coordinates
    const newPathString = `M ${start.x} ${start.y} Q ${control.x} ${control.y} ${end.x} ${end.y}`;

    // Create a temporary path to get properly calculated dimensions
    const tempPath = new Path(newPathString);

    // Copy the calculated path properties from temp to existing path
    path.set({
      path: tempPath.path,
      pathOffset: tempPath.pathOffset,
      left: tempPath.left,
      top: tempPath.top,
      width: tempPath.width,
      height: tempPath.height,
    });

    path.setCoords();
    path.dirty = true;

    // CRITICAL FIX: Re-store the correct world coordinates AFTER updating the path
    // This prevents drift caused by the coordinate system change
    lineData.curvedLineStart = { x: start.x, y: start.y };
    lineData.curvedLineEnd = { x: end.x, y: end.y };

    // CRITICAL: Set flag to prevent transform sync from overwriting our coordinates
    // The transform sync extracts coords from path geometry with rounding errors
    lineData._skipTransformSync = true;

    // Fire modified event to trigger marker sync
    path.fire('modified');

    // Clear flag after event handlers run
    delete lineData._skipTransformSync;
  }

  /**
   * Update an orthogonal line's endpoints
   */
  private updateOrthogonalLine(
    line: FabricObject,
    lineData: any,
    newStart: { x: number; y: number } | null,
    newEnd: { x: number; y: number } | null,
    startUpdated: boolean,
    endUpdated: boolean
  ): void {
    if (!lineData.orthogonalLineWaypoints || lineData.orthogonalLineWaypoints.length === 0) return;

    // Check if we should use auto-pathfinding to recalculate the entire path
    // Pathfinding works even without attachments - routes from first to last waypoint
    const shouldUsePathfinding =
      lineData.autoPathfindingEnabled &&
      !lineData.manualPathOverride &&
      (startUpdated || endUpdated);

    if (shouldUsePathfinding) {
      // Get the current start and end points (use new values if updated, otherwise use existing)
      const currentStart = newStart || lineData.orthogonalLineWaypoints[0];
      const currentEnd = newEnd || lineData.orthogonalLineWaypoints[lineData.orthogonalLineWaypoints.length - 1];

      if (currentStart && currentEnd) {
        // Collect object IDs to exclude from obstacle detection
        const excludeObjectIds: string[] = [];
        if (lineData.startAttachment?.objectId) {
          excludeObjectIds.push(lineData.startAttachment.objectId);
        }
        if (lineData.endAttachment?.objectId) {
          excludeObjectIds.push(lineData.endAttachment.objectId);
        }

        // Run pathfinding to get new waypoints
        const pathfindingResult = findOrthogonalPath(
          this.canvas,
          currentStart,
          currentEnd,
          lineData.id, // Exclude the line itself
          excludeObjectIds
        );

        // Update waypoints with pathfinding result
        lineData.orthogonalLineWaypoints = pathfindingResult;
      }
    } else {
      // Manual path or no pathfinding - just update start/end points
      if (startUpdated && newStart) {
        lineData.orthogonalLineWaypoints[0] = newStart;
      }

      if (endUpdated && newEnd) {
        const lastIndex = lineData.orthogonalLineWaypoints.length - 1;
        lineData.orthogonalLineWaypoints[lastIndex] = newEnd;
      }

      // Also update orthogonalWorldPoints if it exists (used in edit mode)
      if (lineData.orthogonalWorldPoints && Array.isArray(lineData.orthogonalWorldPoints)) {
        if (startUpdated && newStart) {
          lineData.orthogonalWorldPoints[0] = newStart;
        }
        if (endUpdated && newEnd) {
          const lastIndex = lineData.orthogonalWorldPoints.length - 1;
          lineData.orthogonalWorldPoints[lastIndex] = newEnd;
        }
      }
    }

    // Recalculate the orthogonal path geometry (always produces M/L-only path)
    this.recalculateOrthogonalPath(line, lineData);

    // Re-apply corner style if not sharp (recalculate always produces sharp M/L path)
    if (lineData.cornerStyle && lineData.cornerStyle !== 'sharp') {
      applyCornerStyle(line, lineData.cornerStyle);
    }

    // CRITICAL: Set flag to prevent any transform sync from overwriting our coordinates
    lineData._skipTransformSync = true;
    line.setCoords();
    line.dirty = true;
    line.fire('modified');
    delete lineData._skipTransformSync;
  }

  /**
   * Helper method to calculate orthogonal path from waypoints
   */
  private calculateOrthogonalPathFromWaypoints(points: Array<{ x: number; y: number }>): FabricPoint[] {
    if (points.length < 2) return [];

    const fabricPoints: FabricPoint[] = [];

    // Add first point
    fabricPoints.push(new FabricPoint(points[0].x, points[0].y));

    // For each segment, create orthogonal path
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1];
      const curr = points[i];

      const dx = Math.abs(curr.x - prev.x);
      const dy = Math.abs(curr.y - prev.y);

      // If only first and current point, use routeOrthogonal
      if (i === 1 && points.length === 2) {
        const orthogonalPoints = routeOrthogonal(
          new FabricPoint(prev.x, prev.y),
          new FabricPoint(curr.x, curr.y)
        );
        // Skip first point as it's already added
        fabricPoints.push(...orthogonalPoints.slice(1));
      } else {
        // Determine dominant direction and compute elbow point.
        // Only add the elbow if it's distinct from curr — when the segment is
        // already axis-aligned (horizontal or vertical), the elbow equals curr,
        // which would create a zero-length segment and break corner style rendering.
        const elbowX = dx > dy ? curr.x : prev.x;
        const elbowY = dx > dy ? prev.y : curr.y;
        if (elbowX !== curr.x || elbowY !== curr.y) {
          fabricPoints.push(new FabricPoint(elbowX, elbowY));
        }
        fabricPoints.push(new FabricPoint(curr.x, curr.y));
      }
    }

    return fabricPoints;
  }

  /**
   * Recalculate orthogonal path based on updated waypoints
   */
  public recalculateOrthogonalPath(line: FabricObject, lineData: any): void {
    const worldWaypoints = lineData.orthogonalLineWaypoints as Array<{ x: number; y: number }>;
    const isClosed = lineData.isClosed || false;

    if (!worldWaypoints || worldWaypoints.length < 2) {
      return;
    }

    // If closed, add closing segment from last point back to first
    let waypointsForPath = worldWaypoints;
    if (isClosed && worldWaypoints.length >= 3) {
      waypointsForPath = [...worldWaypoints, worldWaypoints[0]];
    }

    // Calculate orthogonal path from waypoints (in world coordinates)
    const orthogonalWorldPoints = this.calculateOrthogonalPathFromWaypoints(waypointsForPath);

    if (orthogonalWorldPoints.length < 2) {
      return;
    }

    // Build path data string from WORLD coordinates
    let pathData = `M ${orthogonalWorldPoints[0].x} ${orthogonalWorldPoints[0].y}`;
    for (let i = 1; i < orthogonalWorldPoints.length; i++) {
      pathData += ` L ${orthogonalWorldPoints[i].x} ${orthogonalWorldPoints[i].y}`;
    }

    // Create a temporary path to get properly calculated dimensions
    const tempPath = new Path(pathData);

    if (line instanceof Group) {
      // For groups with markers, we need to update both the path and the group
      const pathObj = (line as Group).getObjects()[0] as Path;

      if (pathObj) {
        // Copy path properties from temp path
        pathObj.set({
          path: tempPath.path,
          pathOffset: tempPath.pathOffset,
          left: tempPath.left,
          top: tempPath.top,
          width: tempPath.width,
          height: tempPath.height,
          dirty: true
        });
        pathObj.setCoords();

        // Update group to match the new path dimensions
        (line as Group).set({
          left: tempPath.left,
          top: tempPath.top,
          width: tempPath.width,
          height: tempPath.height,
          dirty: true
        });
        (line as Group).setCoords();

        // Convert world points to new local coordinates for marker positioning
        const newInvMatrix = util.invertTransform(line.calcTransformMatrix());
        const localPoints = orthogonalWorldPoints.map(wp =>
          util.transformPoint(wp, newInvMatrix)
        );

        // Store local points for marker sync
        lineData.orthogonalLineLocalPoints = localPoints;

        // CRITICAL: Also update local waypoints for edit mode
        // Convert world waypoints to new local coordinate system
        if (lineData.orthogonalLineWaypoints && Array.isArray(lineData.orthogonalLineWaypoints)) {
          const localWaypoints = lineData.orthogonalLineWaypoints.map((wp: any) =>
            util.transformPoint(new FabricPoint(wp.x, wp.y), newInvMatrix)
          );
          lineData.orthogonalLineLocalWaypoints = localWaypoints;
        }

        // Update marker positions and angles
        this.updateOrthogonalMarkers(line as Group, lineData, localPoints);
      }
    } else {
      // For simple paths without markers
      const pathObj = line as Path;

      // Copy properties from temp path
      pathObj.set({
        path: tempPath.path,
        pathOffset: tempPath.pathOffset,
        left: tempPath.left,
        top: tempPath.top,
        width: tempPath.width,
        height: tempPath.height,
        dirty: true
      });
      pathObj.setCoords();

      // Convert world points to new local coordinates
      const newInvMatrix = util.invertTransform(pathObj.calcTransformMatrix());
      const localPoints = orthogonalWorldPoints.map(wp =>
        util.transformPoint(wp, newInvMatrix)
      );

      // Store local points
      lineData.orthogonalLineLocalPoints = localPoints;

      // CRITICAL: Also update local waypoints for edit mode
      // Convert world waypoints to new local coordinate system
      if (lineData.orthogonalLineWaypoints && Array.isArray(lineData.orthogonalLineWaypoints)) {
        const localWaypoints = lineData.orthogonalLineWaypoints.map((wp: any) =>
          util.transformPoint(new FabricPoint(wp.x, wp.y), newInvMatrix)
        );
        lineData.orthogonalLineLocalWaypoints = localWaypoints;
      }
    }

    // Clear cached sharp route points - the new M/L path is the new source of truth
    lineData._sharpRoutePoints = null;
  }

  /**
   * Update marker positions for orthogonal lines
   */
  private updateOrthogonalMarkers(group: Group, lineData: any, localPoints: FabricPoint[]): void {
    const objects = group.getObjects();
    if (objects.length < 2 || localPoints.length < 2) return;

    const scaleX = group.scaleX || 1;
    const scaleY = group.scaleY || 1;

    // Update start marker (objects[1])
    if (objects[1]) {
      const startMarker = objects[1] as any;
      const angle = this.calculateAngleFromPoints(localPoints[1], localPoints[0]);

      startMarker.set({
        left: localPoints[0].x / scaleX,
        top: localPoints[0].y / scaleY,
        angle: angle
      });
      startMarker.setCoords();
    }

    // Update end marker (last object)
    if (objects.length > 2) {
      const endMarker = objects[objects.length - 1] as any;
      const lastIdx = localPoints.length - 1;
      const angle = this.calculateAngleFromPoints(localPoints[lastIdx - 1], localPoints[lastIdx]);

      endMarker.set({
        left: localPoints[lastIdx].x / scaleX,
        top: localPoints[lastIdx].y / scaleY,
        angle: angle
      });
      endMarker.setCoords();
    }
  }

  /**
   * Calculate angle between two points
   */
  private calculateAngleFromPoints(p1: FabricPoint, p2: FabricPoint): number {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return Math.atan2(dy, dx) * (180 / Math.PI);
  }

  /**
   * Update a bezier path's endpoints
   */
  private updateBezierPath(
    line: FabricObject,
    lineData: any,
    newStart: { x: number; y: number } | null,
    newEnd: { x: number; y: number } | null,
    startUpdated: boolean,
    endUpdated: boolean
  ): void {
    if (!lineData.bezierPoints || lineData.bezierPoints.length === 0) return;

    const path = line as Path;

    // Convert bezierPoints (stored in local coords) to world coordinates
    const matrix = path.calcTransformMatrix();

    // Build array of world coordinates for all anchor points and control points
    const worldAnchors = lineData.bezierPoints.map((point: any) =>
      util.transformPoint(new FabricPoint(point.x, point.y), matrix)
    );

    const worldCP1s = lineData.bezierPoints.map((point: any) =>
      point.controlPoint1
        ? util.transformPoint(new FabricPoint(point.controlPoint1.x, point.controlPoint1.y), matrix)
        : null
    );

    const worldCP2s = lineData.bezierPoints.map((point: any) =>
      point.controlPoint2
        ? util.transformPoint(new FabricPoint(point.controlPoint2.x, point.controlPoint2.y), matrix)
        : null
    );

    // Check if we should use auto-pathfinding to recalculate the entire path
    const shouldUsePathfinding =
      lineData.autoPathfindingEnabled &&
      !lineData.manualPathOverride &&
      (startUpdated || endUpdated);

    if (shouldUsePathfinding) {
      // Get current start/end (use new positions if an endpoint moved)
      const currentStart = newStart || { x: worldAnchors[0].x, y: worldAnchors[0].y };
      const currentEnd = newEnd || { x: worldAnchors[worldAnchors.length - 1].x, y: worldAnchors[worldAnchors.length - 1].y };

      const excludeObjectIds: string[] = [];
      if (lineData.startAttachment?.objectId) excludeObjectIds.push(lineData.startAttachment.objectId);
      if (lineData.endAttachment?.objectId) excludeObjectIds.push(lineData.endAttachment.objectId);

      const waypoints = findMinimalBezierWaypoints(this.canvas, currentStart, currentEnd, lineData.id, excludeObjectIds);

      if (waypoints.length >= 2) {
        const newBezierPts = waypointsToSmoothBezierPoints(waypoints);

        // Replace world coordinate arrays with new bezier-point data
        worldAnchors.length = 0;
        worldCP1s.length = 0;
        worldCP2s.length = 0;
        for (const bp of newBezierPts) {
          worldAnchors.push(new FabricPoint(bp.x, bp.y));
          worldCP1s.push(bp.controlPoint1 ? new FabricPoint(bp.controlPoint1.x, bp.controlPoint1.y) : null);
          worldCP2s.push(bp.controlPoint2 ? new FabricPoint(bp.controlPoint2.x, bp.controlPoint2.y) : null);
        }

        // Resize bezierPoints array so the local-coord conversion loop matches
        lineData.bezierPoints = newBezierPts.map((bp: any) => ({
          x: bp.x, y: bp.y, type: bp.type, id: bp.id,
          controlPoint1: bp.controlPoint1,
          controlPoint2: bp.controlPoint2,
        }));
      }
    } else {
      // Manual path or no pathfinding — just shift the endpoints by delta
      if (startUpdated && newStart) {
        const dx = newStart.x - worldAnchors[0].x;
        const dy = newStart.y - worldAnchors[0].y;

        worldAnchors[0].x = newStart.x;
        worldAnchors[0].y = newStart.y;

        if (worldCP1s[0]) {
          worldCP1s[0].x += dx;
          worldCP1s[0].y += dy;
        }
        if (worldCP2s[0]) {
          worldCP2s[0].x += dx;
          worldCP2s[0].y += dy;
        }
      }

      if (endUpdated && newEnd) {
        const lastIdx = worldAnchors.length - 1;
        const dx = newEnd.x - worldAnchors[lastIdx].x;
        const dy = newEnd.y - worldAnchors[lastIdx].y;

        worldAnchors[lastIdx].x = newEnd.x;
        worldAnchors[lastIdx].y = newEnd.y;

        if (worldCP1s[lastIdx]) {
          worldCP1s[lastIdx].x += dx;
          worldCP1s[lastIdx].y += dy;
        }
        if (worldCP2s[lastIdx]) {
          worldCP2s[lastIdx].x += dx;
          worldCP2s[lastIdx].y += dy;
        }
      }
    }

    // Build path string from world coordinates
    const isClosed = lineData.isClosed || false;
    let pathData = `M ${worldAnchors[0].x} ${worldAnchors[0].y}`;

    for (let i = 0; i < worldAnchors.length - 1; i++) {
      const cp1 = worldCP2s[i] || worldAnchors[i];
      const cp2 = worldCP1s[i + 1] || worldAnchors[i + 1];
      pathData += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${worldAnchors[i + 1].x} ${worldAnchors[i + 1].y}`;
    }

    if (isClosed && worldAnchors.length >= 3) {
      const lastIdx = worldAnchors.length - 1;
      const cp1 = worldCP2s[lastIdx] || worldAnchors[lastIdx];
      const cp2 = worldCP1s[0] || worldAnchors[0];
      pathData += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${worldAnchors[0].x} ${worldAnchors[0].y}`;
    }

    // Create a temporary path to get properly calculated dimensions
    const tempPath = new Path(pathData);

    // Copy the calculated path properties from temp to existing path
    path.set({
      path: tempPath.path,
      pathOffset: tempPath.pathOffset,
      left: tempPath.left,
      top: tempPath.top,
      width: tempPath.width,
      height: tempPath.height,
    });

    // Now convert the world coordinates back to the NEW local coordinate system
    const newInvMatrix = util.invertTransform(path.calcTransformMatrix());

    for (let i = 0; i < lineData.bezierPoints.length; i++) {
      const localAnchor = util.transformPoint(worldAnchors[i], newInvMatrix);
      lineData.bezierPoints[i].x = localAnchor.x;
      lineData.bezierPoints[i].y = localAnchor.y;

      if (lineData.bezierPoints[i].anchor) {
        lineData.bezierPoints[i].anchor = { x: localAnchor.x, y: localAnchor.y };
      }

      if (worldCP1s[i]) {
        const localCP1 = util.transformPoint(worldCP1s[i], newInvMatrix);
        lineData.bezierPoints[i].controlPoint1 = { x: localCP1.x, y: localCP1.y };
      }

      if (worldCP2s[i]) {
        const localCP2 = util.transformPoint(worldCP2s[i], newInvMatrix);
        lineData.bezierPoints[i].controlPoint2 = { x: localCP2.x, y: localCP2.y };
      }
    }

    // CRITICAL: Set flag to prevent any transform sync from overwriting our coordinates
    lineData._skipTransformSync = true;
    path.setCoords();
    path.dirty = true;
    path.fire('modified');
    delete lineData._skipTransformSync;
  }

  /**
   * Validate that a line's attachments are still valid
   * Returns true if attachments are valid, false otherwise
   */
  validateAttachments(line: FabricObject): boolean {
    const lineData = line as any;
    let isValid = true;

    // Check start attachment
    if (lineData.startAttachment) {
      const attachedObject = this.findObjectById(lineData.startAttachment.objectId);
      if (!attachedObject) {
        delete lineData.startAttachment;
        isValid = false;
      }
    }

    // Check end attachment
    if (lineData.endAttachment) {
      const attachedObject = this.findObjectById(lineData.endAttachment.objectId);
      if (!attachedObject) {
        delete lineData.endAttachment;
        isValid = false;
      }
    }

    return isValid;
  }

  /**
   * Reload all attachments from canvas objects
   * Call this after undo/redo or canvas reload
   */
  reloadAllAttachments(): void {
    // Clear existing index
    this.attachmentIndex.clear();

    // Rebuild index from all line objects
    this.canvas.forEachObject((obj) => {
      const objData = obj as any;
      if (
        objData.isStraightLine ||
        objData.isCurvedLine ||
        objData.isOrthogonalLine ||
        objData.isBezierPath
      ) {
        this.registerLine(obj);
      }
    });
  }

  /**
   * Clear attachment data from a line
   */
  clearAttachments(line: FabricObject): void {
    const lineData = line as any;

    this.unregisterLine(line);

    delete lineData.startAttachment;
    delete lineData.endAttachment;
  }

  /**
   * Find an object by ID
   */
  private findObjectById(id: string): FabricObject | null {
    let found: FabricObject | null = null;
    this.canvas.forEachObject((obj) => {
      if ((obj as any).id === id) {
        found = obj;
      }
    });
    return found;
  }


  /**
   * Get debug information about current attachments
   */
  getDebugInfo(): { objectId: string; lineCount: number }[] {
    const info: { objectId: string; lineCount: number }[] = [];
    this.attachmentIndex.forEach((lineIds, objectId) => {
      info.push({ objectId, lineCount: lineIds.size });
    });
    return info;
  }
}
