import { Canvas as FabricCanvas, Circle, Path, Group, Polygon, FabricObject, Point as FabricPoint, util } from "fabric";
import { toast } from "sonner";
import { v4 as uuidv4 } from 'uuid';
import { routeOrthogonal, smoothOrthogonalPath } from "./lineRouting";
import { LineIntersectionRenderer } from "./lineIntersectionRenderer";
import { DEFAULT_INTERSECTION_CONFIG, ConnectionPoint } from "@/types/effects";
import { snapToConnection } from "./connectionSnapping";
import { highlightConnectionPoint, unhighlightConnectionPoint } from "./connectionPoints";
import { findOrthogonalPath } from "./pathfinding";

export interface OrthogonalLinePoint {
  x: number;
  y: number;
}

export type MarkerType = 'none' | 'dot' | 'arrow' | 'back-arrow' | 'diamond' | 'circle' | 'bar' | 'block';
export type LineStyleType = 'solid' | 'dashed' | 'dotted';

export interface OrthogonalLineOptions {
  startMarker?: MarkerType;
  endMarker?: MarkerType;
  lineStyle?: LineStyleType;
  strokeWidth?: number;
  strokeColor?: string;
  snap?: boolean;
  gridSize?: number;
  smoothCorners?: boolean;
  cornerRadius?: number;
}

export class OrthogonalLineTool {
  private canvas: FabricCanvas;
  private waypoints: OrthogonalLinePoint[] = [];
  private currentPoint: OrthogonalLinePoint | null = null;
  private tempPath: Path | null = null;
  private handles: Circle[] = [];
  private tempMarkers: FabricObject[] = [];
  private isDrawing: boolean = false;
  private isFinishing: boolean = false;
  private isClosed: boolean = false;
  private shouldAutoFinish: boolean = false;
  private options: Required<OrthogonalLineOptions>;
  private smartConnectorsEnabled: boolean = false;
  private autoPathfindingEnabled: boolean = false;
  private snapThreshold: number = 15;
  private tentativeStartAttachment?: ConnectionPoint;
  private tentativeEndAttachment?: ConnectionPoint;
  private lastHighlightedPointId?: string;

  constructor(
    canvas: FabricCanvas,
    options?: OrthogonalLineOptions,
    smartConnectorsEnabled: boolean = false,
    autoPathfindingEnabled: boolean = false,
    snapThreshold: number = 15
  ) {
    this.canvas = canvas;
    this.options = {
      startMarker: options?.startMarker || 'none',
      endMarker: options?.endMarker || 'none',
      lineStyle: options?.lineStyle || 'solid',
      strokeWidth: options?.strokeWidth || 2,
      strokeColor: options?.strokeColor || '#000000',
      snap: options?.snap ?? true,
      gridSize: options?.gridSize || 20,
      smoothCorners: options?.smoothCorners ?? false,
      cornerRadius: options?.cornerRadius || 10,
    };
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

  start(): void {
    this.isDrawing = true;
    this.waypoints = [];
    this.currentPoint = null;
    this.handles = [];
    this.tempMarkers = [];
    this.isClosed = false;
    this.shouldAutoFinish = false;
    this.disableObjectInteraction();
    this.canvas.defaultCursor = 'crosshair';
  }

  addPoint(x: number, y: number): void {
    if (!this.isDrawing) return;

    // Snap to grid if enabled
    let snappedX = x;
    let snappedY = y;
    if (this.options.snap) {
      snappedX = Math.round(x / this.options.gridSize) * this.options.gridSize;
      snappedY = Math.round(y / this.options.gridSize) * this.options.gridSize;
    }

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

    // Store tentative attachment for first or last point
    if (this.waypoints.length === 0 && connectionSnap.connectionPoint) {
      this.tentativeStartAttachment = connectionSnap.connectionPoint;
    }
    if (connectionSnap.connectionPoint) {
      this.tentativeEndAttachment = connectionSnap.connectionPoint;
    }

    this.waypoints.push({ x: finalX, y: finalY });
    this.addPointHandle(finalX, finalY);

    if (this.waypoints.length === 1) {
      toast.info("Click to add corners. Press Enter to finish, or click last point to complete.");
    }

    // Auto-finish if we have at least 2 waypoints and clicked a connection point
    // This handles: first point + connection point, or multiple points + connection point
    if (this.waypoints.length >= 2 && connectionSnap.connectionPoint) {
      this.shouldAutoFinish = true;
    }
  }

  /**
   * Check if a click is near the last waypoint (to complete the line)
   */
  isClickNearLastPoint(x: number, y: number, threshold: number = 12): boolean {
    if (this.waypoints.length < 2) return false; // Need at least 2 points to complete

    const lastPoint = this.waypoints[this.waypoints.length - 1];
    const distance = Math.sqrt(
      Math.pow(x - lastPoint.x, 2) + Math.pow(y - lastPoint.y, 2)
    );

    return distance <= threshold;
  }

  /**
   * Check if a click is near the first waypoint (to close the loop)
   */
  isClickNearFirstPoint(x: number, y: number, threshold: number = 15): boolean {
    if (this.waypoints.length < 3) return false; // Need at least 3 points to close a loop

    const firstPoint = this.waypoints[0];
    const distance = Math.sqrt(
      Math.pow(x - firstPoint.x, 2) + Math.pow(y - firstPoint.y, 2)
    );

    return distance <= threshold;
  }

  /**
   * Check if the line should auto-finish (after clicking a connection point)
   * Returns true and resets the flag if it should auto-finish
   */
  checkAndResetAutoFinish(): boolean {
    const shouldFinish = this.shouldAutoFinish;
    this.shouldAutoFinish = false;
    return shouldFinish;
  }

  /**
   * Update first point handle highlight when hovering near it
   */
  updateFirstPointHighlight(x: number, y: number): void {
    if (this.handles.length === 0 || this.waypoints.length < 3) return;

    const isCloseable = this.isClickNearFirstPoint(x, y);
    const firstHandle = this.handles[0];

    firstHandle.set({
      radius: isCloseable ? 6 : 4,
      fill: isCloseable ? '#FBBF24' : '#10b981', // Yellow when closeable, green otherwise
      stroke: isCloseable ? '#F59E0B' : '#059669',
    });

    this.canvas.requestRenderAll();
  }

  /**
   * Close the path to create a loop
   */
  closePath(): void {
    this.isClosed = true;
    // No need to recalculate here, finish() will handle it
  }

  updatePreview(x: number, y: number): void {
    if (!this.isDrawing || this.waypoints.length === 0) return;

    // Snap to grid if enabled
    let snappedX = x;
    let snappedY = y;
    if (this.options.snap) {
      snappedX = Math.round(x / this.options.gridSize) * this.options.gridSize;
      snappedY = Math.round(y / this.options.gridSize) * this.options.gridSize;
    }

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
      if (this.lastHighlightedPointId && this.lastHighlightedPointId !== connectionSnap.connectionPoint.id) {
        unhighlightConnectionPoint(this.canvas, this.lastHighlightedPointId);
      }
      highlightConnectionPoint(this.canvas, connectionSnap.connectionPoint.id);
      this.lastHighlightedPointId = connectionSnap.connectionPoint.id;
    } else {
      if (this.lastHighlightedPointId) {
        unhighlightConnectionPoint(this.canvas, this.lastHighlightedPointId);
        this.lastHighlightedPointId = undefined;
      }
    }

    const finalX = connectionSnap.connectionPoint ? connectionSnap.x : snappedX;
    const finalY = connectionSnap.connectionPoint ? connectionSnap.y : snappedY;

    this.currentPoint = { x: finalX, y: finalY };
    this.updatePath();
  }

  private addPointHandle(x: number, y: number): void {
    const handle = new Circle({
      left: x - 4,
      top: y - 4,
      radius: 4,
      fill: '#10b981',
      stroke: '#059669',
      strokeWidth: 2,
      selectable: false,
      evented: false,
      excludeFromExport: true,
    });
    this.handles.push(handle);
    this.canvas.add(handle);
  }

  private calculateOrthogonalPath(points: OrthogonalLinePoint[]): FabricPoint[] {
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
        // Determine dominant direction and add intermediate elbow point only if needed
        if (dx > dy) {
          // Horizontal first: only add elbow if segment isn't already horizontal
          if (dy > 0) {
            fabricPoints.push(new FabricPoint(curr.x, prev.y));
          }
        } else {
          // Vertical first: only add elbow if segment isn't already vertical
          if (dx > 0) {
            fabricPoints.push(new FabricPoint(prev.x, curr.y));
          }
        }
        fabricPoints.push(new FabricPoint(curr.x, curr.y));
      }
    }

    return fabricPoints;
  }

  private updatePath(): void {
    // Remove old temporary path and markers
    if (this.tempPath) {
      this.canvas.remove(this.tempPath);
    }
    this.tempMarkers.forEach(marker => this.canvas.remove(marker));
    this.tempMarkers = [];

    if (this.waypoints.length < 1 || !this.currentPoint) {
      this.canvas.requestRenderAll();
      return;
    }

    // Calculate orthogonal path
    const allPoints = [...this.waypoints, this.currentPoint];
    const orthogonalPoints = this.calculateOrthogonalPath(allPoints);

    if (orthogonalPoints.length < 2) {
      this.canvas.requestRenderAll();
      return;
    }

    // Build path data
    let pathData: string;
    if (this.options.smoothCorners && orthogonalPoints.length > 2) {
      pathData = smoothOrthogonalPath(orthogonalPoints, this.options.cornerRadius);
    } else {
      pathData = `M ${orthogonalPoints[0].x} ${orthogonalPoints[0].y}`;
      for (let i = 1; i < orthogonalPoints.length; i++) {
        pathData += ` L ${orthogonalPoints[i].x} ${orthogonalPoints[i].y}`;
      }
    }

    // Create temporary path with teal color
    this.tempPath = new Path(pathData, {
      stroke: '#14b8a6',
      strokeWidth: this.options.strokeWidth,
      fill: null,
      selectable: false,
      evented: false,
      strokeDashArray: this.getStrokeDashArray(),
      strokeUniform: true,
      excludeFromExport: true,
    });
    this.canvas.add(this.tempPath);

    // Add temporary markers
    if (orthogonalPoints.length >= 2) {
      // Start marker
      if (this.options.startMarker !== 'none') {
        const angle = this.calculateAngle(
          orthogonalPoints[1],
          orthogonalPoints[0]
        );
        const marker = this.createMarker(
          this.options.startMarker,
          orthogonalPoints[0].x,
          orthogonalPoints[0].y,
          angle,
          true, // isTemp
          true  // isStartMarker
        );
        (marker as any).excludeFromExport = true;
        this.tempMarkers.push(marker);
        this.canvas.add(marker);
      }

      // End marker
      if (this.options.endMarker !== 'none') {
        const lastIdx = orthogonalPoints.length - 1;
        const angle = this.calculateAngle(
          orthogonalPoints[lastIdx - 1],
          orthogonalPoints[lastIdx]
        );
        const marker = this.createMarker(
          this.options.endMarker,
          orthogonalPoints[lastIdx].x,
          orthogonalPoints[lastIdx].y,
          angle,
          true,  // isTemp
          false  // isStartMarker
        );
        (marker as any).excludeFromExport = true;
        this.tempMarkers.push(marker);
        this.canvas.add(marker);
      }
    }

    this.canvas.requestRenderAll();
  }

  private calculateAngle(from: FabricPoint, to: FabricPoint): number {
    return Math.atan2(to.y - from.y, to.x - from.x) * (180 / Math.PI);
  }

  private createMarker(
    type: MarkerType,
    x: number,
    y: number,
    angle: number,
    isTemp: boolean = false,
    isStartMarker: boolean = false
  ): FabricObject {
    const color = isTemp ? '#14b8a6' : this.options.strokeColor;

    // Calculate offset for hollow markers to align edge with endpoint
    // Start marker angle points backward, end marker angle points forward
    // Both need positive offset in the direction of their respective angles
    const getHollowMarkerOffset = (size: number): { x: number; y: number } => {
      const angleRad = angle * Math.PI / 180;
      const offsetDistance = size; // Always positive
      return {
        x: Math.cos(angleRad) * offsetDistance,
        y: Math.sin(angleRad) * offsetDistance
      };
    };
    
    switch (type) {
      case 'dot': {
        return new Circle({
          left: x,
          top: y,
          radius: 5,
          fill: color,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
          strokeUniform: true,
        });
      }

      case 'arrow': {
        const arrowSize = 10;
        const arrow = new Polygon([
          { x: 0, y: 0 },
          { x: -arrowSize, y: -arrowSize / 2 },
          { x: -arrowSize, y: arrowSize / 2 },
        ], {
          fill: color,
          stroke: color,
          strokeWidth: 0,
          left: x,
          top: y,
          angle: angle,
          selectable: false,
          evented: false,
          originX: 'center',
          originY: 'center',
          strokeUniform: true,
        });
        return arrow;
      }

      case 'diamond': {
        const size = 8;
        const diamond = new Polygon([
          { x: 0, y: -size },
          { x: size, y: 0 },
          { x: 0, y: size },
          { x: -size, y: 0 },
        ], {
          fill: color,
          stroke: color,
          strokeWidth: 1,
          left: x,
          top: y,
          angle: angle,
          selectable: false,
          evented: false,
          originX: 'center',
          originY: 'center',
          strokeUniform: true,
        });
        return diamond;
      }

      case 'circle': {
        const radius = 6;
        const offset = getHollowMarkerOffset(radius);
        return new Circle({
          left: x + offset.x,
          top: y + offset.y,
          radius: radius,
          fill: 'transparent',
          stroke: color,
          strokeWidth: 2,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
          strokeUniform: true,
        });
      }

      case 'bar': {
        const barSize = 10;
        const bar = new Polygon([
          { x: 0, y: -barSize / 2 },
          { x: 0, y: barSize / 2 },
        ], {
          fill: 'transparent',
          stroke: color,
          strokeWidth: 3,
          left: x,
          top: y,
          angle: angle,
          selectable: false,
          evented: false,
          originX: 'center',
          originY: 'center',
          strokeUniform: true,
          strokeLineCap: 'round',
        });
        return bar;
      }

      case 'block': {
        const size = 10;
        const block = new Polygon([
          { x: -size/2, y: -size/2 },
          { x: size/2, y: -size/2 },
          { x: size/2, y: size/2 },
          { x: -size/2, y: size/2 },
        ], {
          fill: color,
          stroke: color,
          strokeWidth: 1,
          left: x,
          top: y,
          angle: angle,
          originX: 'center',
          originY: 'center',
          selectable: false,
          evented: false,
          strokeUniform: true,
        });
        return block;
      }

      case 'back-arrow': {
        const arrowSize = 10;
        const arrow = new Polygon([
          { x: 0, y: 0 },
          { x: arrowSize, y: -arrowSize / 2 },
          { x: arrowSize, y: arrowSize / 2 },
        ], {
          fill: color,
          stroke: color,
          strokeWidth: 0,
          left: x,
          top: y,
          angle: angle,
          selectable: false,
          evented: false,
          originX: 'center',
          originY: 'center',
          strokeUniform: true,
        });
        return arrow;
      }

      default:
        return new Circle({ radius: 0, selectable: false, evented: false });
    }
  }

  private getStrokeDashArray(): number[] | undefined {
    switch (this.options.lineStyle) {
      case 'dashed':
        return [10, 5];
      case 'dotted':
        return [2, 4];
      case 'solid':
      default:
        return undefined;
    }
  }

  private attachTransformSync(group: Group): void {
    const startMarker = (group as any).startMarker as FabricObject | null;
    const endMarker = (group as any).endMarker as FabricObject | null;
    const startMarkerType = (group as any).startMarkerType as MarkerType;
    const endMarkerType = (group as any).endMarkerType as MarkerType;
    
    if (!startMarker && !endMarker) return;

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

    const syncMarkers = () => {
      const localPoints = (group as any).orthogonalLineLocalPoints as FabricPoint[] | undefined;
      
      if (!localPoints || localPoints.length < 2) return;

      const scaleX = group.scaleX || 1;
      const scaleY = group.scaleY || 1;
      const groupAngle = group.angle || 0;

      if (startMarker && localPoints.length >= 2) {
        const localStart = localPoints[0];
        const localSecond = localPoints[1];
        const dx = localSecond.x - localStart.x;
        const dy = localSecond.y - localStart.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const localAngle = Math.atan2(dy, dx) * (180 / Math.PI);
        
        // Calculate offset in local space
        const offset = getMarkerOffset(startMarkerType);
        const offsetX = distance > 0 ? (dx / distance) * offset : 0;
        const offsetY = distance > 0 ? (dy / distance) * offset : 0;
        
        startMarker.set({
          left: localStart.x + offsetX,
          top: localStart.y + offsetY,
          angle: localAngle,
          scaleX: 1 / scaleX,
          scaleY: 1 / scaleY,
        });
      }

      if (endMarker && localPoints.length >= 2) {
        const localEnd = localPoints[localPoints.length - 1];
        const localSecondLast = localPoints[localPoints.length - 2];
        const dx = localEnd.x - localSecondLast.x;
        const dy = localEnd.y - localSecondLast.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const localAngle = Math.atan2(dy, dx) * (180 / Math.PI);
        
        // Calculate offset in local space
        const offset = getMarkerOffset(endMarkerType);
        const offsetX = distance > 0 ? (dx / distance) * offset : 0;
        const offsetY = distance > 0 ? (dy / distance) * offset : 0;
        
        endMarker.set({
          left: localEnd.x + offsetX,
          top: localEnd.y + offsetY,
          angle: localAngle,
          scaleX: 1 / scaleX,
          scaleY: 1 / scaleY,
        });
      }

      // Ensure line stroke stays consistent
      const objects = group.getObjects();
      const path = objects[0] as Path;
      if (path) {
        path.set({ strokeUniform: true });
      }

      group.setCoords();
      this.canvas.requestRenderAll();
    };

    group.on('scaling', syncMarkers);
    group.on('rotating', syncMarkers);
    group.on('moving', syncMarkers);
    group.on('modified', syncMarkers);

    syncMarkers();
  }

  finish(): Group | Path | null {
    this.isFinishing = true;
    
    if (!this.isDrawing || this.waypoints.length < 1) {
      this.cancel();
      this.isFinishing = false;
      return null;
    }

    // If only one waypoint, need current point
    if (this.waypoints.length === 1 && !this.currentPoint) {
      toast.error("Click at least one more point to create a line");
      this.isFinishing = false;
      return null;
    }

    // Clean up temporary objects
    this.cleanup();

    // Build final orthogonal path
    let allPoints: OrthogonalLinePoint[];

    if (this.isClosed) {
      // For closed loops, use waypoints and add first point at end to close the loop
      allPoints = [...this.waypoints, this.waypoints[0]];
    } else {
      // For open paths, only use the clicked waypoints, not the preview cursor position
      allPoints = this.waypoints;
    }

    if (allPoints.length < 2) {
      this.isFinishing = false;
      return null;
    }

    let orthogonalPoints: Array<{ x: number; y: number }>;

    // Use pathfinding if auto-pathfinding is enabled (works even without attachments)
    if (
      this.autoPathfindingEnabled &&
      allPoints.length === 2 // Only use pathfinding for simple start-to-end lines
    ) {
      // Collect object IDs to exclude from obstacle detection (if attached)
      const excludeObjectIds: string[] = [];
      if (this.tentativeStartAttachment?.objectId) {
        excludeObjectIds.push(this.tentativeStartAttachment.objectId);
      }
      if (this.tentativeEndAttachment?.objectId) {
        excludeObjectIds.push(this.tentativeEndAttachment.objectId);
      }

      const pathfindingResult = findOrthogonalPath(
        this.canvas,
        allPoints[0],
        allPoints[1],
        undefined, // excludeLineId
        excludeObjectIds
      );

      orthogonalPoints = pathfindingResult;
    } else {
      // Use default orthogonal routing
      orthogonalPoints = this.calculateOrthogonalPath(allPoints);
    }

    // Build final path data
    let pathData: string;
    if (this.options.smoothCorners && orthogonalPoints.length > 2) {
      pathData = smoothOrthogonalPath(orthogonalPoints, this.options.cornerRadius);
    } else {
      pathData = `M ${orthogonalPoints[0].x} ${orthogonalPoints[0].y}`;
      for (let i = 1; i < orthogonalPoints.length; i++) {
        pathData += ` L ${orthogonalPoints[i].x} ${orthogonalPoints[i].y}`;
      }
    }

    const finalPath = new Path(pathData, {
      stroke: this.options.strokeColor,
      strokeWidth: this.options.strokeWidth,
      fill: null,
      selectable: true,
      strokeDashArray: this.getStrokeDashArray(),
      strokeUniform: true,
    });

    const objects: FabricObject[] = [finalPath];

    // Add start marker
    if (this.options.startMarker !== 'none' && orthogonalPoints.length >= 2) {
      const angle = this.calculateAngle(
        orthogonalPoints[1],
        orthogonalPoints[0]
      );
      const marker = this.createMarker(
        this.options.startMarker,
        orthogonalPoints[0].x,
        orthogonalPoints[0].y,
        angle,
        false, // isTemp
        true   // isStartMarker
      );
      objects.push(marker);
    }

    // Add end marker
    if (this.options.endMarker !== 'none' && orthogonalPoints.length >= 2) {
      const lastIdx = orthogonalPoints.length - 1;
      const angle = this.calculateAngle(
        orthogonalPoints[lastIdx - 1],
        orthogonalPoints[lastIdx]
      );
      const marker = this.createMarker(
        this.options.endMarker,
        orthogonalPoints[lastIdx].x,
        orthogonalPoints[lastIdx].y,
        angle,
        false, // isTemp
        false  // isStartMarker
      );
      objects.push(marker);
    }

    // Create final object (group if has markers, path otherwise)
    let finalObject: Group | Path;
    if (objects.length > 1) {
      finalObject = new Group(objects, {
        selectable: true,
        subTargetCheck: false, // Prevent selecting individual marker elements
      });

      // Store custom properties
      (finalObject as any).id = uuidv4(); // Assign unique ID for connection tracking
      (finalObject as any).isOrthogonalLine = true;
      (finalObject as any).cornerStyle = 'sharp'; // Default corner style
      (finalObject as any).isClosed = this.isClosed;
      (finalObject as any).orthogonalLineWaypoints = this.waypoints;
      (finalObject as any).startMarker = objects.length >= 2 ? objects[1] : null;
      (finalObject as any).endMarker = objects.length >= 3 ? objects[objects.length - 1] : null;
      (finalObject as any).startMarkerType = this.options.startMarker;
      (finalObject as any).endMarkerType = this.options.endMarker;
      (finalObject as any).markerOptions = {
        startMarker: this.options.startMarker,
        endMarker: this.options.endMarker,
        lineStyle: this.options.lineStyle,
      };

      // Store connection attachments if any
      if (this.tentativeStartAttachment) {
        (finalObject as any).startAttachment = {
          objectId: this.tentativeStartAttachment.objectId,
          pointPosition: this.tentativeStartAttachment.position,
          pointId: this.tentativeStartAttachment.id,
        };
      }
      if (this.tentativeEndAttachment) {
        (finalObject as any).endAttachment = {
          objectId: this.tentativeEndAttachment.objectId,
          pointPosition: this.tentativeEndAttachment.position,
          pointId: this.tentativeEndAttachment.id,
        };
      }

      // Store pathfinding flag (works even without attachments)
      (finalObject as any).autoPathfindingEnabled = this.autoPathfindingEnabled;
      (finalObject as any).manualPathOverride = false; // Can be set to true in edit mode

      // Store local coordinates for transform sync
      const inv = util.invertTransform(finalObject.calcTransformMatrix());
      const localOrtho = orthogonalPoints.map(p => util.transformPoint(new FabricPoint(p.x, p.y), inv));
      (finalObject as any).orthogonalLineLocalPoints = localOrtho;

      // Store waypoints in local coordinates for edit mode
      const localWaypoints = this.waypoints.map(wp => util.transformPoint(new FabricPoint(wp.x, wp.y), inv));
      (finalObject as any).orthogonalLineLocalWaypoints = localWaypoints;
      
      // Sync marker transforms to keep them attached
      this.attachTransformSync(finalObject);
    } else {
      finalObject = finalPath;
      (finalObject as any).id = uuidv4(); // Assign unique ID for connection tracking
      (finalObject as any).isOrthogonalLine = true;
      (finalObject as any).cornerStyle = 'sharp'; // Default corner style
      (finalObject as any).isClosed = this.isClosed;
      (finalObject as any).orthogonalLineWaypoints = this.waypoints;
      (finalObject as any).markerOptions = {
        startMarker: this.options.startMarker,
        endMarker: this.options.endMarker,
        lineStyle: this.options.lineStyle,
      };

      // Store connection attachments if any
      if (this.tentativeStartAttachment) {
        (finalObject as any).startAttachment = {
          objectId: this.tentativeStartAttachment.objectId,
          pointPosition: this.tentativeStartAttachment.position,
          pointId: this.tentativeEndAttachment.id,
        };
      }
      if (this.tentativeEndAttachment) {
        (finalObject as any).endAttachment = {
          objectId: this.tentativeEndAttachment.objectId,
          pointPosition: this.tentativeEndAttachment.position,
          pointId: this.tentativeEndAttachment.id,
        };
      }

      // Store pathfinding flag (works even without attachments)
      (finalObject as any).autoPathfindingEnabled = this.autoPathfindingEnabled;
      (finalObject as any).manualPathOverride = false; // Can be set to true in edit mode

      // Store waypoints in local coordinates for edit mode
      const inv = util.invertTransform(finalObject.calcTransformMatrix());
      const localWaypoints = this.waypoints.map(wp => util.transformPoint(new FabricPoint(wp.x, wp.y), inv));
      (finalObject as any).orthogonalLineLocalWaypoints = localWaypoints;
    }

    this.canvas.add(finalObject);
    this.canvas.setActiveObject(finalObject);
    this.enableObjectInteraction();
    this.canvas.defaultCursor = 'default';
    this.canvas.requestRenderAll();

    // Apply intersection behavior if configured
    const intersectionConfig = (finalObject as any).intersectionConfig;
    if (intersectionConfig) {
      // Get the path object (either finalObject itself or first child if it's a group)
      const pathObject = finalObject instanceof Path ? finalObject : (finalObject as Group).getObjects()[0] as Path;
      if (pathObject instanceof Path) {
        const renderer = new LineIntersectionRenderer(pathObject, intersectionConfig);
        renderer.render();
        (finalObject as any).intersectionCount = renderer.getIntersectionCount();
        this.canvas.requestRenderAll();
      }
    }

    this.isDrawing = false;
    this.waypoints = [];
    this.currentPoint = null;

    return finalObject;
  }

  cancel(): void {
    if (this.isFinishing) return;

    // Unhighlight any highlighted connection points
    if (this.lastHighlightedPointId) {
      unhighlightConnectionPoint(this.canvas, this.lastHighlightedPointId);
      this.lastHighlightedPointId = undefined;
    }

    this.cleanup();
    this.enableObjectInteraction();
    this.canvas.defaultCursor = 'default';
    this.isDrawing = false;
    this.waypoints = [];
    this.currentPoint = null;
    this.tentativeStartAttachment = undefined;
    this.tentativeEndAttachment = undefined;
  }

  private cleanup(): void {
    // Remove temporary path
    if (this.tempPath) {
      this.canvas.remove(this.tempPath);
      this.tempPath = null;
    }

    // Remove handles
    this.handles.forEach(handle => this.canvas.remove(handle));
    this.handles = [];

    // Remove temporary markers
    this.tempMarkers.forEach(marker => this.canvas.remove(marker));
    this.tempMarkers = [];

    this.canvas.requestRenderAll();
  }

  getState() {
    return {
      isDrawing: this.isDrawing,
      waypointCount: this.waypoints.length,
    };
  }
}
