import { Canvas, Path, Circle, Line, util, Point as FabricPoint } from "fabric";
import { removeEndpointMarkers, updateEndpointMarkers } from "./lineEndpointRenderer";
import { snapToConnection } from "./connectionSnapping";
import { highlightConnectionPoint, unhighlightConnectionPoint } from "./connectionPoints";

export class StraightLineEditMode {
  private canvas: Canvas;
  private straightLine: Path | null = null;
  private saveState?: () => void;
  private static activationCounter = new Map<string, number>(); // Track activations per line ID
  private lastHighlightedPointId?: string;
  private snapThreshold: number = 15;

  constructor(canvas: Canvas, saveState?: () => void) {
    this.canvas = canvas;
    this.saveState = saveState;
  }

  /**
   * Update anchor handle positions based on path geometry
   */
  private updateHandlePositions(): void {
    if (!this.straightLine) return;

    const curveData = this.straightLine as any;
    const mainPath = this.straightLine as Path;

    const pathData = mainPath.path;
    if (!pathData || pathData.length < 2) {
      console.warn('[updateHandlePositions] Invalid path data');
      return;
    }

    let localStart: { x: number; y: number } | null = null;
    let localEnd: { x: number; y: number } | null = null;

    // Extract from M command
    if (pathData[0][0] === 'M' && pathData[0].length >= 3) {
      localStart = { x: pathData[0][1] as number, y: pathData[0][2] as number };
    }

    // Extract from L command (straight line)
    for (const command of pathData) {
      if (command[0] === 'L' && command.length >= 3) {
        localEnd = { x: command[1] as number, y: command[2] as number };
        break;
      }
    }

    if (!localStart || !localEnd) {
      console.warn('[updateHandlePositions] Could not extract path points');
      return;
    }

    // Fire 'modified' event to trigger syncMarkers
    this.straightLine.fire('modified');

    // Update anchor handles using stored world coordinates
    const storedWorldStart = curveData.straightLineStart;
    const storedWorldEnd = curveData.straightLineEnd;

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
  }

  /**
   * Activate edit mode for a straight line
   */
  activate(straightLinePath: Path): void {
    if (!straightLinePath || !(straightLinePath as any).isStraightLine) {
      console.warn('Can only edit straight lines');
      return;
    }

    this.straightLine = straightLinePath;
    const curveData = straightLinePath as any;

    // Mark as in edit mode
    curveData.isEditMode = true;

    // Deselect the curve to hide the selection box/controls
    this.canvas.discardActiveObject();

    // Disable path selection/resizing/rotating while in edit mode
    // Keep evented:true so it can receive double-click events to exit
    // Disable caching to prevent clipping issues during edit
    this.straightLine.set({
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
    removeEndpointMarkers(this.canvas, this.straightLine);

    // For straight lines, we only need start and end anchor handles (no control handle or guide lines)

    // CRITICAL FIX: Extract path geometry and transform to world coordinates
    // After the path is moved/transformed, the stored coordinates are stale,
    // so we must recalculate them from the current path geometry + transform

    const pathData = this.straightLine.path;
    if (!pathData || pathData.length < 2) {
      console.warn('[StraightLineEditMode] Invalid path data');
      return;
    }

    let localStart: { x: number; y: number } | null = null;
    let localEnd: { x: number; y: number } | null = null;

    // Extract from M command
    if (pathData[0][0] === 'M' && pathData[0].length >= 3) {
      localStart = { x: pathData[0][1] as number, y: pathData[0][2] as number };
    }

    // Extract from L command (straight line)
    for (const command of pathData) {
      if (command[0] === 'L' && command.length >= 3) {
        localEnd = { x: command[1] as number, y: command[2] as number };
        break;
      }
    }

    if (!localStart || !localEnd) {
      console.warn('[StraightLineEditMode] Could not extract path points');
      return;
    }


    // Get pathOffset - this is the offset Fabric.js uses to center the path at its origin
    const pathOffset = this.straightLine.pathOffset || { x: 0, y: 0 };

    // Convert path-local to object-local by subtracting pathOffset
    const objectLocalStart = {
      x: localStart.x - pathOffset.x,
      y: localStart.y - pathOffset.y
    };
    const objectLocalEnd = {
      x: localEnd.x - pathOffset.x,
      y: localEnd.y - pathOffset.y
    };


    // Transform object-local coordinates to world coordinates using the path's current transform
    const matrix = this.straightLine.calcTransformMatrix();
    const worldStartPoint = util.transformPoint(new FabricPoint(objectLocalStart.x, objectLocalStart.y), matrix);
    const worldEndPoint = util.transformPoint(new FabricPoint(objectLocalEnd.x, objectLocalEnd.y), matrix);

    const worldStart = { x: worldStartPoint.x, y: worldStartPoint.y };
    const worldEnd = { x: worldEndPoint.x, y: worldEndPoint.y };


    // Update stored coordinates with the current world coordinates
    curveData.straightLineStart = worldStart;
    curveData.straightLineEnd = worldEnd;

    // Convert path to pathOffset=0 on activation (so it's consistent whether we drag or not)
    if (this.straightLine.pathOffset && (this.straightLine.pathOffset.x !== 0 || this.straightLine.pathOffset.y !== 0)) {
      const matrix = this.straightLine.calcTransformMatrix();
      const invMatrix = util.invertTransform(matrix);

      // Transform stored world coordinates to local coordinates
      const localStart = util.transformPoint(new FabricPoint(worldStart.x, worldStart.y), invMatrix);
      const localEnd = util.transformPoint(new FabricPoint(worldEnd.x, worldEnd.y), invMatrix);

      // Update path with local coordinates and pathOffset=0
      const pathData = `M ${localStart.x} ${localStart.y} L ${localEnd.x} ${localEnd.y}`;
      this.straightLine.set({
        path: util.parsePath(pathData),
        pathOffset: new FabricPoint(0, 0),
        dirty: true
      });
      this.straightLine.setCoords();

    }

    // Declare anchor handles at this scope so they're accessible throughout
    let startAnchorHandle = curveData.startAnchorHandle as Circle;
    let endAnchorHandle = curveData.endAnchorHandle as Circle;

    // Check if anchor handles exist, if not recreate them

    if (!startAnchorHandle || !this.canvas.contains(startAnchorHandle) ||
        !endAnchorHandle || !this.canvas.contains(endAnchorHandle)) {

      // Create start anchor handle
      startAnchorHandle = new Circle({
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
      (startAnchorHandle as any).isAnchorHandle = true;
      (startAnchorHandle as any).handleType = 'start';
      (startAnchorHandle as any).excludeFromExport = true;

      // Create end anchor handle
      endAnchorHandle = new Circle({
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
      (endAnchorHandle as any).isAnchorHandle = true;
      (endAnchorHandle as any).handleType = 'end';
      (endAnchorHandle as any).excludeFromExport = true;

      // Store references
      curveData.startAnchorHandle = startAnchorHandle;
      curveData.endAnchorHandle = endAnchorHandle;

      // Add to canvas (no control handle or guide lines for straight lines)
      this.canvas.add(startAnchorHandle, endAnchorHandle);

      // Set up drag handlers for start and end anchor handles
      // Start anchor drag handler
      startAnchorHandle.on('moving', () => {
        let newStart = { x: startAnchorHandle.left!, y: startAnchorHandle.top! };
        const end = { x: curveData.straightLineEnd.x, y: curveData.straightLineEnd.y };

        // Try to snap to connection point
        const connectionSnap = snapToConnection(
          this.canvas,
          newStart.x,
          newStart.y,
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
          newStart = { x: connectionSnap.x, y: connectionSnap.y };
          startAnchorHandle.set({ left: newStart.x, top: newStart.y });
          startAnchorHandle.setCoords();

          // Update attachment
          curveData.startAttachment = {
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
          if (curveData.startAttachment) {
            delete curveData.startAttachment;
          }
        }

        // Update stored start point (world coordinates)
        curveData.straightLineStart = newStart;

        // Convert world coordinates to local coordinates using inverse transform (like pen tool)
        const matrix = this.straightLine!.calcTransformMatrix();
        const invMatrix = util.invertTransform(matrix);

        const localStartPoint = util.transformPoint(new FabricPoint(newStart.x, newStart.y), invMatrix);
        const localEndPoint = util.transformPoint(new FabricPoint(end.x, end.y), invMatrix);

        // Update path with local coordinates, set pathOffset to 0,0 (like pen tool)
        const newPathData = `M ${localStartPoint.x} ${localStartPoint.y} L ${localEndPoint.x} ${localEndPoint.y}`;
        this.straightLine!.set({
          path: util.parsePath(newPathData),
          pathOffset: new FabricPoint(0, 0),
          dirty: true
        });
        this.straightLine!.setCoords();
        this.canvas.requestRenderAll();
      });

      // End anchor drag handler
      endAnchorHandle.on('moving', () => {
        let newEnd = { x: endAnchorHandle.left!, y: endAnchorHandle.top! };
        const start = { x: curveData.straightLineStart.x, y: curveData.straightLineStart.y };

        // Try to snap to connection point
        const connectionSnap = snapToConnection(
          this.canvas,
          newEnd.x,
          newEnd.y,
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
          newEnd = { x: connectionSnap.x, y: connectionSnap.y };
          endAnchorHandle.set({ left: newEnd.x, top: newEnd.y });
          endAnchorHandle.setCoords();

          // Update attachment
          curveData.endAttachment = {
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
          if (curveData.endAttachment) {
            delete curveData.endAttachment;
          }
        }

        // Update stored end point (world coordinates)
        curveData.straightLineEnd = newEnd;

        // Convert world coordinates to local coordinates using inverse transform (like pen tool)
        const matrix = this.straightLine!.calcTransformMatrix();
        const invMatrix = util.invertTransform(matrix);

        const localStartPoint = util.transformPoint(new FabricPoint(start.x, start.y), invMatrix);
        const localEndPoint = util.transformPoint(new FabricPoint(newEnd.x, newEnd.y), invMatrix);

        // Update path with local coordinates, set pathOffset to 0,0 (like pen tool)
        const newPathData = `M ${localStartPoint.x} ${localStartPoint.y} L ${localEndPoint.x} ${localEndPoint.y}`;
        this.straightLine!.set({
          path: util.parsePath(newPathData),
          pathOffset: new FabricPoint(0, 0),
          dirty: true
        });
        this.straightLine!.setCoords();
        this.canvas.requestRenderAll();
      });

      // Save state on modification
      startAnchorHandle.on('modified', () => {
        if (this.saveState) this.saveState();
      });

      endAnchorHandle.on('modified', () => {
        if (this.saveState) this.saveState();
      });
    }

    // Show the anchor handles (no control handle or guide lines for straight lines)
    // (variables already declared above, just update them)
    startAnchorHandle = curveData.startAnchorHandle as Circle;
    endAnchorHandle = curveData.endAnchorHandle as Circle;

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

    // Bring anchor handles to front
    if (startAnchorHandle) {
      this.canvas.bringObjectToFront(startAnchorHandle);
    }
    if (endAnchorHandle) {
      this.canvas.bringObjectToFront(endAnchorHandle);
    }

    this.canvas.requestRenderAll();
  }

  /**
   * Deactivate edit mode
   */
  deactivate(skipSave = false): void {
    if (!this.straightLine) return;

    const curveData = this.straightLine as any;

    // Mark as not in edit mode
    curveData.isEditMode = false;


    // Store old dimensions and pathOffset before normalization
    const oldWidth = this.straightLine.width || 0;
    const oldHeight = this.straightLine.height || 0;
    const oldPathOffset = { x: this.straightLine.pathOffset?.x || 0, y: this.straightLine.pathOffset?.y || 0 };

    // Rebuild path to normalize coordinates (like pen tool does)
    // Extract current path coordinates
    const pathData = this.straightLine.path;
    if (!pathData || pathData.length < 2) {
      console.warn('[DEACTIVATE] Invalid path data');
      return;
    }

    // Build path string from current coordinates
    let pathString = '';
    for (const cmd of pathData) {
      if (cmd[0] === 'M') {
        pathString += `M ${cmd[1]} ${cmd[2]} `;
      } else if (cmd[0] === 'L') {
        pathString += `L ${cmd[1]} ${cmd[2]} `;
      }
    }

    // Set the path and let _setPath normalize it
    this.straightLine.path = util.parsePath(pathString.trim());
    (this.straightLine as any)._setPath(this.straightLine.path);

    // Get the new pathOffset after normalization
    const newPathOffset = { x: this.straightLine.pathOffset?.x || 0, y: this.straightLine.pathOffset?.y || 0 };
    const pathOffsetDelta = {
      x: newPathOffset.x - oldPathOffset.x,
      y: newPathOffset.y - oldPathOffset.y
    };

    // Adjust path coordinates to be relative to new pathOffset (like pen tool does)
    const adjustedCommands: any[] = [];
    for (const cmd of this.straightLine.path) {
      if (cmd[0] === 'M' || cmd[0] === 'L') {
        adjustedCommands.push([
          cmd[0],
          (cmd[1] as number) - pathOffsetDelta.x,
          (cmd[2] as number) - pathOffsetDelta.y
        ]);
      } else {
        adjustedCommands.push([...cmd]);
      }
    }

    // Set the adjusted path with pathOffset=(0,0) (critical - like pen tool line 1070)
    this.straightLine.set({
      path: adjustedCommands,
      pathOffset: new FabricPoint(0, 0),
      dirty: true
    });

    // Get new dimensions after setting adjusted path (like pen tool line 1075-1076)
    const newWidth = this.straightLine.width || 0;
    const newHeight = this.straightLine.height || 0;

    // Calculate dimension changes
    const widthDelta = newWidth - oldWidth;
    const heightDelta = newHeight - oldHeight;


    // Adjust position by DELTA only (not absolute pathOffset)
    this.straightLine.set({
      left: (this.straightLine.left || 0) + pathOffsetDelta.x - widthDelta / 2,
      top: (this.straightLine.top || 0) + pathOffsetDelta.y - heightDelta / 2,
    });

    this.straightLine.setCoords();

    // Re-enable curve selection, controls, and caching
    this.straightLine.set({
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
    this.straightLine.setCoords();

    // CRITICAL: Update stored world coordinates after normalization
    // Extract the current path geometry and transform to world coordinates
    const finalPathData = this.straightLine.path;
    if (finalPathData && finalPathData.length >= 2) {
      // Extract local coordinates from path
      let localStart: { x: number; y: number } | null = null;
      let localEnd: { x: number; y: number } | null = null;

      if (finalPathData[0][0] === 'M' && finalPathData[0].length >= 3) {
        localStart = { x: finalPathData[0][1] as number, y: finalPathData[0][2] as number };
      }

      for (const command of finalPathData) {
        if (command[0] === 'L' && command.length >= 3) {
          localEnd = { x: command[1] as number, y: command[2] as number };
          break;
        }
      }

      if (localStart && localEnd) {
        // Transform to world coordinates
        const pathOffset = this.straightLine.pathOffset || { x: 0, y: 0 };
        const matrix = this.straightLine.calcTransformMatrix();

        const objectLocalStart = {
          x: localStart.x - pathOffset.x,
          y: localStart.y - pathOffset.y
        };
        const objectLocalEnd = {
          x: localEnd.x - pathOffset.x,
          y: localEnd.y - pathOffset.y
        };

        const worldStartPoint = util.transformPoint(new FabricPoint(objectLocalStart.x, objectLocalStart.y), matrix);
        const worldEndPoint = util.transformPoint(new FabricPoint(objectLocalEnd.x, objectLocalEnd.y), matrix);

        // Update stored world coordinates
        curveData.straightLineStart = { x: worldStartPoint.x, y: worldStartPoint.y };
        curveData.straightLineEnd = { x: worldEndPoint.x, y: worldEndPoint.y };
      }
    }

    // Remove the anchor handles from canvas (no control handle or guide lines for straight lines)
    const startAnchorHandle = curveData.startAnchorHandle as Circle;
    const endAnchorHandle = curveData.endAnchorHandle as Circle;

    if (startAnchorHandle) {
      this.canvas.remove(startAnchorHandle);
      curveData.startAnchorHandle = null;
    }

    if (endAnchorHandle) {
      this.canvas.remove(endAnchorHandle);
      curveData.endAnchorHandle = null;
    }

    // Restore endpoint markers when exiting edit mode
    updateEndpointMarkers(
      this.canvas,
      this.straightLine,
      curveData.startMarkerType || 'none',
      curveData.endMarkerType || 'none'
    );

    // Clear any active selections
    this.canvas.discardActiveObject();

    this.straightLine = null;
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
    return this.straightLine !== null;
  }

  /**
   * Get the currently editing straight line
   */
  getStraightLine(): Group | null {
    return this.straightLine;
  }
}
