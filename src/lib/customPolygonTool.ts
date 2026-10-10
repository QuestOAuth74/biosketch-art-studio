import { Canvas as FabricCanvas, Circle, Path, Polygon, Point } from "fabric";
import { toast } from "sonner";

interface CustomPolygonPoint {
  x: number;
  y: number;
}

interface CustomPolygonToolOptions {
  snap?: boolean;
  gridSize?: number;
  minVertices?: number;
}

export class CustomPolygonTool {
  private canvas: FabricCanvas;
  private vertices: CustomPolygonPoint[] = [];
  private tempPath: Path | null = null;
  private handles: Circle[] = [];
  private isDrawing: boolean = false;
  private options: CustomPolygonToolOptions;
  private cursorX: number = 0;
  private cursorY: number = 0;

  constructor(canvas: FabricCanvas, options?: CustomPolygonToolOptions) {
    this.canvas = canvas;
    this.options = {
      snap: options?.snap ?? false,
      gridSize: options?.gridSize ?? 10,
      minVertices: options?.minVertices ?? 3,
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

  private snapToGrid(x: number, y: number): CustomPolygonPoint {
    if (!this.options.snap) return { x, y };
    const gridSize = this.options.gridSize!;
    return {
      x: Math.round(x / gridSize) * gridSize,
      y: Math.round(y / gridSize) * gridSize,
    };
  }

  // Start drawing mode
  start(): void {
    this.isDrawing = true;
    this.vertices = [];
    this.clearTemporaryObjects();
    this.disableObjectInteraction();
  }

  // Add vertex on click
  addVertex(x: number, y: number): void {
    if (!this.isDrawing) return;

    const snapped = this.snapToGrid(x, y);

    // Prevent duplicate vertices (too close to previous)
    if (this.vertices.length > 0) {
      const lastVertex = this.vertices[this.vertices.length - 1];
      const distance = Math.sqrt(
        (snapped.x - lastVertex.x) ** 2 + (snapped.y - lastVertex.y) ** 2
      );
      if (distance < 5) {
        toast.info("Vertex too close to previous vertex");
        return;
      }
    }

    this.vertices.push(snapped);
    this.addVertexHandle(snapped.x, snapped.y, this.vertices.length === 1);
    this.updatePreview(this.cursorX, this.cursorY);

    if (this.vertices.length === 2) {
      toast.info("Continue adding vertices or click first vertex to close");
    }
  }

  // Check if cursor is close enough to first vertex to close
  isCloseableDistance(x: number, y: number): boolean {
    if (this.vertices.length < this.options.minVertices!) return false;

    const firstVertex = this.vertices[0];
    const distance = Math.sqrt(
      (x - firstVertex.x) ** 2 + (y - firstVertex.y) ** 2
    );
    return distance < 15; // Clickable radius
  }

  // Update preview line from last vertex to cursor
  updatePreview(x: number, y: number): void {
    this.cursorX = x;
    this.cursorY = y;

    // Remove old preview path
    if (this.tempPath) {
      this.canvas.remove(this.tempPath);
      this.tempPath = null;
    }

    if (this.vertices.length === 0) return;

    // Build path data
    let pathData = `M ${this.vertices[0].x} ${this.vertices[0].y}`;
    for (let i = 1; i < this.vertices.length; i++) {
      pathData += ` L ${this.vertices[i].x} ${this.vertices[i].y}`;
    }
    // Add preview line to cursor
    pathData += ` L ${x} ${y}`;

    // Create temp path
    this.tempPath = new Path(pathData, {
      stroke: "#14b8a6", // Teal
      strokeWidth: 2,
      strokeDashArray: [5, 5],
      fill: "",
      selectable: false,
      evented: false,
    });
    (this.tempPath as any).isTemp = true;
    this.canvas.add(this.tempPath);
    this.canvas.requestRenderAll();

    // Update first vertex highlight if closeable
    if (this.handles.length > 0) {
      const isCloseable = this.isCloseableDistance(x, y);
      this.updateFirstVertexHighlight(isCloseable);
    }
  }

  // Add vertex handle (circle)
  private addVertexHandle(x: number, y: number, isFirst: boolean): void {
    const handle = new Circle({
      left: x,
      top: y,
      radius: isFirst ? 6 : 5,
      fill: isFirst ? "#F59E0B" : "#0D9488", // Gold for first, Teal for others
      stroke: "#ffffff",
      strokeWidth: 2,
      originX: "center",
      originY: "center",
      selectable: false,
      evented: false,
    });
    (handle as any).isTemp = true;
    this.handles.push(handle);
    this.canvas.add(handle);
    this.canvas.requestRenderAll();
  }

  // Update first vertex highlighting
  private updateFirstVertexHighlight(isCloseable: boolean): void {
    if (this.handles.length === 0) return;

    const firstHandle = this.handles[0];
    firstHandle.set({
      radius: isCloseable ? 7 : 6,
      fill: isCloseable ? "#FBBF24" : "#F59E0B", // Brighter when hovering
    });
    this.canvas.requestRenderAll();
  }

  // Close polygon and create final shape
  closePolygon(): Polygon | null {
    if (this.vertices.length < this.options.minVertices!) {
      toast.error(`Need at least ${this.options.minVertices} vertices to close polygon`);
      return null;
    }

    // Create final polygon
    const points = this.vertices.map((v) => new Point(v.x, v.y));
    const polygon = new Polygon(points, {
      fill: "rgba(134, 239, 172, 0.5)", // Default light green
      stroke: "#9ca3af", // Default light grey
      strokeWidth: 2,
      strokeUniform: true,
      selectable: true,
      evented: true,
    });

    // Cleanup
    this.clearTemporaryObjects();
    this.enableObjectInteraction();
    this.isDrawing = false;

    return polygon;
  }

  // Undo last vertex
  undoLastVertex(): void {
    if (this.vertices.length === 0) {
      toast.info("No vertices to undo");
      return;
    }

    this.vertices.pop();
    const lastHandle = this.handles.pop();
    if (lastHandle) {
      this.canvas.remove(lastHandle);
    }

    this.updatePreview(this.cursorX, this.cursorY);
    toast.success("Vertex removed");
  }

  // Cancel drawing
  cancel(): void {
    if (!this.isDrawing) return;

    this.clearTemporaryObjects();
    this.enableObjectInteraction();
    this.isDrawing = false;
    this.vertices = [];
    toast.info("Polygon drawing cancelled");
  }

  // Clear all temporary objects
  private clearTemporaryObjects(): void {
    // Remove handles
    this.handles.forEach((handle) => this.canvas.remove(handle));
    this.handles = [];

    // Remove temp path
    if (this.tempPath) {
      this.canvas.remove(this.tempPath);
      this.tempPath = null;
    }

    this.canvas.requestRenderAll();
  }

  // Get current state
  getState(): { isDrawing: boolean; vertexCount: number } {
    return {
      isDrawing: this.isDrawing,
      vertexCount: this.vertices.length,
    };
  }
}
