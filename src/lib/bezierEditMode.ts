import { Canvas, Circle, Line as FabricLine, Path, Rect, util, Point as FabricPoint } from "fabric";
import { BezierPoint, BezierPath, BezierEditConfig, Point } from "@/types/bezier";
import {
  subdivideCubicBezier,
  findClosestPointOnPath,
  alignControlHandles,
  calculateAngle,
  vectorLength,
  getPointOnCubicBezier,
} from "./bezierMath";
import { v4 as uuidv4 } from 'uuid';
import { removeEndpointMarkers, updateEndpointMarkers } from "./lineEndpointRenderer";
import { snapToConnection } from "./connectionSnapping";
import { highlightConnectionPoint, unhighlightConnectionPoint } from "./connectionPoints";

const DEFAULT_CONFIG: BezierEditConfig = {
  anchorRadius: 6,
  controlHandleRadius: 5,
  smoothColor: '#10b981',
  cornerColor: '#3b82f6',
  selectedColor: '#f59e0b',
  guideLineColor: '#10b981',
  guideLineDash: [5, 3],
};

// Static counter for instance IDs
let bezierEditModeInstanceCounter = 0;

export class BezierEditMode {
  private instanceId: number;
  private canvas: Canvas;
  private path: BezierPath | null = null;
  private config: BezierEditConfig;
  private anchorHandles: Map<string, Circle | Rect> = new Map();
  private controlHandles: Map<string, Circle> = new Map();
  private guideLines: Map<string, FabricLine> = new Map();
  private selectedAnchorId: string | null = null;
  private hoverAnchorId: string | null = null;
  private pathDoubleClickHandler: ((e: any) => void) | null = null;
  private saveState?: () => void;
  private activationTime: number = 0;
  private lastAnchorCreationTime: number = 0;
  private blockAnchorClicks: boolean = false;
  private lastHighlightedPointId?: string;
  private snapThreshold: number = 15;
  /** Set to true by the dblclick handler when it successfully adds an anchor point.
   *  Read by FabricCanvas to decide whether to exit edit mode on background clicks. */
  public lastDblClickHandled: boolean = false;

  constructor(canvas: Canvas, config?: Partial<BezierEditConfig>, saveState?: () => void) {
    this.instanceId = ++bezierEditModeInstanceCounter;
    this.canvas = canvas;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.saveState = saveState;
  }

  /**
   * Activate edit mode for a bezier path
   */
  activate(path: Path): void {
    if (!path || !(path as any).isBezierPath) {
      console.warn('Can only edit bezier paths');
      return;
    }

    this.path = path as BezierPath;
    const bezierPoints = (this.path as any).bezierPoints as BezierPoint[];

    if (!bezierPoints || bezierPoints.length < 2) {
      console.warn('Path does not have valid bezier points');
      return;
    }

    // Mark path as in edit mode
    (this.path as any).isEditMode = true;

    // Record activation time to prevent the activation double-click from adding a point
    this.activationTime = Date.now();

    // Convert bezierPoints from world coordinates to local coordinates
    if (!(this.path as any).bezierPointsAreLocal) {
      const matrix = this.path.calcTransformMatrix();
      const invMatrix = util.invertTransform(matrix);

      bezierPoints.forEach(point => {
        const localAnchor = util.transformPoint(
          new FabricPoint(point.x, point.y),
          invMatrix
        );
        point.x = localAnchor.x;
        point.y = localAnchor.y;

        if (point.controlPoint1) {
          const localCp1 = util.transformPoint(
            new FabricPoint(point.controlPoint1.x, point.controlPoint1.y),
            invMatrix
          );
          point.controlPoint1.x = localCp1.x;
          point.controlPoint1.y = localCp1.y;
        }
        if (point.controlPoint2) {
          const localCp2 = util.transformPoint(
            new FabricPoint(point.controlPoint2.x, point.controlPoint2.y),
            invMatrix
          );
          point.controlPoint2.x = localCp2.x;
          point.controlPoint2.y = localCp2.y;
        }
      });

      (this.path as any).bezierPointsAreLocal = true;
    }

    // Deselect the path to hide the selection box/controls
    this.canvas.discardActiveObject();

    // Disable path selection/dragging while in edit mode
    // Keep evented:true so path can receive double-click events for adding anchor points
    // Disable caching to prevent clipping issues
    this.path.set({
      selectable: false,
      evented: true,
      objectCaching: false, // Prevents clipping during edit
      hoverCursor: 'crosshair', // Show crosshair cursor when hovering over path
    });

    // Remove endpoint markers when entering edit mode
    removeEndpointMarkers(this.canvas, this.path);

    // Create anchor handles for all points
    bezierPoints.forEach((point, index) => {
      this.createAnchorHandle(point);
    });

    // Remove any existing handler first to prevent duplicates
    if (this.pathDoubleClickHandler) {
      this.canvas.off('mouse:dblclick', this.pathDoubleClickHandler);
    }

    // Attach double-click handler to canvas for adding anchor points
    // (object-level double-click events aren't well supported, so use canvas-level event)
    this.pathDoubleClickHandler = (e: any) => {
      // Ignore double-clicks that happen too soon after activation
      // (prevents the activation double-click from adding an unwanted point)
      const timeSinceActivation = Date.now() - this.activationTime;
      if (timeSinceActivation < 50) {
        return;
      }

      // Skip if clicking on anchor handles or control handles — those have their own handlers
      const target = e.target;
      if (target && ((target as any).isAnchorHandle || (target as any).isControlHandle)) {
        return;
      }

      if (!this.path) return;

      // Get the pointer position relative to the canvas
      const pointer = this.canvas.getPointer(e.e);

      // Convert from canvas coordinates to local coordinates
      const invMatrix = util.invertTransform(this.path.calcTransformMatrix());
      const localPoint = util.transformPoint(
        new FabricPoint(pointer.x, pointer.y),
        invMatrix
      );

      // Fast path: if Fabric resolved the target as our path, add the anchor point directly
      if (target === this.path) {
        this.lastDblClickHandled = true;
        this.addAnchorPoint(localPoint.x, localPoint.y);
        return;
      }

      // Fallback: Fabric.js may not resolve the target to our path (e.g., when
      // selectable:false or z-order causes the path to be skipped). Use geometric
      // proximity to determine if the click was close enough to the path.
      const bezierPoints = (this.path as any).bezierPoints as BezierPoint[];
      if (!bezierPoints || bezierPoints.length < 2) return;

      const closest = findClosestPointOnPath(localPoint.x, localPoint.y, bezierPoints);
      if (!closest) return;

      // Distance in local coordinates — allow a generous hit tolerance (30px)
      const dx = localPoint.x - closest.point.x;
      const dy = localPoint.y - closest.point.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= 30) {
        this.lastDblClickHandled = true;
        this.addAnchorPoint(localPoint.x, localPoint.y);
      }
    };

    this.canvas.on('mouse:dblclick', this.pathDoubleClickHandler);

    this.canvas.requestRenderAll();
  }

  /**
   * Deactivate edit mode
   */
  deactivate(skipSave = false): void {
    if (!this.path) return;

    // Unblock anchor clicks in case we're exiting while blocked
    this.blockAnchorClicks = false;

    // Remove double-click event handler from canvas
    if (this.pathDoubleClickHandler) {
      this.canvas.off('mouse:dblclick', this.pathDoubleClickHandler);
      this.pathDoubleClickHandler = null;
    }

    // Remove all handles and guide lines
    this.clearHandles();

    // Clear any active selections that might reference handles
    this.canvas.discardActiveObject();

    // Keep bezierPoints in local coordinates - they should always be local
    // This ensures anchor points stay aligned when the path is moved
    const bezierPoints = (this.path as any).bezierPoints as BezierPoint[];
    if (bezierPoints && bezierPoints.length >= 2) {
      // Ensure the flag is set to local (it should already be, but just to be safe)
      (this.path as any).bezierPointsAreLocal = true;
    }

    // Mark path as not in edit mode
    (this.path as any).isEditMode = false;
    (this.path as any).selectedAnchorId = null;

    // Rebuild the path to recalculate dimensions
    // Don't normalize - let Fabric.js handle the coordinate system naturally
    this.rebuildPath();

    // Re-enable path selection and caching
    this.path.set({
      selectable: true,
      evented: true,
      objectCaching: true,
      dirty: true,
      hoverCursor: 'move', // Reset cursor back to default
    });

    // Force bounding box recalculation
    this.path.setCoords();

    // Restore endpoint markers when exiting edit mode
    const pathData = this.path as any;
    updateEndpointMarkers(
      this.canvas,
      this.path,
      pathData.startMarkerType || 'none',
      pathData.endMarkerType || 'none'
    );

    this.path = null;
    this.selectedAnchorId = null;
    this.hoverAnchorId = null;

    // Final cleanup: remove any objects with the edit mode flags
    const objectsToRemove = this.canvas.getObjects().filter((obj: any) =>
      obj.isAnchorHandle || obj.isControlHandle || obj.isGuideLine
    );
    objectsToRemove.forEach(obj => this.canvas.remove(obj));

    // Force multiple render passes to ensure cleanup
    this.canvas.requestRenderAll();
    setTimeout(() => this.canvas.requestRenderAll(), 0);

    // Save state after exiting edit mode to capture the edited path (unless skipSave is true)
    if (this.saveState && !skipSave) {
      // Use setTimeout to ensure all cleanup is complete before saving
      setTimeout(() => {
        if (this.saveState) {
          this.saveState();
        }
      }, 10);
    }
  }

  /**
   * Create visual anchor handle for a bezier point
   * @param point The bezier point to create a handle for
   * @param delayEvents If true, delay attaching mousedown handler to prevent double-click interference
   */
  private createAnchorHandle(point: BezierPoint, delayEvents: boolean = false): void {
    // Remove any existing handle for this point ID to prevent duplicates
    const existingHandle = this.anchorHandles.get(point.id);
    if (existingHandle) {
      this.canvas.remove(existingHandle);
      this.anchorHandles.delete(point.id);
    }

    const worldPoint = this.getWorldPoint(point);
    const isSmooth = point.type === 'smooth';

    let handle: Circle | Rect;

    if (isSmooth) {
      // Smooth points are circles
      handle = new Circle({
        left: worldPoint.x,
        top: worldPoint.y,
        radius: this.config.anchorRadius,
        fill: this.config.smoothColor,
        stroke: '#ffffff',
        strokeWidth: 2,
        originX: 'center',
        originY: 'center',
        selectable: !delayEvents, // Disable selection initially if delaying
        evented: !delayEvents, // Disable events initially if delaying
        hasControls: false,
        hasBorders: false,
        lockScalingX: true,
        lockScalingY: true,
        lockRotation: true,
        lockSkewingX: true,
        lockSkewingY: true,
        hoverCursor: 'move',
        objectCaching: false, // Disable caching to ensure visual changes are always rendered
      });
    } else {
      // Corner points are squares
      const size = this.config.anchorRadius * 2;
      handle = new Rect({
        left: worldPoint.x,
        top: worldPoint.y,
        width: size,
        height: size,
        fill: this.config.cornerColor,
        stroke: '#ffffff',
        strokeWidth: 2,
        originX: 'center',
        originY: 'center',
        selectable: !delayEvents, // Disable selection initially if delaying
        evented: !delayEvents, // Disable events initially if delaying
        hasControls: false,
        hasBorders: false,
        lockScalingX: true,
        lockScalingY: true,
        lockRotation: true,
        lockSkewingX: true,
        lockSkewingY: true,
        hoverCursor: 'move',
        objectCaching: false, // Disable caching to ensure visual changes are always rendered
      });
    }

    // Completely hide all selection controls
    handle.setControlsVisibility({
      tl: false,
      tr: false,
      br: false,
      bl: false,
      ml: false,
      mt: false,
      mr: false,
      mb: false,
      mtr: false,
    });

    // Flag and store metadata
    (handle as any).isAnchorHandle = true;
    (handle as any).pointId = point.id;
    (handle as any).excludeFromExport = true;

    // Attach event handlers (or delay them if requested)
    const attachEventHandlers = () => {
      handle.on('mousedown', () => this.handleAnchorClick(point.id));
      handle.on('moving', () => this.handleAnchorDrag(point.id));
      handle.on('modified', () => {
        this.recalculateHitArea();
        // Don't save state during edit mode - undo will reset to pre-edit state
      });
      handle.on('mouseover', () => this.handleAnchorHover(point.id));
      handle.on('mouseout', () => this.handleAnchorHoverOut());

      // Enable events and selection if they were delayed
      if (delayEvents) {
        handle.set({
          evented: true,
          selectable: true,
        });

        // Force the anchor to have unselected visual state
        const bezierPoints = (this.path as any)?.bezierPoints as BezierPoint[];
        const pt = bezierPoints?.find(p => p.id === point.id);
        if (pt) {
          const color = pt.type === 'smooth' ? this.config.smoothColor : this.config.cornerColor;
          handle.set({
            fill: color,
            strokeWidth: 2,
            scaleX: 1,
            scaleY: 1,
          });
        }

        this.canvas.requestRenderAll();
      }
    };

    if (delayEvents) {
      // Make anchor non-selectable initially to prevent Fabric.js selection styling
      handle.set({
        evented: false,
        selectable: false,
      });

      // Delay event attachment to prevent double-click's mousedown from firing on new anchor
      // Use setTimeout to let the current event processing complete
      setTimeout(attachEventHandlers, 100);
    } else {
      attachEventHandlers();
    }

    this.anchorHandles.set(point.id, handle);
    this.canvas.add(handle);
  }

  /**
   * Create control handles for a selected anchor point
   */
  private createControlHandles(pointId: string): void {
    if (!this.path) return;

    const bezierPoints = (this.path as any).bezierPoints as BezierPoint[];
    const point = bezierPoints.find(p => p.id === pointId);
    if (!point) return;

    const worldPoint = this.getWorldPoint(point);

    // Create handle for controlPoint1 (incoming)
    if (point.controlPoint1) {
      const worldCp1 = this.getWorldPoint(point.controlPoint1);
      const handle1 = this.createControlHandle(worldCp1, pointId, 1);
      this.controlHandles.set(`${pointId}-cp1`, handle1);
      this.canvas.add(handle1);

      // Create guide line
      const guideLine1 = this.createGuideLine(worldPoint, worldCp1);
      this.guideLines.set(`${pointId}-line1`, guideLine1);
      this.canvas.add(guideLine1);
    }

    // Create handle for controlPoint2 (outgoing)
    if (point.controlPoint2) {
      const worldCp2 = this.getWorldPoint(point.controlPoint2);
      const handle2 = this.createControlHandle(worldCp2, pointId, 2);
      this.controlHandles.set(`${pointId}-cp2`, handle2);
      this.canvas.add(handle2);

      // Create guide line
      const guideLine2 = this.createGuideLine(worldPoint, worldCp2);
      this.guideLines.set(`${pointId}-line2`, guideLine2);
      this.canvas.add(guideLine2);
    }
  }

  /**
   * Create a single control handle
   */
  private createControlHandle(worldPoint: Point, pointId: string, handleIndex: number): Circle {
    const handle = new Circle({
      left: worldPoint.x,
      top: worldPoint.y,
      radius: this.config.controlHandleRadius,
      fill: '#ffffff',
      stroke: this.config.guideLineColor,
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
      selectable: true,
      evented: true,
      hasControls: false,
      hasBorders: false,
      lockScalingX: true,
      lockScalingY: true,
      lockRotation: true,
      lockSkewingX: true,
      lockSkewingY: true,
      hoverCursor: 'move',
    });

    // Completely hide all selection controls
    handle.setControlsVisibility({
      tl: false,
      tr: false,
      br: false,
      bl: false,
      ml: false,
      mt: false,
      mr: false,
      mb: false,
      mtr: false,
    });

    (handle as any).isControlHandle = true;
    (handle as any).pointId = pointId;
    (handle as any).handleIndex = handleIndex;
    (handle as any).excludeFromExport = true;

    handle.on('moving', () => this.handleControlDrag(pointId, handleIndex));
    handle.on('modified', () => {
      this.recalculateHitArea();
      // Don't save state during edit mode - undo will reset to pre-edit state
    });

    return handle;
  }

  /**
   * Create guide line connecting anchor to control handle
   */
  private createGuideLine(start: Point, end: Point): FabricLine {
    const line = new FabricLine([start.x, start.y, end.x, end.y], {
      stroke: this.config.guideLineColor,
      strokeWidth: 1,
      strokeDashArray: this.config.guideLineDash,
      selectable: false,
      evented: false,
    });

    (line as any).isGuideLine = true;
    (line as any).excludeFromExport = true;

    return line;
  }

  /**
   * Handle anchor point click
   */
  private handleAnchorClick(pointId: string): void {

    // Block all anchor clicks if flag is set (e.g., right after creating a new anchor)
    if (this.blockAnchorClicks) {
      return;
    }

    // If clicking already selected anchor, do nothing
    if (this.selectedAnchorId === pointId) {
      return;
    }

    // Clear previous selection
    if (this.selectedAnchorId) {
      this.deselectAnchor(this.selectedAnchorId);
    }

    // Select new anchor
    this.selectAnchor(pointId);
  }

  /**
   * Select an anchor point
   */
  private selectAnchor(pointId: string): void {

    // First, reset ALL anchor handles to their default appearance
    // This ensures no orphaned "selected" visual states
    this.resetAllAnchorVisuals();

    this.selectedAnchorId = pointId;
    if (this.path) {
      (this.path as any).selectedAnchorId = pointId;
    }

    // Update anchor visual (highlight)
    const handle = this.anchorHandles.get(pointId);
    if (handle) {
      handle.set({
        fill: this.config.selectedColor,
        strokeWidth: 3,
        scaleX: 1.2,
        scaleY: 1.2,
      });
      handle.setCoords(); // Update coordinates after scale change
      handle.dirty = true; // Mark as dirty to ensure re-render
    } else {
    }

    // Show control handles
    this.createControlHandles(pointId);

    this.canvas.requestRenderAll();
  }

  /**
   * Reset all anchor handles to their default (unselected) appearance
   */
  private resetAllAnchorVisuals(): void {
    if (!this.path) return;

    const bezierPoints = (this.path as any).bezierPoints as BezierPoint[];

    this.anchorHandles.forEach((handle, pointId) => {
      const point = bezierPoints.find(p => p.id === pointId);
      if (point) {
        const color = point.type === 'smooth' ? this.config.smoothColor : this.config.cornerColor;
        handle.set({
          fill: color,
          strokeWidth: 2,
          scaleX: 1,
          scaleY: 1,
        });
        handle.setCoords(); // Ensure coordinates are updated after scale change
        handle.dirty = true; // Mark as dirty to force re-render
      }
    });

    // Force canvas update
    this.canvas.requestRenderAll();
  }

  /**
   * Force reset a specific anchor's visual state to unselected
   */
  private forceResetAnchorVisual(pointId: string): void {
    if (!this.path) return;

    const bezierPoints = (this.path as any).bezierPoints as BezierPoint[];
    const point = bezierPoints.find(p => p.id === pointId);
    const handle = this.anchorHandles.get(pointId);

    if (point && handle) {
      const color = point.type === 'smooth' ? this.config.smoothColor : this.config.cornerColor;
      handle.set({
        fill: color,
        strokeWidth: 2,
        scaleX: 1,
        scaleY: 1,
      });
      handle.setCoords();
    }
  }

  /**
   * Deselect an anchor point
   */
  private deselectAnchor(pointId: string): void {
    // Restore anchor visual
    const handle = this.anchorHandles.get(pointId);
    if (handle && this.path) {
      const bezierPoints = (this.path as any).bezierPoints as BezierPoint[];
      const point = bezierPoints.find(p => p.id === pointId);
      if (point) {
        const color = point.type === 'smooth' ? this.config.smoothColor : this.config.cornerColor;
        handle.set({
          fill: color,
          strokeWidth: 2,
          scaleX: 1,
          scaleY: 1,
        });
      }
    }

    // Remove control handles
    this.clearControlHandles();
  }

  /**
   * Handle anchor point hover
   */
  private handleAnchorHover(pointId: string): void {
    this.hoverAnchorId = pointId;
    // Could add visual feedback here if desired
  }

  /**
   * Handle anchor point hover out
   */
  private handleAnchorHoverOut(): void {
    this.hoverAnchorId = null;
  }

  /**
   * Handle anchor point drag
   */
  private handleAnchorDrag(pointId: string): void {
    if (!this.path) return;

    const handle = this.anchorHandles.get(pointId);
    if (!handle) return;

    const bezierPoints = (this.path as any).bezierPoints as BezierPoint[];
    const pointIndex = bezierPoints.findIndex(p => p.id === pointId);
    if (pointIndex === -1) return;

    const point = bezierPoints[pointIndex];
    const isClosed = (this.path as any).isClosed;

    // Get new position in world coordinates
    let newWorldX = handle.left!;
    let newWorldY = handle.top!;

    // Only snap first and last anchors to connection points
    const isEndpoint = pointIndex === 0 || pointIndex === bezierPoints.length - 1;
    if (isEndpoint) {
      // Try to snap to connection point
      const connectionSnap = snapToConnection(
        this.canvas,
        newWorldX,
        newWorldY,
        this.snapThreshold,
        true
      );

      if (connectionSnap.connectionPoint) {
        if (this.lastHighlightedPointId && this.lastHighlightedPointId !== connectionSnap.connectionPoint.id) {
          unhighlightConnectionPoint(this.canvas, this.lastHighlightedPointId);
        }
        highlightConnectionPoint(this.canvas, connectionSnap.connectionPoint.id);
        this.lastHighlightedPointId = connectionSnap.connectionPoint.id;

        // Snap to connection point
        newWorldX = connectionSnap.x;
        newWorldY = connectionSnap.y;
        handle.set({ left: newWorldX, top: newWorldY });
        handle.setCoords();

        // Update attachment
        const attachmentKey = pointIndex === 0 ? 'startAttachment' : 'endAttachment';
        (this.path as any)[attachmentKey] = {
          objectId: connectionSnap.connectionPoint.objectId,
          pointPosition: connectionSnap.connectionPoint.position,
          pointId: connectionSnap.connectionPoint.id,
        };
      } else {
        if (this.lastHighlightedPointId) {
          unhighlightConnectionPoint(this.canvas, this.lastHighlightedPointId);
          this.lastHighlightedPointId = undefined;
        }

        // Clear attachment if dragged away
        const attachmentKey = pointIndex === 0 ? 'startAttachment' : 'endAttachment';
        if ((this.path as any)[attachmentKey]) {
          delete (this.path as any)[attachmentKey];
        }
      }
    }

    // Convert to local coordinates using inverse transform matrix
    const invMatrix = util.invertTransform(this.path.calcTransformMatrix());
    const localPoint = util.transformPoint(
      new FabricPoint(newWorldX, newWorldY),
      invMatrix
    );

    // Calculate delta (how much the anchor moved)
    const deltaX = localPoint.x - point.x;
    const deltaY = localPoint.y - point.y;

    // Update bezier point with local coordinates
    point.x = localPoint.x;
    point.y = localPoint.y;

    // Move control points by the same delta to maintain relative positions
    if (point.controlPoint1) {
      point.controlPoint1.x += deltaX;
      point.controlPoint1.y += deltaY;
    }
    if (point.controlPoint2) {
      point.controlPoint2.x += deltaX;
      point.controlPoint2.y += deltaY;
    }

    // Rebuild path
    this.rebuildPath();

    // Update control handles if this point is selected
    if (this.selectedAnchorId === pointId) {
      this.updateControlHandles(pointId);
    }

    this.canvas.requestRenderAll();
  }

  /**
   * Handle control handle drag
   */
  private handleControlDrag(pointId: string, handleIndex: number): void {
    if (!this.path) return;

    const handleKey = `${pointId}-cp${handleIndex}`;
    const handle = this.controlHandles.get(handleKey);
    if (!handle) return;

    const bezierPoints = (this.path as any).bezierPoints as BezierPoint[];
    const point = bezierPoints.find(p => p.id === pointId);
    if (!point) return;

    // Get new position in world coordinates
    const newWorldX = handle.left!;
    const newWorldY = handle.top!;

    // Convert to local coordinates using inverse transform matrix
    const invMatrix = util.invertTransform(this.path.calcTransformMatrix());
    const localPoint = util.transformPoint(
      new FabricPoint(newWorldX, newWorldY),
      invMatrix
    );

    // Update control point with local coordinates
    if (handleIndex === 1 && point.controlPoint1) {
      point.controlPoint1.x = localPoint.x;
      point.controlPoint1.y = localPoint.y;

      // For smooth points, align opposite handle
      if (point.type === 'smooth' && point.controlPoint2) {
        // alignControlHandles mirrors the 3rd param's direction to create new cp1
        // So we pass CP1 as 3rd param to get mirrored CP2
        const aligned = alignControlHandles(
          { x: point.x, y: point.y },
          point.controlPoint2,  // cp1 in function (will be mirrored)
          point.controlPoint1,  // cp2 in function (direction source)
          true
        );
        point.controlPoint2 = aligned.cp1;  // Use cp1 result as new CP2

        // Update opposite handle visual (convert local to world for positioning)
        const oppositeHandle = this.controlHandles.get(`${pointId}-cp2`);
        if (oppositeHandle) {
          const worldCp2 = this.getWorldPoint(aligned.cp1);
          oppositeHandle.set({ left: worldCp2.x, top: worldCp2.y });
          oppositeHandle.setCoords();
        }
      }
    } else if (handleIndex === 2 && point.controlPoint2) {
      point.controlPoint2.x = localPoint.x;
      point.controlPoint2.y = localPoint.y;

      // For smooth points, align opposite handle
      if (point.type === 'smooth' && point.controlPoint1) {
        // alignControlHandles mirrors the 3rd param's direction to create new cp1
        // So we pass CP2 as 3rd param to get mirrored CP1
        const aligned = alignControlHandles(
          { x: point.x, y: point.y },
          point.controlPoint1,  // cp1 in function (will be mirrored)
          point.controlPoint2,  // cp2 in function (direction source)
          true
        );
        point.controlPoint1 = aligned.cp1;  // Use cp1 result as new CP1

        // Update opposite handle visual (convert local to world for positioning)
        const oppositeHandle = this.controlHandles.get(`${pointId}-cp1`);
        if (oppositeHandle) {
          const worldCp1 = this.getWorldPoint(aligned.cp1);
          oppositeHandle.set({ left: worldCp1.x, top: worldCp1.y });
          oppositeHandle.setCoords();
        }
      }
    }

    // Rebuild path
    this.rebuildPath();

    // Update guide lines
    this.updateGuideLines(pointId);

    this.canvas.requestRenderAll();
  }

  /**
   * Update control handles positions
   */
  private updateControlHandles(pointId: string): void {
    if (!this.path) return;

    const bezierPoints = (this.path as any).bezierPoints as BezierPoint[];
    const point = bezierPoints.find(p => p.id === pointId);
    if (!point) return;

    const worldPoint = this.getWorldPoint(point);

    // Update cp1 handle
    if (point.controlPoint1) {
      const worldCp1 = this.getWorldPoint(point.controlPoint1);
      const handle1 = this.controlHandles.get(`${pointId}-cp1`);
      if (handle1) {
        handle1.set({ left: worldCp1.x, top: worldCp1.y });
        handle1.setCoords(); // Update interactive coordinates
      }
    }

    // Update cp2 handle
    if (point.controlPoint2) {
      const worldCp2 = this.getWorldPoint(point.controlPoint2);
      const handle2 = this.controlHandles.get(`${pointId}-cp2`);
      if (handle2) {
        handle2.set({ left: worldCp2.x, top: worldCp2.y });
        handle2.setCoords(); // Update interactive coordinates
      }
    }

    this.updateGuideLines(pointId);
  }

  /**
   * Update guide lines for an anchor point
   */
  private updateGuideLines(pointId: string): void {
    if (!this.path) return;

    const bezierPoints = (this.path as any).bezierPoints as BezierPoint[];
    const point = bezierPoints.find(p => p.id === pointId);
    if (!point) return;

    const worldPoint = this.getWorldPoint(point);

    // Update line1
    if (point.controlPoint1) {
      const worldCp1 = this.getWorldPoint(point.controlPoint1);
      const line1 = this.guideLines.get(`${pointId}-line1`);
      if (line1) {
        line1.set({
          x1: worldPoint.x,
          y1: worldPoint.y,
          x2: worldCp1.x,
          y2: worldCp1.y,
        });
        line1.setCoords();
      }
    }

    // Update line2
    if (point.controlPoint2) {
      const worldCp2 = this.getWorldPoint(point.controlPoint2);
      const line2 = this.guideLines.get(`${pointId}-line2`);
      if (line2) {
        line2.set({
          x1: worldPoint.x,
          y1: worldPoint.y,
          x2: worldCp2.x,
          y2: worldCp2.y,
        });
        line2.setCoords();
      }
    }
  }

  /**
   * Normalize the path so bezierPoints start at (0, 0) and adjust path position
   * Called once in activate() to prevent shift on first drag
   */
  private normalizePath(): void {
    if (!this.path) return;

    const bezierPoints = (this.path as any).bezierPoints as BezierPoint[];
    if (bezierPoints.length < 2) return;

    // Find bounding box
    let minX = Infinity, minY = Infinity;
    bezierPoints.forEach(point => {
      minX = Math.min(minX, point.x);
      minY = Math.min(minY, point.y);
      if (point.controlPoint1) {
        minX = Math.min(minX, point.controlPoint1.x);
        minY = Math.min(minY, point.controlPoint1.y);
      }
      if (point.controlPoint2) {
        minX = Math.min(minX, point.controlPoint2.x);
        minY = Math.min(minY, point.controlPoint2.y);
      }
    });

    // If already normalized, skip
    if (minX === 0 && minY === 0) return;

    // Normalize bezierPoints
    bezierPoints.forEach(point => {
      point.x -= minX;
      point.y -= minY;
      if (point.controlPoint1) {
        point.controlPoint1.x -= minX;
        point.controlPoint1.y -= minY;
      }
      if (point.controlPoint2) {
        point.controlPoint2.x -= minX;
        point.controlPoint2.y -= minY;
      }
    });

    // Build normalized path data
    let pathData = `M ${bezierPoints[0].x} ${bezierPoints[0].y}`;
    for (let i = 0; i < bezierPoints.length - 1; i++) {
      const curr = bezierPoints[i];
      const next = bezierPoints[i + 1];
      const cp1 = curr.controlPoint2 || curr;
      const cp2 = next.controlPoint1 || next;
      pathData += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${next.x} ${next.y}`;
    }

    // Transform the offset to world coordinates
    const matrix = this.path.calcTransformMatrix();
    const offsetWorld = util.transformPoint(new FabricPoint(minX, minY), matrix);
    const originWorld = util.transformPoint(new FabricPoint(0, 0), matrix);

    // Update path data and position
    this.path.set({
      path: util.parsePath(pathData),
      left: (this.path.left || 0) + (offsetWorld.x - originWorld.x),
      top: (this.path.top || 0) + (offsetWorld.y - originWorld.y),
      dirty: true,
    });

    this.path.setCoords();
  }

  /**
   * Recalculate the path's hit detection area
   * Call this after drag operations complete to update clickable regions
   */
  private recalculateHitArea(): void {
    if (!this.path) return;

    const bezierPoints = (this.path as any).bezierPoints as BezierPoint[];
    if (bezierPoints.length < 2) return;

    // Build path data from bezierPoints
    let pathData = `M ${bezierPoints[0].x} ${bezierPoints[0].y}`;
    for (let i = 0; i < bezierPoints.length - 1; i++) {
      const curr = bezierPoints[i];
      const next = bezierPoints[i + 1];
      const cp1 = curr.controlPoint2 || curr;
      const cp2 = next.controlPoint1 || next;
      pathData += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${next.x} ${next.y}`;
    }

    // Add closing bezier curve if path is closed
    const isClosed = (this.path as any).isClosed;
    if (isClosed && bezierPoints.length >= 3) {
      const last = bezierPoints[bezierPoints.length - 1];
      const first = bezierPoints[0];
      const cp1 = last.controlPoint2 || last;
      const cp2 = first.controlPoint1 || first;
      pathData += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${first.x} ${first.y}`;
    }

    // Update path with new data
    this.path.set({
      path: util.parsePath(pathData),
      dirty: true,
    });

    this.path.setCoords();
  }

  /**
   * Rebuild the path from bezier points (in local coordinates)
   * During edit mode, we don't normalize to avoid position drift
   */
  private rebuildPath(): void {
    if (!this.path) return;

    const bezierPoints = (this.path as any).bezierPoints as BezierPoint[];
    if (bezierPoints.length < 2) return;

    const isEditMode = (this.path as any).isEditMode;
    const isClosed = (this.path as any).isClosed;


    // Build path data from bezierPoints (allow negative coords during edit mode)
    let pathData = `M ${bezierPoints[0].x} ${bezierPoints[0].y}`;
    for (let i = 0; i < bezierPoints.length - 1; i++) {
      const curr = bezierPoints[i];
      const next = bezierPoints[i + 1];
      const cp1 = curr.controlPoint2 || curr;
      const cp2 = next.controlPoint1 || next;
      pathData += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${next.x} ${next.y}`;
    }

    // Add closing bezier curve if path is closed
    if (isClosed && bezierPoints.length >= 3) {
      const last = bezierPoints[bezierPoints.length - 1];
      const first = bezierPoints[0];
      const cp1 = last.controlPoint2 || last;
      const cp2 = first.controlPoint1 || first;
      pathData += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${first.x} ${first.y}`;
    }

    if (isEditMode) {
      // During edit mode: just update path data without recalculating dimensions
      // This prevents position drift and keeps everything stable while dragging
      this.path.set({
        path: util.parsePath(pathData),
        pathOffset: new FabricPoint(0, 0),
        dirty: true,
      });
      this.path.setCoords();
    } else {
      // When NOT in edit mode (e.g., on exit): let Fabric.js recalculate dimensions
      // Capture old dimensions before _setPath changes them
      const oldWidth = this.path.width || 0;
      const oldHeight = this.path.height || 0;

      this.path.path = util.parsePath(pathData);
      (this.path as any)._setPath(this.path.path);

      // _setPath() calculated a pathOffset. Instead of resetting it, adjust bezierPoints to match
      const newPathOffset = { x: this.path.pathOffset?.x || 0, y: this.path.pathOffset?.y || 0 };

      // Shift all bezierPoints by the pathOffset so they're relative to the new origin
      for (const point of bezierPoints) {
        point.x -= newPathOffset.x;
        point.y -= newPathOffset.y;
        if (point.controlPoint1) {
          point.controlPoint1.x -= newPathOffset.x;
          point.controlPoint1.y -= newPathOffset.y;
        }
        if (point.controlPoint2) {
          point.controlPoint2.x -= newPathOffset.x;
          point.controlPoint2.y -= newPathOffset.y;
        }
      }

      // Now rebuild the path with the adjusted bezierPoints
      let adjustedPathData = `M ${bezierPoints[0].x} ${bezierPoints[0].y}`;
      for (let i = 0; i < bezierPoints.length - 1; i++) {
        const curr = bezierPoints[i];
        const next = bezierPoints[i + 1];
        const cp1 = curr.controlPoint2 || curr;
        const cp2 = next.controlPoint1 || next;
        adjustedPathData += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${next.x} ${next.y}`;
      }

      // Add closing bezier curve if path is closed
      if (isClosed && bezierPoints.length >= 3) {
        const last = bezierPoints[bezierPoints.length - 1];
        const first = bezierPoints[0];
        const cp1 = last.controlPoint2 || last;
        const cp2 = first.controlPoint1 || first;
        adjustedPathData += ` C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${first.x} ${first.y}`;
      }

      // Set the adjusted path (this will recalculate dimensions)
      this.path.set({
        path: util.parsePath(adjustedPathData),
        pathOffset: new FabricPoint(0, 0),
        dirty: true,
      });

      // Get new dimensions after setting adjusted path
      const newWidth = this.path.width || 0;
      const newHeight = this.path.height || 0;

      // Compensate for dimension changes (objects are center-based in Fabric.js)
      // When width changes, center x shifts by half the change
      const widthDelta = newWidth - oldWidth;
      const heightDelta = newHeight - oldHeight;

      // Adjust position: add pathOffset and compensate for dimension changes
      this.path.set({
        left: (this.path.left || 0) + newPathOffset.x - widthDelta / 2,
        top: (this.path.top || 0) + newPathOffset.y - heightDelta / 2,
      });

      this.path.setCoords();
    }

    this.updateAnchorHandles();
    this.canvas.requestRenderAll();
  }

  /**
   * Clear all control handles and guide lines
   */
  private clearControlHandles(): void {
    // Remove control handles
    this.controlHandles.forEach(handle => {
      this.canvas.remove(handle);
    });
    this.controlHandles.clear();

    // Remove guide lines
    this.guideLines.forEach(line => {
      this.canvas.remove(line);
    });
    this.guideLines.clear();

    // Force canvas to update and remove any lingering objects
    this.canvas.renderOnAddRemove = true;
  }

  /**
   * Clear all handles (anchor + control)
   */
  private clearHandles(): void {
    // Remove anchor handles
    this.anchorHandles.forEach(handle => {
      this.canvas.remove(handle);
    });
    this.anchorHandles.clear();

    // Remove control handles and guide lines
    this.clearControlHandles();

    // Force canvas to clean up removed objects
    this.canvas.renderOnAddRemove = true;
  }

  /**
   * Get world coordinates for a point (accounting for path transforms)
   */
  private getWorldPoint(point: Point): Point {
    if (!this.path) return point;

    // Convert from local coordinates to world coordinates using transform matrix
    const matrix = this.path.calcTransformMatrix();

    const worldPoint = util.transformPoint(
      new FabricPoint(point.x, point.y),
      matrix
    );

    return {
      x: worldPoint.x,
      y: worldPoint.y
    };
  }

  /**
   * Update anchor handle positions (called after transform)
   */
  updateAnchorHandles(): void {
    if (!this.path) return;

    const bezierPoints = (this.path as any).bezierPoints as BezierPoint[];

    bezierPoints.forEach(point => {
      const handle = this.anchorHandles.get(point.id);
      if (handle) {
        const worldPoint = this.getWorldPoint(point);
        handle.set({ left: worldPoint.x, top: worldPoint.y });
        handle.setCoords();
      }
    });
  }

  /**
   * Toggle anchor point type between smooth and corner
   */
  togglePointType(pointId: string): void {
    if (!this.path) return;

    const bezierPoints = (this.path as any).bezierPoints as BezierPoint[];
    const point = bezierPoints.find(p => p.id === pointId);
    if (!point) return;

    // Toggle type
    const oldType = point.type;
    const newType = point.type === 'smooth' ? 'corner' : 'smooth';
    point.type = newType;

    // If switching to smooth and the point has both control points, align them
    if (newType === 'smooth' && point.controlPoint1 && point.controlPoint2) {
      const aligned = alignControlHandles(
        { x: point.x, y: point.y },
        point.controlPoint1,
        point.controlPoint2,
        true // maintain lengths
      );
      point.controlPoint1 = aligned.cp1;
      point.controlPoint2 = aligned.cp2;

      // Rebuild path with aligned handles
      this.rebuildPath();
    }

    // Update anchor handle visual
    const handle = this.anchorHandles.get(pointId);
    if (handle) {
      // Remove old handle
      this.canvas.remove(handle);
      this.anchorHandles.delete(pointId);

      // Create new handle with correct shape
      this.createAnchorHandle(point);

      // If this point is selected, clear old control handles and reselect to show new controls
      if (this.selectedAnchorId === pointId) {
        // Clear old control handles before creating new ones
        this.clearControlHandles();
        this.selectAnchor(pointId);
      }
    }

    this.canvas.requestRenderAll();
    if (this.saveState) this.saveState();
  }

  /**
   * Get the currently selected anchor ID
   */
  getSelectedAnchorId(): string | null {
    return this.selectedAnchorId;
  }

  /**
   * Check if edit mode is active
   */
  isActive(): boolean {
    return this.path !== null;
  }

  /**
   * Debug method to log the complete state of all anchor handles
   */
  debugState(): void {

    if (this.path) {
      const bezierPoints = (this.path as any).bezierPoints as BezierPoint[];

      this.anchorHandles.forEach((handle, pointId) => {
        const point = bezierPoints.find(p => p.id === pointId);
        const expectedColor = point?.type === 'smooth' ? this.config.smoothColor : this.config.cornerColor;
        const actualFill = handle.fill;
        const isSelectedColor = actualFill === this.config.selectedColor;
      });
    }
  }

  /**
   * Add a new anchor point at the clicked position on the path
   */
  addAnchorPoint(x: number, y: number): void {
    if (!this.path) return;

    const bezierPoints = (this.path as any).bezierPoints as BezierPoint[];
    if (bezierPoints.length < 2) return;


    // Deselect any currently selected anchor
    if (this.selectedAnchorId) {
      this.deselectAnchor(this.selectedAnchorId);
      this.selectedAnchorId = null;
    }

    // Find closest point on path
    const result = findClosestPointOnPath(x, y, bezierPoints);
    if (!result) return;

    const { segmentIndex, t } = result;

    // Get the segment
    const p0 = bezierPoints[segmentIndex];
    const p1 = bezierPoints[segmentIndex + 1];
    const cp1 = p0.controlPoint2 || p0;
    const cp2 = p1.controlPoint1 || p1;

    // Subdivide the cubic bezier curve at parameter t
    const subdivided = subdivideCubicBezier(t, p0, cp1, cp2, p1);

    // Create new anchor point at the split position
    const newPoint: BezierPoint = {
      x: subdivided.left.p1.x,
      y: subdivided.left.p1.y,
      controlPoint1: subdivided.left.cp2,
      controlPoint2: subdivided.right.cp1,
      type: 'smooth',  // New points default to smooth
      id: uuidv4(),
    };

    // Update control points of surrounding points
    p0.controlPoint2 = subdivided.left.cp1;
    p1.controlPoint1 = subdivided.right.cp2;

    // Insert new point into array
    bezierPoints.splice(segmentIndex + 1, 0, newPoint);

    // Store the new point ID so we can verify its state after the delay
    const newPointId = newPoint.id;

    // Create anchor handle for new point, but delay attaching event handlers
    // This prevents the double-click's mousedown events from immediately firing on the new anchor
    this.createAnchorHandle(newPoint, true);

    // Block all anchor clicks temporarily to prevent the double-click from triggering selections
    // The createAnchorHandle with delayEvents=true will enable the anchor's events after 100ms,
    // but we keep click blocking for a bit longer to ensure the double-click event is fully processed
    this.blockAnchorClicks = true;

    setTimeout(() => {
      this.blockAnchorClicks = false;

      // After unblocking, force reset the new anchor's visual state
      // This ensures it's definitely not showing as selected
      this.forceResetAnchorVisual(newPointId);

      // Also reset all anchor visuals to be safe
      this.resetAllAnchorVisuals();

      this.canvas.requestRenderAll();

      // Debug: log the complete state
      this.debugState();
    }, 200);

    // Rebuild path
    this.rebuildPath();


    this.canvas.requestRenderAll();
    if (this.saveState) this.saveState();
  }

  /**
   * Delete an anchor point
   */
  deleteAnchorPoint(pointId: string): void {
    if (!this.path) return;

    const bezierPoints = (this.path as any).bezierPoints as BezierPoint[];
    const pointIndex = bezierPoints.findIndex(p => p.id === pointId);

    if (pointIndex === -1) return;

    // Prevent deletion if less than 2 points would remain
    if (bezierPoints.length <= 2) {
      console.warn('Cannot delete - path must have at least 2 points');
      return;
    }

    // If deleting selected point, deselect first
    if (this.selectedAnchorId === pointId) {
      this.deselectAnchor(pointId);
      this.selectedAnchorId = null;
    }

    // Remove anchor handle
    const handle = this.anchorHandles.get(pointId);
    if (handle) {
      this.canvas.remove(handle);
      this.anchorHandles.delete(pointId);
    }

    // Remove the point from array
    const deletedPoint = bezierPoints.splice(pointIndex, 1)[0];

    // Recalculate control points for neighbors
    // This ensures smooth transition after deletion
    if (pointIndex > 0 && pointIndex < bezierPoints.length) {
      const prev = bezierPoints[pointIndex - 1];
      const next = bezierPoints[pointIndex];

      // Average the control points for smooth transition
      if (deletedPoint.controlPoint1 && deletedPoint.controlPoint2) {
        prev.controlPoint2 = deletedPoint.controlPoint1;
        next.controlPoint1 = deletedPoint.controlPoint2;
      }
    }

    // Rebuild path
    this.rebuildPath();

    // Recalculate hit area after deleting point
    this.recalculateHitArea();

    this.canvas.requestRenderAll();
    if (this.saveState) this.saveState();
  }

  /**
   * Handle click on path curve to add new point
   */
  handlePathClick(x: number, y: number): void {
    // Only add point if no anchor is selected
    // (clicking an anchor selects it instead)
    if (!this.hoverAnchorId) {
      this.addAnchorPoint(x, y);
    }
  }
}
