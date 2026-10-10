import { Canvas as FabricCanvas, FabricObject } from 'fabric';

export interface ViewportBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Object Culling Manager
 * Hides objects outside the viewport for better rendering performance
 */
export class ObjectCullingManager {
  private canvas: FabricCanvas | null = null;
  private cullingEnabled: boolean = true;
  private margin: number = 100; // Pixels of margin around viewport

  constructor(canvas?: FabricCanvas) {
    this.canvas = canvas || null;
  }

  setCanvas(canvas: FabricCanvas): void {
    this.canvas = canvas;
  }

  setEnabled(enabled: boolean): void {
    this.cullingEnabled = enabled;
    if (!enabled && this.canvas) {
      // Re-show all objects when culling is disabled
      this.showAllObjects();
    }
  }

  setMargin(margin: number): void {
    this.margin = margin;
  }

  /**
   * Get current viewport bounds in canvas coordinates
   */
  getViewportBounds(): ViewportBounds | null {
    if (!this.canvas) return null;

    const zoom = this.canvas.getZoom();
    const vpt = this.canvas.viewportTransform;
    
    if (!vpt) return null;

    const width = (this.canvas.width || 0) / zoom;
    const height = (this.canvas.height || 0) / zoom;
    
    return {
      left: -vpt[4] / zoom - this.margin,
      top: -vpt[5] / zoom - this.margin,
      right: (-vpt[4] + (this.canvas.width || 0)) / zoom + this.margin,
      bottom: (-vpt[5] + (this.canvas.height || 0)) / zoom + this.margin
    };
  }

  /**
   * Check if object intersects with viewport
   */
  isObjectInViewport(obj: FabricObject, bounds: ViewportBounds): boolean {
    const objBounds = obj.getBoundingRect();
    
    return !(
      objBounds.left + objBounds.width < bounds.left ||
      objBounds.left > bounds.right ||
      objBounds.top + objBounds.height < bounds.top ||
      objBounds.top > bounds.bottom
    );
  }

  /**
   * Apply culling to all objects
   * Returns number of objects culled
   */
  cullObjects(): number {
    if (!this.canvas || !this.cullingEnabled) return 0;

    const bounds = this.getViewportBounds();
    if (!bounds) return 0;

    let culledCount = 0;
    const objects = this.canvas.getObjects();

    objects.forEach(obj => {
      // Don't cull UI helper objects or the active selection
      if (
        (obj as any).isGridLine ||
        (obj as any).isRuler ||
        (obj as any).isEndpointMarker ||
        (obj as any).isControlHandle ||
        (obj as any).isHandleLine ||
        (obj as any).isAnchorHandle ||
        (obj as any).isGuideLine ||
        (obj as any).isPortIndicator ||
        (obj as any).isFeedback ||
        (obj as any).excludeFromExport ||
        obj === this.canvas?.getActiveObject()
      ) {
        return;
      }

      // Ensure coordinates are fresh before checking viewport intersection
      if (obj.setCoords) obj.setCoords();

      const shouldBeVisible = this.isObjectInViewport(obj, bounds);
      
      // Only change visibility if needed to avoid unnecessary renders
      if (obj.visible !== shouldBeVisible) {
        obj.visible = shouldBeVisible;
        // Invalidate group cache when restoring visibility so icons re-render
        if (shouldBeVisible) {
          (obj as any).dirty = true;
          if ((obj as any)._objects) {
            // Mark all children dirty too (nested images need re-render)
            (obj as any)._objects.forEach((child: any) => { child.dirty = true; });
          }
        } else {
          culledCount++;
        }
      }
    });

    return culledCount;
  }

  /**
   * Show all objects (disable culling temporarily)
   */
  showAllObjects(): void {
    if (!this.canvas) return;

    const objects = this.canvas.getObjects();
    objects.forEach(obj => {
      if (!obj.visible && !(obj as any).isGridLine && !(obj as any).isRuler) {
        obj.visible = true;
      }
    });
  }

  /**
   * Get statistics about culling
   */
  getStats(): { total: number; visible: number; culled: number } {
    if (!this.canvas) {
      return { total: 0, visible: 0, culled: 0 };
    }

    const objects = this.canvas.getObjects().filter(
      obj => !(obj as any).isGridLine && !(obj as any).isRuler
    );

    const visible = objects.filter(obj => obj.visible).length;
    const total = objects.length;

    return {
      total,
      visible,
      culled: total - visible
    };
  }
}

/**
 * Throttled culling function for use during pan/zoom
 */
export function createThrottledCuller(
  cullingManager: ObjectCullingManager,
  delay: number = 100
): () => void {
  let timeout: NodeJS.Timeout | null = null;
  let lastRan: number | null = null;

  return () => {
    const now = Date.now();

    if (lastRan === null || now - lastRan >= delay) {
      cullingManager.cullObjects();
      lastRan = now;
    } else if (!timeout) {
      timeout = setTimeout(() => {
        cullingManager.cullObjects();
        lastRan = Date.now();
        timeout = null;
      }, delay - (now - lastRan));
    }
  };
}
