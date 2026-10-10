import { Path, Circle, Line as FabricLine, Canvas as FabricCanvas, Point, util } from "fabric";
import { calculateSmoothCurve, snapToGrid } from "./advancedLineSystem";
import { BezierPoint as BezierPointType } from "@/types/bezier";
import { v4 as uuidv4 } from 'uuid';
import { ConnectionPoint } from "@/types/effects";
import { snapToConnection } from "./connectionSnapping";
import { highlightConnectionPoint, unhighlightConnectionPoint } from "./connectionPoints";
import { findMinimalBezierWaypoints, waypointsToSmoothBezierPoints } from "./pathfinding";

// Re-export BezierPoint for backwards compatibility
export type BezierPoint = BezierPointType;

export class EnhancedBezierTool {
  private canvas: FabricCanvas;
  private points: BezierPoint[] = [];
  private tempPath: Path | null = null;
  private previewSegment: Path | null = null;
  private handles: Circle[] = [];
  private controlLines: FabricLine[] = [];
  private isDrawing: boolean = false;
  private smoothFactor: number = 0.5;
  private snapEnabled: boolean = true;
  private isClosed: boolean = false;
  private finishedPath: Path | null = null; // Store the last finished path
  private smartConnectorsEnabled: boolean = false;
  private autoPathfindingEnabled: boolean = false;
  private snapThreshold: number = 15;
  private tentativeStartAttachment?: ConnectionPoint;
  private tentativeEndAttachment?: ConnectionPoint;
  private lastHighlightedPointId?: string;

  constructor(canvas: FabricCanvas, options?: { smooth?: number; snap?: boolean }, smartConnectorsEnabled: boolean = false, snapThreshold: number = 15, autoPathfindingEnabled: boolean = false) {
    this.canvas = canvas;
    if (options?.smooth !== undefined) this.smoothFactor = options.smooth;
    if (options?.snap !== undefined) this.snapEnabled = options.snap;
    this.smartConnectorsEnabled = smartConnectorsEnabled;
    this.autoPathfindingEnabled = autoPathfindingEnabled;
    this.snapThreshold = snapThreshold;
  }

  private disableObjectInteraction(): void {
    this.canvas.skipTargetFind = true;
    this.canvas.selection = false;
    this.canvas.forEachObject((obj) => {
      const objData = obj as any;
      if (!objData.isTemp && !objData.isGridLine && !objData.isRuler) {
        obj.set({
          selectable: false,
          evented: false
        });
      }
    });
    this.canvas.requestRenderAll();
  }

  private enableObjectInteraction(): void {
    this.canvas.skipTargetFind = false;
    this.canvas.selection = true;
    this.canvas.forEachObject((obj) => {
      const objData = obj as any;
      if (!objData.isTemp && !objData.isGridLine && !objData.isRuler) {
        obj.set({
          selectable: true,
          evented: true
        });
      }
    });
    this.canvas.requestRenderAll();
  }

  // Start drawing mode
  start() {
    this.isDrawing = true;
    this.points = [];
    this.finishedPath = null; // Clear any previous finished path
    this.clearTemporaryObjects();
    this.disableObjectInteraction();
  }

  // Add point on click
  addPoint(x: number, y: number) {
    if (!this.isDrawing) return;

    let snappedX = this.snapEnabled ? snapToGrid(x, 10) : x;
    let snappedY = this.snapEnabled ? snapToGrid(y, 10) : y;

    // Try to snap to connection point
    const connectionSnap = snapToConnection(
      this.canvas,
      snappedX,
      snappedY,
      this.snapThreshold,
      this.smartConnectorsEnabled
    );

    const finalX = connectionSnap.connectionPoint ? connectionSnap.x : snappedX;
    const finalY = connectionSnap.connectionPoint ? connectionSnap.y : snappedY;

    // Store tentative attachment for first point
    if (this.points.length === 0 && connectionSnap.connectionPoint) {
      this.tentativeStartAttachment = connectionSnap.connectionPoint;
    }

    // Check if clicking near the last point to finish (when we have at least 2 points)
    if (this.points.length >= 2 && this.isClickNearLastPoint(finalX, finalY)) {
      this.isDrawing = false;
      return;
    }

    // Check if clicking near first point to close the path
    if (this.isCloseableDistance(finalX, finalY)) {
      this.closePath();
      return;
    }

    // Store tentative end attachment (will be overwritten for each new point)
    if (connectionSnap.connectionPoint) {
      this.tentativeEndAttachment = connectionSnap.connectionPoint;
    }

    // Add point with type and unique ID
    this.points.push({
      x: finalX,
      y: finalY,
      type: 'smooth',  // Default to smooth points
      id: uuidv4(),    // Generate unique ID
    });

    // Auto-calculate control points for smooth curve
    if (this.points.length > 1) {
      this.calculateControlPoints();
    }

    // Update visual representation
    this.updatePath();
    this.addPointHandle(finalX, finalY);

    // Auto-finish if we have at least 2 points and clicked a connection point
    // This handles: first point + connection point, or multiple points + connection point
    if (this.points.length >= 2 && connectionSnap.connectionPoint) {
      this.isDrawing = false;
    }
  }

  // Calculate control points for smooth bezier (Catmull-Rom style)
  private calculateControlPoints() {
    const tension = this.smoothFactor;

    if (this.isClosed && this.points.length >= 3) {
      // For closed paths, treat all points as interior points in a loop
      for (let i = 0; i < this.points.length; i++) {
        const prev = this.points[(i - 1 + this.points.length) % this.points.length];
        const curr = this.points[i];
        const next = this.points[(i + 1) % this.points.length];

        // Calculate tangent
        const tx = (next.x - prev.x) * tension;
        const ty = (next.y - prev.y) * tension;

        // Set control points
        curr.controlPoint1 = {
          x: curr.x - tx / 2,
          y: curr.y - ty / 2,
        };
        curr.controlPoint2 = {
          x: curr.x + tx / 2,
          y: curr.y + ty / 2,
        };
      }
    } else {
      // For open paths, handle interior points
      for (let i = 1; i < this.points.length - 1; i++) {
        const prev = this.points[i - 1];
        const curr = this.points[i];
        const next = this.points[i + 1];

        // Calculate tangent
        const tx = (next.x - prev.x) * tension;
        const ty = (next.y - prev.y) * tension;

        // Set control points
        curr.controlPoint1 = {
          x: curr.x - tx / 2,
          y: curr.y - ty / 2,
        };
        curr.controlPoint2 = {
          x: curr.x + tx / 2,
          y: curr.y + ty / 2,
        };
      }

      // First and last points for open paths
      if (this.points.length > 1) {
        const first = this.points[0];
        const second = this.points[1];
        first.controlPoint2 = {
          x: first.x + (second.x - first.x) * tension,
          y: first.y + (second.y - first.y) * tension,
        };

        const last = this.points[this.points.length - 1];
        const beforeLast = this.points[this.points.length - 2];
        last.controlPoint1 = {
          x: last.x - (last.x - beforeLast.x) * tension,
          y: last.y - (last.y - beforeLast.y) * tension,
        };
      }
    }
  }

  // Update the path visualization
  private updatePath() {
    if (this.points.length < 2) return;

    // Remove old path
    if (this.tempPath) {
      this.canvas.remove(this.tempPath);
    }

    // Build SVG path with smooth curves
    let pathData = `M ${this.points[0].x} ${this.points[0].y}`;

    for (let i = 0; i < this.points.length - 1; i++) {
      const curr = this.points[i];
      const next = this.points[i + 1];

      if (curr.controlPoint2 && next.controlPoint1) {
        // Cubic bezier with control points
        pathData += ` C ${curr.controlPoint2.x} ${curr.controlPoint2.y}, ${next.controlPoint1.x} ${next.controlPoint1.y}, ${next.x} ${next.y}`;
      } else {
        // Simple line if no control points
        pathData += ` L ${next.x} ${next.y}`;
      }
    }

    // Add closing bezier curve if path is closed
    if (this.isClosed && this.points.length >= 3) {
      const last = this.points[this.points.length - 1];
      const first = this.points[0];

      if (last.controlPoint2 && first.controlPoint1) {
        // Close with bezier curve
        pathData += ` C ${last.controlPoint2.x} ${last.controlPoint2.y}, ${first.controlPoint1.x} ${first.controlPoint1.y}, ${first.x} ${first.y}`;
      } else {
        // Fallback to straight line
        pathData += ' Z';
      }
    }

    // Create new path
    this.tempPath = new Path(pathData, {
      stroke: '#0D9488',
      strokeWidth: 2,
      fill: '',
      selectable: false,
      evented: false,
      strokeUniform: true,
    } as any);

    // Mark as temporary preview - should not be saved in history
    (this.tempPath as any).excludeFromExport = true;

    this.canvas.add(this.tempPath);
    this.canvas.requestRenderAll();
  }

  // Update preview segment from last point to cursor position
  updatePreview(x: number, y: number) {
    if (!this.isDrawing || this.points.length === 0) return;

    // Apply snapping
    let snappedX = this.snapEnabled ? snapToGrid(x, 10) : x;
    let snappedY = this.snapEnabled ? snapToGrid(y, 10) : y;

    // Try to snap to connection point
    const connectionSnap = snapToConnection(
      this.canvas,
      snappedX,
      snappedY,
      this.snapThreshold,
      this.smartConnectorsEnabled
    );

    // Highlight connection point if found
    if (connectionSnap.connectionPoint) {
      if (this.lastHighlightedPointId !== connectionSnap.connectionPoint.id) {
        // Unhighlight previous
        if (this.lastHighlightedPointId) {
          unhighlightConnectionPoint(this.canvas, this.lastHighlightedPointId);
        }
        // Highlight new
        highlightConnectionPoint(this.canvas, connectionSnap.connectionPoint.id);
        this.lastHighlightedPointId = connectionSnap.connectionPoint.id;
      }
    } else {
      // Unhighlight if no connection point
      if (this.lastHighlightedPointId) {
        unhighlightConnectionPoint(this.canvas, this.lastHighlightedPointId);
        this.lastHighlightedPointId = undefined;
      }
    }

    const finalX = connectionSnap.connectionPoint ? connectionSnap.x : snappedX;
    const finalY = connectionSnap.connectionPoint ? connectionSnap.y : snappedY;

    // Remove old preview segment
    if (this.previewSegment) {
      this.canvas.remove(this.previewSegment);
    }

    // Get the last added point
    const lastPoint = this.points[this.points.length - 1];

    // Create preview line from last point to cursor
    const pathData = `M ${lastPoint.x} ${lastPoint.y} L ${finalX} ${finalY}`;

    this.previewSegment = new Path(pathData, {
      stroke: '#0D9488',
      strokeWidth: 2,
      strokeDashArray: [5, 5], // Dashed line for preview
      fill: '',
      selectable: false,
      evented: false,
      strokeUniform: true,
      opacity: 0.6,
    } as any);

    (this.previewSegment as any).isTemp = true;
    (this.previewSegment as any).excludeFromExport = true;

    this.canvas.add(this.previewSegment);
    this.canvas.requestRenderAll();
  }

  // Add visual handle for point
  private addPointHandle(x: number, y: number) {
    const handle = new Circle({
      left: x,
      top: y,
      radius: 5,
      fill: '#0D9488',
      stroke: '#ffffff',
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
      selectable: false,
      evented: false,
    } as any);

    // Mark as temporary drawing handle - should not be saved in history
    (handle as any).isAnchorHandle = true;
    (handle as any).excludeFromExport = true;

    this.handles.push(handle);
    this.canvas.add(handle);
  }

  // Show control points (for editing)
  showControlPoints() {
    this.clearControlLines();

    this.points.forEach((point, index) => {
      if (point.controlPoint1) {
        this.addControlPoint(point.x, point.y, point.controlPoint1.x, point.controlPoint1.y, index, 1);
      }
      if (point.controlPoint2) {
        this.addControlPoint(point.x, point.y, point.controlPoint2.x, point.controlPoint2.y, index, 2);
      }
    });
  }

  // Add draggable control point
  private addControlPoint(
    anchorX: number,
    anchorY: number,
    cpX: number,
    cpY: number,
    pointIndex: number,
    controlIndex: number
  ) {
    // Line from anchor to control point
    const line = new FabricLine([anchorX, anchorY, cpX, cpY], {
      stroke: '#999',
      strokeWidth: 1,
      strokeDashArray: [5, 5],
      selectable: false,
      evented: false,
    } as any);

    // Mark as temporary drawing guide line - should not be saved in history
    (line as any).isGuideLine = true;
    (line as any).excludeFromExport = true;

    this.controlLines.push(line);
    this.canvas.add(line);

    // Control point handle
    const handle = new Circle({
      left: cpX,
      top: cpY,
      radius: 4,
      fill: '#ffffff',
      stroke: '#0D9488',
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
      selectable: true,
      evented: true,
      hasControls: false,
      hasBorders: false,
      hoverCursor: 'move',
    } as any);

    (handle as any).pointIndex = pointIndex;
    (handle as any).controlIndex = controlIndex;

    // Mark as temporary drawing handle - should not be saved in history
    (handle as any).isControlHandle = true;
    (handle as any).excludeFromExport = true;

    this.handles.push(handle);
    this.canvas.add(handle);
  }

  // Clear temporary objects
  private clearTemporaryObjects() {
    if (this.tempPath) {
      this.canvas.remove(this.tempPath);
      this.tempPath = null;
    }
    if (this.previewSegment) {
      this.canvas.remove(this.previewSegment);
      this.previewSegment = null;
    }
    this.clearHandles();
    this.clearControlLines();
  }

  private clearHandles() {
    this.handles.forEach(h => this.canvas.remove(h));
    this.handles = [];
  }

  private clearControlLines() {
    this.controlLines.forEach(l => this.canvas.remove(l));
    this.controlLines = [];
  }

  // Check if mouse is near first point for closing the path
  private isCloseableDistance(x: number, y: number): boolean {
    if (this.points.length < 3) return false; // Need at least 3 points to close

    const first = this.points[0];
    const distance = Math.sqrt((x - first.x) ** 2 + (y - first.y) ** 2);
    return distance < 15; // 15px threshold like CustomPolygonTool
  }

  // Check if mouse is near the last point to finish the line
  private isClickNearLastPoint(x: number, y: number): boolean {
    if (this.points.length < 2) return false; // Need at least 2 points to finish

    const last = this.points[this.points.length - 1];
    const distance = Math.sqrt((x - last.x) ** 2 + (y - last.y) ** 2);
    return distance < 15; // 15px threshold
  }

  // Update first point handle to show when path can be closed
  updateFirstPointHighlight(x: number, y: number): void {
    if (this.handles.length === 0 || this.points.length < 3) return;

    const isCloseable = this.isCloseableDistance(x, y);
    const firstHandle = this.handles[0];

    firstHandle.set({
      radius: isCloseable ? 6 : 5,
      fill: isCloseable ? '#FBBF24' : '#0D9488', // Brighter yellow when closeable
    });

    this.canvas.requestRenderAll();
  }

  // Update last point handle to show when line can be finished
  updateLastPointHighlight(x: number, y: number): void {
    if (this.handles.length < 2 || this.points.length < 2) return;

    const canFinish = this.isClickNearLastPoint(x, y);
    const lastHandle = this.handles[this.handles.length - 1];

    lastHandle.set({
      radius: canFinish ? 6 : 5,
      fill: canFinish ? '#FBBF24' : '#0D9488', // Brighter yellow when can finish
    });

    this.canvas.requestRenderAll();
  }

  // Close the path
  private closePath(): void {
    this.isClosed = true;
    // Recalculate control points treating all points as interior points in a loop
    this.calculateControlPoints();
    // Update the visual path to show the closing curve
    this.updatePath();
    this.finish();
  }

  // Finish drawing and return final path
  finish(): Path | null {
    // Guard against double-finalization. When the user closes a path by clicking
    // near the first point, closePath() calls finish() internally, and then
    // handleCanvasClick sees wasDrawing && !isStillDrawing and calls finish() a
    // second time. Return the already-created path instead of adding a duplicate.
    if (this.finishedPath) return this.finishedPath;

    // Only check if we have enough points - isDrawing may already be false from auto-finish
    if (this.points.length < 2) {
      this.cancel();
      return null;
    }

    this.isDrawing = false;

    // Apply auto-pathfinding when enabled and user drew exactly 2 anchor points
    console.debug('[BezierTool] finish() - autoPathfindingEnabled:', this.autoPathfindingEnabled, 'isClosed:', this.isClosed, 'points.length:', this.points.length);
    if (this.autoPathfindingEnabled && !this.isClosed && this.points.length === 2) {
      const startPt = this.points[0];
      const endPt = this.points[1];

      const excludeObjectIds: string[] = [];
      if (this.tentativeStartAttachment?.objectId) {
        excludeObjectIds.push(this.tentativeStartAttachment.objectId);
      }
      if (this.tentativeEndAttachment?.objectId) {
        excludeObjectIds.push(this.tentativeEndAttachment.objectId);
      }

      console.debug('[BezierTool] Running pathfinding from', startPt, 'to', endPt, 'excludeObjectIds:', excludeObjectIds);
      const waypoints = findMinimalBezierWaypoints(this.canvas, startPt, endPt, undefined, excludeObjectIds);
      console.debug('[BezierTool] Pathfinding returned', waypoints.length, 'waypoints:', waypoints);

      // Always apply waypoints (mirrors orthogonal tool — no length > 2 gate).
      // For a direct 2-point path, waypointsToSmoothBezierPoints produces a
      // clean straight cubic bezier, so there's no visual regression.
      this.points = waypointsToSmoothBezierPoints(waypoints, 20);
      console.debug('[BezierTool] Replaced points with', this.points.length, 'smooth bezier points');
    }

    // Create final path from points (in world coordinates)
    let pathData = `M ${this.points[0].x} ${this.points[0].y}`;

    for (let i = 0; i < this.points.length - 1; i++) {
      const curr = this.points[i];
      const next = this.points[i + 1];

      if (curr.controlPoint2 && next.controlPoint1) {
        pathData += ` C ${curr.controlPoint2.x} ${curr.controlPoint2.y}, ${next.controlPoint1.x} ${next.controlPoint1.y}, ${next.x} ${next.y}`;
      } else {
        pathData += ` L ${next.x} ${next.y}`;
      }
    }

    // Add closing bezier curve if path is closed
    if (this.isClosed && this.points.length >= 3) {
      const last = this.points[this.points.length - 1];
      const first = this.points[0];

      if (last.controlPoint2 && first.controlPoint1) {
        // Close with bezier curve
        pathData += ` C ${last.controlPoint2.x} ${last.controlPoint2.y}, ${first.controlPoint1.x} ${first.controlPoint1.y}, ${first.x} ${first.y}`;
      } else {
        // Fallback to straight line
        pathData += ' Z';
      }
    }

    const finalPath = new Path(pathData, {
      stroke: '#000000',
      strokeWidth: 2,
      fill: '',
      selectable: true,
      evented: true,
      strokeUniform: true,
    } as any);

    // Convert bezierPoints to local coordinates (relative to the path's coordinate system)
    // This ensures anchor points stay aligned when the path is moved
    const matrix = finalPath.calcTransformMatrix();
    const invMatrix = util.invertTransform(matrix);

    const localPoints: BezierPoint[] = this.points.map(point => {
      const localAnchor = util.transformPoint(
        new Point(point.x, point.y),
        invMatrix
      );

      const localPoint: BezierPoint = {
        x: localAnchor.x,
        y: localAnchor.y,
        type: point.type,
        id: point.id,
      };

      if (point.controlPoint1) {
        const localCp1 = util.transformPoint(
          new Point(point.controlPoint1.x, point.controlPoint1.y),
          invMatrix
        );
        localPoint.controlPoint1 = { x: localCp1.x, y: localCp1.y };
      }

      if (point.controlPoint2) {
        const localCp2 = util.transformPoint(
          new Point(point.controlPoint2.x, point.controlPoint2.y),
          invMatrix
        );
        localPoint.controlPoint2 = { x: localCp2.x, y: localCp2.y };
      }

      return localPoint;
    });

    // Store bezier data for future editing (in local coordinates)
    (finalPath as any).bezierPoints = localPoints;
    (finalPath as any).bezierPointsAreLocal = true;
    (finalPath as any).isBezierPath = true;
    (finalPath as any).isClosed = this.isClosed;
    (finalPath as any).id = uuidv4(); // Assign unique ID for history tracking
    (finalPath as any).autoPathfindingEnabled = this.autoPathfindingEnabled;
    (finalPath as any).manualPathOverride = false;

    // Store connection attachments if any
    if (this.tentativeStartAttachment) {
      (finalPath as any).startAttachment = {
        objectId: this.tentativeStartAttachment.objectId,
        pointPosition: this.tentativeStartAttachment.position,
        pointId: this.tentativeStartAttachment.id,
      };
    }
    if (this.tentativeEndAttachment) {
      (finalPath as any).endAttachment = {
        objectId: this.tentativeEndAttachment.objectId,
        pointPosition: this.tentativeEndAttachment.position,
        pointId: this.tentativeEndAttachment.id,
      };
    }

    // IMPORTANT: Override toObject to include custom properties in serialization
    // This ensures the properties are saved to JSON when canvas.toJSON() is called
    const originalToObject = finalPath.toObject.bind(finalPath);
    (finalPath as any).toObject = function(propertiesToInclude?: string[]) {
      return originalToObject([
        ...(propertiesToInclude || []),
        'bezierPoints',
        'bezierPointsAreLocal',
        'isBezierPath',
        'isClosed',
        'startAttachment',
        'endAttachment',
        'id',
        'autoPathfindingEnabled',
        'manualPathOverride',
      ]);
    };

    this.clearTemporaryObjects();
    this.canvas.add(finalPath);
    this.canvas.setActiveObject(finalPath);
    this.enableObjectInteraction();

    // Store the finished path so it can be retrieved later
    this.finishedPath = finalPath;

    return finalPath;
  }

  // Cancel drawing
  cancel() {
    // Unhighlight any highlighted connection points
    if (this.lastHighlightedPointId) {
      unhighlightConnectionPoint(this.canvas, this.lastHighlightedPointId);
      this.lastHighlightedPointId = undefined;
    }

    this.isDrawing = false;
    this.points = [];
    this.finishedPath = null;
    this.clearTemporaryObjects();
    this.enableObjectInteraction();
    this.tentativeStartAttachment = undefined;
    this.tentativeEndAttachment = undefined;
  }

  // Get current state
  getState() {
    return {
      isDrawing: this.isDrawing,
      pointCount: this.points.length,
    };
  }

  // Get world coordinate points (before conversion to local coordinates)
  getWorldPoints(): BezierPoint[] {
    // Return a deep copy to prevent external modification
    return this.points.map(point => ({
      x: point.x,
      y: point.y,
      type: point.type,
      id: point.id,
      controlPoint1: point.controlPoint1 ? { ...point.controlPoint1 } : undefined,
      controlPoint2: point.controlPoint2 ? { ...point.controlPoint2 } : undefined,
    }));
  }

  // Get the last finished path (useful when path auto-closes)
  getFinishedPath(): Path | null {
    return this.finishedPath;
  }
}
