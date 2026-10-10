import { Canvas, Path, Group, FabricObject, util, Point as FabricPoint, FabricImage } from "fabric";
import { BezierEditMode } from "./bezierEditMode";
import { BezierPoint } from "@/types/bezier";
import { DNAHelixTool, DNAHelixOptions } from "./dnaHelixTool";

export class DNAHelixEditMode {
  private canvas: Canvas;
  private helix: FabricImage | Group | null = null;
  private pathEditMode: BezierEditMode | null = null;
  private virtualPath: Path | null = null;
  private pathChangeHandler: ((e: any) => void) | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_DELAY = 200;
  private saveState?: () => void;
  private activationTime: number = 0;

  constructor(canvas: Canvas, _config?: any, saveState?: () => void) {
    this.canvas = canvas;
    this.saveState = saveState;
  }

  async activate(helix: Group | FabricImage): Promise<void> {
    this.activationTime = Date.now();
    this.helix = helix as any;
    (this.helix as any).isEditMode = true;

    this.canvas.setActiveObject(this.helix);
    this.canvas.requestRenderAll();

    this.enterPathEdit();
  }

  async deactivate(): Promise<Group | FabricImage | null> {
    if (!this.helix) return null;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    await this.exitPathEdit();

    (this.helix as any).isEditMode = false;
    this.helix.set({ opacity: 1, selectable: true, evented: true });
    this.canvas.requestRenderAll();

    const finalHelix = this.helix;
    this.helix = null;
    return finalHelix;
  }

  isActive(): boolean {
    return this.helix !== null;
  }

  // ---- Path editing ----

  private enterPathEdit(): void {
    if (!this.helix) return;

    const storedWorldBezierPoints = (this.helix as any).worldBezierPoints as BezierPoint[];
    const isClosed = (this.helix as any).isClosed;
    if (!storedWorldBezierPoints || storedWorldBezierPoints.length < 2) return;

    const groupMatrix = this.buildTransformMatrix();
    const currentWorldBezierPoints = this.transformPointsToWorld(storedWorldBezierPoints, groupMatrix);

    this.virtualPath = this.createVirtualPath(currentWorldBezierPoints, isClosed);
    this.canvas.add(this.virtualPath);
    this.canvas.bringObjectToFront(this.virtualPath);

    this.helix.set({ visible: true, opacity: 0.3, selectable: false, evented: false });
    this.canvas.sendObjectToBack(this.helix);

    if (!this.pathEditMode) {
      this.pathEditMode = new BezierEditMode(this.canvas, undefined, this.saveState);
    }
    this.pathEditMode.activate(this.virtualPath);

    this.pathChangeHandler = (e: any) => {
      const target = e.target;
      if (target && (target.isAnchorHandle || target.isControlHandle)) {
        if (this.debounceTimer) clearTimeout(this.debounceTimer);
        this.debounceTimer = setTimeout(async () => {
          await this.handlePathChange();
          this.debounceTimer = null;
        }, this.DEBOUNCE_DELAY);
      }
    };
    this.canvas.on('object:modified', this.pathChangeHandler);

    this.canvas.sendObjectBackwards(this.virtualPath);
    this.canvas.requestRenderAll();
  }

  private async exitPathEdit(): Promise<void> {
    if (this.pathEditMode) {
      this.pathEditMode.deactivate(true);
    }

    if (this.helix && this.virtualPath) {
      const worldBezierPoints = this.extractWorldBezierPoints();
      await this.regenerateFromPoints(worldBezierPoints, false);
    }

    if (this.pathChangeHandler) {
      this.canvas.off('object:modified', this.pathChangeHandler);
      this.pathChangeHandler = null;
    }

    if (this.virtualPath) {
      this.canvas.remove(this.virtualPath);
      this.virtualPath = null;
    }

    if (this.helix) {
      this.helix.set({ visible: true, opacity: 1, selectable: true, evented: true });
      this.canvas.requestRenderAll();
    }
  }

  private async handlePathChange(): Promise<void> {
    if (!this.helix || !this.virtualPath) return;

    const worldBezierPoints = this.extractWorldBezierPoints();
    await this.regenerateFromPoints(worldBezierPoints, true);
  }

  private async regenerateFromPoints(worldBezierPoints: BezierPoint[], ghosted: boolean): Promise<void> {
    if (!this.helix) return;

    const options: DNAHelixOptions = (this.helix as any).dnaHelixOptions;
    const isClosed = (this.helix as any).isClosed;
    const id = (this.helix as any).id;

    const tool = new DNAHelixTool(this.canvas as any, options);
    const helixPaths = tool.generateHelix(worldBezierPoints, isClosed);
    if (helixPaths.length === 0) return;

    const newGroup = new Group(helixPaths, {
      selectable: true,
      evented: true,
      subTargetCheck: false,
      interactive: false,
      objectCaching: false,
    });

    // Store bezier points in relative space
    const invGroupMatrix = util.invertTransform(newGroup.calcTransformMatrix());
    const relativeWorldBezierPoints = worldBezierPoints.map((point: any) => {
      const rel = util.transformPoint({ x: point.x, y: point.y }, invGroupMatrix);
      const p: any = { x: rel.x, y: rel.y, type: point.type, id: point.id };
      if (point.controlPoint1) {
        const cp = util.transformPoint({ x: point.controlPoint1.x, y: point.controlPoint1.y }, invGroupMatrix);
        p.controlPoint1 = { x: cp.x, y: cp.y };
      }
      if (point.controlPoint2) {
        const cp = util.transformPoint({ x: point.controlPoint2.x, y: point.controlPoint2.y }, invGroupMatrix);
        p.controlPoint2 = { x: cp.x, y: cp.y };
      }
      return p;
    });

    (newGroup as any).isDNAHelix = true;
    (newGroup as any).dnaHelixOptions = options;
    (newGroup as any).worldBezierPoints = relativeWorldBezierPoints;
    (newGroup as any).bezierPoints = relativeWorldBezierPoints;
    (newGroup as any).isClosed = isClosed;
    (newGroup as any).id = id;

    const origToObj = newGroup.toObject.bind(newGroup);
    (newGroup as any).toObject = function (propertiesToInclude?: string[]) {
      return origToObj([
        ...(propertiesToInclude || []),
        'isDNAHelix', 'dnaHelixOptions', 'bezierPoints',
        'worldBezierPoints', 'isClosed', 'id',
      ]);
    };

    // Rasterize
    const newRasterized = await DNAHelixTool.rasterizeHelix(newGroup);

    // Replace on canvas
    this.canvas.remove(this.helix);
    this.canvas.add(newRasterized);
    this.canvas.sendObjectToBack(newRasterized);

    if (ghosted) {
      newRasterized.set({ opacity: 0.3, selectable: false, evented: false });
    }

    this.helix = newRasterized as any;
    this.canvas.requestRenderAll();
  }

  // ---- Helpers ----

  private buildTransformMatrix(): number[] {
    if (!this.helix) return [1, 0, 0, 1, 0, 0];

    if ((this.helix as any).isRasterizedHelix) {
      const originalScaleX = (this.helix as any).originalScaleX || 1;
      const originalScaleY = (this.helix as any).originalScaleY || 1;
      const angle = this.helix.angle || 0;
      const bounds = this.helix.getBoundingRect();
      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;
      const cos = Math.cos(angle * Math.PI / 180);
      const sin = Math.sin(angle * Math.PI / 180);
      return [cos * originalScaleX, sin * originalScaleX, -sin * originalScaleY, cos * originalScaleY, centerX, centerY];
    }

    return this.helix.calcTransformMatrix();
  }

  private transformPointsToWorld(points: BezierPoint[], matrix: number[]): BezierPoint[] {
    return points.map(point => {
      const transformed = util.transformPoint(new FabricPoint(point.x, point.y), matrix);
      const p: BezierPoint = { x: transformed.x, y: transformed.y, type: point.type, id: point.id };
      if (point.controlPoint1) {
        const cp = util.transformPoint(new FabricPoint(point.controlPoint1.x, point.controlPoint1.y), matrix);
        p.controlPoint1 = { x: cp.x, y: cp.y };
      }
      if (point.controlPoint2) {
        const cp = util.transformPoint(new FabricPoint(point.controlPoint2.x, point.controlPoint2.y), matrix);
        p.controlPoint2 = { x: cp.x, y: cp.y };
      }
      return p;
    });
  }

  private extractWorldBezierPoints(): BezierPoint[] {
    if (!this.virtualPath) return [];
    const localBezierPoints = (this.virtualPath as any).bezierPoints as BezierPoint[];
    const pathMatrix = this.virtualPath.calcTransformMatrix();
    return localBezierPoints.map(point => {
      const world = util.transformPoint(new FabricPoint(point.x, point.y), pathMatrix);
      const p: BezierPoint = { x: world.x, y: world.y, type: point.type, id: point.id };
      if (point.controlPoint1) {
        const cp = util.transformPoint(new FabricPoint(point.controlPoint1.x, point.controlPoint1.y), pathMatrix);
        p.controlPoint1 = { x: cp.x, y: cp.y };
      }
      if (point.controlPoint2) {
        const cp = util.transformPoint(new FabricPoint(point.controlPoint2.x, point.controlPoint2.y), pathMatrix);
        p.controlPoint2 = { x: cp.x, y: cp.y };
      }
      return p;
    });
  }

  private createVirtualPath(bezierPoints: BezierPoint[], isClosed: boolean): Path {
    let pathData = `M ${bezierPoints[0].x} ${bezierPoints[0].y}`;

    for (let i = 0; i < bezierPoints.length - 1; i++) {
      const curr = bezierPoints[i];
      const next = bezierPoints[i + 1];
      if (curr.controlPoint2 && next.controlPoint1) {
        pathData += ` C ${curr.controlPoint2.x} ${curr.controlPoint2.y}, ${next.controlPoint1.x} ${next.controlPoint1.y}, ${next.x} ${next.y}`;
      } else {
        pathData += ` L ${next.x} ${next.y}`;
      }
    }

    if (isClosed && bezierPoints.length >= 3) {
      const last = bezierPoints[bezierPoints.length - 1];
      const first = bezierPoints[0];
      if (last.controlPoint2 && first.controlPoint1) {
        pathData += ` C ${last.controlPoint2.x} ${last.controlPoint2.y}, ${first.controlPoint1.x} ${first.controlPoint1.y}, ${first.x} ${first.y}`;
      } else {
        pathData += ' Z';
      }
    }

    const path = new Path(pathData, {
      fill: '',
      stroke: '#0D9488',
      strokeWidth: 3,
      strokeDashArray: [5, 5],
      selectable: false,
      evented: true,
      objectCaching: false,
      strokeUniform: true,
      hoverCursor: 'crosshair',
    });

    (path as any).isBezierPath = true;
    (path as any).bezierPoints = bezierPoints;
    (path as any).bezierPointsAreLocal = false;
    (path as any).isClosed = isClosed;
    (path as any).excludeFromExport = true;

    return path;
  }
}
