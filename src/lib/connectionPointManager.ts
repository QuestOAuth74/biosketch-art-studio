import { Canvas, Circle } from "fabric";
import { ConnectionPoint } from "@/types/effects";
import {
  calculateConnectionPoints,
  renderConnectionPoints as renderConnectionPointsUtil,
  hideAllConnectionPoints as hideAllConnectionPointsUtil,
  updateConnectionPointsForObject,
  findNearestConnectionPoint as findNearestConnectionPointUtil,
  highlightConnectionPoint as highlightConnectionPointUtil,
  unhighlightConnectionPoint,
} from "./connectionPoints";

/**
 * Centralized manager for connection point visibility and rendering
 * Follows the AlignmentGuides pattern for managing visual overlays
 */
export class ConnectionPointManager {
  private canvas: Canvas;
  private isActive: boolean = false;
  private renderedCircles: Circle[] = [];
  private referencePoint: { x: number; y: number } | null = null;

  constructor(canvas: Canvas) {
    this.canvas = canvas;
  }

  /**
   * Set a reference point for distance-based filtering
   * When set, only the 100 closest connection points will be shown
   */
  setReferencePoint(x: number | null, y: number | null): void {
    if (x === null || y === null) {
      this.referencePoint = null;
    } else {
      this.referencePoint = { x, y };
    }
  }

  /**
   * Show connection points for all eligible objects
   */
  show(): void {
    if (this.isActive) return;

    this.isActive = true;
    // Clear reference point when showing all points initially
    this.referencePoint = null;
    this.refresh();
  }

  /**
   * Hide all connection points
   */
  hide(): void {
    if (!this.isActive) return;

    this.isActive = false;
    this.referencePoint = null;
    hideAllConnectionPointsUtil(this.canvas);
    this.renderedCircles = [];
  }

  /**
   * Refresh connection points (update positions)
   * Call this when objects move or canvas changes
   * @param referencePoint Optional point to calculate distances from (for limiting to closest 100)
   */
  refresh(referencePoint?: { x: number; y: number }): void {
    if (!this.isActive) return;

    // Use provided reference point, or stored reference point, or null
    const refPoint = referencePoint || this.referencePoint;

    // Clear existing connection points
    hideAllConnectionPointsUtil(this.canvas);
    this.renderedCircles = [];

    // Get attachments from selected line (if in edit mode)
    const attachedPoints = this.getAttachedConnectionPoints();

    // Collect all connection points with their distances (if reference point provided)
    interface ConnectionPointWithDistance {
      obj: any;
      point: ConnectionPoint;
      distance: number;
    }
    const allPoints: ConnectionPointWithDistance[] = [];

    // Calculate all connection points
    this.canvas.forEachObject((obj) => {
      const objData = obj as any;

      // Skip temporary objects, connection point circles, lines, and grid/ruler elements
      if (this.shouldExcludeObject(objData)) {
        return;
      }

      const points = calculateConnectionPoints(obj);
      points.forEach(point => {
        let distance = 0;
        if (refPoint) {
          const dx = point.x - refPoint.x;
          const dy = point.y - refPoint.y;
          distance = Math.sqrt(dx * dx + dy * dy);
        }
        allPoints.push({ obj, point, distance });
      });
    });

    // Sort by distance and limit to 100 closest if reference point provided
    let pointsToRender = allPoints;
    if (refPoint) {
      pointsToRender = allPoints
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 100);
    }

    // Group points by object to avoid rendering same object multiple times
    const objectsToRender = new Map<any, Set<string>>();
    pointsToRender.forEach(({ obj, point }) => {
      if (!objectsToRender.has(obj)) {
        objectsToRender.set(obj, new Set());
      }
      objectsToRender.get(obj)!.add(point.id);
    });

    // Render connection points only for selected points
    objectsToRender.forEach((pointIds, obj) => {
      const circles = renderConnectionPointsUtil(this.canvas, obj);

      // Keep only the circles for selected points
      circles.forEach(circle => {
        const circleData = (circle as any).connectionPointData as ConnectionPoint;
        if (circleData && pointIds.has(circleData.id)) {
          // Highlight attached connection points in green
          if (this.isPointAttached(circleData, attachedPoints)) {
            circle.set({ fill: '#10b981' }); // Green for attached points
          }
          this.renderedCircles.push(circle);
        } else {
          // Remove circles that don't match the selected points
          this.canvas.remove(circle);
        }
      });
    });

    // Bring all anchor handles to front so they're above connection points
    this.bringAnchorHandlesToFront();

    this.canvas.requestRenderAll();
  }

  /**
   * Bring all anchor handles to front so they render above connection points
   */
  private bringAnchorHandlesToFront(): void {
    this.canvas.forEachObject((obj) => {
      const objData = obj as any;
      if (objData.isAnchorHandle) {
        this.canvas.bringObjectToFront(obj);
      }
    });
  }

  /**
   * Get connection points that are currently attached to the selected line
   */
  private getAttachedConnectionPoints(): ConnectionPoint[] {
    const activeObject = this.canvas.getActiveObject();
    if (!activeObject) return [];

    const lineData = activeObject as any;
    const attachedPoints: ConnectionPoint[] = [];

    // Check if this is a line with attachments
    if (lineData.startAttachment) {
      const obj = this.findObjectById(lineData.startAttachment.objectId);
      if (obj) {
        const points = calculateConnectionPoints(obj);
        const attachedPoint = points.find(p => p.id === lineData.startAttachment.pointId);
        if (attachedPoint) {
          attachedPoints.push(attachedPoint);
        }
      }
    }

    if (lineData.endAttachment) {
      const obj = this.findObjectById(lineData.endAttachment.objectId);
      if (obj) {
        const points = calculateConnectionPoints(obj);
        const attachedPoint = points.find(p => p.id === lineData.endAttachment.pointId);
        if (attachedPoint) {
          attachedPoints.push(attachedPoint);
        }
      }
    }

    return attachedPoints;
  }

  /**
   * Check if a connection point is in the list of attached points
   */
  private isPointAttached(point: ConnectionPoint, attachedPoints: ConnectionPoint[]): boolean {
    return attachedPoints.some(ap => ap.id === point.id);
  }

  /**
   * Find an object by its ID
   */
  private findObjectById(id: string): any {
    let foundObject: any = null;
    this.canvas.forEachObject((obj) => {
      const objData = obj as any;
      if (objData.id === id) {
        foundObject = obj;
      }
    });
    return foundObject;
  }

  /**
   * Determine if an object should be excluded from connection points
   */
  private shouldExcludeObject(obj: any): boolean {
    const excluded = (
      obj.isTemp ||
      obj.isConnectionPoint ||
      obj.isControlHandle ||
      obj.isAnchorHandle ||
      obj.isHandleLine ||
      obj.isGridLine ||
      obj.isRuler ||
      obj.isEndpointMarker ||
      obj.type === 'line' ||
      obj.type === 'path' ||
      obj.isFreeformLine ||
      obj.isConnector ||
      obj.isCurvedLine ||
      obj.isOrthogonalLine ||
      obj.isStraightLine ||
      obj.isBezierPath
    );

    if (!excluded && (obj.type === 'circle' || obj.type === 'polygon' || obj.type === 'group')) {
      // Log objects that pass the filter so we can diagnose unexpected objects
      console.debug('[ConnectionPointManager] Rendering connection points for:', {
        type: obj.type,
        isEndpointMarker: obj.isEndpointMarker,
        lineId: obj.lineId,
        id: obj.id,
        selectable: obj.selectable,
        evented: obj.evented,
      });
    }

    return excluded;
  }

  /**
   * Find the nearest connection point to a given position
   */
  findNearestPoint(x: number, y: number, threshold: number = 15): { point: ConnectionPoint; distance: number } | null {
    if (!this.isActive) return null;
    return findNearestConnectionPointUtil(this.canvas, x, y, threshold);
  }

  /**
   * Highlight a connection point (make it green/larger)
   */
  highlightPoint(pointId: string): void {
    if (!this.isActive) return;
    highlightConnectionPointUtil(this.canvas, pointId);
  }

  /**
   * Unhighlight all connection points (return to normal blue appearance)
   */
  unhighlightAll(): void {
    if (!this.isActive) return;

    // Unhighlight all rendered circles
    this.canvas.forEachObject((obj) => {
      if ((obj as any).isConnectionPoint) {
        const pointData = (obj as any).connectionPointData as ConnectionPoint;
        if (pointData) {
          unhighlightConnectionPoint(this.canvas, pointData.id);
        }
      }
    });
  }

  /**
   * Check if manager is currently active
   */
  get active(): boolean {
    return this.isActive;
  }

  /**
   * Update connection points for a specific object
   * Useful when a single object moves
   */
  updateForObject(obj: any): void {
    if (!this.isActive) return;
    updateConnectionPointsForObject(this.canvas, obj);
  }
}
