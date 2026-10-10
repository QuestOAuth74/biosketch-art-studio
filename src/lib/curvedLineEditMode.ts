import { Canvas, Path, Circle, Line, util, Point as FabricPoint } from "fabric";
import { removeEndpointMarkers, updateEndpointMarkers } from "./lineEndpointRenderer";
import { snapToConnection } from "./connectionSnapping";
import { highlightConnectionPoint, unhighlightConnectionPoint } from "./connectionPoints";

export class CurvedLineEditMode {
  private canvas: Canvas;
  private curvedLine: Path | null = null;
  private saveState?: () => void;
  private static activationCounter = new Map<string, number>(); // Track activations per line ID
  private lastHighlightedPointId?: string;
  private snapThreshold: number = 15;

  constructor(canvas: Canvas, saveState?: () => void) {
    this.canvas = canvas;
    this.saveState = saveState;
  }

  /**
   * Helper to snap a point to connection and update attachments
   */
  private snapAndUpdateAttachment(
    point: { x: number; y: number },
    handle: Circle,
    isStart: boolean
  ): { x: number; y: number } {
    const curveData = this.curvedLine as any;

    // Try to snap to connection point
    const connectionSnap = snapToConnection(
      this.canvas,
      point.x,
      point.y,
      this.snapThreshold,
      true
    );

    // Highlight connection point if found
    if (connectionSnap.connectionPoint) {
      if (this.lastHighlightedPointId && this.lastHighlightedPointId !== connectionSnap.connectionPoint.id) {
        unhighlightConnectionPoint(this.canvas, this.lastHighlightedPointId);
      }
      highlightConnectionPoint(this.canvas, connectionSnap.connectionPoint.id);
      this.lastHighlightedPointId = connectionSnap.connectionPoint.id;

      // Snap to connection point
      const snappedPoint = { x: connectionSnap.x, y: connectionSnap.y };
      handle.set({ left: snappedPoint.x, top: snappedPoint.y });
      handle.setCoords();

      // Update attachment
      const attachmentKey = isStart ? 'startAttachment' : 'endAttachment';
      curveData[attachmentKey] = {
        objectId: connectionSnap.connectionPoint.objectId,
        pointPosition: connectionSnap.connectionPoint.position,
        pointId: connectionSnap.connectionPoint.id,
      };

      return snappedPoint;
    } else {
      if (this.lastHighlightedPointId) {
        unhighlightConnectionPoint(this.canvas, this.lastHighlightedPointId);
        this.lastHighlightedPointId = undefined;
      }

      // Clear attachment if dragged away
      const attachmentKey = isStart ? 'startAttachment' : 'endAttachment';
      if (curveData[attachmentKey]) {
        delete curveData[attachmentKey];
      }

      return point;
    }
  }

  /**
   * Update handle positions based on path geometry
   */
  private updateHandlePositions(): void {
    if (!this.curvedLine) return;

    const curveData = this.curvedLine as any;
    const mainPath = this.curvedLine as Path;
    const controlHandle = curveData.controlHandle as Circle;
    const handleLines = curveData.handleLines as [Line, Line];
    if (!mainPath || !controlHandle || !handleLines) {
      console.warn('[updateHandlePositions] Missing curved line components for position update');
      return;
    }

    // CRITICAL FIX: Extract coordinates FROM the path geometry (source of truth)
    // The path geometry maintains full precision after undo/redo, while stored
    // local coordinates get rounded during JSON serialization

    const pathData = mainPath.path;
    if (!pathData || pathData.length < 2) {
      console.warn('[updateHandlePositions] Invalid path data');
      return;
    }

    let localStart: { x: number; y: number } | null = null;
    let localEnd: { x: number; y: number } | null = null;
    let localControl: { x: number; y: number } | null = null;

    // Extract from M command
    if (pathData[0][0] === 'M' && pathData[0].length >= 3) {
      localStart = { x: pathData[0][1] as number, y: pathData[0][2] as number };
    }

    // Extract from Q command
    for (const command of pathData) {
      if (command[0] === 'Q' && command.length >= 5) {
        localControl = { x: command[1] as number, y: command[2] as number };
        localEnd = { x: command[3] as number, y: command[4] as number };
        break;
      }
    }

    if (!localStart || !localEnd || !localControl) {
      console.warn('[updateHandlePositions] Could not extract path points');
      return;
    }


    // Update stored local coordinates with the extracted values (full precision)
    curveData.curvedLocalStart = localStart;
    curveData.curvedLocalEnd = localEnd;
    curveData.curvedLocalControl = localControl;

    // CRITICAL: Do NOT recalculate world coordinates from local coordinates!
    // The stored world coordinates are exact (set during creation) and should be preserved.
    // Recalculating them using the rounded transform matrix introduces errors.
    // The stored world coords are used by the drag handler for exact positioning.

    // Fire 'modified' event to trigger syncMarkers
    // This will properly position markers with correct offsets based on marker type
    this.curvedLine.fire('modified');

    // Update handle positions using the STORED world coordinates (exact)
    const storedWorldStart = curveData.curvedLineStart;
    const storedWorldEnd = curveData.curvedLineEnd;
    const storedWorldControl = curveData.curvedLineControlPoint;

    // Update control handle
    controlHandle.set({
      left: storedWorldControl.x,
      top: storedWorldControl.y,
    });
    controlHandle.setCoords();

    // Update anchor handles
    const startAnchorHandle = curveData.startAnchorHandle as Circle;
    const endAnchorHandle = curveData.endAnchorHandle as Circle;

    if (startAnchorHandle) {
      startAnchorHandle.set({
        left: storedWorldStart.x,
        top: storedWorldStart.y,
      });
      startAnchorHandle.setCoords();
    }

    if (endAnchorHandle) {
      endAnchorHandle.set({
        left: storedWorldEnd.x,
        top: storedWorldEnd.y,
      });
      endAnchorHandle.setCoords();
    }

    // Update guide lines using STORED world coordinates (exact)
    handleLines[0].set({
      x1: storedWorldStart.x,
      y1: storedWorldStart.y,
      x2: storedWorldControl.x,
      y2: storedWorldControl.y,
    });
    handleLines[0].setCoords();

    handleLines[1].set({
      x1: storedWorldControl.x,
      y1: storedWorldControl.y,
      x2: storedWorldEnd.x,
      y2: storedWorldEnd.y,
    });
    handleLines[1].setCoords();
  }

  /**
   * Activate edit mode for a curved line
   */
  activate(curvedLinePath: Path): void {
    if (!curvedLinePath || !(curvedLinePath as any).isCurvedLine) {
      console.warn('Can only edit curved lines');
      return;
    }

    this.curvedLine = curvedLinePath;
    const curveData = curvedLinePath as any;

    // Mark as in edit mode
    curveData.isEditMode = true;

    // Deselect the curve to hide the selection box/controls
    this.canvas.discardActiveObject();

    // Disable path selection/resizing/rotating while in edit mode
    // Keep evented:true so it can receive double-click events to exit
    // Disable caching to prevent clipping issues during edit
    this.curvedLine.set({
      selectable: false,
      evented: true,
      hasControls: false,
      hasBorders: false,
      lockScalingX: true,
      lockScalingY: true,
      lockRotation: true,
      lockSkewingX: true,
      lockSkewingY: true,
      hoverCursor: 'default',
      objectCaching: false, // Prevents clipping during edit
    });

    // Remove endpoint markers when entering edit mode
    removeEndpointMarkers(this.canvas, this.curvedLine);

    // Check if control handle and guide lines exist, if not recreate them (e.g., after undo)
    let controlHandle = curveData.controlHandle as Circle;
    let handleLines = curveData.handleLines as [Line, Line];

    if (!controlHandle || !this.canvas.contains(controlHandle)) {
      // Control handle was removed (e.g., by undo) - recreate it

      // CRITICAL FIX: Extract path geometry and transform to world coordinates
      // After the path is moved/transformed, the stored coordinates are stale,
      // so we must recalculate them from the current path geometry + transform

      const pathData = this.curvedLine.path;
      if (!pathData || pathData.length < 2) {
        console.warn('[CurvedLineEditMode] Invalid path data');
        return;
      }

      let localStart: { x: number; y: number } | null = null;
      let localEnd: { x: number; y: number } | null = null;
      let localControl: { x: number; y: number } | null = null;

      // Extract from M command
      if (pathData[0][0] === 'M' && pathData[0].length >= 3) {
        localStart = { x: pathData[0][1] as number, y: pathData[0][2] as number };
      }

      // Extract from Q command (quadratic bezier)
      for (const command of pathData) {
        if (command[0] === 'Q' && command.length >= 5) {
          localControl = { x: command[1] as number, y: command[2] as number };
          localEnd = { x: command[3] as number, y: command[4] as number };
          break;
        }
      }

      if (!localStart || !localEnd || !localControl) {
        console.warn('[CurvedLineEditMode] Could not extract path points');
        return;
      }


      // Get pathOffset - this is the offset Fabric.js uses to center the path at its origin
      const pathOffset = this.curvedLine.pathOffset || { x: 0, y: 0 };

      // Convert path-local to object-local by subtracting pathOffset
      const objectLocalStart = {
        x: localStart.x - pathOffset.x,
        y: localStart.y - pathOffset.y
      };
      const objectLocalEnd = {
        x: localEnd.x - pathOffset.x,
        y: localEnd.y - pathOffset.y
      };
      const objectLocalControl = {
        x: localControl.x - pathOffset.x,
        y: localControl.y - pathOffset.y
      };


      // Transform object-local coordinates to world coordinates using the path's current transform
      const matrix = this.curvedLine.calcTransformMatrix();
      const worldStartPoint = util.transformPoint(new FabricPoint(objectLocalStart.x, objectLocalStart.y), matrix);
      const worldEndPoint = util.transformPoint(new FabricPoint(objectLocalEnd.x, objectLocalEnd.y), matrix);
      const worldControlPoint = util.transformPoint(new FabricPoint(objectLocalControl.x, objectLocalControl.y), matrix);

      const worldStart = { x: worldStartPoint.x, y: worldStartPoint.y };
      const worldEnd = { x: worldEndPoint.x, y: worldEndPoint.y };
      const worldControl = { x: worldControlPoint.x, y: worldControlPoint.y };


      // Update stored coordinates with the current world coordinates
      curveData.curvedLineStart = worldStart;
      curveData.curvedLineEnd = worldEnd;
      curveData.curvedLineControlPoint = worldControl;

      // Convert path to pathOffset=0 on activation (so it's consistent whether we drag or not)
      if (this.curvedLine.pathOffset && (this.curvedLine.pathOffset.x !== 0 || this.curvedLine.pathOffset.y !== 0)) {
        const matrix = this.curvedLine.calcTransformMatrix();
        const invMatrix = util.invertTransform(matrix);

        // Transform stored world coordinates to local coordinates
        const localStart = util.transformPoint(new FabricPoint(worldStart.x, worldStart.y), invMatrix);
        const localEnd = util.transformPoint(new FabricPoint(worldEnd.x, worldEnd.y), invMatrix);
        const localControl = util.transformPoint(new FabricPoint(worldControl.x, worldControl.y), invMatrix);

        // Update path with local coordinates and pathOffset=0
        const pathData = `M ${localStart.x} ${localStart.y} Q ${localControl.x} ${localControl.y} ${localEnd.x} ${localEnd.y}`;
        this.curvedLine.set({
          path: util.parsePath(pathData),
          pathOffset: new FabricPoint(0, 0),
          dirty: true
        });
        this.curvedLine.setCoords();

      }

      // Create control handle
      controlHandle = new Circle({
        left: worldControl.x,
        top: worldControl.y,
        radius: 8,
        fill: '#10b981',
        stroke: '#ffffff',
        strokeWidth: 2,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
        hoverCursor: 'move',
        visible: false,
      });
      (controlHandle as any).isControlHandle = true;
      (controlHandle as any).excludeFromExport = true;

      // Create start anchor handle
      const startHandle = new Circle({
        left: worldStart.x,
        top: worldStart.y,
        radius: 8,
        fill: '#3b82f6',
        stroke: '#ffffff',
        strokeWidth: 2,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
        hoverCursor: 'move',
        visible: false,
      });
      (startHandle as any).isAnchorHandle = true;
      (startHandle as any).handleType = 'start';
      (startHandle as any).excludeFromExport = true;

      // Create end anchor handle
      const endHandle = new Circle({
        left: worldEnd.x,
        top: worldEnd.y,
        radius: 8,
        fill: '#3b82f6',
        stroke: '#ffffff',
        strokeWidth: 2,
        originX: 'center',
        originY: 'center',
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
        hoverCursor: 'move',
        visible: false,
      });
      (endHandle as any).isAnchorHandle = true;
      (endHandle as any).handleType = 'end';
      (endHandle as any).excludeFromExport = true;

      // Create guide lines
      const line1 = new Line([worldStart.x, worldStart.y, worldControl.x, worldControl.y], {
        stroke: '#10b981',
        strokeWidth: 1,
        strokeDashArray: [5, 3],
        selectable: false,
        evented: false,
        visible: false,
      });
      (line1 as any).isHandleLine = true;
      (line1 as any).excludeFromExport = true;

      const line2 = new Line([worldControl.x, worldControl.y, worldEnd.x, worldEnd.y], {
        stroke: '#10b981',
        strokeWidth: 1,
        strokeDashArray: [5, 3],
        selectable: false,
        evented: false,
        visible: false,
      });
      (line2 as any).isHandleLine = true;
      (line2 as any).excludeFromExport = true;

      handleLines = [line1, line2];

      // Store references
      curveData.controlHandle = controlHandle;
      curveData.startAnchorHandle = startHandle;
      curveData.endAnchorHandle = endHandle;
      curveData.handleLines = handleLines;

      // Add to canvas
      this.canvas.add(line1, line2, controlHandle, startHandle, endHandle);

      // Set up drag handlers (simplified for Path)
      const setupDragHandler = () => {
        controlHandle.on('moving', () => {
          // Get current start/end positions from the anchor handles (not stale stored data)
          const start = { x: startHandle.left!, y: startHandle.top! };
          const end = { x: endHandle.left!, y: endHandle.top! };
          const newControl = { x: controlHandle.left!, y: controlHandle.top! };

          // Update stored control point (world coordinates)
          curveData.curvedLineControlPoint = newControl;

          // Convert world coordinates to local coordinates using inverse transform (like pen tool)
          const matrix = this.curvedLine!.calcTransformMatrix();
          const invMatrix = util.invertTransform(matrix);

          const localStartPoint = util.transformPoint(new FabricPoint(start.x, start.y), invMatrix);
          const localEndPoint = util.transformPoint(new FabricPoint(end.x, end.y), invMatrix);
          const localControlPoint = util.transformPoint(new FabricPoint(newControl.x, newControl.y), invMatrix);

          // Update path with local coordinates, set pathOffset to 0,0 (like pen tool)
          const newPathData = `M ${localStartPoint.x} ${localStartPoint.y} Q ${localControlPoint.x} ${localControlPoint.y} ${localEndPoint.x} ${localEndPoint.y}`;
          this.curvedLine!.set({
            path: util.parsePath(newPathData),
            pathOffset: new FabricPoint(0, 0),
            dirty: true
          });
          this.curvedLine!.setCoords();

          // Update handle lines
          line1.set({
            x1: start.x,
            y1: start.y,
            x2: newControl.x,
            y2: newControl.y,
          });

          line2.set({
            x1: newControl.x,
            y1: newControl.y,
            x2: end.x,
            y2: end.y,
          });

          this.canvas.requestRenderAll();
        });
      };
      setupDragHandler();

      // Set up drag handlers for start and end anchor handles
      const setupAnchorDragHandlers = () => {
        // Start anchor drag handler
        startHandle.on('moving', () => {
          let newStart = { x: startHandle.left!, y: startHandle.top! };
          const end = { x: curveData.curvedLineEnd.x, y: curveData.curvedLineEnd.y };
          const control = { x: curveData.curvedLineControlPoint.x, y: curveData.curvedLineControlPoint.y };

          // Snap to connection point and update attachment
          newStart = this.snapAndUpdateAttachment(newStart, startHandle, true);

          // Update stored start point (world coordinates)
          curveData.curvedLineStart = newStart;

          // Convert world coordinates to local coordinates using inverse transform (like pen tool)
          const matrix = this.curvedLine!.calcTransformMatrix();
          const invMatrix = util.invertTransform(matrix);

          const localStartPoint = util.transformPoint(new FabricPoint(newStart.x, newStart.y), invMatrix);
          const localEndPoint = util.transformPoint(new FabricPoint(end.x, end.y), invMatrix);
          const localControlPoint = util.transformPoint(new FabricPoint(control.x, control.y), invMatrix);

          // Update path with local coordinates, set pathOffset to 0,0 (like pen tool)
          const newPathData = `M ${localStartPoint.x} ${localStartPoint.y} Q ${localControlPoint.x} ${localControlPoint.y} ${localEndPoint.x} ${localEndPoint.y}`;
          this.curvedLine!.set({
            path: util.parsePath(newPathData),
            pathOffset: new FabricPoint(0, 0),
            dirty: true
          });
          this.curvedLine!.setCoords();

          // Update guide line
          line1.set({
            x1: newStart.x,
            y1: newStart.y,
            x2: control.x,
            y2: control.y,
          });

          this.canvas.requestRenderAll();
        });

        // End anchor drag handler
        endHandle.on('moving', () => {
          let newEnd = { x: endHandle.left!, y: endHandle.top! };
          const start = { x: curveData.curvedLineStart.x, y: curveData.curvedLineStart.y };
          const control = { x: curveData.curvedLineControlPoint.x, y: curveData.curvedLineControlPoint.y };

          // Snap to connection point and update attachment
          newEnd = this.snapAndUpdateAttachment(newEnd, endHandle, false);

          // Update stored end point (world coordinates)
          curveData.curvedLineEnd = newEnd;

          // Convert world coordinates to local coordinates using inverse transform (like pen tool)
          const matrix = this.curvedLine!.calcTransformMatrix();
          const invMatrix = util.invertTransform(matrix);

          const localStartPoint = util.transformPoint(new FabricPoint(start.x, start.y), invMatrix);
          const localEndPoint = util.transformPoint(new FabricPoint(newEnd.x, newEnd.y), invMatrix);
          const localControlPoint = util.transformPoint(new FabricPoint(control.x, control.y), invMatrix);

          // Update path with local coordinates, set pathOffset to 0,0 (like pen tool)
          const newPathData = `M ${localStartPoint.x} ${localStartPoint.y} Q ${localControlPoint.x} ${localControlPoint.y} ${localEndPoint.x} ${localEndPoint.y}`;
          this.curvedLine!.set({
            path: util.parsePath(newPathData),
            pathOffset: new FabricPoint(0, 0),
            dirty: true
          });
          this.curvedLine!.setCoords();

          // Update guide line
          line2.set({
            x1: control.x,
            y1: control.y,
            x2: newEnd.x,
            y2: newEnd.y,
          });

          this.canvas.requestRenderAll();
        });

        // Save state on modification
        startHandle.on('modified', () => {
          if (this.saveState) this.saveState();
        });

        endHandle.on('modified', () => {
          if (this.saveState) this.saveState();
        });
      };
      setupAnchorDragHandlers();
    } else {
      // Control handle exists, but anchor handles might not - check and create if needed
      let startAnchorHandle = curveData.startAnchorHandle as Circle;
      let endAnchorHandle = curveData.endAnchorHandle as Circle;

      // CRITICAL FIX: Remove old moving handler from tool and reattach correct one
      // The control handle was created by the tool with a handler that reads from stale stored coords
      controlHandle.off('moving');

      if (!startAnchorHandle || !this.canvas.contains(startAnchorHandle) ||
          !endAnchorHandle || !this.canvas.contains(endAnchorHandle)) {

        // CRITICAL FIX: Recalculate world coordinates from current path geometry

        const pathData = this.curvedLine.path;
        if (!pathData || pathData.length < 2) {
          console.warn('[CurvedLineEditMode] Invalid path data');
          return;
        }

        let localStart: { x: number; y: number } | null = null;
        let localEnd: { x: number; y: number } | null = null;

        // Extract from M command
        if (pathData[0][0] === 'M' && pathData[0].length >= 3) {
          localStart = { x: pathData[0][1] as number, y: pathData[0][2] as number };
        }

        // Extract from Q command
        for (const command of pathData) {
          if (command[0] === 'Q' && command.length >= 5) {
            localEnd = { x: command[3] as number, y: command[4] as number };
            break;
          }
        }

        if (!localStart || !localEnd) {
          console.warn('[CurvedLineEditMode] Could not extract start/end points');
          return;
        }

        // Get pathOffset
        const pathOffset = this.curvedLine.pathOffset || { x: 0, y: 0 };

        // Convert path-local to object-local by subtracting pathOffset
        const objectLocalStart = {
          x: localStart.x - pathOffset.x,
          y: localStart.y - pathOffset.y
        };
        const objectLocalEnd = {
          x: localEnd.x - pathOffset.x,
          y: localEnd.y - pathOffset.y
        };

        // Transform to world coordinates
        const matrix = this.curvedLine.calcTransformMatrix();
        const worldStartPoint = util.transformPoint(new FabricPoint(objectLocalStart.x, objectLocalStart.y), matrix);
        const worldEndPoint = util.transformPoint(new FabricPoint(objectLocalEnd.x, objectLocalEnd.y), matrix);

        const worldStart = { x: worldStartPoint.x, y: worldStartPoint.y };
        const worldEnd = { x: worldEndPoint.x, y: worldEndPoint.y };


        // Update stored coordinates
        curveData.curvedLineStart = worldStart;
        curveData.curvedLineEnd = worldEnd;

        // Convert path to pathOffset=0 on activation (so it's consistent whether we drag or not)
        if (this.curvedLine.pathOffset && (this.curvedLine.pathOffset.x !== 0 || this.curvedLine.pathOffset.y !== 0)) {
          const matrix = this.curvedLine.calcTransformMatrix();
          const invMatrix = util.invertTransform(matrix);

          // Transform stored world coordinates to local coordinates
          const worldControl = { x: curveData.curvedLineControlPoint.x, y: curveData.curvedLineControlPoint.y };
          const localStart = util.transformPoint(new FabricPoint(worldStart.x, worldStart.y), invMatrix);
          const localEnd = util.transformPoint(new FabricPoint(worldEnd.x, worldEnd.y), invMatrix);
          const localControl = util.transformPoint(new FabricPoint(worldControl.x, worldControl.y), invMatrix);

          // Update path with local coordinates and pathOffset=0
          const pathData = `M ${localStart.x} ${localStart.y} Q ${localControl.x} ${localControl.y} ${localEnd.x} ${localEnd.y}`;
          this.curvedLine.set({
            path: util.parsePath(pathData),
            pathOffset: new FabricPoint(0, 0),
            dirty: true
          });
          this.curvedLine.setCoords();

        }

        // Create start anchor handle if missing
        if (!startAnchorHandle || !this.canvas.contains(startAnchorHandle)) {
          const startHandle = new Circle({
            left: worldStart.x,
            top: worldStart.y,
            radius: 8,
            fill: '#3b82f6',
            stroke: '#ffffff',
            strokeWidth: 2,
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false,
            hasControls: false,
            hasBorders: false,
            hoverCursor: 'move',
            visible: false,
          });
          (startHandle as any).isAnchorHandle = true;
          (startHandle as any).handleType = 'start';
          (startHandle as any).excludeFromExport = true;

          curveData.startAnchorHandle = startHandle;
          this.canvas.add(startHandle);

          // Set up drag handler for start anchor (simplified for Path)
          startHandle.on('moving', () => {
            let newStart = { x: startHandle.left!, y: startHandle.top! };
            const end = { x: curveData.curvedLineEnd.x, y: curveData.curvedLineEnd.y };
            const control = { x: curveData.curvedLineControlPoint.x, y: curveData.curvedLineControlPoint.y };

            // Snap to connection point and update attachment
            newStart = this.snapAndUpdateAttachment(newStart, startHandle, true);

            // Update stored start point (world coordinates)
            curveData.curvedLineStart = newStart;

            // Convert world coordinates to local coordinates using inverse transform (like pen tool)
            const matrix = this.curvedLine!.calcTransformMatrix();
            const invMatrix = util.invertTransform(matrix);

            const localStartPoint = util.transformPoint(new FabricPoint(newStart.x, newStart.y), invMatrix);
            const localEndPoint = util.transformPoint(new FabricPoint(end.x, end.y), invMatrix);
            const localControlPoint = util.transformPoint(new FabricPoint(control.x, control.y), invMatrix);

            // Update path with local coordinates, set pathOffset to 0,0 (like pen tool)
            const newPathData = `M ${localStartPoint.x} ${localStartPoint.y} Q ${localControlPoint.x} ${localControlPoint.y} ${localEndPoint.x} ${localEndPoint.y}`;
            this.curvedLine!.set({
              path: util.parsePath(newPathData),
              pathOffset: new FabricPoint(0, 0),
              dirty: true
            });
            this.curvedLine!.setCoords();

            // Update guide line
            handleLines[0].set({
              x1: newStart.x,
              y1: newStart.y,
              x2: control.x,
              y2: control.y,
            });

            this.canvas.requestRenderAll();
          });

          startHandle.on('modified', () => {
            if (this.saveState) this.saveState();
          });
        }

        // Create end anchor handle if missing
        if (!endAnchorHandle || !this.canvas.contains(endAnchorHandle)) {
          const endHandle = new Circle({
            left: worldEnd.x,
            top: worldEnd.y,
            radius: 8,
            fill: '#3b82f6',
            stroke: '#ffffff',
            strokeWidth: 2,
            originX: 'center',
            originY: 'center',
            selectable: false,
            evented: false,
            hasControls: false,
            hasBorders: false,
            hoverCursor: 'move',
            visible: false,
          });
          (endHandle as any).isAnchorHandle = true;
          (endHandle as any).handleType = 'end';
          (endHandle as any).excludeFromExport = true;

          curveData.endAnchorHandle = endHandle;
          this.canvas.add(endHandle);

          // Set up drag handler for end anchor (simplified for Path)
          endHandle.on('moving', () => {
            let newEnd = { x: endHandle.left!, y: endHandle.top! };
            const start = { x: curveData.curvedLineStart.x, y: curveData.curvedLineStart.y };
            const control = { x: curveData.curvedLineControlPoint.x, y: curveData.curvedLineControlPoint.y };

            // Snap to connection point and update attachment
            newEnd = this.snapAndUpdateAttachment(newEnd, endHandle, false);

            // Update stored end point (world coordinates)
            curveData.curvedLineEnd = newEnd;

            // Convert world coordinates to local coordinates using inverse transform (like pen tool)
            const matrix = this.curvedLine!.calcTransformMatrix();
            const invMatrix = util.invertTransform(matrix);

            const localStartPoint = util.transformPoint(new FabricPoint(start.x, start.y), invMatrix);
            const localEndPoint = util.transformPoint(new FabricPoint(newEnd.x, newEnd.y), invMatrix);
            const localControlPoint = util.transformPoint(new FabricPoint(control.x, control.y), invMatrix);

            // Update path with local coordinates, set pathOffset to 0,0 (like pen tool)
            const newPathData = `M ${localStartPoint.x} ${localStartPoint.y} Q ${localControlPoint.x} ${localControlPoint.y} ${localEndPoint.x} ${localEndPoint.y}`;
            this.curvedLine!.set({
              path: util.parsePath(newPathData),
              pathOffset: new FabricPoint(0, 0),
              dirty: true
            });
            this.curvedLine!.setCoords();

            // Update guide line
            handleLines[1].set({
              x1: control.x,
              y1: control.y,
              x2: newEnd.x,
              y2: newEnd.y,
            });

            this.canvas.requestRenderAll();
          });

          endHandle.on('modified', () => {
            if (this.saveState) this.saveState();
          });
        }
      }

      // Reattach correct moving handler for control handle (reads from anchor handles, not stale stored coords)
      const finalStartHandle = curveData.startAnchorHandle as Circle;
      const finalEndHandle = curveData.endAnchorHandle as Circle;
      const handleLines = curveData.handleLines as [Line, Line];

      if (controlHandle && finalStartHandle && finalEndHandle) {
        controlHandle.on('moving', () => {
          // Get current start/end positions from the anchor handles (not stale stored data)
          const start = { x: finalStartHandle.left!, y: finalStartHandle.top! };
          const end = { x: finalEndHandle.left!, y: finalEndHandle.top! };
          const newControl = { x: controlHandle.left!, y: controlHandle.top! };

          // Update stored control point (world coordinates)
          curveData.curvedLineControlPoint = newControl;

          // Convert world coordinates to local coordinates using inverse transform
          const matrix = this.curvedLine!.calcTransformMatrix();
          const invMatrix = util.invertTransform(matrix);

          const localStartPoint = util.transformPoint(new FabricPoint(start.x, start.y), invMatrix);
          const localEndPoint = util.transformPoint(new FabricPoint(end.x, end.y), invMatrix);
          const localControlPoint = util.transformPoint(new FabricPoint(newControl.x, newControl.y), invMatrix);

          // Update path with local coordinates, set pathOffset to 0,0
          const newPathData = `M ${localStartPoint.x} ${localStartPoint.y} Q ${localControlPoint.x} ${localControlPoint.y} ${localEndPoint.x} ${localEndPoint.y}`;
          this.curvedLine!.set({
            path: util.parsePath(newPathData),
            pathOffset: new FabricPoint(0, 0),
            dirty: true
          });
          this.curvedLine!.setCoords();

          // Update guide lines
          if (handleLines && handleLines.length === 2) {
            handleLines[0].set({
              x1: start.x,
              y1: start.y,
              x2: newControl.x,
              y2: newControl.y,
            });

            handleLines[1].set({
              x1: newControl.x,
              y1: newControl.y,
              x2: end.x,
              y2: end.y,
            });
          }

          this.canvas.requestRenderAll();
        });
      }
    }

    // Update handle positions from current path geometry before showing them
    this.updateHandlePositions();

    // Show the control handle, anchor handles, and guide lines
    const startAnchorHandle = curveData.startAnchorHandle as Circle;
    const endAnchorHandle = curveData.endAnchorHandle as Circle;

    if (controlHandle) {
      controlHandle.set({
        visible: true,
        selectable: true,
        evented: true,
        hasControls: false,
        hasBorders: false,
        lockScalingX: true,
        lockScalingY: true,
        lockRotation: true,
        lockSkewingX: true,
        lockSkewingY: true,
      });

      // Hide all selection controls on the handle
      controlHandle.setControlsVisibility({
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

      // Update coordinates to ensure proper rendering
      controlHandle.setCoords();
    }

    // Show start anchor handle
    if (startAnchorHandle) {
      startAnchorHandle.set({
        visible: true,
        selectable: true,
        evented: true,
        hasControls: false,
        hasBorders: false,
        lockScalingX: true,
        lockScalingY: true,
        lockRotation: true,
        lockSkewingX: true,
        lockSkewingY: true,
      });

      startAnchorHandle.setControlsVisibility({
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

      startAnchorHandle.setCoords();
    }

    // Show end anchor handle
    if (endAnchorHandle) {
      endAnchorHandle.set({
        visible: true,
        selectable: true,
        evented: true,
        hasControls: false,
        hasBorders: false,
        lockScalingX: true,
        lockScalingY: true,
        lockRotation: true,
        lockSkewingX: true,
        lockSkewingY: true,
      });

      endAnchorHandle.setControlsVisibility({
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

      endAnchorHandle.setCoords();
    }

    if (handleLines && handleLines.length === 2) {
      handleLines[0].set({
        visible: true,
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
      });
      handleLines[1].set({
        visible: true,
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false,
      });
      handleLines[0].setCoords();
      handleLines[1].setCoords();
    }

    // Bring all handles to front
    if (handleLines && handleLines.length === 2) {
      this.canvas.bringObjectToFront(handleLines[0]);
      this.canvas.bringObjectToFront(handleLines[1]);
    }
    if (startAnchorHandle) {
      this.canvas.bringObjectToFront(startAnchorHandle);
    }
    if (endAnchorHandle) {
      this.canvas.bringObjectToFront(endAnchorHandle);
    }
    if (controlHandle) {
      this.canvas.bringObjectToFront(controlHandle);
    }

    this.canvas.requestRenderAll();
  }

  /**
   * Deactivate edit mode
   */
  deactivate(skipSave = false): void {
    if (!this.curvedLine) return;

    const curveData = this.curvedLine as any;

    // Mark as not in edit mode
    curveData.isEditMode = false;


    // Store old dimensions and pathOffset before normalization
    const oldWidth = this.curvedLine.width || 0;
    const oldHeight = this.curvedLine.height || 0;
    const oldPathOffset = { x: this.curvedLine.pathOffset?.x || 0, y: this.curvedLine.pathOffset?.y || 0 };

    // Rebuild path to normalize coordinates (like pen tool does)
    // Extract current path coordinates
    const pathData = this.curvedLine.path;
    if (!pathData || pathData.length < 2) {
      console.warn('[DEACTIVATE] Invalid path data');
      return;
    }

    // Build path string from current coordinates
    let pathString = '';
    for (const cmd of pathData) {
      if (cmd[0] === 'M') {
        pathString += `M ${cmd[1]} ${cmd[2]} `;
      } else if (cmd[0] === 'Q') {
        pathString += `Q ${cmd[1]} ${cmd[2]} ${cmd[3]} ${cmd[4]} `;
      }
    }

    // Set the path and let _setPath normalize it
    this.curvedLine.path = util.parsePath(pathString.trim());
    (this.curvedLine as any)._setPath(this.curvedLine.path);

    // Get the new pathOffset after normalization
    const newPathOffset = { x: this.curvedLine.pathOffset?.x || 0, y: this.curvedLine.pathOffset?.y || 0 };
    const pathOffsetDelta = {
      x: newPathOffset.x - oldPathOffset.x,
      y: newPathOffset.y - oldPathOffset.y
    };

    // Adjust path coordinates to be relative to new pathOffset (like pen tool does)
    const adjustedCommands: any[] = [];
    for (const cmd of this.curvedLine.path) {
      if (cmd[0] === 'M') {
        adjustedCommands.push([
          cmd[0],
          (cmd[1] as number) - pathOffsetDelta.x,
          (cmd[2] as number) - pathOffsetDelta.y
        ]);
      } else if (cmd[0] === 'Q') {
        adjustedCommands.push([
          cmd[0],
          (cmd[1] as number) - pathOffsetDelta.x,
          (cmd[2] as number) - pathOffsetDelta.y,
          (cmd[3] as number) - pathOffsetDelta.x,
          (cmd[4] as number) - pathOffsetDelta.y
        ]);
      } else {
        adjustedCommands.push([...cmd]);
      }
    }

    // Set the adjusted path with pathOffset=(0,0) (critical - like pen tool line 1070)
    this.curvedLine.set({
      path: adjustedCommands,
      pathOffset: new FabricPoint(0, 0),
      dirty: true
    });

    // Get new dimensions after setting adjusted path (like pen tool line 1075-1076)
    const newWidth = this.curvedLine.width || 0;
    const newHeight = this.curvedLine.height || 0;

    // Calculate dimension changes
    const widthDelta = newWidth - oldWidth;
    const heightDelta = newHeight - oldHeight;


    // Adjust position by DELTA only (not absolute pathOffset)
    this.curvedLine.set({
      left: (this.curvedLine.left || 0) + pathOffsetDelta.x - widthDelta / 2,
      top: (this.curvedLine.top || 0) + pathOffsetDelta.y - heightDelta / 2,
    });

    this.curvedLine.setCoords();

    // Re-enable curve selection, controls, and caching
    this.curvedLine.set({
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
      lockScalingX: false,
      lockScalingY: false,
      lockRotation: false,
      lockSkewingX: false,
      lockSkewingY: false,
      hoverCursor: 'move',
      objectCaching: true, // Re-enable caching after edit
      dirty: true,
    });

    // Force bounding box recalculation
    this.curvedLine.setCoords();

    // CRITICAL: Update stored world coordinates after normalization
    // Extract the current path geometry and transform to world coordinates
    const finalPathData = this.curvedLine.path;
    if (finalPathData && finalPathData.length >= 2) {
      // Extract local coordinates from path
      let localStart: { x: number; y: number } | null = null;
      let localEnd: { x: number; y: number } | null = null;
      let localControl: { x: number; y: number } | null = null;

      if (finalPathData[0][0] === 'M' && finalPathData[0].length >= 3) {
        localStart = { x: finalPathData[0][1] as number, y: finalPathData[0][2] as number };
      }

      for (const command of finalPathData) {
        if (command[0] === 'Q' && command.length >= 5) {
          localControl = { x: command[1] as number, y: command[2] as number };
          localEnd = { x: command[3] as number, y: command[4] as number };
          break;
        }
      }

      if (localStart && localEnd && localControl) {
        // Transform to world coordinates
        const pathOffset = this.curvedLine.pathOffset || { x: 0, y: 0 };
        const matrix = this.curvedLine.calcTransformMatrix();

        const objectLocalStart = {
          x: localStart.x - pathOffset.x,
          y: localStart.y - pathOffset.y
        };
        const objectLocalEnd = {
          x: localEnd.x - pathOffset.x,
          y: localEnd.y - pathOffset.y
        };
        const objectLocalControl = {
          x: localControl.x - pathOffset.x,
          y: localControl.y - pathOffset.y
        };

        const worldStartPoint = util.transformPoint(new FabricPoint(objectLocalStart.x, objectLocalStart.y), matrix);
        const worldEndPoint = util.transformPoint(new FabricPoint(objectLocalEnd.x, objectLocalEnd.y), matrix);
        const worldControlPoint = util.transformPoint(new FabricPoint(objectLocalControl.x, objectLocalControl.y), matrix);

        // Update stored world coordinates
        curveData.curvedLineStart = { x: worldStartPoint.x, y: worldStartPoint.y };
        curveData.curvedLineEnd = { x: worldEndPoint.x, y: worldEndPoint.y };
        curveData.curvedLineControlPoint = { x: worldControlPoint.x, y: worldControlPoint.y };
      }
    }

    // Remove the control handle, anchor handles, and guide lines from canvas
    const controlHandle = curveData.controlHandle as Circle;
    const startAnchorHandle = curveData.startAnchorHandle as Circle;
    const endAnchorHandle = curveData.endAnchorHandle as Circle;
    const handleLines = curveData.handleLines as [Line, Line];

    if (controlHandle) {
      this.canvas.remove(controlHandle);
      curveData.controlHandle = null;
    }

    if (startAnchorHandle) {
      this.canvas.remove(startAnchorHandle);
      curveData.startAnchorHandle = null;
    }

    if (endAnchorHandle) {
      this.canvas.remove(endAnchorHandle);
      curveData.endAnchorHandle = null;
    }

    if (handleLines && handleLines.length === 2) {
      this.canvas.remove(handleLines[0]);
      this.canvas.remove(handleLines[1]);
      curveData.handleLines = null;
    }

    // Restore endpoint markers when exiting edit mode
    updateEndpointMarkers(
      this.canvas,
      this.curvedLine,
      curveData.startMarkerType || 'none',
      curveData.endMarkerType || 'none'
    );

    // Clear any active selections
    this.canvas.discardActiveObject();

    this.curvedLine = null;
    this.canvas.requestRenderAll();

    // Save state after exiting edit mode to capture the edited curve (unless skipSave is true)
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
   * Check if edit mode is active
   */
  isActive(): boolean {
    return this.curvedLine !== null;
  }

  /**
   * Get the currently editing curved line
   */
  getCurvedLine(): Group | null {
    return this.curvedLine;
  }
}
