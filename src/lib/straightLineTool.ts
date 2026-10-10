import { Canvas, Path, Circle, Line, Group, util, Point as FabricPoint } from "fabric";
import { LineIntersectionRenderer } from "./lineIntersectionRenderer";
import { DEFAULT_INTERSECTION_CONFIG, ConnectionPoint } from "@/types/effects";
import { v4 as uuidv4 } from 'uuid';
import { snapToConnection } from "./connectionSnapping";
import { highlightConnectionPoint, unhighlightConnectionPoint } from "./connectionPoints";

export type MarkerType = 'none' | 'arrow' | 'back-arrow' | 'diamond' | 'circle' | 'dot' | 'bar' | 'block' | 'right-angle';
export type LineStyleType = 'solid' | 'dashed' | 'dotted';

export interface Point {
  x: number;
  y: number;
}

export interface StraightLineOptions {
  startMarker?: MarkerType;
  endMarker?: MarkerType;
  lineStyle?: LineStyleType;
  strokeWidth?: number;
  strokeColor?: string;
  snap?: boolean;
  gridSize?: number;
  gradientConfig?: any; // LineGradientConfig from effects.ts
}

export class StraightLineTool {
  private canvas: Canvas;
  private options: Required<StraightLineOptions>;
  private startPoint: Point | null = null;
  private previewPath: Path | null = null;
  private previewMarkers: Group[] = [];
  private controlPoint: Point | null = null;
  private saveState?: () => void;
  private smartConnectorsEnabled: boolean = false;
  private snapThreshold: number = 15;
  private tentativeStartAttachment?: ConnectionPoint;
  private tentativeEndAttachment?: ConnectionPoint;
  private lastHighlightedPointId?: string;

  constructor(canvas: Canvas, options: StraightLineOptions = {}, saveState?: () => void, smartConnectorsEnabled: boolean = false, snapThreshold: number = 15) {
    this.canvas = canvas;
    this.options = {
      startMarker: options.startMarker || 'none',
      endMarker: options.endMarker || 'none',
      lineStyle: options.lineStyle || 'solid',
      strokeWidth: options.strokeWidth || 2,
      strokeColor: options.strokeColor || '#000000',
      snap: options.snap !== undefined ? options.snap : true,
      gridSize: options.gridSize || 20,
      gradientConfig: options.gradientConfig || undefined,
    };
    this.saveState = saveState;
    this.smartConnectorsEnabled = smartConnectorsEnabled;
    this.snapThreshold = snapThreshold;
  }

  private disableObjectInteraction(): void {
    this.canvas.skipTargetFind = true;
    this.canvas.selection = false;
    this.canvas.forEachObject((obj) => {
      const objData = obj as any;
      if (!objData.isTemp && !objData.isControlHandle && !objData.isHandleLine && !objData.isGridLine && !objData.isRuler) {
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
      if (!objData.isTemp && !objData.isControlHandle && !objData.isHandleLine && !objData.isGridLine && !objData.isRuler) {
        obj.set({
          selectable: true,
          evented: true
        });
      }
    });
    this.canvas.requestRenderAll();
  }

  start(): void {
    this.startPoint = null;
    this.controlPoint = null;
    this.cleanup();
    this.disableObjectInteraction();
  }

  setStartPoint(x: number, y: number): void {
    const gridSnapped = this.snapToGrid({ x, y });

    // Try to snap to connection point first
    const connectionSnap = snapToConnection(
      this.canvas,
      gridSnapped.x,
      gridSnapped.y,
      this.snapThreshold,
      this.smartConnectorsEnabled
    );

    // Store tentative start attachment
    if (connectionSnap.connectionPoint) {
      this.tentativeStartAttachment = connectionSnap.connectionPoint;
    }

    const finalPoint = connectionSnap.connectionPoint
      ? { x: connectionSnap.x, y: connectionSnap.y }
      : gridSnapped;

    this.startPoint = finalPoint;

    // Show start marker preview
    if (this.options.startMarker !== 'none') {
      const marker = this.createMarkerPreview(finalPoint.x, finalPoint.y, 0);
      this.previewMarkers.push(marker);
      this.canvas.add(marker);
    }

    this.canvas.requestRenderAll();
  }

  updatePreview(x: number, y: number): void {
    if (!this.startPoint) return;

    const gridSnapped = this.snapToGrid({ x, y });

    // Try to snap to connection point
    const connectionSnap = snapToConnection(
      this.canvas,
      gridSnapped.x,
      gridSnapped.y,
      this.snapThreshold,
      this.smartConnectorsEnabled
    );

    // Highlight connection point if found
    if (connectionSnap.connectionPoint) {
      // Unhighlight previous point if different
      if (this.lastHighlightedPointId && this.lastHighlightedPointId !== connectionSnap.connectionPoint.id) {
        unhighlightConnectionPoint(this.canvas, this.lastHighlightedPointId);
      }
      highlightConnectionPoint(this.canvas, connectionSnap.connectionPoint.id);
      this.lastHighlightedPointId = connectionSnap.connectionPoint.id;
      this.tentativeEndAttachment = connectionSnap.connectionPoint;
    } else {
      // Unhighlight all if no connection point found
      if (this.lastHighlightedPointId) {
        unhighlightConnectionPoint(this.canvas, this.lastHighlightedPointId);
        this.lastHighlightedPointId = undefined;
      }
      this.tentativeEndAttachment = undefined;
    }

    const finalPoint = connectionSnap.connectionPoint
      ? { x: connectionSnap.x, y: connectionSnap.y }
      : gridSnapped;

    // Calculate auto-positioned control point (for edit mode compatibility)
    const control = this.calculateControlPoint(this.startPoint, finalPoint);

    // Create preview path (straight line)
    const pathData = `M ${this.startPoint.x} ${this.startPoint.y} L ${finalPoint.x} ${finalPoint.y}`;

    if (this.previewPath) {
      this.canvas.remove(this.previewPath);
    }

    this.previewPath = new Path(pathData, {
      stroke: '#0D9488',
      strokeWidth: this.options.strokeWidth,
      fill: '',
      selectable: false,
      evented: false,
      strokeDashArray: this.getStrokeDashArray(),
      excludeFromExport: true,
    });

    this.canvas.add(this.previewPath);

    // Remove old end marker preview
    if (this.previewMarkers.length > 1) {
      this.canvas.remove(this.previewMarkers[1]);
      this.previewMarkers.pop();
    }

    // Show end marker preview
    if (this.options.endMarker !== 'none') {
      const angle = this.calculateEndAngle(this.startPoint, control, finalPoint);
      const marker = this.createMarkerPreview(finalPoint.x, finalPoint.y, angle);
      this.previewMarkers.push(marker);
      this.canvas.add(marker);
    }

    this.canvas.requestRenderAll();
  }

  setEndPoint(x: number, y: number): Path | null {
    if (!this.startPoint) return null;

    const gridSnapped = this.snapToGrid({ x, y });

    // Try to snap to connection point
    const connectionSnap = snapToConnection(
      this.canvas,
      gridSnapped.x,
      gridSnapped.y,
      this.snapThreshold,
      this.smartConnectorsEnabled
    );

    // Store tentative end attachment
    if (connectionSnap.connectionPoint) {
      this.tentativeEndAttachment = connectionSnap.connectionPoint;
    }

    const finalPoint = connectionSnap.connectionPoint
      ? { x: connectionSnap.x, y: connectionSnap.y }
      : gridSnapped;

    this.controlPoint = this.calculateControlPoint(this.startPoint, finalPoint);

    return this.finish(finalPoint);
  }

  private finish(endPoint: Point): Path | null {
    if (!this.startPoint || !this.controlPoint) return null;

    this.cleanup();

    // Create the straight line path (now standalone, not in a Group)
    const pathData = `M ${this.startPoint.x} ${this.startPoint.y} L ${endPoint.x} ${endPoint.y}`;

    const curvePath = new Path(pathData, {
      stroke: this.options.strokeColor,
      strokeWidth: this.options.strokeWidth,
      fill: '',
      strokeDashArray: this.getStrokeDashArray(),
      selectable: true,
      hasControls: true,
    });

    // Store custom properties on the Path
    (curvePath as any).isStraightLine = true;
    (curvePath as any).id = uuidv4();
    (curvePath as any).isEditMode = false;
    (curvePath as any).straightLineStart = { x: this.startPoint.x, y: this.startPoint.y };
    (curvePath as any).straightLineEnd = { x: endPoint.x, y: endPoint.y };
    (curvePath as any).straightLineControlPoint = { x: this.controlPoint.x, y: this.controlPoint.y };
    (curvePath as any).startMarkerType = this.options.startMarker;
    (curvePath as any).endMarkerType = this.options.endMarker;
    (curvePath as any).markerOptions = {
      startMarker: this.options.startMarker,
      endMarker: this.options.endMarker,
      lineStyle: this.options.lineStyle,
    };
    (curvePath as any).straightLineVersion = 3; // Version 3 = Path-based architecture

    // Store connection attachments if any
    if (this.tentativeStartAttachment) {
      (curvePath as any).startAttachment = {
        objectId: this.tentativeStartAttachment.objectId,
        pointPosition: this.tentativeStartAttachment.position,
        pointId: this.tentativeStartAttachment.id,
      };
    }

    if (this.tentativeEndAttachment) {
      (curvePath as any).endAttachment = {
        objectId: this.tentativeEndAttachment.objectId,
        pointPosition: this.tentativeEndAttachment.position,
        pointId: this.tentativeEndAttachment.id,
      };
    }

    // Create start marker as separate object
    let startMarkerRef: Group | null = null;
    if (this.options.startMarker !== 'none') {
      const angle = this.calculateStartAngle(this.startPoint, this.controlPoint, endPoint);
      const marker = this.createMarker(this.startPoint.x, this.startPoint.y, angle, this.options.startMarker, true);
      if (marker) {
        startMarkerRef = marker;
        this.canvas.add(marker);
      }
    }

    // Create end marker as separate object
    let endMarkerRef: Group | null = null;
    if (this.options.endMarker !== 'none') {
      const angle = this.calculateEndAngle(this.startPoint, this.controlPoint, endPoint);
      const marker = this.createMarker(endPoint.x, endPoint.y, angle, this.options.endMarker, false);
      if (marker) {
        endMarkerRef = marker;
        this.canvas.add(marker);
      }
    }

    // Store marker references on the Path
    (curvePath as any).startMarker = startMarkerRef;
    (curvePath as any).endMarker = endMarkerRef;

    // Note: No control handle or guide lines for straight lines
    // These will be created in edit mode (only anchor handles)

    // Attach transform sync to keep markers in sync with path
    attachStraightLineTransformSync(this.canvas, curvePath);

    // Add path to canvas
    this.canvas.add(curvePath);
    this.canvas.setActiveObject(curvePath);
    this.enableObjectInteraction();

    // Force immediate re-render
    this.canvas.requestRenderAll();


    // Apply intersection behavior if configured
    const intersectionConfig = (curvePath as any).intersectionConfig;
    if (intersectionConfig) {
      if (curvePath instanceof Path) {
        const renderer = new LineIntersectionRenderer(curvePath, intersectionConfig);
        renderer.render();
        (curvePath as any).intersectionCount = renderer.getIntersectionCount();
        this.canvas.requestRenderAll();
      }
    }

    return curvePath;
  }

  cancel(): void {
    // Unhighlight any highlighted connection points
    if (this.lastHighlightedPointId) {
      unhighlightConnectionPoint(this.canvas, this.lastHighlightedPointId);
      this.lastHighlightedPointId = undefined;
    }

    this.cleanup();
    this.enableObjectInteraction();
    this.startPoint = null;
    this.controlPoint = null;
    this.tentativeStartAttachment = undefined;
    this.tentativeEndAttachment = undefined;
  }

  private cleanup(): void {
    if (this.previewPath) {
      this.canvas.remove(this.previewPath);
      this.previewPath = null;
    }
    
    this.previewMarkers.forEach(marker => this.canvas.remove(marker));
    this.previewMarkers = [];
    
    this.canvas.requestRenderAll();
  }

  private snapToGrid(point: Point): Point {
    if (!this.options.snap) return point;
    
    return {
      x: Math.round(point.x / this.options.gridSize) * this.options.gridSize,
      y: Math.round(point.y / this.options.gridSize) * this.options.gridSize,
    };
  }

  private calculateControlPoint(start: Point, end: Point): Point {
    // Calculate midpoint
    const midpoint = {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    };

    // Calculate perpendicular vector
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.sqrt(dx * dx + dy * dy);

    if (length === 0) return midpoint;

    const perpX = -dy / length;
    const perpY = dx / length;

    // Offset by 30% of line length
    const offset = length * 0.3;

    return {
      x: midpoint.x + perpX * offset,
      y: midpoint.y + perpY * offset,
    };
  }

  private calculateStartAngle(start: Point, control: Point, end: Point): number {
    // Straight line path is always an L command – use simple direction from end to start (outward).
    // The stored control point sits 30% off the midpoint perpendicularly and must not influence the angle.
    return Math.atan2(start.y - end.y, start.x - end.x) * (180 / Math.PI);
  }

  private calculateEndAngle(start: Point, control: Point, end: Point): number {
    // Straight line path is always an L command – use simple direction from start to end (outward).
    return Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI);
  }

  private createMarker(x: number, y: number, angle: number, type: MarkerType, isStartMarker: boolean = false): Group | null {
    if (type === 'none') return null;

    const size = 12;
    let marker: any;

    // Calculate offset for hollow markers to align edge with endpoint
    // Start marker angle points backward, end marker angle points forward
    // Both need positive offset in the direction of their respective angles
    const getHollowMarkerOffset = (markerSize: number): { x: number; y: number } => {
      const angleRad = angle * Math.PI / 180;
      const offsetDistance = markerSize; // Always positive
      return {
        x: Math.cos(angleRad) * offsetDistance,
        y: Math.sin(angleRad) * offsetDistance
      };
    };

    switch (type) {
      case 'arrow':
        marker = new Path(`M 0 0 L ${-size} ${-size/2} L ${-size} ${size/2} Z`, {
          fill: this.options.strokeColor,
          stroke: this.options.strokeColor,
          strokeWidth: 1,
        });
        break;
      
      case 'circle':
        marker = new Circle({
          radius: size / 2,
          fill: 'transparent',
          stroke: this.options.strokeColor,
          strokeWidth: this.options.strokeWidth,
        });
        break;
      
      case 'diamond':
        marker = new Path(`M 0 0 L ${-size/2} ${-size/2} L ${-size} 0 L ${-size/2} ${size/2} Z`, {
          fill: 'transparent',
          stroke: this.options.strokeColor,
          strokeWidth: this.options.strokeWidth,
        });
        break;
      
      case 'dot':
        marker = new Circle({
          radius: size / 3,
          fill: this.options.strokeColor,
          stroke: this.options.strokeColor,
          strokeWidth: 1,
        });
        break;
      
      case 'bar':
        marker = new Path(`M 0 ${-size/2} L 0 ${size/2}`, {
          fill: 'transparent',
          stroke: this.options.strokeColor,
          strokeWidth: 3,
          strokeLineCap: 'round',
        });
        break;
      
      case 'block':
        marker = new Path(`M ${-size/2} ${-size/2} L ${size/2} ${-size/2} L ${size/2} ${size/2} L ${-size/2} ${size/2} Z`, {
          fill: this.options.strokeColor,
          stroke: this.options.strokeColor,
          strokeWidth: 1,
        });
        break;
      
      case 'back-arrow':
        marker = new Path(`M 0 0 L ${size} ${-size/2} L ${size} ${size/2} Z`, {
          fill: this.options.strokeColor,
          stroke: this.options.strokeColor,
          strokeWidth: 1,
        });
        break;

      case 'right-angle':
        marker = new Path(`M ${-size} 0 M ${size} ${-size} L 0 0 L ${size} ${size}`, {
          fill: 'transparent',
          stroke: this.options.strokeColor,
          strokeWidth: Math.max(this.options.strokeWidth * 0.8, 1.5),
          strokeLineCap: 'round',
          strokeLineJoin: 'round',
        });
        break;

      default:
        return null;
    }

    // Apply offset for hollow markers (circle, diamond, bar)
    const isHollowMarker = type === 'circle' || type === 'diamond' || type === 'bar';
    let finalX = x;
    let finalY = y;

    if (isHollowMarker) {
      const offset = getHollowMarkerOffset(size / 2);
      finalX = x + offset.x;
      finalY = y + offset.y;
    }

    const group = new Group([marker], {
      left: finalX,
      top: finalY,
      originX: 'center',
      originY: 'center',
      angle: angle,
    });

    (group as any).isEndpointMarker = true;
    if (isHollowMarker) {
      (group as any)._hollowOffset = size / 2;
    }

    return group;
  }

  private createMarkerPreview(x: number, y: number, angle: number): Group {
    const marker = new Circle({
      radius: 6,
      fill: '#0D9488',
      stroke: '#ffffff',
      strokeWidth: 2,
    });

    return new Group([marker], {
      left: x,
      top: y,
      originX: 'center',
      originY: 'center',
      angle: angle,
      selectable: false,
      evented: false,
      excludeFromExport: true,
    });
  }

  private createControlHandle(x: number, y: number): Circle {
    const handle = new Circle({
      left: x,
      top: y,
      radius: 8,
      fill: '#10b981',
      stroke: '#ffffff',
      strokeWidth: 2,
      originX: 'center',
      originY: 'center',
      selectable: false, // Only selectable in edit mode
      evented: false, // Only evented in edit mode
      hasControls: false,
      hasBorders: false,
      hoverCursor: 'move',
    });

    (handle as any).isControlHandle = true;
    (handle as any).excludeFromExport = true; // Don't save in history
    return handle;
  }

  private createHandleLines(start: Point, control: Point, end: Point): [Line, Line] {
    const line1 = new Line([start.x, start.y, control.x, control.y], {
      stroke: '#10b981',
      strokeWidth: 1,
      strokeDashArray: [5, 3],
      selectable: false,
      evented: false,
    });

    const line2 = new Line([control.x, control.y, end.x, end.y], {
      stroke: '#10b981',
      strokeWidth: 1,
      strokeDashArray: [5, 3],
      selectable: false,
      evented: false,
    });

    (line1 as any).isHandleLine = true;
    (line1 as any).excludeFromExport = true; // Don't save in history
    (line2 as any).isHandleLine = true;
    (line2 as any).excludeFromExport = true; // Don't save in history

    return [line1, line2];
  }

  private setupControlHandleDrag(path: Path, handle: Circle, line1: Line, line2: Line): void {
    const canvas = this.canvas;
    const saveState = this.saveState;
    const calculateStartAngle = this.calculateStartAngle.bind(this);
    const calculateEndAngle = this.calculateEndAngle.bind(this);

    handle.on('moving', () => {
      const curveData = path as any;
      const start = { x: curveData.straightLineStart.x, y: curveData.straightLineStart.y };
      const end = { x: curveData.straightLineEnd.x, y: curveData.straightLineEnd.y };
      const newControl = { x: handle.left!, y: handle.top! };

      // Update stored control point
      curveData.straightLineControlPoint = newControl;

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

      // Update the path geometry directly
      const newPathData = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
      path.set({
        path: util.parsePath(newPathData),
        dirty: true,
      });

      // Update bounding box (automatic for Path objects)
      path.setCoords();

      // Sync markers to the path (they're separate objects now)
      if (curveData.startMarker) {
        const startAngle = calculateStartAngle(start, newControl, end);
        let leftPos = start.x;
        let topPos = start.y;
        const startOffset = (curveData.startMarker as any)._hollowOffset;
        if (startOffset) {
          const rad = startAngle * Math.PI / 180;
          leftPos += Math.cos(rad) * startOffset;
          topPos += Math.sin(rad) * startOffset;
        }
        curveData.startMarker.set({
          left: leftPos,
          top: topPos,
          angle: startAngle,
        });
        curveData.startMarker.setCoords();
      }

      if (curveData.endMarker) {
        const endAngle = calculateEndAngle(start, newControl, end);
        let leftPos = end.x;
        let topPos = end.y;
        const endOffset = (curveData.endMarker as any)._hollowOffset;
        if (endOffset) {
          const rad = endAngle * Math.PI / 180;
          leftPos += Math.cos(rad) * endOffset;
          topPos += Math.sin(rad) * endOffset;
        }
        curveData.endMarker.set({
          left: leftPos,
          top: topPos,
          angle: endAngle,
        });
        curveData.endMarker.setCoords();
      }

      canvas.requestRenderAll();
    });

    handle.on('modified', () => {
      if (saveState) saveState();
    });
  }

  private getStrokeDashArray(): number[] | undefined {
    switch (this.options.lineStyle) {
      case 'dashed':
        return [10, 5];
      case 'dotted':
        return [2, 4];
      default:
        return undefined;
    }
  }
}

/**
 * Helper: Detect if an object looks like an orphan control handle by visual appearance
 */
function looksLikeOrphanHandle(obj: any): boolean {
  // Green circle handle
  if (obj.type === 'circle' && 
      obj.radius >= 7 && obj.radius <= 9 &&
      (obj.fill === '#10b981' || obj.fill === 'rgb(16, 185, 129)') &&
      (obj.stroke === '#ffffff' || obj.stroke === 'rgb(255, 255, 255)')) {
    return true;
  }
  
  // Green dashed line
  if (obj.type === 'line' &&
      (obj.stroke === '#10b981' || obj.stroke === 'rgb(16, 185, 129)') &&
      obj.strokeDashArray && obj.strokeDashArray.length > 0) {
    return true;
  }
  
  return false;
}

/**
 * Cleanup all orphan handles and guide lines from canvas.
 * Removes objects with transient flags OR objects that visually match handle/guide appearance.
 */
export function cleanupOrphanHandlesStraight(canvas: Canvas): void {
  const toRemove: any[] = [];
  
  canvas.getObjects().forEach((obj) => {
    const objData = obj as any;
    
    // Remove by flag
    if (objData.isControlHandle || 
        objData.isHandleLine || 
        objData.isGuideLine ||
        objData.isPortIndicator ||
        objData.isFeedback) {
      toRemove.push(obj);
      return;
    }
    
    // Remove by visual appearance (for legacy data without flags)
    if (looksLikeOrphanHandle(objData)) {
      toRemove.push(obj);
    }
  });
  
  toRemove.forEach(obj => canvas.remove(obj));
  
  if (toRemove.length > 0) {
  }
}

/**
 * Derive control point coordinates from mainPath geometry and group transform.
 * This ensures accurate positioning even after the group has been moved/scaled.
 */
function deriveControlPointFromPath(group: Group, mainPath: Path): Point | null {
  try {
    const pathData = mainPath.path;
    if (!pathData || pathData.length < 2) return null;
    
    // Extract L command for straight line: ['L', ex, ey]
    let controlX = 0, controlY = 0;
    
    for (const command of pathData) {
      if (command[0] === 'Q' && command.length >= 5) {
        controlX = command[1] as number;
        controlY = command[2] as number;
        break;
      }
    }
    
    if (controlX === 0 && controlY === 0) return null;
    
    // Convert path-local coordinates to world coordinates
    const localPoint = new FabricPoint(controlX, controlY);
    const worldPoint = util.transformPoint(localPoint, group.calcTransformMatrix());
    
    return { x: worldPoint.x, y: worldPoint.y };
  } catch (error) {
    console.warn('Failed to derive control point from path:', error);
    return null;
  }
}

/**
 * Reconnect all straight lines on the canvas after loading from JSON.
 * This recreates control handles, guide lines, and event handlers using live path geometry.
 */
export function reconnectStraightLines(canvas: Canvas): void {
  canvas.getObjects().forEach((obj) => {
    const curveData = obj as any;

    // Only process straight lines
    if (!curveData.isStraightLine) return;

    // Skip if already has a control handle (shouldn't happen after cleanup)
    if (curveData.controlHandle && canvas.contains(curveData.controlHandle)) return;

    // Check if this is a Path-based straight line (version 3+) or legacy Group-based (version 2)
    const isPathBased = curveData.straightLineVersion >= 3 || obj.type === 'path';

    if (!isPathBased) {
      // Legacy Group-based straight line - handle separately or skip
      console.warn('Legacy Group-based straight line detected, skipping reconnect');
      return;
    }

    const path = obj as Path;

    // Get coordinates from stored data
    const controlPoint = curveData.straightLineControlPoint;
    const start = curveData.straightLineStart;
    const end = curveData.straightLineEnd;

    if (!controlPoint || !start || !end) {
      // Still attach transform sync so markers follow the line when moved.
      // attachStraightLineTransformSync reads endpoints from path geometry directly.
      attachStraightLineTransformSync(canvas, path);
      return;
    }

    // Initialize edit mode flag if not set
    if (curveData.isEditMode === undefined) {
      curveData.isEditMode = false;
    }
    
    // Create control handle
    const controlHandle = new Circle({
      left: controlPoint.x,
      top: controlPoint.y,
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

    // Create guide lines
    const line1 = new Line([start.x, start.y, controlPoint.x, controlPoint.y], {
      stroke: '#10b981',
      strokeWidth: 1,
      strokeDashArray: [5, 3],
      selectable: false,
      evented: false,
      visible: false,
    });
    (line1 as any).isHandleLine = true;
    (line1 as any).excludeFromExport = true;

    const line2 = new Line([controlPoint.x, controlPoint.y, end.x, end.y], {
      stroke: '#10b981',
      strokeWidth: 1,
      strokeDashArray: [5, 3],
      selectable: false,
      evented: false,
      visible: false,
    });
    (line2 as any).isHandleLine = true;
    (line2 as any).excludeFromExport = true;

    // Store references on the path
    curveData.controlHandle = controlHandle;
    curveData.handleLines = [line1, line2];

    // Add to canvas
    canvas.add(line1, line2, controlHandle);

    // Remove any old event handlers
    controlHandle.off('moving');

    // Re-attach event handler for dragging (simplified for Path)
    controlHandle.on('moving', () => {
      const start = { x: curveData.straightLineStart.x, y: curveData.straightLineStart.y };
      const end = { x: curveData.straightLineEnd.x, y: curveData.straightLineEnd.y };
      const newControl = { x: controlHandle.left!, y: controlHandle.top! };

      // Update stored control point
      curveData.straightLineControlPoint = newControl;

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

      // Update the path geometry
      const newPathData = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
      path.set({
        path: util.parsePath(newPathData),
        dirty: true,
      });
      path.setCoords();

      // Sync markers
      path.fire('modified');
      canvas.requestRenderAll();
    });

    // Re-attach transform sync
    attachStraightLineTransformSync(canvas, path);
  });

  canvas.requestRenderAll();
}

/**
 * Calculate start angle for straight line marker
 */
function calculateCurveStartAngle(start: Point, control: Point, end: Point): number {
  // Straight line path is always an L command – use simple direction from end to start (outward).
  return Math.atan2(start.y - end.y, start.x - end.x) * (180 / Math.PI);
}

/**
 * Calculate end angle for straight line marker
 */
function calculateCurveEndAngle(start: Point, control: Point, end: Point): number {
  // Straight line path is always an L command – use simple direction from start to end (outward).
  return Math.atan2(end.y - start.y, end.x - start.x) * (180 / Math.PI);
}

/**
 * Attach transform sync to keep markers, control handles, and guide lines synchronized
 * Now works with Path objects instead of Groups
 */
export function attachStraightLineTransformSync(canvas: Canvas, path: Path): void {
  const startMarker = (path as any).startMarker as Group | null;
  const endMarker = (path as any).endMarker as Group | null;
  const startMarkerType = (path as any).startMarkerType as string;
  const endMarkerType = (path as any).endMarkerType as string;
  const controlHandle = (path as any).controlHandle as Circle | null;
  const handleLines = (path as any).handleLines as [Line, Line] | null;

  const getMarkerOffset = (markerType: string): number => {
    switch (markerType) {
      case 'arrow': return -12;
      case 'back-arrow': return 12;
      case 'dot': return 4;
      case 'circle': return 6;
      case 'diamond': return 6;
      case 'block': return 6;
      case 'bar': return 0;
      default: return 0;
    }
  };

  const syncMarkers = () => {
    const pathData = path.path;
    if (!pathData || pathData.length < 2) {
      console.warn('[StraightLine:TransformSync] Invalid path data');
      return;
    }

    // CRITICAL: Skip coordinate extraction if connection sync is updating
    // Connection sync sets precise coordinates and we don't want to overwrite them
    // with extracted values that have rounding errors
    const shouldSkipCoordUpdate = (path as any)._skipTransformSync === true;

    let start: { x: number; y: number };
    let end: { x: number; y: number };

    if (shouldSkipCoordUpdate) {
      // Use stored coordinates directly (already set by connection sync)
      start = (path as any).straightLineStart || { x: 0, y: 0 };
      end = (path as any).straightLineEnd || { x: 0, y: 0 };
    } else {
      // CRITICAL FIX: Extract current world coordinates from path geometry + transform
      // This ensures stored coordinates stay in sync after path is moved/transformed by user
      let localStart: { x: number; y: number } | null = null;
      let localEnd: { x: number; y: number } | null = null;

      // Extract from M command
      if (pathData[0][0] === 'M' && pathData[0].length >= 3) {
        localStart = { x: pathData[0][1] as number, y: pathData[0][2] as number };
      }

      // Extract from L command
      for (const command of pathData) {
        if (command[0] === 'L' && command.length >= 3) {
          localEnd = { x: command[1] as number, y: command[2] as number };
          break;
        }
      }

      if (!localStart || !localEnd) {
        console.warn('[StraightLine:TransformSync] Could not extract path points');
        return;
      }

      // Get pathOffset - this is the offset Fabric.js uses to center the path at its origin
      const pathOffset = path.pathOffset || { x: 0, y: 0 };

      // Convert path-local to object-local by subtracting pathOffset
      const objectLocalStart = {
        x: localStart.x - pathOffset.x,
        y: localStart.y - pathOffset.y
      };
      const objectLocalEnd = {
        x: localEnd.x - pathOffset.x,
        y: localEnd.y - pathOffset.y
      };

      // Transform object-local coordinates to world coordinates
      const matrix = path.calcTransformMatrix();
      const worldStartPoint = util.transformPoint(new FabricPoint(objectLocalStart.x, objectLocalStart.y), matrix);
      const worldEndPoint = util.transformPoint(new FabricPoint(objectLocalEnd.x, objectLocalEnd.y), matrix);

      start = { x: worldStartPoint.x, y: worldStartPoint.y };
      end = { x: worldEndPoint.x, y: worldEndPoint.y };

      // Update stored coordinates (only when user moves/transforms the path)
      (path as any).straightLineStart = start;
      (path as any).straightLineEnd = end;
    }

    // Calculate control point (for marker angle calculations)
    const control = (path as any).straightLineControlPoint || {
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2
    };

    // Since markers are separate objects now, update their positions to match path endpoints
    // Read fresh references each time - they may have been replaced when user changes marker type
    const currentStartMarker = (path as any).startMarker as Group | null;
    const currentEndMarker = (path as any).endMarker as Group | null;

    if (currentStartMarker) {
      const startAngle = calculateCurveStartAngle(start, control, end);
      let leftPos = start.x;
      let topPos = start.y;
      const startOffset = (currentStartMarker as any)._hollowOffset;
      if (startOffset) {
        const rad = startAngle * Math.PI / 180;
        leftPos += Math.cos(rad) * startOffset;
        topPos += Math.sin(rad) * startOffset;
      }
      currentStartMarker.set({
        left: leftPos,
        top: topPos,
        angle: startAngle,
      });
      currentStartMarker.setCoords();
    }

    if (currentEndMarker) {
      const endAngle = calculateCurveEndAngle(start, control, end);
      let leftPos = end.x;
      let topPos = end.y;
      const endOffset = (currentEndMarker as any)._hollowOffset;
      if (endOffset) {
        const rad = endAngle * Math.PI / 180;
        leftPos += Math.cos(rad) * endOffset;
        topPos += Math.sin(rad) * endOffset;
      }
      currentEndMarker.set({
        left: leftPos,
        top: topPos,
        angle: endAngle,
      });
      currentEndMarker.setCoords();
    }

    // Synchronize control handle position (for edit mode)
    if (controlHandle) {
      controlHandle.set({
        left: control.x,
        top: control.y,
      });
      controlHandle.setCoords();
    }

    // Synchronize guide lines (for edit mode)
    if (handleLines && handleLines.length === 2) {
      handleLines[0].set({
        x1: start.x,
        y1: start.y,
        x2: control.x,
        y2: control.y,
      });

      handleLines[1].set({
        x1: control.x,
        y1: control.y,
        x2: end.x,
        y2: end.y,
      });

      handleLines[0].setCoords();
      handleLines[1].setCoords();
    }

    path.setCoords();
    canvas.requestRenderAll();
  };

  // Sync on all transform events
  path.on('scaling', syncMarkers);
  path.on('rotating', syncMarkers);
  path.on('moving', syncMarkers);
  path.on('modified', syncMarkers);

  // Initialize
  syncMarkers();
}
