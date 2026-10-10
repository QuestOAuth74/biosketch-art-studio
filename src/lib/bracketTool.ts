import { Canvas as FabricCanvas, Textbox, Text, Path, Rect, Group, FabricObject, Point as FabricPoint, util } from "fabric";
import { toast } from "sonner";

export type BracketOrientation = 'left' | 'right' | 'top' | 'bottom';

export interface BracketToolOptions {
  strokeWidth?: number;
  strokeColor?: string;
  textColor?: string;
  fontSize?: number;
  fontFamily?: string;
  bracketSize?: number;
  bracketGap?: number;
}

interface Point {
  x: number;
  y: number;
}

export class BracketTool {
  private canvas: FabricCanvas;
  private clickCount: number = 0;
  private labelPosition: Point | null = null;
  private bracketPosition: Point | null = null;
  private tempLabel: Text | null = null;
  private tempLine: Path | null = null;
  private tempBracket: Path | null = null;
  private options: Required<BracketToolOptions>;
  private onComplete?: () => void;
  private onBracketCreated?: () => void;

  constructor(canvas: FabricCanvas, options?: BracketToolOptions, onComplete?: () => void, onBracketCreated?: () => void) {
    this.canvas = canvas;
    this.onComplete = onComplete;
    this.onBracketCreated = onBracketCreated;
    this.options = {
      strokeWidth: options?.strokeWidth || 1.5,
      strokeColor: options?.strokeColor || "#000000",
      textColor: options?.textColor || "#000000",
      fontSize: options?.fontSize || 14,
      fontFamily:
        options?.fontFamily ||
        "Inter, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      bracketSize: options?.bracketSize || 60,
      bracketGap: options?.bracketGap || 15,
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
    if (this.tempBracket) {
      this.canvas.remove(this.tempBracket);
      this.tempBracket = null;
    }
  }

  start(): void {
    this.clickCount = 0;
    this.labelPosition = null;
    this.bracketPosition = null;
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
      toast.info("Click to place bracket");
      // Setup mouse move for preview
      this.canvas.on("mouse:move", this.handleMouseMove.bind(this));
    } else if (this.clickCount === 1) {
      // Second click: create bracket
      this.bracketPosition = { x: pointer.x, y: pointer.y };
      try {
        this.createBracket();
        this.finish();
      } catch (error) {
        console.error('[Bracket Tool] Error creating bracket:', error);
        toast.error('Failed to create bracket: ' + error);
      }
    }
  }

  private handleMouseMove(e: any): void {
    if (this.clickCount !== 1 || !this.labelPosition || !this.tempLabel) return;

    const pointer = this.canvas.getPointer(e.e);

    // Update preview line and bracket
    if (this.tempLine) {
      this.canvas.remove(this.tempLine);
    }
    if (this.tempBracket) {
      this.canvas.remove(this.tempBracket);
    }

    const labelBounds = this.tempLabel.getBoundingRect();
    const labelCenter = {
      x: labelBounds.left + labelBounds.width / 2,
      y: labelBounds.top + labelBounds.height / 2,
    };

    // Calculate orientation
    const orientation = this.calculateOrientation(labelCenter, pointer);

    // Find closest edge point of label for line connection
    const labelEdgePoint = this.getClosestEdgePoint(labelBounds, pointer.x, pointer.y);

    // Create preview line from label edge to bracket
    const pathData = `M ${labelEdgePoint.x} ${labelEdgePoint.y} L ${pointer.x} ${pointer.y}`;
    this.tempLine = new Path(pathData, {
      stroke: this.options.strokeColor,
      strokeWidth: this.options.strokeWidth,
      fill: "",
      selectable: false,
      evented: false,
      strokeDashArray: [5, 5],
    });
    (this.tempLine as any).isTemp = true;

    // Create preview bracket
    const bracketPath = this.createBracketPath(
      pointer,
      this.options.bracketSize,
      orientation
    );
    this.tempBracket = new Path(bracketPath, {
      stroke: this.options.strokeColor,
      strokeWidth: this.options.strokeWidth,
      fill: "",
      selectable: false,
      evented: false,
      strokeDashArray: [5, 5],
      strokeUniform: true,
    });
    (this.tempBracket as any).isTemp = true;

    this.canvas.add(this.tempLine);
    this.canvas.add(this.tempBracket);
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

  private calculateOrientation(
    labelPos: Point,
    bracketPos: Point
  ): BracketOrientation {
    const dx = bracketPos.x - labelPos.x;
    const dy = bracketPos.y - labelPos.y;

    // Determine if horizontal or vertical based on which difference is larger
    if (Math.abs(dx) > Math.abs(dy)) {
      // Horizontal
      return dx > 0 ? 'right' : 'left';
    } else {
      // Vertical
      return dy > 0 ? 'bottom' : 'top';
    }
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

  private createBracketPath(
    center: Point,
    size: number,
    orientation: BracketOrientation
  ): string {
    const gap = this.options.bracketGap;
    const halfSize = size / 2;

    switch (orientation) {
      case 'right':
        // Opening to the right: [
        return `M ${center.x} ${center.y - halfSize}
                L ${center.x - gap} ${center.y - halfSize}
                L ${center.x - gap} ${center.y + halfSize}
                L ${center.x} ${center.y + halfSize}`;

      case 'left':
        // Opening to the left: ]
        return `M ${center.x} ${center.y - halfSize}
                L ${center.x + gap} ${center.y - halfSize}
                L ${center.x + gap} ${center.y + halfSize}
                L ${center.x} ${center.y + halfSize}`;

      case 'bottom':
        // Opening downward
        return `M ${center.x - halfSize} ${center.y}
                L ${center.x - halfSize} ${center.y - gap}
                L ${center.x + halfSize} ${center.y - gap}
                L ${center.x + halfSize} ${center.y}`;

      case 'top':
        // Opening upward
        return `M ${center.x - halfSize} ${center.y}
                L ${center.x - halfSize} ${center.y + gap}
                L ${center.x + halfSize} ${center.y + gap}
                L ${center.x + halfSize} ${center.y}`;
    }
  }

  private createBracket(): void {
    if (!this.labelPosition || !this.bracketPosition || !this.tempLabel) return;

    // Get label dimensions
    const labelBounds = this.tempLabel.getBoundingRect();
    const labelCenter = {
      x: labelBounds.left + labelBounds.width / 2,
      y: labelBounds.top + labelBounds.height / 2,
    };

    // Calculate orientation
    const orientation = this.calculateOrientation(labelCenter, this.bracketPosition);

    // Find closest edge point of label to connect the line
    const labelEdgePoint = this.getClosestEdgePoint(
      {
        left: this.labelPosition.x,
        top: this.labelPosition.y,
        width: labelBounds.width,
        height: labelBounds.height
      },
      this.bracketPosition.x,
      this.bracketPosition.y
    );

    // Find the bounding box of all elements
    const halfBracket = this.options.bracketSize / 2;
    const gap = this.options.bracketGap;

    // Calculate bracket bounds based on orientation
    let bracketMinX = this.bracketPosition.x;
    let bracketMaxX = this.bracketPosition.x;
    let bracketMinY = this.bracketPosition.y;
    let bracketMaxY = this.bracketPosition.y;

    if (orientation === 'right') {
      bracketMinX = this.bracketPosition.x - gap;
      bracketMinY = this.bracketPosition.y - halfBracket;
      bracketMaxY = this.bracketPosition.y + halfBracket;
    } else if (orientation === 'left') {
      bracketMaxX = this.bracketPosition.x + gap;
      bracketMinY = this.bracketPosition.y - halfBracket;
      bracketMaxY = this.bracketPosition.y + halfBracket;
    } else if (orientation === 'bottom') {
      bracketMinX = this.bracketPosition.x - halfBracket;
      bracketMaxX = this.bracketPosition.x + halfBracket;
      bracketMinY = this.bracketPosition.y - gap;
    } else { // top
      bracketMinX = this.bracketPosition.x - halfBracket;
      bracketMaxX = this.bracketPosition.x + halfBracket;
      bracketMaxY = this.bracketPosition.y + gap;
    }

    const minX = Math.min(this.labelPosition.x, labelEdgePoint.x, this.bracketPosition.x, bracketMinX);
    const minY = Math.min(this.labelPosition.y, labelEdgePoint.y, this.bracketPosition.y, bracketMinY);

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

    // Calculate positions in local coordinates relative to group origin
    const localLabelEdge = {
      x: labelEdgePoint.x - minX,
      y: labelEdgePoint.y - minY,
    };

    const localBracketCenter = {
      x: this.bracketPosition.x - minX,
      y: this.bracketPosition.y - minY,
    };

    // Calculate bracket connection point (edge of bracket shape, not center)
    let bracketConnectionPoint = { ...localBracketCenter };
    if (orientation === 'right') {
      // Bracket opens right [, solid bar on left
      bracketConnectionPoint.x = localBracketCenter.x - gap;
    } else if (orientation === 'left') {
      // Bracket opens left ], solid bar on right
      bracketConnectionPoint.x = localBracketCenter.x + gap;
    } else if (orientation === 'bottom') {
      // Bracket opens down, solid bar on top
      bracketConnectionPoint.y = localBracketCenter.y - gap;
    } else { // top
      // Bracket opens up, solid bar on bottom
      bracketConnectionPoint.y = localBracketCenter.y + gap;
    }

    // Create connecting line from label edge to bracket edge
    const linePathData = `M ${localLabelEdge.x} ${localLabelEdge.y} L ${bracketConnectionPoint.x} ${bracketConnectionPoint.y}`;
    const linePath = new Path(linePathData, {
      stroke: this.options.strokeColor,
      strokeWidth: this.options.strokeWidth,
      fill: "",
      strokeUniform: true,
      selectable: false,
      evented: false,
    });

    // Create bracket with center at bracket position
    const bracketPathData = this.createBracketPath(
      localBracketCenter,
      this.options.bracketSize,
      orientation
    );
    const bracketPath = new Path(bracketPathData, {
      stroke: this.options.strokeColor,
      strokeWidth: this.options.strokeWidth,
      fill: "",
      strokeUniform: true,
      selectable: false,
      evented: false,
    });

    // Create group at the minimum point (labelBg, then label for z-index)
    // Use very large fixed dimensions to prevent any clipping
    const group = new Group([bracketPath, linePath, labelBg, label], {
      left: minX,
      top: minY,
      subTargetCheck: true,
      width: 2000,
      height: 2000,
    });

    // Disable clipping completely
    (group as any).clipPath = undefined;

    // Add custom properties
    (group as any).customType = "bracket-label";
    (group as any).bracketOrientation = orientation;
    (group as any).bracketLocalCenter = localBracketCenter;
    (group as any).bracketConnectionPoint = bracketConnectionPoint;
    (group as any).labelLocalEdge = localLabelEdge;
    (group as any).bracketSize = this.options.bracketSize;
    (group as any).bracketGap = this.options.bracketGap;
    (group as any).labelOffsetX = 0;
    (group as any).labelOffsetY = 0;

    // Add to canvas
    this.canvas.add(group);
    this.canvas.setActiveObject(group);

    // Attach transform sync
    attachBracketTransformSync(group, this.options.bracketSize, this.options.bracketGap);

    // Attach background resize on text change
    attachBracketLabelBackgroundSync(group);

    toast.success("Bracket created!");

    // Call the onBracketCreated callback before finishing
    if (this.onBracketCreated) {
      this.onBracketCreated();
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
    this.bracketPosition = null;
  }

  cancel(): void {
    this.removeTempObjects();
    this.enableObjectInteraction();
    this.canvas.defaultCursor = "default";
    this.canvas.off("mouse:down");
    this.canvas.off("mouse:move");
    this.clickCount = 0;
    this.labelPosition = null;
    this.bracketPosition = null;
    toast.info("Bracket tool cancelled");
  }
}

/**
 * Attaches transform sync to a bracket group to keep all elements aligned during transforms
 */
export function attachBracketTransformSync(group: Group, bracketSize: number, bracketGap: number): void {
  const updateBracket = () => {
    const localLabelEdge = (group as any).labelLocalEdge as Point;
    const localBracketCenter = (group as any).bracketLocalCenter as Point;
    const orientation = (group as any).bracketOrientation as BracketOrientation;
    const gap = (group as any).bracketGap || bracketGap;
    const size = (group as any).bracketSize || bracketSize;

    if (!localLabelEdge || !localBracketCenter || !orientation) return;

    // Calculate bracket connection point (edge of bracket shape)
    let bracketConnectionPoint = { ...localBracketCenter };
    if (orientation === 'right') {
      bracketConnectionPoint.x = localBracketCenter.x - gap;
    } else if (orientation === 'left') {
      bracketConnectionPoint.x = localBracketCenter.x + gap;
    } else if (orientation === 'bottom') {
      bracketConnectionPoint.y = localBracketCenter.y - gap;
    } else { // top
      bracketConnectionPoint.y = localBracketCenter.y + gap;
    }

    // Update bracket path (first element in group)
    const bracketPath = group.getObjects()[0] as Path;
    if (bracketPath) {
      const halfSize = size / 2;
      const center = localBracketCenter;

      let bracketPathData: string;
      switch (orientation) {
        case 'right':
          bracketPathData = `M ${center.x} ${center.y - halfSize}
                            L ${center.x - gap} ${center.y - halfSize}
                            L ${center.x - gap} ${center.y + halfSize}
                            L ${center.x} ${center.y + halfSize}`;
          break;
        case 'left':
          bracketPathData = `M ${center.x} ${center.y - halfSize}
                            L ${center.x + gap} ${center.y - halfSize}
                            L ${center.x + gap} ${center.y + halfSize}
                            L ${center.x} ${center.y + halfSize}`;
          break;
        case 'bottom':
          bracketPathData = `M ${center.x - halfSize} ${center.y}
                            L ${center.x - halfSize} ${center.y - gap}
                            L ${center.x + halfSize} ${center.y - gap}
                            L ${center.x + halfSize} ${center.y}`;
          break;
        case 'top':
          bracketPathData = `M ${center.x - halfSize} ${center.y}
                            L ${center.x - halfSize} ${center.y + gap}
                            L ${center.x + halfSize} ${center.y + gap}
                            L ${center.x + halfSize} ${center.y}`;
          break;
      }

      bracketPath.set({ path: util.makePathSimpler(util.parsePath(bracketPathData) as any) });
    }

    // Update connecting line (second element in group)
    const linePath = group.getObjects()[1] as Path;
    if (linePath) {
      const linePathData = `M ${localLabelEdge.x} ${localLabelEdge.y} L ${bracketConnectionPoint.x} ${bracketConnectionPoint.y}`;
      linePath.set({ path: util.makePathSimpler(util.parsePath(linePathData) as any) });
    }

    // Don't recalculate group dimensions - keep the large fixed size to prevent clipping
    group.dirty = true;
    group.setCoords();
  };

  // Attach event listeners
  // Note: Don't listen to "moving" - objects should move with the group automatically
  group.on("scaling", updateBracket);
  group.on("rotating", updateBracket);
  group.on("modified", updateBracket);
}

/**
 * Attaches listener to update background rect when label text changes
 */
export function attachBracketLabelBackgroundSync(group: Group): void {
  const updateBackground = () => {
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
  const label = group.getObjects()[3] as Textbox;
  if (label) {
    label.on('changed', updateBackground);
    label.on('editing:exited', updateBackground);
  }
}

/**
 * Type guard to check if an object is a bracket
 */
export function isBracket(obj: FabricObject | null | undefined): obj is Group {
  return obj instanceof Group && (obj as any).customType === "bracket-label";
}
