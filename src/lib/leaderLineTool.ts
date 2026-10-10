import { Canvas as FabricCanvas, Textbox, Text, Path, Polygon, Rect, Group, FabricObject, Point as FabricPoint, util } from "fabric";
import { toast } from "sonner";

export interface LeaderLineOptions {
  strokeWidth?: number;
  strokeColor?: string;
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
}

interface Point {
  x: number;
  y: number;
}

export class LeaderLineTool {
  private canvas: FabricCanvas;
  private clickCount: number = 0;
  private labelPosition: Point | null = null;
  private tempLabel: Text | null = null;
  private tempLine: Path | null = null;
  private options: Required<LeaderLineOptions>;
  private onComplete?: () => void;
  private onLineCreated?: () => void;

  constructor(canvas: FabricCanvas, options?: LeaderLineOptions, onComplete?: () => void, onLineCreated?: () => void) {
    this.canvas = canvas;
    this.onComplete = onComplete;
    this.onLineCreated = onLineCreated;
    this.options = {
      strokeWidth: options?.strokeWidth || 1.5,
      strokeColor: options?.strokeColor || "#000000",
      textColor: options?.textColor || "#000000",
      fontSize: options?.fontSize || 14,
      fontFamily:
        options?.fontFamily ||
        "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
    };
  }

  private disableObjectInteraction(): void {
    this.canvas.skipTargetFind = true;
    this.canvas.selection = false;
    this.canvas.forEachObject((obj) => {
      const objData = obj as any;
      if (!objData.isTemp && !objData.isGridLine && !objData.isRuler) {
        obj.set({
          selectable: false,
          evented: false,
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
          evented: true,
        });
      }
    });
    this.canvas.requestRenderAll();
  }

  private removeTempObjects(): void {
    if (this.tempLabel) {
      this.canvas.remove(this.tempLabel);
      this.tempLabel = null;
    }
    if (this.tempLine) {
      this.canvas.remove(this.tempLine);
      this.tempLine = null;
    }
  }

  start(): void {
    this.clickCount = 0;
    this.labelPosition = null;
    this.removeTempObjects();
    this.disableObjectInteraction();
    this.canvas.defaultCursor = "crosshair";
    toast.info("Click to place label");

    // Setup mouse handlers
    this.canvas.on("mouse:down", this.handleMouseDown.bind(this));
  }

  private handleMouseDown(e: any): void {
    const pointer = this.canvas.getPointer(e.e);

    if (this.clickCount === 0) {
      // First click: place label
      this.labelPosition = { x: pointer.x, y: pointer.y };
      this.createTempLabel(pointer.x, pointer.y);
      this.clickCount++;
      toast.info("Click to place arrow destination");

      // Setup mouse move for preview
      this.canvas.on("mouse:move", this.handleMouseMove.bind(this));
    } else if (this.clickCount === 1) {
      // Second click: create leader line
      this.createLeaderLine(pointer.x, pointer.y);
      this.finish();
    }
  }

  private handleMouseMove(e: any): void {
    if (this.clickCount !== 1 || !this.labelPosition || !this.tempLabel) return;

    const pointer = this.canvas.getPointer(e.e);
    // Update preview line
    if (this.tempLine) {
      this.canvas.remove(this.tempLine);
    }

    const labelBounds = this.tempLabel.getBoundingRect();
    const closestPoint = this.getClosestEdgePoint(
      labelBounds,
      pointer.x,
      pointer.y
    );
    const pathData = `M ${closestPoint.x} ${closestPoint.y} L ${pointer.x} ${pointer.y}`;
    this.tempLine = new Path(pathData, {
      stroke: this.options.strokeColor,
      strokeWidth: this.options.strokeWidth,
      fill: "",
      selectable: false,
      evented: false,
      strokeDashArray: [5, 5],
    });
    (this.tempLine as any).isTemp = true;

    this.canvas.add(this.tempLine);
    this.canvas.requestRenderAll();
  }

  private createTempLabel(x: number, y: number): void {
    this.tempLabel = new Text("Label", {
      left: x,
      top: y,
      fontSize: this.options.fontSize,
      fontFamily: this.options.fontFamily,
      fill: this.options.textColor,
      backgroundColor: "#ffffff",
      padding: 8,
      selectable: false,
      evented: false,
    });
    (this.tempLabel as any).isTemp = true;

    this.canvas.add(this.tempLabel);
    this.canvas.requestRenderAll();
  }

  private getClosestEdgePoint(
    bounds: { left: number; top: number; width: number; height: number },
    targetX: number,
    targetY: number
  ): Point {
    // Calculate center of each edge
    const edges = [
      { x: bounds.left + bounds.width / 2, y: bounds.top }, // top
      { x: bounds.left + bounds.width, y: bounds.top + bounds.height / 2 }, // right
      { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height }, // bottom
      { x: bounds.left, y: bounds.top + bounds.height / 2 }, // left
    ];

    // Find closest edge point
    let closestPoint = edges[0];
    let minDist = this.distance(edges[0], { x: targetX, y: targetY });

    for (const edge of edges) {
      const dist = this.distance(edge, { x: targetX, y: targetY });
      if (dist < minDist) {
        minDist = dist;
        closestPoint = edge;
      }
    }

    return closestPoint;
  }

  private distance(p1: Point, p2: Point): number {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  }

  private createArrowHead(x: number, y: number, angle: number): Polygon {
    const arrowSize = 10;
    const points = [
      { x: 0, y: 0 },
      { x: -arrowSize, y: -arrowSize / 2 },
      { x: -arrowSize, y: arrowSize / 2 },
    ];

    return new Polygon(points, {
      left: x,
      top: y,
      fill: this.options.strokeColor,
      stroke: this.options.strokeColor,
      strokeWidth: 0,
      angle: angle,
      selectable: false,
      evented: false,
      originX: "center",
      originY: "center",
    });
  }

  private createLeaderLine(destX: number, destY: number): void {
    if (!this.labelPosition || !this.tempLabel) return;

    // Get label dimensions from temp label
    const tempBounds = this.tempLabel.getBoundingRect();
    const labelWidth = tempBounds.width;
    const labelHeight = tempBounds.height;

    // Calculate all positions in world coordinates first
    const labelBounds = {
      left: this.labelPosition.x,
      top: this.labelPosition.y,
      width: labelWidth,
      height: labelHeight
    };

    const closestPoint = this.getClosestEdgePoint(labelBounds, destX, destY);

    // Find the bounding box of all elements to determine group origin offset
    const minX = Math.min(this.labelPosition.x, closestPoint.x, destX);
    const minY = Math.min(this.labelPosition.y, closestPoint.y, destY);

    // Create label with offset from group origin (no background - we'll add a Rect)
    const label = new Textbox("Label", {
      fontSize: this.options.fontSize,
      fontFamily: this.options.fontFamily,
      fill: this.options.textColor,
      left: this.labelPosition.x - minX,
      top: this.labelPosition.y - minY,
      selectable: true,
      evented: true,
      editable: true,
      width: 300,
      splitByGrapheme: true,
    });

    // Create background rect that auto-sizes to text
    const padding = 8;
    const textWidth = label.calcTextWidth();
    const textHeight = label.calcTextHeight();

    const labelBg = new Rect({
      left: label.left! - padding,
      top: label.top! - padding,
      width: textWidth + padding * 2,
      height: textHeight + padding * 2,
      fill: "#ffffff",
      selectable: false,
      evented: false,
    });

    // Create line path with offset from group origin
    const localLineStartX = closestPoint.x - minX;
    const localLineStartY = closestPoint.y - minY;
    const localLineEndX = destX - minX;
    const localLineEndY = destY - minY;

    const pathData = `M ${localLineStartX} ${localLineStartY} L ${localLineEndX} ${localLineEndY}`;
    const linePath = new Path(pathData, {
      stroke: this.options.strokeColor,
      strokeWidth: this.options.strokeWidth,
      fill: "",
      strokeUniform: true,
      selectable: false,
      evented: false,
    });

    // Create arrow marker at destination
    const angle =
      (Math.atan2(
        localLineEndY - localLineStartY,
        localLineEndX - localLineStartX
      ) *
        180) /
      Math.PI;

    const arrow = this.createArrowHead(localLineEndX, localLineEndY, angle);

    // Group elements: path, arrow, labelBg, label (in z-order)
    const groupElements: FabricObject[] = [linePath, arrow, labelBg, label];

    // Create group at the minimum point
    const group = new Group(groupElements, {
      left: minX,
      top: minY,
      subTargetCheck: true,
    });

    // Add custom properties - store local coordinates and label styling
    (group as any).customType = "leader-line";
    (group as any).leaderLocalStart = { x: localLineStartX, y: localLineStartY };
    (group as any).leaderLocalEnd = { x: localLineEndX, y: localLineEndY };
    (group as any).labelOffsetX = 0;
    (group as any).labelOffsetY = 0;

    // Add to canvas
    this.canvas.add(group);
    this.canvas.setActiveObject(group);

    // Attach transform sync
    attachLeaderLineTransformSync(group);

    // Attach background resize on text change
    attachLabelBackgroundSync(group);

    toast.success("Leader line created!");

    // Call the onLineCreated callback before finishing
    if (this.onLineCreated) {
      this.onLineCreated();
    }

    // Clean up and switch back to select mode
    this.finish();
    if (this.onComplete) {
      this.onComplete();
    }
  }

  finish(): void {
    this.removeTempObjects();
    this.enableObjectInteraction();
    this.canvas.defaultCursor = "default";
    this.canvas.off("mouse:down");
    this.canvas.off("mouse:move");
    this.clickCount = 0;
    this.labelPosition = null;
  }

  cancel(): void {
    this.removeTempObjects();
    this.enableObjectInteraction();
    this.canvas.defaultCursor = "default";
    this.canvas.off("mouse:down");
    this.canvas.off("mouse:move");
    this.clickCount = 0;
    this.labelPosition = null;
    toast.info("Leader line cancelled");
  }
}

/**
 * Attaches transform sync to a leader line group to keep line connected during transforms
 */
export function attachLeaderLineTransformSync(group: Group): void {
  const updateLeaderLine = (eventType: string) => {
    const localStart = (group as any).leaderLocalStart as Point;
    const localEnd = (group as any).leaderLocalEnd as Point;
    if (!localStart || !localEnd) {
      return;
    }

    // Get transform matrix
    const matrix = group.calcTransformMatrix();
    // Transform local points to world coordinates
    const startWorld = util.transformPoint(new FabricPoint(localStart.x, localStart.y), matrix);
    const endWorld = util.transformPoint(new FabricPoint(localEnd.x, localEnd.y), matrix);
    // Update stored world coordinates
    (group as any).leaderLineStart = { x: startWorld.x, y: startWorld.y };
    (group as any).leaderLineEnd = { x: endWorld.x, y: endWorld.y };

    // Update line path (first element in group)
    const linePath = group.getObjects()[0] as Path;
    if (linePath) {
      const pathData = `M ${localStart.x} ${localStart.y} L ${localEnd.x} ${localEnd.y}`;
      linePath.set({ path: util.makePathSimpler(util.parsePath(pathData) as any) });
    }

    // Update arrow marker (second element in group)
    const arrow = group.getObjects()[1];
    if (arrow) {
      const angle =
        (Math.atan2(localEnd.y - localStart.y, localEnd.x - localStart.x) *
          180) /
        Math.PI;
      // Only update angle, NOT position - let it move with the group
      arrow.set({ angle: angle });
      arrow.setCoords();
    } else {
    }

    group.dirty = true;
    group.setCoords();
  };

  // Attach event listeners
  // NOTE: Don't listen to "moving" - the arrow maintains its local position and moves with the group automatically
  group.on("scaling", () => updateLeaderLine("scaling"));
  group.on("rotating", () => updateLeaderLine("rotating"));
  group.on("modified", () => updateLeaderLine("modified"));
}

/**
 * Attaches listener to update background rect when label text changes
 */
export function attachLabelBackgroundSync(group: Group): void {
  const updateBackground = () => {
    // Fixed indices: path(0), arrow(1), labelBg(2), label(3)
    const labelBg = group.getObjects()[2] as Rect; // Background rect
    const label = group.getObjects()[3] as Textbox; // Label text

    if (!labelBg || !label) return;

    const padding = 8;
    const textWidth = label.calcTextWidth();
    const textHeight = label.calcTextHeight();

    labelBg.set({
      left: label.left! - padding,
      top: label.top! - padding,
      width: textWidth + padding * 2,
      height: textHeight + padding * 2,
    });

    group.dirty = true;
    group.setCoords();
  };

  // Listen to text changes
  // Fixed index: label is always at position 3
  const label = group.getObjects()[3] as Textbox;
  if (label) {
    label.on('changed', updateBackground);
    label.on('editing:exited', updateBackground);
  }
}

/**
 * Type guard to check if an object is a leader line
 */
export function isLeaderLine(obj: FabricObject | null | undefined): obj is Group {
  return obj instanceof Group && (obj as any).customType === "leader-line";
}

/**
 * Re-attach transform-sync and label-background-sync event handlers to every
 * leader line on the canvas. Called after Undo/Redo because Fabric event
 * handlers do not survive a `loadFromJSON` / enliven round trip.
 *
 * Safe to call repeatedly: `attachLeaderLineTransformSync` is idempotent in
 * effect — even if older handlers remain (which they won't after a recreate),
 * the new ones would just produce duplicate work, not incorrect output.
 */
export function reconnectLeaderLines(canvas: { getObjects: () => FabricObject[] }): void {
  for (const obj of canvas.getObjects()) {
    if (!isLeaderLine(obj)) continue;
    const group = obj as Group;
    attachLeaderLineTransformSync(group);
    attachLabelBackgroundSync(group);
  }
}
