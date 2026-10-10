import { Canvas, Group, FabricObject, FabricImage, util, loadSVGFromString } from "fabric";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface Point {
  x: number;
  y: number;
}

export interface MembraneBrushOptions {
  iconId?: string;        // NEW: Primary format - icon UUID from database
  iconName?: string;      // Optional metadata for display
  iconSVG?: string;       // LEGACY: Keep for backwards compatibility
  iconSize: number;
  spacing: number;
  rotateToPath: boolean;
  doubleSided: boolean;
  orientationOffset: number;
}

export class MembraneBrushTool {
  private canvas: Canvas;
  private options: MembraneBrushOptions;
  private pathPoints: Point[] = [];
  private previewGroup: Group | null = null;
  private isDrawing: boolean = false;

  // Static cache for fetched SVG content - key is iconId, value is SVG string
  private static iconSvgCache: Map<string, string> = new Map();

  // Static cache for parsed icon templates - key is iconId or SVG content, value is the template Group
  private static iconCache: Map<string, Group> = new Map();

  // Static cache for rasterized icon templates - key is "iconId:size", value is rasterized FabricImage
  // This provides 10-50x performance improvement (vector clone ~5-10ms → raster clone ~0.1-0.5ms)
  private static rasterizedIconCache: Map<string, FabricImage> = new Map();

  constructor(canvas: Canvas, options: MembraneBrushOptions) {
    this.canvas = canvas;
    this.options = options;
  }

  // Static method to fetch icon SVG content from database by iconId
  private static async fetchIconSVG(iconId: string): Promise<string | null> {
    // Check cache first
    if (MembraneBrushTool.iconSvgCache.has(iconId)) {
      return MembraneBrushTool.iconSvgCache.get(iconId)!;
    }


    // Fetch from database
    const { data, error } = await supabase
      .from('icons')
      .select('svg_content')
      .eq('id', iconId)
      .single();

    if (error) {
      console.error('[MembraneBrush] Error fetching icon SVG:', error);
      return null;
    }

    if (!data?.svg_content) {
      console.error('[MembraneBrush] No SVG content found for iconId:', iconId);
      return null;
    }

    // Cache and return
    MembraneBrushTool.iconSvgCache.set(iconId, data.svg_content);
    return data.svg_content;
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
    this.pathPoints = [];
    this.isDrawing = false;
    this.cleanup();
    this.disableObjectInteraction();
  }

  addPoint(x: number, y: number): void {
    this.pathPoints.push({ x, y });
    this.isDrawing = true;
  }

  updatePreview(): void {
    if (this.pathPoints.length < 2) return;
    
    this.cleanup();
    this.createPreviewIcons();
  }

  private async createPreviewIcons(): Promise<void> {
    const icons = await this.placeIconsAlongPath(true);
    if (icons.length === 0) return;

    this.previewGroup = new Group(icons, {
      selectable: false,
      evented: false,
    });
    (this.previewGroup as any).isTemp = true;
    this.canvas.add(this.previewGroup);
    this.canvas.requestRenderAll();
  }

  async finish(): Promise<Group | null> {
    if (this.pathPoints.length < 2) {
      this.cancel();
      return null;
    }

    this.cleanup();
    
    try {
      const icons = await this.placeIconsAlongPath(false);
      if (icons.length === 0) {
        this.enableObjectInteraction();
        return null;
      }

      const membrane = new Group(icons, {
        selectable: true,
        evented: true,
      });
      
      (membrane as any).isMembrane = true;
      (membrane as any).membraneOptions = this.options;
      (membrane as any).membranePathPoints = this.pathPoints;
      
      this.canvas.add(membrane);
      this.canvas.setActiveObject(membrane);
      this.enableObjectInteraction();
      this.canvas.requestRenderAll();
      
      return membrane;
    } catch (error) {
      console.error("Error finishing membrane:", error);
      this.enableObjectInteraction();
      return null;
    }
  }

  cancel(): void {
    this.cleanup();
    this.enableObjectInteraction();
    this.pathPoints = [];
    this.isDrawing = false;
  }

  private cleanup(): void {
    if (this.previewGroup) {
      this.canvas.remove(this.previewGroup);
      this.previewGroup = null;
    }
    
    // Remove any temporary objects
    this.canvas.getObjects().forEach((obj) => {
      if ((obj as any).isTemp) {
        this.canvas.remove(obj);
      }
    });
    
    this.canvas.requestRenderAll();
  }

  private smoothPath(points: Point[]): Point[] {
    if (points.length < 3) return points;
    
    const smoothed: Point[] = [points[0]];
    
    for (let i = 1; i < points.length - 1; i++) {
      const p0 = points[i - 1];
      const p1 = points[i];
      const p2 = points[i + 1];
      
      // Add interpolated points using Catmull-Rom spline
      const numSegments = 3;
      for (let t = 0; t < numSegments; t++) {
        const u = t / numSegments;
        const u2 = u * u;
        const u3 = u2 * u;
        
        const x = 0.5 * (
          (2 * p1.x) +
          (-p0.x + p2.x) * u +
          (2 * p0.x - 5 * p1.x + 4 * p2.x - (i + 1 < points.length - 1 ? points[i + 1].x : p2.x)) * u2 +
          (-p0.x + 3 * p1.x - 3 * p2.x + (i + 1 < points.length - 1 ? points[i + 1].x : p2.x)) * u3
        );
        
        const y = 0.5 * (
          (2 * p1.y) +
          (-p0.y + p2.y) * u +
          (2 * p0.y - 5 * p1.y + 4 * p2.y - (i + 1 < points.length - 1 ? points[i + 1].y : p2.y)) * u2 +
          (-p0.y + 3 * p1.y - 3 * p2.y + (i + 1 < points.length - 1 ? points[i + 1].y : p2.y)) * u3
        );
        
        smoothed.push({ x, y });
      }
    }
    
    smoothed.push(points[points.length - 1]);
    return smoothed;
  }

  private calculatePathLength(points: Point[]): number {
    let length = 0;
    for (let i = 1; i < points.length; i++) {
      const dx = points[i].x - points[i - 1].x;
      const dy = points[i].y - points[i - 1].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
  }

  private getPointAtDistance(points: Point[], distance: number): { point: Point; angle: number } | null {
    let accumulated = 0;
    
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);
      
      if (accumulated + segmentLength >= distance) {
        const ratio = (distance - accumulated) / segmentLength;
        const x = p1.x + dx * ratio;
        const y = p1.y + dy * ratio;
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        
        return { point: { x, y }, angle };
      }
      
      accumulated += segmentLength;
    }
    
    return null;
  }

  private async placeIconsAlongPath(isPreview: boolean): Promise<FabricObject[]> {
    const smoothedPoints = this.smoothPath(this.pathPoints);
    const pathLength = this.calculatePathLength(smoothedPoints);

    const icons: FabricObject[] = [];

    // Determine SVG content
    let svgContent: string | null = null;
    const hasIconId = this.options.iconId !== undefined;

    if (hasIconId) {
      // NEW: Icon-by-reference format
      svgContent = await MembraneBrushTool.fetchIconSVG(this.options.iconId!);
      if (!svgContent) {
        toast.error("Failed to load icon from library");
        return [];
      }
    } else if (this.options.iconSVG) {
      // LEGACY: Inline SVG format (backwards compatibility)
      svgContent = this.options.iconSVG;
    } else {
      toast.error("No icon source provided");
      return [];
    }

    return new Promise(async (resolve) => {
      // Cache key for icon templates
      const cacheKey = hasIconId ? this.options.iconId! : svgContent!;

      // Check cache for parsed icon template
      let iconTemplate = MembraneBrushTool.iconCache.get(cacheKey);

      if (!iconTemplate) {
        const { objects } = await loadSVGFromString(svgContent!);
        if (!objects || objects.length === 0) {
          toast.error("Failed to load icon");
          resolve([]);
          return;
        }
        iconTemplate = new Group(objects);
        MembraneBrushTool.iconCache.set(cacheKey, iconTemplate);
      }

      // Rasterize icon template ONCE for massive performance improvement
      const rasterCacheKey = `${cacheKey}:${this.options.iconSize}`;
      let rasterizedTemplate = MembraneBrushTool.rasterizedIconCache.get(rasterCacheKey);

      if (!rasterizedTemplate) {
        const iconWidth = iconTemplate.width || 1;
        const iconHeight = iconTemplate.height || 1;
        const scale = this.options.iconSize / Math.max(iconWidth, iconHeight);

        const tempIcon = await iconTemplate.clone();
        tempIcon.set({ scaleX: scale, scaleY: scale });

        // Rasterize to data URL and create image
        const dataURL = tempIcon.toDataURL({ format: 'png', quality: 1, multiplier: 2 });
        rasterizedTemplate = await FabricImage.fromURL(dataURL, { crossOrigin: 'anonymous' });
        rasterizedTemplate.set({ scaleX: 0.5, scaleY: 0.5 }); // Scale down from 2x multiplier

        MembraneBrushTool.rasterizedIconCache.set(rasterCacheKey, rasterizedTemplate);
      }

      const iconWidth = iconTemplate.width || 1;
      const iconHeight = iconTemplate.height || 1;
      const scale = this.options.iconSize / Math.max(iconWidth, iconHeight);

      // Calculate actual scaled dimensions
      const scaledWidth = iconWidth * scale;
      const scaledHeight = iconHeight * scale;

      // Determine which dimension is along the path based on rotation
      const baseAngle = this.options.rotateToPath ? 90 : 0;
      const totalRotation = baseAngle + this.options.orientationOffset;
      const normalizedAngle = ((totalRotation % 360) + 360) % 360;
      const isVerticalOrientation = (normalizedAngle >= 45 && normalizedAngle < 135) ||
                                     (normalizedAngle >= 225 && normalizedAngle < 315);

      const effectiveDimension = isVerticalOrientation ? scaledHeight : scaledWidth;
      const effectiveSpacing = effectiveDimension + this.options.spacing;
        const numIcons = Math.max(2, Math.floor(pathLength / effectiveSpacing));
        
        const clonePromises: Promise<void>[] = [];

        for (let i = 0; i < numIcons; i++) {
          const distance = (i / (numIcons - 1)) * pathLength;
          const result = this.getPointAtDistance(smoothedPoints, distance);

          if (!result) continue;

          // Clone rasterized template — await all clones before resolving
          const clonePromise = rasterizedTemplate!.clone().then(async (icon) => {
            icon.set({
              left: result.point.x,
              top: result.point.y,
              originX: 'center',
              originY: 'center',
              selectable: false,
              evented: false,
            });

            if (this.options.rotateToPath) {
              icon.set({ angle: result.angle + 90 + this.options.orientationOffset });
            } else {
              icon.set({ angle: this.options.orientationOffset });
            }

            if (isPreview) {
              icon.set({ opacity: 0.6 });
            }

            // Mark icon with metadata for icon-by-reference saving
            if (hasIconId) {
              (icon as any).iconId = this.options.iconId;
              (icon as any).isLibraryIcon = true;
            }
            (icon as any).isMembraneIcon = true;

            const originalToObject = icon.toObject.bind(icon);
            (icon as any).toObject = function(propertiesToInclude?: string[]) {
              return originalToObject([
                ...(propertiesToInclude || []),
                'iconId',
                'isLibraryIcon',
                'isMembraneIcon',
              ]);
            };

            icons.push(icon);

            // If double-sided, add mirrored icon
            if (this.options.doubleSided) {
              const mirroredIcon = await rasterizedTemplate!.clone();
              const offset = this.options.iconSize * 0.7;
              const perpAngle = (result.angle + 90) * (Math.PI / 180);
              const offsetX = Math.cos(perpAngle) * offset;
              const offsetY = Math.sin(perpAngle) * offset;

              mirroredIcon.set({
                left: result.point.x + offsetX,
                top: result.point.y + offsetY,
                originX: 'center',
                originY: 'center',
                selectable: false,
                evented: false,
                angle: this.options.rotateToPath ? result.angle - 90 + this.options.orientationOffset : this.options.orientationOffset,
              });

              if (isPreview) {
                mirroredIcon.set({ opacity: 0.6 });
              }

              if (hasIconId) {
                (mirroredIcon as any).iconId = this.options.iconId;
                (mirroredIcon as any).isLibraryIcon = true;
              }
              (mirroredIcon as any).isMembraneIcon = true;

              const mirroredOriginalToObject = mirroredIcon.toObject.bind(mirroredIcon);
              (mirroredIcon as any).toObject = function(propertiesToInclude?: string[]) {
                return mirroredOriginalToObject([
                  ...(propertiesToInclude || []),
                  'iconId',
                  'isLibraryIcon',
                  'isMembraneIcon',
                ]);
              };

              icons.push(mirroredIcon);
            }
          });

          clonePromises.push(clonePromise);
        }

        // Wait for ALL clones to complete before resolving
        await Promise.all(clonePromises);
        resolve(icons);
    });
  }

  getState() {
    return {
      isDrawing: this.isDrawing,
      pointCount: this.pathPoints.length,
    };
  }

  // Static method to clear the icon cache (useful for memory management)
  static clearIconCache(): void {
    MembraneBrushTool.iconCache.clear();
  }

  // Static method to clear the rasterized icon cache (useful for memory management)
  static clearRasterizedCache(): void {
    MembraneBrushTool.rasterizedIconCache.clear();
  }

  // Static method to get cache size (for debugging)
  static getCacheSize(): number {
    return MembraneBrushTool.iconCache.size;
  }

  // Static method to get rasterized cache size (for debugging)
  static getRasterizedCacheSize(): number {
    return MembraneBrushTool.rasterizedIconCache.size;
  }
}
