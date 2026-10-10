import { Canvas, Circle, Path, Rect, Group, FabricObject, util, Point as FabricPoint, FabricImage } from "fabric";
import { BezierEditMode } from "./bezierEditMode";
import { BezierPoint } from "@/types/bezier";
import { v4 as uuidv4 } from 'uuid';
import { MembranePathTool } from "./membranePathTool";

// Membrane edit mode only supports path editing
export enum MembraneEditState {
  PATH_EDIT = 'path_edit'
}

// No custom config needed for membrane edit mode currently
export interface MembraneEditConfig {}

const DEFAULT_CONFIG: MembraneEditConfig = {};

// Static counter for instance IDs
let membraneEditModeInstanceCounter = 0;

export class MembraneEditMode {
  private instanceId: number;
  private canvas: Canvas;
  private membrane: Group | null = null;
  private originalRasterized: FabricImage | null = null; // Store original rasterized version
  private editState: MembraneEditState = MembraneEditState.PATH_EDIT;

  // Path edit mode (delegate to BezierEditMode)
  private pathEditMode: BezierEditMode | null = null;
  private virtualPath: Path | null = null;
  private pathChangeHandler: ((e: any) => void) | null = null;
  private debounceTimer: NodeJS.Timeout | null = null;
  private readonly DEBOUNCE_DELAY = 200; // ms - wait for user to finish dragging before regenerating

  private config: MembraneEditConfig;
  private saveState?: () => void;
  private activationTime: number = 0;

  constructor(canvas: Canvas, config?: Partial<MembraneEditConfig>, saveState?: () => void) {
    this.instanceId = ++membraneEditModeInstanceCounter;
    this.canvas = canvas;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.saveState = saveState;
  }

  async activate(membrane: Group | FabricImage): Promise<void> {
    this.activationTime = Date.now();

    // Keep membrane rasterized during edit (don't vectorize)
    // Store reference to rasterized membrane
    if ((membrane as any).isRasterizedMembrane) {
      this.originalRasterized = membrane as FabricImage;
      this.membrane = membrane as any;
    } else {
      // If not rasterized (legacy), use as-is
      this.membrane = membrane as Group;
    }

    // Mark as in edit mode
    (this.membrane as any).isEditMode = true;

    // Set as active object
    this.canvas.setActiveObject(this.membrane);
    this.canvas.requestRenderAll();

    // Enter path edit mode
    this.editState = MembraneEditState.PATH_EDIT;
    this.enterPathEdit();
  }

  async deactivate(): Promise<Group | FabricImage | null> {
    if (!this.membrane) {
      return null;
    }

    // Clear any pending debounce timer
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    // Clean up path edit mode
    await this.exitPathEdit();

    // Mark as not in edit mode
    (this.membrane as any).isEditMode = false;

    // Membrane is already rasterized (kept rasterized throughout edit mode)
    // Just restore full opacity and make it interactive
    this.membrane.set({
      opacity: 1,
      selectable: true,
      evented: true
    });

    this.canvas.requestRenderAll();

    const finalMembrane = this.membrane;
    this.membrane = null;
    this.originalRasterized = null;

    return finalMembrane;
  }


  private enterPathEdit(): void {
    if (!this.membrane) return;

    // Get stored bezier points
    const storedWorldBezierPoints = (this.membrane as any).worldBezierPoints as BezierPoint[];
    const isClosed = (this.membrane as any).isClosed;


    if (!storedWorldBezierPoints || storedWorldBezierPoints.length < 2) return;

    // Calculate current world bezier points by applying the correct transformation
    // For rasterized membranes, we need to use originalScaleX/Y instead of display scale (0.5)
    let groupMatrix: number[];

    if ((this.membrane as any).isRasterizedMembrane) {
      // Build transform matrix using ORIGINAL scales, not display scales
      const originalScaleX = (this.membrane as any).originalScaleX || 1;
      const originalScaleY = (this.membrane as any).originalScaleY || 1;
      const angle = this.membrane.angle || 0;
      const bounds = this.membrane.getBoundingRect();
      const centerX = bounds.left + bounds.width / 2;
      const centerY = bounds.top + bounds.height / 2;

      const cos = Math.cos(angle * Math.PI / 180);
      const sin = Math.sin(angle * Math.PI / 180);

      groupMatrix = [
        cos * originalScaleX,
        sin * originalScaleX,
        -sin * originalScaleY,
        cos * originalScaleY,
        centerX,
        centerY
      ];
    } else {
      // For non-rasterized (legacy), use normal transform
      groupMatrix = this.membrane.calcTransformMatrix();
    }

    const currentWorldBezierPoints = storedWorldBezierPoints.map(point => {
      // Transform anchor point
      const transformedAnchor = util.transformPoint(
        new FabricPoint(point.x, point.y),
        groupMatrix
      );

      const transformedPoint: BezierPoint = {
        x: transformedAnchor.x,
        y: transformedAnchor.y,
        type: point.type,
        id: point.id,
      };

      // Transform control points if they exist
      if (point.controlPoint1) {
        const transformedCp1 = util.transformPoint(
          new FabricPoint(point.controlPoint1.x, point.controlPoint1.y),
          groupMatrix
        );
        transformedPoint.controlPoint1 = { x: transformedCp1.x, y: transformedCp1.y };
      }

      if (point.controlPoint2) {
        const transformedCp2 = util.transformPoint(
          new FabricPoint(point.controlPoint2.x, point.controlPoint2.y),
          groupMatrix
        );
        transformedPoint.controlPoint2 = { x: transformedCp2.x, y: transformedCp2.y };
      }

      return transformedPoint;
    });


    this.virtualPath = this.createVirtualPathFromBezierPoints(currentWorldBezierPoints);

    this.canvas.add(this.virtualPath);

    // Bring virtual path to front so it's visible above the membrane
    this.canvas.bringObjectToFront(this.virtualPath);

    // Show membrane group at reduced opacity while editing path, and make it non-interactive
    // Do this BEFORE activating BezierEditMode to ensure proper stacking order
    this.membrane.set({
      visible: true,
      opacity: 0.3,
      selectable: false,
      evented: false
    });

    // Send membrane to back first
    this.canvas.sendObjectToBack(this.membrane);

    // Activate BezierEditMode on virtual path
    // This will create anchor handles and control handles on top of the path
    if (!this.pathEditMode) {
      this.pathEditMode = new BezierEditMode(this.canvas, undefined, this.saveState);
    }
    this.pathEditMode.activate(this.virtualPath);

    // Set up event listener to regenerate icons when anchors or control handles are modified
    // Listen at the canvas level since control handles fire 'modified' on themselves, not the path
    // DEBOUNCED to avoid regenerating on every pixel of drag (massive performance improvement!)
    this.pathChangeHandler = (e: any) => {
      const target = e.target;
      // Check if the modified object is an anchor handle or control handle
      if (target && (target.isAnchorHandle || target.isControlHandle)) {
        // Clear existing timer
        if (this.debounceTimer) {
          clearTimeout(this.debounceTimer);
        }

        // Set new timer - only regenerate after user stops dragging for DEBOUNCE_DELAY ms
        this.debounceTimer = setTimeout(async () => {
          await this.handlePathChange();
          this.debounceTimer = null;
        }, this.DEBOUNCE_DELAY);
      }
    };
    this.canvas.on('object:modified', this.pathChangeHandler);

    // Send virtual path behind the handles so handles are clickable
    // The handles were just created by BezierEditMode.activate() and are on top
    // We need to move the path below them
    this.canvas.sendObjectBackwards(this.virtualPath);

    this.canvas.requestRenderAll();
  }

  private async exitPathEdit(): Promise<void> {
    // Check if we should skip regeneration (e.g., when exiting from icon mode where user made manual changes)
    const skipRegeneration = (this as any).skipRegenerationOnExit;
    if (skipRegeneration) {
      (this as any).skipRegenerationOnExit = false; // Reset flag
    } else {
    }

    // Deactivate path edit mode (always needed for cleanup)
    if (this.pathEditMode) {
      // Skip save state during deactivation since we'll regenerate the membrane (or preserve user changes)
      this.pathEditMode.deactivate(true);
    }

    // Regenerate icons with the updated path BEFORE cleaning up (unless skipped)
    if (this.membrane && this.virtualPath && !skipRegeneration) {
      const isClosed = (this.membrane as any).isClosed;

      // Now read the finalized bezier points (in local coordinates)
      const localBezierPoints = (this.virtualPath as any).bezierPoints as BezierPoint[];


      // Convert bezier points from virtual path's local coordinates to world coordinates
      const pathMatrix = this.virtualPath.calcTransformMatrix();
      const worldBezierPoints = localBezierPoints.map(point => {
        const worldAnchor = util.transformPoint(
          new FabricPoint(point.x, point.y),
          pathMatrix
        );

        const worldPoint: BezierPoint = {
          x: worldAnchor.x,
          y: worldAnchor.y,
          type: point.type,
          id: point.id,
        };

        if (point.controlPoint1) {
          const worldCp1 = util.transformPoint(
            new FabricPoint(point.controlPoint1.x, point.controlPoint1.y),
            pathMatrix
          );
          worldPoint.controlPoint1 = { x: worldCp1.x, y: worldCp1.y };
        }

        if (point.controlPoint2) {
          const worldCp2 = util.transformPoint(
            new FabricPoint(point.controlPoint2.x, point.controlPoint2.y),
            pathMatrix
          );
          worldPoint.controlPoint2 = { x: worldCp2.x, y: worldCp2.y };
        }

        return worldPoint;
      });


      // Import MembranePathTool to use regenerateIconsVector
      const { MembranePathTool } = await import('./membranePathTool');

      // Remove old membrane before creating new one
      this.canvas.remove(this.membrane);

      // Regenerate icons as vector group
      const newMembraneGroup = await MembranePathTool.regenerateIconsVector(this.canvas, this.membrane, worldBezierPoints);

      // Immediately re-rasterize for performance (edit mode keeps rasterized)
      const newRasterized = await MembranePathTool.rasterizeMembrane(newMembraneGroup);

      // Add rasterized membrane to canvas
      this.canvas.add(newRasterized);
      this.canvas.sendObjectToBack(newRasterized);

      // Set opacity for edit mode (will be restored to 1.0 later in this method)
      newRasterized.set({
        opacity: 0.3,
        selectable: false,
        evented: false
      });


      // Update our reference to the new rasterized membrane
      this.membrane = newRasterized as any;

      this.canvas.requestRenderAll();
    }

    // Clean up event listener
    if (this.pathChangeHandler) {
      this.canvas.off('object:modified', this.pathChangeHandler);
      this.pathChangeHandler = null;
    }

    // Clean up the virtual path
    if (this.virtualPath) {
      this.canvas.remove(this.virtualPath);
      this.virtualPath = null;
    }

    if (this.membrane) {
      // Restore membrane to full opacity and make it interactive again
      this.membrane.set({
        visible: true,
        opacity: 1,
        selectable: true,
        evented: true
      });
      this.canvas.requestRenderAll();
    }
  }


  private createVirtualPathFromBezierPoints(bezierPoints: BezierPoint[]): Path {
    // Build SVG path data from bezier points
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

    // Close path with bezier curve if membrane was closed
    const isClosed = (this.membrane as any).isClosed;
    if (isClosed && bezierPoints.length >= 3) {
      const last = bezierPoints[bezierPoints.length - 1];
      const first = bezierPoints[0];

      if (last.controlPoint2 && first.controlPoint1) {
        // Close with bezier curve
        pathData += ` C ${last.controlPoint2.x} ${last.controlPoint2.y}, ${first.controlPoint1.x} ${first.controlPoint1.y}, ${first.x} ${first.y}`;
      } else {
        // Fallback to straight line
        pathData += ' Z';
      }
    }

    const path = new Path(pathData, {
      fill: '',
      stroke: '#0D9488',
      strokeWidth: 3,
      strokeDashArray: [5, 5],
      selectable: false,
      evented: true, // Needs to be evented for double-click to add points
      objectCaching: false,
      strokeUniform: true,
      hoverCursor: 'crosshair',
    });

    (path as any).isBezierPath = true;
    (path as any).bezierPoints = bezierPoints;
    (path as any).bezierPointsAreLocal = false; // Virtual path uses world coords
    (path as any).isClosed = isClosed;
    (path as any).excludeFromExport = true; // Mark as temporary edit mode object


    return path;
  }


  async handlePathChange(): Promise<void> {
    if (!this.membrane || !this.virtualPath) return;

    const localBezierPoints = (this.virtualPath as any).bezierPoints as BezierPoint[];
    const isClosed = (this.membrane as any).isClosed;


    // Convert bezier points from virtual path's local coordinates to world coordinates
    const pathMatrix = this.virtualPath.calcTransformMatrix();
    const worldBezierPoints = localBezierPoints.map(point => {
      const worldAnchor = util.transformPoint(
        new FabricPoint(point.x, point.y),
        pathMatrix
      );

      const worldPoint: BezierPoint = {
        x: worldAnchor.x,
        y: worldAnchor.y,
        type: point.type,
        id: point.id,
      };

      if (point.controlPoint1) {
        const worldCp1 = util.transformPoint(
          new FabricPoint(point.controlPoint1.x, point.controlPoint1.y),
          pathMatrix
        );
        worldPoint.controlPoint1 = { x: worldCp1.x, y: worldCp1.y };
      }

      if (point.controlPoint2) {
        const worldCp2 = util.transformPoint(
          new FabricPoint(point.controlPoint2.x, point.controlPoint2.y),
          pathMatrix
        );
        worldPoint.controlPoint2 = { x: worldCp2.x, y: worldCp2.y };
      }

      return worldPoint;
    });

    // Import MembranePathTool to use regenerateIconsVector
    const { MembranePathTool } = await import('./membranePathTool');

    // Remove old membrane before creating new one
    this.canvas.remove(this.membrane);

    // Regenerate icons as vector group
    const newMembraneGroup = await MembranePathTool.regenerateIconsVector(this.canvas, this.membrane, worldBezierPoints);

    // Immediately re-rasterize for performance (edit mode keeps rasterized)
    const newRasterized = await MembranePathTool.rasterizeMembrane(newMembraneGroup);

    // Add rasterized membrane to canvas
    this.canvas.add(newRasterized);
    this.canvas.sendObjectToBack(newRasterized);

    // Set opacity for edit mode (ghosted appearance)
    newRasterized.set({
      opacity: 0.3,
      selectable: false,
      evented: false
    });

    // Update our reference to the new rasterized membrane
    this.membrane = newRasterized as any;

    this.canvas.requestRenderAll();

    // Restore edit mode appearance: reduced opacity and non-interactive
    this.membrane.set({
      visible: true,
      opacity: 0.3,
      selectable: false,
      evented: false
    });

    // Send membrane to back so virtual path and handles are visible on top
    this.canvas.sendObjectToBack(this.membrane);

    // Don't move the virtual path - it's already in the correct position
    // (behind the anchor handles, above the membrane)

    // Note: We no longer call discardActiveObject() here because it can interfere
    // with the BezierEditMode's anchor selection state. The membrane regeneration
    // shouldn't affect the active selection since the membrane is set to non-evented.

    this.canvas.requestRenderAll();
  }

  isActive(): boolean {
    return this.membrane !== null;
  }

  getEditState(): MembraneEditState {
    return this.editState;
  }
}
