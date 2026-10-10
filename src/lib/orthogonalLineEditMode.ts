import { Canvas, Path, Circle, Group, util, Point as FabricPoint } from "fabric";
import { routeOrthogonal } from "./lineRouting";
import { removeEndpointMarkers, updateEndpointMarkers } from "./lineEndpointRenderer";
import { snapToConnection } from "./connectionSnapping";
import { highlightConnectionPoint, unhighlightConnectionPoint } from "./connectionPoints";

type MarkerType = 'none' | 'arrow' | 'back-arrow' | 'dot' | 'circle' | 'diamond' | 'block' | 'bar';

export class OrthogonalLineEditMode {
  private canvas: Canvas;
  private orthogonalLine: Path | Group | null = null;
  private saveState?: () => void;
  private selectedWaypointIndex: number | null = null;
  private pathDoubleClickHandler: ((e: any) => void) | null = null;
  private activationTime: number = 0;
  private lastHighlightedPointId?: string;
  private snapThreshold: number = 15;

  constructor(canvas: Canvas, saveState?: () => void) {
    this.canvas = canvas;
    this.saveState = saveState;
  }

  /**
   * Calculate orthogonal path from waypoints using same logic as orthogonalLineTool
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
        // Determine dominant direction
        if (dx > dy) {
          // Horizontal first
          fabricPoints.push(new FabricPoint(curr.x, prev.y));
        } else {
          // Vertical first
          fabricPoints.push(new FabricPoint(prev.x, curr.y));
        }
        fabricPoints.push(new FabricPoint(curr.x, curr.y));
      }
    }

    return fabricPoints;
  }

  /**
   * Recalculate orthogonal path based on updated world waypoints
   */
  private recalculateOrthogonalPath(): void {
    if (!this.orthogonalLine) return;

    const lineData = this.orthogonalLine as any;
    const worldWaypoints = lineData.orthogonalWorldPoints as Array<{ x: number; y: number }>;
    const isClosed = lineData.isClosed || false;

    if (!worldWaypoints || worldWaypoints.length < 2) {
      console.warn('[recalculateOrthogonalPath] Invalid waypoints');
      return;
    }

    // Get the path object (extract from Group if necessary)
    const pathObj = this.orthogonalLine instanceof Group
      ? this.orthogonalLine.getObjects()[0] as Path
      : this.orthogonalLine as Path;

    if (!pathObj) {
      console.warn('[recalculateOrthogonalPath] Could not find path object');
      return;
    }

    // Convert world waypoints to local coordinates using inverse transform
    const matrix = this.orthogonalLine.calcTransformMatrix();
    const invMatrix = util.invertTransform(matrix);

    const localWaypoints = worldWaypoints.map(wp => {
      const localPoint = util.transformPoint(new FabricPoint(wp.x, wp.y), invMatrix);
      return { x: localPoint.x, y: localPoint.y };
    });

    // If closed, add closing segment from last point back to first
    let waypointsForPath = localWaypoints;
    if (isClosed && localWaypoints.length >= 3) {
      // Add first waypoint to end to close the loop
      waypointsForPath = [...localWaypoints, localWaypoints[0]];
    }

    // Calculate orthogonal path from waypoints
    const orthogonalPoints = this.calculateOrthogonalPathFromWaypoints(waypointsForPath);

    if (orthogonalPoints.length < 2) {
      console.warn('[recalculateOrthogonalPath] Invalid orthogonal path');
      return;
    }

    // Build path data string
    let pathData = `M ${orthogonalPoints[0].x} ${orthogonalPoints[0].y}`;
    for (let i = 1; i < orthogonalPoints.length; i++) {
      pathData += ` L ${orthogonalPoints[i].x} ${orthogonalPoints[i].y}`;
    }

    // Update path with pathOffset = (0,0)
    pathObj.set({
      path: util.parsePath(pathData),
      pathOffset: new FabricPoint(0, 0),
      dirty: true
    });
    pathObj.setCoords();

    // Store local points for marker sync
    lineData.orthogonalLineLocalPoints = orthogonalPoints;

    // Clear cached sharp route points so applyCornerStyle re-extracts from the new M/L path
    lineData._sharpRoutePoints = null;

    // If this is a Group with markers, update marker positions
    if (this.orthogonalLine instanceof Group) {
      this.updateMarkerPositions();
    }
  }

  /**
   * Update marker positions based on path endpoints
   */
  private updateMarkerPositions(): void {
    if (!this.orthogonalLine || !(this.orthogonalLine instanceof Group)) return;

    const group = this.orthogonalLine as Group;
    const lineData = group as any;
    const localPoints = lineData.orthogonalLineLocalPoints as FabricPoint[] | undefined;

    if (!localPoints || localPoints.length < 2) return;

    const objects = group.getObjects();
    const startMarker = objects[1] as any; // objects[0] is path, objects[1] is start marker
    const endMarker = objects.length > 2 ? objects[objects.length - 1] as any : null;

    const scaleX = group.scaleX || 1;
    const scaleY = group.scaleY || 1;

    // Get marker offset helper
    const getMarkerOffset = (markerType: MarkerType): number => {
      switch (markerType) {
        case 'arrow': return -10;      // Tip touches endpoint
        case 'back-arrow': return 10;   // Tip touches endpoint
        case 'dot': return 5;           // Radius
        case 'circle': return 6;        // Radius
        case 'diamond': return 4;       // Half diagonal
        case 'block': return 5;         // Half width
        case 'bar': return 0;           // Perpendicular, no offset
        default: return 0;
      }
    };

    // Update start marker
    if (startMarker && localPoints.length >= 2) {
      const localStart = localPoints[0];
      const localSecond = localPoints[1];

      const angle = Math.atan2(localSecond.y - localStart.y, localSecond.x - localStart.x) * (180 / Math.PI);
      const offset = getMarkerOffset(lineData.startMarkerType || 'none');

      const offsetX = offset * Math.cos(angle * Math.PI / 180);
      const offsetY = offset * Math.sin(angle * Math.PI / 180);

      startMarker.set({
        left: localStart.x + offsetX,
        top: localStart.y + offsetY,
        angle: angle,
        scaleX: 1 / scaleX,
        scaleY: 1 / scaleY,
      });
      startMarker.setCoords();
    }

    // Update end marker
    if (endMarker && localPoints.length >= 2) {
      const localEnd = localPoints[localPoints.length - 1];
      const localSecondLast = localPoints[localPoints.length - 2];

      const angle = Math.atan2(localEnd.y - localSecondLast.y, localEnd.x - localSecondLast.x) * (180 / Math.PI);
      const offset = getMarkerOffset(lineData.endMarkerType || 'none');

      const offsetX = offset * Math.cos(angle * Math.PI / 180);
      const offsetY = offset * Math.sin(angle * Math.PI / 180);

      endMarker.set({
        left: localEnd.x + offsetX,
        top: localEnd.y + offsetY,
        angle: angle,
        scaleX: 1 / scaleX,
        scaleY: 1 / scaleY,
      });
      endMarker.setCoords();
    }

    group.dirty = true;
    group.setCoords();
  }

  /**
   * Activate edit mode for an orthogonal line
   */
  activate(orthogonalLineObj: Path | Group): void {
    if (!orthogonalLineObj || !(orthogonalLineObj as any).isOrthogonalLine) {
      console.warn('Can only edit orthogonal lines');
      return;
    }

    this.orthogonalLine = orthogonalLineObj;
    const lineData = orthogonalLineObj as any;
    this.activationTime = Date.now();


    // Mark as in edit mode
    lineData.isEditMode = true;

    // Deselect the line to hide the selection box/controls
    this.canvas.discardActiveObject();

    // Disable selection/resizing/rotating while in edit mode
    this.orthogonalLine.set({
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
    removeEndpointMarkers(this.canvas, this.orthogonalLine);

    // Extract path geometry to calculate current world coordinates
    const pathObj = this.orthogonalLine instanceof Group
      ? this.orthogonalLine.getObjects()[0] as Path
      : this.orthogonalLine as Path;

    if (!pathObj || !pathObj.path) {
      console.warn('[OrthogonalLineEditMode] Invalid path data');
      return;
    }

    // Extract waypoints in local coordinates and transform to world coordinates
    // This ensures waypoints are correct even if the line has been moved/scaled/rotated
    let localWaypoints: Array<{ x: number; y: number }> = [];

    // Check if we have orthogonalLineLocalWaypoints (waypoints in local coords)
    if (lineData.orthogonalLineLocalWaypoints && lineData.orthogonalLineLocalWaypoints.length >= 2) {
      // Use the stored local waypoints - these transform with the object
      localWaypoints = lineData.orthogonalLineLocalWaypoints.map((wp: any) => ({ x: wp.x, y: wp.y }));
    } else if (lineData.orthogonalLineLocalPoints && lineData.orthogonalLineLocalPoints.length >= 2) {
      // Fallback: use path points (includes routing points, not ideal)
      // Extract start and end only
      const localPoints = lineData.orthogonalLineLocalPoints;
      localWaypoints.push({ x: localPoints[0].x, y: localPoints[0].y }); // Start
      localWaypoints.push({ x: localPoints[localPoints.length - 1].x, y: localPoints[localPoints.length - 1].y }); // End
    } else {
      // Last resort: extract from path commands
      const pathData = pathObj.path;
      const pathOffset = pathObj.pathOffset || { x: 0, y: 0 };

      // Get start point from M command
      if (pathData[0][0] === 'M' && pathData[0].length >= 3) {
        localWaypoints.push({
          x: (pathData[0][1] as number) - pathOffset.x,
          y: (pathData[0][2] as number) - pathOffset.y
        });
      }

      // Get end point from last L command
      for (let i = pathData.length - 1; i >= 0; i--) {
        if (pathData[i][0] === 'L' && pathData[i].length >= 3) {
          localWaypoints.push({
            x: (pathData[i][1] as number) - pathOffset.x,
            y: (pathData[i][2] as number) - pathOffset.y
          });
          break;
        }
      }

    }

    if (localWaypoints.length < 2) {
      console.warn('[OrthogonalLineEditMode] Could not extract waypoints');
      return;
    }

    // Transform local waypoints to world coordinates using current transform
    const matrix = this.orthogonalLine.calcTransformMatrix();
    const worldWaypoints = localWaypoints.map(wp => {
      const worldPoint = util.transformPoint(new FabricPoint(wp.x, wp.y), matrix);
      return { x: worldPoint.x, y: worldPoint.y };
    });


    // Store world waypoints (source of truth during edit)
    lineData.orthogonalWorldPoints = worldWaypoints;

    // Normalize pathOffset to (0,0) if needed.
    // Must handle all command types that contain absolute coordinates:
    //   M x y         → subtract pathOffset from (x, y)
    //   L x y         → subtract pathOffset from (x, y)
    //   Q cx cy x y   → subtract pathOffset from control point AND endpoint
    //   C c1x c1y c2x c2y x y → subtract pathOffset from all three pairs
    //   Z             → no coordinates, pass through unchanged
    if (pathObj.pathOffset && (pathObj.pathOffset.x !== 0 || pathObj.pathOffset.y !== 0)) {
      const pathOffset = pathObj.pathOffset;
      const adjustedCommands: any[] = [];

      for (const cmd of pathObj.path) {
        const type = cmd[0] as string;
        if (type === 'M' || type === 'L') {
          // M/L: [type, x, y]
          adjustedCommands.push([
            type,
            (cmd[1] as number) - pathOffset.x,
            (cmd[2] as number) - pathOffset.y
          ]);
        } else if (type === 'Q') {
          // Q: [type, cx, cy, x, y]
          adjustedCommands.push([
            type,
            (cmd[1] as number) - pathOffset.x,
            (cmd[2] as number) - pathOffset.y,
            (cmd[3] as number) - pathOffset.x,
            (cmd[4] as number) - pathOffset.y
          ]);
        } else if (type === 'C') {
          // C: [type, c1x, c1y, c2x, c2y, x, y]
          adjustedCommands.push([
            type,
            (cmd[1] as number) - pathOffset.x,
            (cmd[2] as number) - pathOffset.y,
            (cmd[3] as number) - pathOffset.x,
            (cmd[4] as number) - pathOffset.y,
            (cmd[5] as number) - pathOffset.x,
            (cmd[6] as number) - pathOffset.y
          ]);
        } else {
          // Z and any other commands have no coordinates
          adjustedCommands.push([...cmd]);
        }
      }

      pathObj.set({
        path: adjustedCommands,
        pathOffset: new FabricPoint(0, 0),
        dirty: true
      });
      pathObj.setCoords();
    }

    // Create anchor handles for each waypoint
    const anchorHandles: Circle[] = [];

    for (let i = 0; i < worldWaypoints.length; i++) {
      const wp = worldWaypoints[i];

      const handle = new Circle({
        left: wp.x,
        top: wp.y,
        radius: 8,
        fill: '#3b82f6',
        stroke: '#ffffff',
        strokeWidth: 2,
        originX: 'center',
        originY: 'center',
        selectable: true,
        evented: true,
        hasControls: false,
        hasBorders: false,
        hoverCursor: 'move',
        visible: false,
      });

      (handle as any).isAnchorHandle = true;
      (handle as any).handleType = 'waypoint';
      (handle as any).waypointIndex = i;
      (handle as any).excludeFromExport = true;

      // Set up click handler for selection
      handle.on('mousedown', () => {
        const idx = (handle as any).waypointIndex;
        this.selectWaypoint(idx);
      });

      // Set up drag handler for this waypoint
      handle.on('moving', () => {
        // Get the current index from the handle (not from closure)
        const idx = (handle as any).waypointIndex;
        let newPoint = { x: handle.left!, y: handle.top! };

        // Only snap first and last waypoints to connection points
        const isEndpoint = idx === 0 || idx === lineData.orthogonalWorldPoints.length - 1;
        if (isEndpoint) {
          // Try to snap to connection point
          const connectionSnap = snapToConnection(
            this.canvas,
            newPoint.x,
            newPoint.y,
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
            newPoint = { x: connectionSnap.x, y: connectionSnap.y };
            handle.set({ left: newPoint.x, top: newPoint.y });
            handle.setCoords();

            // Update attachment
            const attachmentKey = idx === 0 ? 'startAttachment' : 'endAttachment';
            lineData[attachmentKey] = {
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
            const attachmentKey = idx === 0 ? 'startAttachment' : 'endAttachment';
            if (lineData[attachmentKey]) {
              delete lineData[attachmentKey];
            }
          }
        }

        // Update stored world coordinates
        lineData.orthogonalWorldPoints[idx] = newPoint;

        // Recalculate orthogonal path from updated waypoints
        this.recalculateOrthogonalPath();

        this.canvas.requestRenderAll();
      });

      handle.on('modified', () => {
        if (this.saveState) this.saveState();
      });

      anchorHandles.push(handle);
      this.canvas.add(handle);
    }

    // Store handles reference
    lineData.anchorHandles = anchorHandles;

    // IMPORTANT: Render once after adding all handles to canvas
    this.canvas.requestRenderAll();

    // Show anchor handles and bring them to front
    anchorHandles.forEach((handle, idx) => {
      handle.set({
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
        hoverCursor: 'move',
      });

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

      handle.setCoords();
    });

    // Bring all handles to front AFTER they're all configured
    anchorHandles.forEach(handle => {
      this.canvas.bringObjectToFront(handle);
    });

    // Set up double-click handler for adding waypoints
    // Remove any existing handler first to prevent duplicates
    if (this.pathDoubleClickHandler) {
      this.canvas.off('mouse:dblclick', this.pathDoubleClickHandler);
    }

    this.pathDoubleClickHandler = (e: any) => {
      // Don't check e.target - just process any double-click during edit mode
      // This allows adding waypoints even when clicking on extended parts of the line

      // Ignore double-clicks that happen too soon after activation
      const timeSinceActivation = Date.now() - this.activationTime;
      if (timeSinceActivation < 50) {
        return;
      }

      // Don't process if clicking on an anchor handle
      if (e.target && (e.target as any).isAnchorHandle) {
        return;
      }


      const pointer = this.canvas.getPointer(e.e);

      // Convert pointer to local coordinates
      const invMatrix = util.invertTransform(this.orthogonalLine!.calcTransformMatrix());
      const localPoint = util.transformPoint(new FabricPoint(pointer.x, pointer.y), invMatrix);

      this.addWaypoint(localPoint.x, localPoint.y);
    };

    this.canvas.on('mouse:dblclick', this.pathDoubleClickHandler);

    // Final render to show all handles
    this.canvas.requestRenderAll();
  }

  /**
   * Deactivate edit mode
   */
  deactivate(skipSave = false): void {
    if (!this.orthogonalLine) return;

    const lineData = this.orthogonalLine as any;

    // Remove double-click event handler
    if (this.pathDoubleClickHandler) {
      this.canvas.off('mouse:dblclick', this.pathDoubleClickHandler);
      this.pathDoubleClickHandler = null;
    }

    // Deselect any selected waypoint
    if (this.selectedWaypointIndex !== null) {
      this.deselectWaypoint();
    }

    // Mark as not in edit mode
    lineData.isEditMode = false;
    lineData.selectedWaypointIndex = null;


    // Store the current world waypoints for later (we'll save them after normalization)
    const currentWorldWaypoints = lineData.orthogonalWorldPoints ? [...lineData.orthogonalWorldPoints] : null;

    // Get the path object
    const pathObj = this.orthogonalLine instanceof Group
      ? this.orthogonalLine.getObjects()[0] as Path
      : this.orthogonalLine as Path;

    if (!pathObj) {
      console.warn('[DEACTIVATE] Could not find path object');
      return;
    }

    // Store old dimensions and pathOffset before normalization
    const oldWidth = this.orthogonalLine.width || 0;
    const oldHeight = this.orthogonalLine.height || 0;
    const oldPathOffset = { x: pathObj.pathOffset?.x || 0, y: pathObj.pathOffset?.y || 0 };

    // Rebuild path to normalize coordinates
    const pathData = pathObj.path;
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
    pathObj.path = util.parsePath(pathString.trim());
    (pathObj as any)._setPath(pathObj.path);

    // Get the new pathOffset after normalization
    const newPathOffset = { x: pathObj.pathOffset?.x || 0, y: pathObj.pathOffset?.y || 0 };
    const pathOffsetDelta = {
      x: newPathOffset.x - oldPathOffset.x,
      y: newPathOffset.y - oldPathOffset.y
    };

    // Adjust path coordinates to be relative to new pathOffset
    const adjustedCommands: any[] = [];
    for (const cmd of pathObj.path) {
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

    // Set the adjusted path with pathOffset=(0,0)
    pathObj.set({
      path: adjustedCommands,
      pathOffset: new FabricPoint(0, 0),
      dirty: true
    });

    // Get new dimensions after setting adjusted path
    const newWidth = this.orthogonalLine.width || 0;
    const newHeight = this.orthogonalLine.height || 0;

    // Calculate dimension changes
    const widthDelta = newWidth - oldWidth;
    const heightDelta = newHeight - oldHeight;


    // Adjust position by DELTA only (not absolute pathOffset)
    this.orthogonalLine.set({
      left: (this.orthogonalLine.left || 0) + pathOffsetDelta.x - widthDelta / 2,
      top: (this.orthogonalLine.top || 0) + pathOffsetDelta.y - heightDelta / 2,
    });

    this.orthogonalLine.setCoords();

    // Re-enable line selection, controls, and caching
    this.orthogonalLine.set({
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
    this.orthogonalLine.setCoords();

    // IMPORTANT: Save the updated waypoint positions AFTER path normalization
    // This ensures waypoints are saved relative to the final object transform
    if (currentWorldWaypoints && currentWorldWaypoints.length >= 2) {
      const invMatrix = util.invertTransform(this.orthogonalLine.calcTransformMatrix());
      const updatedLocalWaypoints = currentWorldWaypoints.map((wp: any) => {
        const localPoint = util.transformPoint(new FabricPoint(wp.x, wp.y), invMatrix);
        return { x: localPoint.x, y: localPoint.y };
      });
      lineData.orthogonalLineLocalWaypoints = updatedLocalWaypoints;
      // Also sync world waypoints so ConnectionSyncManager uses the updated positions
      // when objects are moved after edit mode. Without this, stale pre-edit waypoints
      // cause the line to visually snap back to the original connection point.
      lineData.orthogonalLineWaypoints = currentWorldWaypoints.map((wp: any) => ({ x: wp.x, y: wp.y }));
    }

    // Remove all anchor handles from canvas
    const anchorHandles = lineData.anchorHandles as Circle[];
    if (anchorHandles) {
      anchorHandles.forEach((handle: Circle) => {
        this.canvas.remove(handle);
      });
      lineData.anchorHandles = null;
    }

    // Restore endpoint markers when exiting edit mode
    updateEndpointMarkers(
      this.canvas,
      this.orthogonalLine,
      lineData.startMarkerType || 'none',
      lineData.endMarkerType || 'none'
    );

    // Clear any active selections
    this.canvas.discardActiveObject();

    this.orthogonalLine = null;
    this.canvas.requestRenderAll();

    // Save state after exiting edit mode to capture the edited line (unless skipSave is true)
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
    return this.orthogonalLine !== null;
  }

  /**
   * Get the currently edited orthogonal line
   */
  getOrthogonalLine(): Path | Group | null {
    return this.orthogonalLine;
  }

  /**
   * Select a waypoint by index
   */
  private selectWaypoint(index: number): void {
    if (!this.orthogonalLine) return;

    const lineData = this.orthogonalLine as any;
    const anchorHandles = lineData.anchorHandles as Circle[];
    if (!anchorHandles || index < 0 || index >= anchorHandles.length) return;

    // If already selected, do nothing
    if (this.selectedWaypointIndex === index) return;

    // Deselect previous waypoint
    if (this.selectedWaypointIndex !== null && anchorHandles[this.selectedWaypointIndex]) {
      anchorHandles[this.selectedWaypointIndex].set({
        fill: '#3b82f6',
        radius: 8,
      });
    }

    // Select new waypoint
    this.selectedWaypointIndex = index;
    lineData.selectedWaypointIndex = index;

    // Update visual appearance
    anchorHandles[index].set({
      fill: '#f97316', // Orange color for selected
      radius: 10,
    });

    this.canvas.requestRenderAll();
  }

  /**
   * Deselect the current waypoint
   */
  private deselectWaypoint(): void {
    if (this.selectedWaypointIndex === null || !this.orthogonalLine) return;

    const lineData = this.orthogonalLine as any;
    const anchorHandles = lineData.anchorHandles as Circle[];

    if (anchorHandles && anchorHandles[this.selectedWaypointIndex]) {
      anchorHandles[this.selectedWaypointIndex].set({
        fill: '#3b82f6',
        radius: 8,
      });
    }

    this.selectedWaypointIndex = null;
    lineData.selectedWaypointIndex = null;
    this.canvas.requestRenderAll();
  }

  /**
   * Get the currently selected waypoint index
   */
  getSelectedWaypointIndex(): number | null {
    return this.selectedWaypointIndex;
  }

  /**
   * Delete a waypoint by index
   */
  deleteWaypoint(index: number): void {
    if (!this.orthogonalLine) return;

    const lineData = this.orthogonalLine as any;
    const worldWaypoints = lineData.orthogonalWorldPoints as Array<{ x: number; y: number }>;
    const anchorHandles = lineData.anchorHandles as Circle[];


    // Must have at least 3 waypoints to delete one (leaving minimum of 2)
    if (!worldWaypoints || worldWaypoints.length <= 2) {
      console.warn('[OrthogonalLineEditMode] Cannot delete waypoint - need minimum of 2 waypoints');
      return;
    }

    if (index < 0 || index >= worldWaypoints.length) return;

    // If deleting selected waypoint, deselect first
    if (this.selectedWaypointIndex === index) {
      this.deselectWaypoint();
    } else if (this.selectedWaypointIndex !== null && this.selectedWaypointIndex > index) {
      // Adjust selected index if it comes after deleted waypoint
      this.selectedWaypointIndex--;
      lineData.selectedWaypointIndex = this.selectedWaypointIndex;
    }

    // Remove waypoint from array
    worldWaypoints.splice(index, 1);

    // Remove handle from canvas
    if (anchorHandles && anchorHandles[index]) {
      this.canvas.remove(anchorHandles[index]);
      anchorHandles.splice(index, 1);


      // Update waypointIndex on remaining handles
      for (let i = index; i < anchorHandles.length; i++) {
        const oldIndex = (anchorHandles[i] as any).waypointIndex;
        (anchorHandles[i] as any).waypointIndex = i;
      }
    }

    // Recalculate path
    this.recalculateOrthogonalPath();
    this.canvas.requestRenderAll();

    if (this.saveState) this.saveState();
  }

  /**
   * Add a waypoint at the specified local coordinates
   */
  addWaypoint(localX: number, localY: number): void {
    if (!this.orthogonalLine) return;

    const lineData = this.orthogonalLine as any;
    const worldWaypoints = lineData.orthogonalWorldPoints as Array<{ x: number; y: number }>;

    if (!worldWaypoints || worldWaypoints.length < 2) return;

    // Deselect any currently selected waypoint
    if (this.selectedWaypointIndex !== null) {
      this.deselectWaypoint();
    }

    // Transform local point to world coordinates
    const matrix = this.orthogonalLine.calcTransformMatrix();
    const worldPoint = util.transformPoint(new FabricPoint(localX, localY), matrix);


    // Find the closest waypoint segment to insert the new waypoint between
    // Since the double-click handler already verified we clicked on the line,
    // we don't need to check distance - just find the closest segment
    let closestWaypointSegmentIndex = 0;
    let closestWaypointDistance = Infinity;

    for (let i = 0; i < worldWaypoints.length - 1; i++) {
      const p1 = worldWaypoints[i];
      const p2 = worldWaypoints[i + 1];

      // Calculate distance from point to line segment
      const distance = this.pointToSegmentDistance(worldPoint.x, worldPoint.y, p1.x, p1.y, p2.x, p2.y);


      if (distance < closestWaypointDistance) {
        closestWaypointDistance = distance;
        closestWaypointSegmentIndex = i;
      }
    }


    // Only add waypoint if click is reasonably close to a waypoint segment (within 100 pixels)
    const MAX_DISTANCE = 100;
    if (closestWaypointDistance > MAX_DISTANCE) {
      return;
    }

    // Insert new waypoint after the closest segment
    const insertIndex = closestWaypointSegmentIndex + 1;
    worldWaypoints.splice(insertIndex, 0, { x: worldPoint.x, y: worldPoint.y });

    // Create new handle for the waypoint
    const handle = new Circle({
      left: worldPoint.x,
      top: worldPoint.y,
      radius: 8,
      fill: '#3b82f6',
      stroke: '#ffffff',
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
      visible: true,
    });

    (handle as any).isAnchorHandle = true;
    (handle as any).handleType = 'waypoint';
    (handle as any).waypointIndex = insertIndex;
    (handle as any).excludeFromExport = true;

    // Set up click handler for selection
    handle.on('mousedown', () => {
      const idx = (handle as any).waypointIndex;
      this.selectWaypoint(idx);
    });

    // Set up drag handler
    handle.on('moving', () => {
      const idx = (handle as any).waypointIndex;
      let newPoint = { x: handle.left!, y: handle.top! };

      // Only snap first and last waypoints to connection points
      const isEndpoint = idx === 0 || idx === lineData.orthogonalWorldPoints.length - 1;
      if (isEndpoint) {
        // Try to snap to connection point
        const connectionSnap = snapToConnection(
          this.canvas,
          newPoint.x,
          newPoint.y,
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
          newPoint = { x: connectionSnap.x, y: connectionSnap.y };
          handle.set({ left: newPoint.x, top: newPoint.y });
          handle.setCoords();

          // Update attachment
          const attachmentKey = idx === 0 ? 'startAttachment' : 'endAttachment';
          lineData[attachmentKey] = {
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
          const attachmentKey = idx === 0 ? 'startAttachment' : 'endAttachment';
          if (lineData[attachmentKey]) {
            delete lineData[attachmentKey];
          }
        }
      }

      lineData.orthogonalWorldPoints[idx] = newPoint;
      this.recalculateOrthogonalPath();
      this.canvas.requestRenderAll();
    });

    handle.on('modified', () => {
      if (this.saveState) this.saveState();
    });

    // Add to canvas and handles array
    const anchorHandles = lineData.anchorHandles as Circle[];
    if (anchorHandles) {
      anchorHandles.splice(insertIndex, 0, handle);

      // Update waypointIndex on handles after insertion
      for (let i = insertIndex + 1; i < anchorHandles.length; i++) {
        (anchorHandles[i] as any).waypointIndex = i;
      }
    }

    this.canvas.add(handle);
    handle.set({
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
      hoverCursor: 'move',
    });

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

    this.canvas.bringObjectToFront(handle);

    // Recalculate path with new waypoint
    this.recalculateOrthogonalPath();
    this.canvas.requestRenderAll();

    if (this.saveState) this.saveState();
  }

  /**
   * Calculate distance from point to line segment
   */
  private pointToSegmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lengthSquared = dx * dx + dy * dy;

    if (lengthSquared === 0) {
      // Segment is a point
      return Math.sqrt((px - x1) * (px - x1) + (py - y1) * (py - y1));
    }

    // Project point onto line segment
    let t = ((px - x1) * dx + (py - y1) * dy) / lengthSquared;
    t = Math.max(0, Math.min(1, t));

    const projX = x1 + t * dx;
    const projY = y1 + t * dy;

    return Math.sqrt((px - projX) * (px - projX) + (py - projY) * (py - projY));
  }
}
