import { Path, Group, FabricObject, Canvas as FabricCanvas, loadSVGFromString, util, Point as FabricPoint, FabricImage } from "fabric";
import { EnhancedBezierTool } from "./enhancedBezierTool";
import { BezierPoint } from "@/types/bezier";
import { v4 as uuidv4 } from 'uuid';
import { supabase } from "@/integrations/supabase/client";

export interface MembranePathOptions {
  iconId?: string;        // NEW: Primary format - icon UUID from database
  iconName?: string;      // Optional metadata for display
  iconSVG?: string;       // LEGACY: Keep for backwards compatibility
  iconSize: number;
  spacing: number;
  rotateToPath: boolean;
  doubleSided: boolean;
  orientationOffset: number;
}

export class MembranePathTool {
  private canvas: FabricCanvas;
  private bezierTool: EnhancedBezierTool;
  private options: MembranePathOptions;
  private isDrawing: boolean = false;

  // Static cache for parsed icon templates - key is iconId or SVG content, value is the template Group
  private static iconCache: Map<string, Group> = new Map();

  // Static cache for fetched SVG content - key is iconId, value is SVG string
  private static iconSvgCache: Map<string, string> = new Map();

  // Static cache for rasterized icon templates - key is "iconId:size", value is rasterized FabricImage
  // This provides 10-50x performance improvement (vector clone ~5-10ms → raster clone ~0.1-0.5ms)
  private static rasterizedIconCache: Map<string, FabricImage> = new Map();

  constructor(canvas: FabricCanvas, options: MembranePathOptions) {
    this.canvas = canvas;
    this.options = options;
    this.bezierTool = new EnhancedBezierTool(canvas);
  }

  // Static method to fetch icon SVG content from database by iconId
  private static async fetchIconSVG(iconId: string): Promise<string | null> {
    // Check cache first
    if (MembranePathTool.iconSvgCache.has(iconId)) {
      return MembranePathTool.iconSvgCache.get(iconId)!;
    }


    // Fetch from database
    const { data, error } = await supabase
      .from('icons')
      .select('svg_content')
      .eq('id', iconId)
      .single();

    if (error) {
      console.error('[MembranePath] Error fetching icon SVG:', error);
      return null;
    }

    if (!data?.svg_content) {
      console.error('[MembranePath] No SVG content found for iconId:', iconId);
      return null;
    }

    // Cache and return
    MembranePathTool.iconSvgCache.set(iconId, data.svg_content);
    return data.svg_content;
  }

  start(): void {
    this.isDrawing = true;
    this.bezierTool.start();
  }

  async addPoint(x: number, y: number): Promise<Group | null> {
    if (!this.isDrawing) return null;

    // Check if bezierTool is still drawing before adding point
    const wasDrawing = this.bezierTool.getState().isDrawing;

    // Add the point to the bezier tool
    this.bezierTool.addPoint(x, y);

    // Check if bezierTool finished (auto-closed by clicking first point)
    const isStillDrawing = this.bezierTool.getState().isDrawing;

    if (wasDrawing && !isStillDrawing) {
      // BezierTool auto-finished, so finish the membrane as well
      return await this.finish();
    }

    return null;
  }

  async finish(): Promise<Group | null> {
    if (!this.isDrawing) return null;

    // Get world coordinate points BEFORE finishing (which converts to local coords)
    const worldBezierPoints = this.bezierTool.getWorldPoints();

    // Check if path was already finished (auto-closed by clicking first point)
    let path = this.bezierTool.getFinishedPath();

    if (!path) {
      // Path not finished yet, finish it now
      path = this.bezierTool.finish();
      if (!path) return null;
    }

    // Get the actual isClosed state from the finished path
    const actualIsClosed = (path as any).isClosed || false;

    // Get local bezier points from the path for storage
    const localBezierPoints = (path as any).bezierPoints as BezierPoint[];


    // Place icons along path using WORLD coordinates
    const icons = await this.placeIconsAlongPath(worldBezierPoints, actualIsClosed);

    // Remove the visible path (we'll store data only)
    this.canvas.remove(path);

    // Create membrane group with icons
    const membrane = new Group(icons, {
      selectable: true,
      evented: true,
      subTargetCheck: true,
      interactive: true,
      objectCaching: false, // Disable caching to prevent clipping
    });

    // Transform worldBezierPoints to relative space (inverse of group's transformation)
    // This ensures consistency with how they're stored after regenerateIcons
    const invGroupMatrix = util.invertTransform(membrane.calcTransformMatrix());
    const relativeWorldBezierPoints = worldBezierPoints.map(point => {
      const relativeAnchor = util.transformPoint(
        { x: point.x, y: point.y },
        invGroupMatrix
      );

      const relativePoint: BezierPoint = {
        x: relativeAnchor.x,
        y: relativeAnchor.y,
        type: point.type,
        id: point.id,
      };

      if (point.controlPoint1) {
        const relativeCp1 = util.transformPoint(
          { x: point.controlPoint1.x, y: point.controlPoint1.y },
          invGroupMatrix
        );
        relativePoint.controlPoint1 = { x: relativeCp1.x, y: relativeCp1.y };
      }

      if (point.controlPoint2) {
        const relativeCp2 = util.transformPoint(
          { x: point.controlPoint2.x, y: point.controlPoint2.y },
          invGroupMatrix
        );
        relativePoint.controlPoint2 = { x: relativeCp2.x, y: relativeCp2.y };
      }

      return relativePoint;
    });


    // Store membrane metadata
    (membrane as any).isMembraneShape = true;
    (membrane as any).membraneOptions = this.options;
    (membrane as any).bezierPoints = localBezierPoints; // Store local coords for editing
    (membrane as any).worldBezierPoints = relativeWorldBezierPoints; // Store in relative space (consistent with regenerateIcons)
    (membrane as any).isClosed = actualIsClosed;
    (membrane as any).id = uuidv4();

    // Override toObject for serialization
    const originalToObject = membrane.toObject.bind(membrane);
    (membrane as any).toObject = function(propertiesToInclude?: string[]) {
      return originalToObject([
        ...(propertiesToInclude || []),
        'isMembraneShape',
        'membraneOptions',
        'bezierPoints',
        'worldBezierPoints',
        'isClosed',
        'id'
      ]);
    };

    // Rasterize membrane for performance
    const rasterizedMembrane = await MembranePathTool.rasterizeMembrane(membrane);

    this.canvas.add(rasterizedMembrane);
    this.canvas.setActiveObject(rasterizedMembrane);
    this.canvas.requestRenderAll();
    this.isDrawing = false;

    // Clear the bezier tool's finished path reference
    // This is safe to do via direct access since it's our internal tool
    (this.bezierTool as any).finishedPath = null;

    return rasterizedMembrane as any;
  }

  cancel(): void {
    this.isDrawing = false;
    this.bezierTool.cancel();
  }

  // Place icons along the bezier path
  private async placeIconsAlongPath(bezierPoints: BezierPoint[], isClosed?: boolean): Promise<FabricObject[]> {

    // Sample the actual bezier curve using the control points
    const sampledPoints = this.sampleBezierCurve(bezierPoints, isClosed);
    const pathLength = this.calculatePathLength(sampledPoints);


    const icons: FabricObject[] = [];

    // Determine SVG content and cache key
    let svgContent: string | null = null;
    let cacheKey: string;
    const hasIconId = this.options.iconId !== undefined;

    if (hasIconId) {
      // NEW: Icon-by-reference format
      cacheKey = this.options.iconId!;
      svgContent = await MembranePathTool.fetchIconSVG(this.options.iconId!);
      if (!svgContent) {
        console.error('[MembranePath] Failed to fetch icon SVG for iconId:', this.options.iconId);
        return [];
      }
    } else if (this.options.iconSVG) {
      // LEGACY: Inline SVG format (backwards compatibility)
      cacheKey = this.options.iconSVG;
      svgContent = this.options.iconSVG;
    } else {
      console.error('[MembranePath] No icon source (iconId or iconSVG) provided');
      return [];
    }

    // Check cache for parsed icon template
    let iconTemplate = MembranePathTool.iconCache.get(cacheKey);

    if (iconTemplate) {
    } else {
      const { objects } = await loadSVGFromString(svgContent);
      if (!objects || objects.length === 0) {
        return [];
      }
      iconTemplate = new Group(objects);
      MembranePathTool.iconCache.set(cacheKey, iconTemplate);
    }

    return new Promise(async (resolve) => {
      // Rasterize icon template ONCE for massive performance improvement
      // Key by iconId:size for cache reuse across regenerations
      const rasterCacheKey = `${cacheKey}:${this.options.iconSize}`;
      let rasterizedTemplate = MembranePathTool.rasterizedIconCache.get(rasterCacheKey);

      if (!rasterizedTemplate) {
        // Create a temporary scaled instance for rasterization
        const iconWidth = iconTemplate!.width || 1;
        const iconHeight = iconTemplate!.height || 1;
        const scale = this.options.iconSize / Math.max(iconWidth, iconHeight);

        const tempIcon = await iconTemplate!.clone();
        tempIcon.set({ scaleX: scale, scaleY: scale });

        // Rasterize to data URL and create image
        const dataURL = tempIcon.toDataURL({ format: 'png', quality: 1, multiplier: 2 });
        rasterizedTemplate = await FabricImage.fromURL(dataURL, { crossOrigin: 'anonymous' });
        rasterizedTemplate.set({ scaleX: 0.5, scaleY: 0.5 }); // Scale down from 2x multiplier

        MembranePathTool.rasterizedIconCache.set(rasterCacheKey, rasterizedTemplate);
      }

      const processIcons = async () => {
        const iconWidth = iconTemplate!.width || 1;
        const iconHeight = iconTemplate!.height || 1;
        const scale = this.options.iconSize / Math.max(iconWidth, iconHeight);

        // Calculate spacing
        const scaledWidth = iconWidth * scale;
        const scaledHeight = iconHeight * scale;

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
          // For closed paths, distribute icons evenly around the loop without overlap at start/end
          // For open paths, distribute from start to end including both endpoints
          const distance = isClosed
            ? (i / numIcons) * pathLength
            : (i / (numIcons - 1)) * pathLength;

          const result = this.getPointAtDistance(sampledPoints, distance);

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

            // Mark icon with metadata for icon-by-reference saving
            if (hasIconId) {
              (icon as any).iconId = this.options.iconId;
              (icon as any).isLibraryIcon = true;
            }
            // Mark as membrane icon to prevent individual editing
            (icon as any).isMembraneIcon = true;

            // Override toObject to include icon metadata in serialization
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

              // Mark mirrored icon with metadata for icon-by-reference saving
              if (hasIconId) {
                (mirroredIcon as any).iconId = this.options.iconId;
                (mirroredIcon as any).isLibraryIcon = true;
              }
              // Mark as membrane icon to prevent individual editing
              (mirroredIcon as any).isMembraneIcon = true;

              // Override toObject to include icon metadata in serialization
              const originalToObject = mirroredIcon.toObject.bind(mirroredIcon);
              (mirroredIcon as any).toObject = function(propertiesToInclude?: string[]) {
                return originalToObject([
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

        // Wait for ALL clones to complete before returning icons
        await Promise.all(clonePromises);
        resolve(icons);
      };

      await processIcons();
    });
  }

  // Sample points along the actual bezier curve defined by control points
  private sampleBezierCurve(bezierPoints: BezierPoint[], isClosed?: boolean): { x: number; y: number }[] {
    if (bezierPoints.length < 2) return bezierPoints.map(bp => ({ x: bp.x, y: bp.y }));

    const sampled: { x: number; y: number }[] = [];
    const samplesPerSegment = 20; // More samples for smoother curve

    // Sample each bezier segment
    for (let i = 0; i < bezierPoints.length - 1; i++) {
      const p0 = bezierPoints[i];
      const p1 = bezierPoints[i + 1];

      // Get control points (use anchor point if control point doesn't exist)
      const cp1 = p0.controlPoint2 || { x: p0.x, y: p0.y };
      const cp2 = p1.controlPoint1 || { x: p1.x, y: p1.y };

      // Sample the cubic bezier curve
      for (let t = 0; t <= samplesPerSegment; t++) {
        const u = t / samplesPerSegment;
        const point = this.sampleCubicBezier(u, p0, cp1, cp2, p1);
        sampled.push(point);
      }
    }

    // Add closing segment if path is closed
    if (isClosed && bezierPoints.length >= 3) {
      const p0 = bezierPoints[bezierPoints.length - 1];
      const p1 = bezierPoints[0];

      const cp1 = p0.controlPoint2 || { x: p0.x, y: p0.y };
      const cp2 = p1.controlPoint1 || { x: p1.x, y: p1.y };

      for (let t = 0; t <= samplesPerSegment; t++) {
        const u = t / samplesPerSegment;
        const point = this.sampleCubicBezier(u, p0, cp1, cp2, p1);
        sampled.push(point);
      }
    }

    return sampled;
  }

  // Sample a point on a cubic bezier curve at parameter t (0 to 1)
  private sampleCubicBezier(
    t: number,
    p0: { x: number; y: number },
    cp1: { x: number; y: number },
    cp2: { x: number; y: number },
    p1: { x: number; y: number }
  ): { x: number; y: number } {
    const u = 1 - t;
    const tt = t * t;
    const uu = u * u;
    const uuu = uu * u;
    const ttt = tt * t;

    // Cubic bezier formula: B(t) = (1-t)³P0 + 3(1-t)²t*CP1 + 3(1-t)t²*CP2 + t³P1
    const x = uuu * p0.x + 3 * uu * t * cp1.x + 3 * u * tt * cp2.x + ttt * p1.x;
    const y = uuu * p0.y + 3 * uu * t * cp1.y + 3 * u * tt * cp2.y + ttt * p1.y;

    return { x, y };
  }

  // Helper: Smooth path using Catmull-Rom spline (kept for backward compatibility)
  private smoothPath(points: { x: number; y: number }[], isClosed?: boolean): { x: number; y: number }[] {
    if (points.length < 2) return points;

    const smoothed: { x: number; y: number }[] = [];
    const segments = 3; // Interpolation segments between points

    // Process segments between consecutive points
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(0, i - 1)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(points.length - 1, i + 2)];

      for (let t = 0; t <= segments; t++) {
        const u = t / segments;
        const point = this.catmullRom(u, p0, p1, p2, p3);
        smoothed.push(point);
      }
    }

    // Add closing segment if path is closed
    if (isClosed && points.length >= 3) {
      const lastIndex = points.length - 1;
      const p0 = points[lastIndex - 1];
      const p1 = points[lastIndex];
      const p2 = points[0]; // Close back to first point
      const p3 = points[1]; // Use second point for tangent

      for (let t = 0; t <= segments; t++) {
        const u = t / segments;
        const point = this.catmullRom(u, p0, p1, p2, p3);
        smoothed.push(point);
      }
    }

    return smoothed;
  }

  private catmullRom(t: number, p0: any, p1: any, p2: any, p3: any): { x: number; y: number } {
    const t2 = t * t;
    const t3 = t2 * t;

    const v0 = (p2.x - p0.x) * 0.5;
    const v1 = (p3.x - p1.x) * 0.5;
    const x = (2 * p1.x - 2 * p2.x + v0 + v1) * t3 +
              (-3 * p1.x + 3 * p2.x - 2 * v0 - v1) * t2 +
              v0 * t + p1.x;

    const w0 = (p2.y - p0.y) * 0.5;
    const w1 = (p3.y - p1.y) * 0.5;
    const y = (2 * p1.y - 2 * p2.y + w0 + w1) * t3 +
              (-3 * p1.y + 3 * p2.y - 2 * w0 - w1) * t2 +
              w0 * t + p1.y;

    return { x, y };
  }

  private calculatePathLength(points: { x: number; y: number }[]): number {
    let length = 0;
    for (let i = 0; i < points.length - 1; i++) {
      const dx = points[i + 1].x - points[i].x;
      const dy = points[i + 1].y - points[i].y;
      length += Math.sqrt(dx * dx + dy * dy);
    }
    return length;
  }

  private getPointAtDistance(
    points: { x: number; y: number }[],
    targetDistance: number
  ): { point: { x: number; y: number }; angle: number } | null {
    let accumulated = 0;

    for (let i = 0; i < points.length - 1; i++) {
      const p1 = points[i];
      const p2 = points[i + 1];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const segmentLength = Math.sqrt(dx * dx + dy * dy);

      if (accumulated + segmentLength >= targetDistance) {
        const remaining = targetDistance - accumulated;
        const ratio = remaining / segmentLength;

        return {
          point: {
            x: p1.x + dx * ratio,
            y: p1.y + dy * ratio,
          },
          angle: Math.atan2(dy, dx) * (180 / Math.PI),
        };
      }

      accumulated += segmentLength;
    }

    return null;
  }

  // Static method to regenerate icons after path editing
  // Returns the new membrane group
  // Regenerate icons and return vector group (for edit mode - no rasterization)
  static async regenerateIconsVector(
    canvas: FabricCanvas,
    oldMembrane: Group | FabricImage,
    newBezierPoints: BezierPoint[]
  ): Promise<Group> {
    const options = (oldMembrane as any).membraneOptions;
    const isClosed = (oldMembrane as any).isClosed;
    const id = (oldMembrane as any).id;


    // Create temporary tool instance to use placeIconsAlongPath
    const tempTool = new MembranePathTool(canvas, options);
    const newIcons = await tempTool.placeIconsAlongPath(newBezierPoints, isClosed);


    // Create a new group with the new icons
    const newMembraneGroup = new Group(newIcons, {
      selectable: true,
      evented: true,
      subTargetCheck: true,
      interactive: true,
      objectCaching: false,
    });

    // Copy metadata
    (newMembraneGroup as any).isMembraneShape = true;
    (newMembraneGroup as any).membraneOptions = options;
    (newMembraneGroup as any).isClosed = isClosed;
    (newMembraneGroup as any).id = id;

    // Store bezier points in relative space
    const invGroupMatrix = util.invertTransform(newMembraneGroup.calcTransformMatrix());
    const relativeWorldBezierPoints = newBezierPoints.map(point => {
      const relativeAnchor = util.transformPoint(
        { x: point.x, y: point.y },
        invGroupMatrix
      );

      const relativePoint: BezierPoint = {
        x: relativeAnchor.x,
        y: relativeAnchor.y,
        type: point.type,
        id: point.id,
      };

      if (point.controlPoint1) {
        const relativeCp1 = util.transformPoint(
          { x: point.controlPoint1.x, y: point.controlPoint1.y },
          invGroupMatrix
        );
        relativePoint.controlPoint1 = { x: relativeCp1.x, y: relativeCp1.y };
      }

      if (point.controlPoint2) {
        const relativeCp2 = util.transformPoint(
          { x: point.controlPoint2.x, y: point.controlPoint2.y },
          invGroupMatrix
        );
        relativePoint.controlPoint2 = { x: relativeCp2.x, y: relativeCp2.y };
      }

      return relativePoint;
    });

    (newMembraneGroup as any).worldBezierPoints = relativeWorldBezierPoints;
    (newMembraneGroup as any).bezierPoints = relativeWorldBezierPoints;

    // Override toObject for serialization
    const originalToObject = newMembraneGroup.toObject.bind(newMembraneGroup);
    (newMembraneGroup as any).toObject = function(propertiesToInclude?: string[]) {
      return originalToObject([
        ...(propertiesToInclude || []),
        'isMembraneShape',
        'membraneOptions',
        'bezierPoints',
        'worldBezierPoints',
        'isClosed',
        'id'
      ]);
    };

    return newMembraneGroup;
  }

  static async regenerateIcons(
    canvas: FabricCanvas,
    oldMembraneGroup: Group,
    newBezierPoints: BezierPoint[]
  ): Promise<Group> {
    const options = (oldMembraneGroup as any).membraneOptions;
    const isClosed = (oldMembraneGroup as any).isClosed;
    const id = (oldMembraneGroup as any).id;

    // Store old group's position and transform
    const oldLeft = oldMembraneGroup.left;
    const oldTop = oldMembraneGroup.top;
    const oldAngle = oldMembraneGroup.angle;
    const oldScaleX = oldMembraneGroup.scaleX;
    const oldScaleY = oldMembraneGroup.scaleY;


    // Create temporary tool instance to use placeIconsAlongPath
    const tempTool = new MembranePathTool(canvas, options);
    const newIcons = await tempTool.placeIconsAlongPath(newBezierPoints, isClosed);


    // Create a new group with the new icons
    // Don't set position - let Fabric.js calculate it naturally from icon positions
    // The icons are already at world coordinates, so the group will be positioned correctly
    const newMembraneGroup = new Group(newIcons, {
      selectable: true,
      evented: true,
      subTargetCheck: true,
      interactive: true,
      objectCaching: false, // Disable caching to prevent clipping
    });


    // Copy metadata from old group
    (newMembraneGroup as any).isMembraneShape = true;
    (newMembraneGroup as any).membraneOptions = options;
    (newMembraneGroup as any).isClosed = isClosed;
    (newMembraneGroup as any).id = id;

    // Store bezier points in relative space (inverse of new group's transformation)
    const invGroupMatrix = util.invertTransform(newMembraneGroup.calcTransformMatrix());
    const relativeWorldBezierPoints = newBezierPoints.map(point => {
      const relativeAnchor = util.transformPoint(
        { x: point.x, y: point.y },
        invGroupMatrix
      );

      const relativePoint: BezierPoint = {
        x: relativeAnchor.x,
        y: relativeAnchor.y,
        type: point.type,
        id: point.id,
      };

      if (point.controlPoint1) {
        const relativeCp1 = util.transformPoint(
          { x: point.controlPoint1.x, y: point.controlPoint1.y },
          invGroupMatrix
        );
        relativePoint.controlPoint1 = { x: relativeCp1.x, y: relativeCp1.y };
      }

      if (point.controlPoint2) {
        const relativeCp2 = util.transformPoint(
          { x: point.controlPoint2.x, y: point.controlPoint2.y },
          invGroupMatrix
        );
        relativePoint.controlPoint2 = { x: relativeCp2.x, y: relativeCp2.y };
      }

      return relativePoint;
    });

    (newMembraneGroup as any).worldBezierPoints = relativeWorldBezierPoints;
    (newMembraneGroup as any).bezierPoints = relativeWorldBezierPoints;

    // Override toObject for serialization
    const originalToObject = newMembraneGroup.toObject.bind(newMembraneGroup);
    (newMembraneGroup as any).toObject = function(propertiesToInclude?: string[]) {
      return originalToObject([
        ...(propertiesToInclude || []),
        'isMembraneShape',
        'membraneOptions',
        'bezierPoints',
        'worldBezierPoints',
        'isClosed',
        'id'
      ]);
    };

    // Rasterize the regenerated membrane for performance
    const rasterizedMembrane = await MembranePathTool.rasterizeMembrane(newMembraneGroup);

    // Replace old group with new rasterized membrane on canvas
    const wasOnCanvas = canvas.contains(oldMembraneGroup);
    if (wasOnCanvas) {
      canvas.remove(oldMembraneGroup);
      canvas.add(rasterizedMembrane);
      canvas.setActiveObject(rasterizedMembrane);
    }

    rasterizedMembrane.setCoords();
    canvas.requestRenderAll();


    return rasterizedMembrane as any;
  }

  // Static method to clear the icon cache (useful for memory management)
  static clearIconCache(): void {
    MembranePathTool.iconCache.clear();
  }

  // Static method to clear the rasterized icon cache (useful for memory management)
  static clearRasterizedCache(): void {
    MembranePathTool.rasterizedIconCache.clear();
  }

  // Static method to get cache size (for debugging)
  static getCacheSize(): number {
    return MembranePathTool.iconCache.size;
  }

  // Static method to get rasterized cache size (for debugging)
  static getRasterizedCacheSize(): number {
    return MembranePathTool.rasterizedIconCache.size;
  }

  // Rasterize a membrane group into an image for performance
  static async rasterizeMembrane(membraneGroup: Group | FabricImage): Promise<FabricImage> {

    // If already rasterized, return as-is
    if ((membraneGroup as any).isRasterizedMembrane) {
      return membraneGroup as FabricImage;
    }

    // Get the group's bounding box for accurate sizing
    const boundingRect = membraneGroup.getBoundingRect();

    // Store metadata for regeneration on load
    const metadata = {
      isMembraneShape: true,
      membraneOptions: (membraneGroup as any).membraneOptions,
      bezierPoints: (membraneGroup as any).bezierPoints,
      worldBezierPoints: (membraneGroup as any).worldBezierPoints,
      isClosed: (membraneGroup as any).isClosed,
      id: (membraneGroup as any).id,
      // Store original group scales (before display scaling)
      originalScaleX: membraneGroup.scaleX || 1,
      originalScaleY: membraneGroup.scaleY || 1,
    };

    const multiplier = 2;

    // Render group to data URL with high quality
    const dataURL = membraneGroup.toDataURL({
      format: 'png',
      quality: 1,
      multiplier: multiplier, // 2x resolution for crisp rendering
    });

    // Create image from data URL
    const image = await FabricImage.fromURL(dataURL, {
      crossOrigin: 'anonymous',
    });

    // Calculate the scale to match the original visual size
    // toDataURL creates an image at multiplier resolution, so we scale down
    const scale = 1 / multiplier;

    // Set image properties to match the original group exactly
    const imageLeft = boundingRect.left + boundingRect.width / 2;
    const imageTop = boundingRect.top + boundingRect.height / 2;
    const imageScaleX = scale * (membraneGroup.scaleX || 1);
    const imageScaleY = scale * (membraneGroup.scaleY || 1);

    image.set({
      left: imageLeft,
      top: imageTop,
      originX: 'center',
      originY: 'center',
      scaleX: imageScaleX,
      scaleY: imageScaleY,
      angle: membraneGroup.angle || 0,
      selectable: true,
      evented: true,
    });

    // Store metadata on the image
    Object.assign(image, metadata);

    // Mark as rasterized membrane
    (image as any).isRasterizedMembrane = true;

    // Override toObject for serialization
    const originalToObject = image.toObject.bind(image);

    (image as any).toObject = function(this: any, propertiesToInclude?: string[]) {
      const result = originalToObject([
        ...(propertiesToInclude || []),
        'isMembraneShape',
        'membraneOptions',
        'bezierPoints',
        'worldBezierPoints',
        'isClosed',
        'id',
        'originalScaleX',
        'originalScaleY',
        'isRasterizedMembrane',
      ]);

      // When inside a user group, keep the real image src so it survives
      // deserialization (regeneration doesn't work reliably for nested objects).
      // For top-level membranes, use a placeholder to reduce save size —
      // the image is regenerated from worldBezierPoints in runPostLoadGlobalSteps.
      const isInsideUserGroup = this.group && !(this.group as any).isMembraneShape && !(this.group as any).isTripleMembrane;
      if (!isInsideUserGroup) {
        result.src = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRElEQkSuQmCC';
      }
      return result;
    };

    return image;
  }

  // Convert rasterized membrane back to vector group for editing
  static async vectorizeMembrane(canvas: FabricCanvas, rasterizedImage: FabricImage): Promise<Group> {

    const metadata = {
      membraneOptions: (rasterizedImage as any).membraneOptions,
      bezierPoints: (rasterizedImage as any).bezierPoints,
      worldBezierPoints: (rasterizedImage as any).worldBezierPoints,
      isClosed: (rasterizedImage as any).isClosed,
      id: (rasterizedImage as any).id,
      originalScaleX: (rasterizedImage as any).originalScaleX || 1,
      originalScaleY: (rasterizedImage as any).originalScaleY || 1,
    };

    // The stored worldBezierPoints are in relative space (stored with inverted transform)
    // We need to transform them back to world space, but the image's scale includes the display
    // multiplier (0.5), so we need to compensate by creating a matrix with the original scales
    const relativeBezierPoints = metadata.worldBezierPoints || metadata.bezierPoints;

    // Create a transform matrix that matches the original group's transform (before display scaling)
    // Get image position and angle, but use original scales instead of display scales
    const imageBounds = rasterizedImage.getBoundingRect();
    const centerX = imageBounds.left + imageBounds.width / 2;
    const centerY = imageBounds.top + imageBounds.height / 2;

    // Build transform manually with original scales
    const cos = Math.cos((rasterizedImage.angle || 0) * Math.PI / 180);
    const sin = Math.sin((rasterizedImage.angle || 0) * Math.PI / 180);
    const scaleX = metadata.originalScaleX;
    const scaleY = metadata.originalScaleY;

    // Create transform matrix: translate to center, rotate, scale
    const transformMatrix = [
      cos * scaleX,
      sin * scaleX,
      -sin * scaleY,
      cos * scaleY,
      centerX,
      centerY
    ];

    const worldBezierPoints = relativeBezierPoints.map(point => {
      const worldAnchor = util.transformPoint(
        { x: point.x, y: point.y },
        transformMatrix
      );

      const worldPoint: BezierPoint = {
        x: worldAnchor.x,
        y: worldAnchor.y,
        type: point.type,
        id: point.id,
      };

      if (point.controlPoint1) {
        const worldCp1 = util.transformPoint(
          { x: point.controlPoint1.x, y: point.controlPoint1.y },
          transformMatrix
        );
        worldPoint.controlPoint1 = { x: worldCp1.x, y: worldCp1.y };
      }

      if (point.controlPoint2) {
        const worldCp2 = util.transformPoint(
          { x: point.controlPoint2.x, y: point.controlPoint2.y },
          transformMatrix
        );
        worldPoint.controlPoint2 = { x: worldCp2.x, y: worldCp2.y };
      }

      return worldPoint;
    });


    // Reconstruct the membrane using world bezier points - DO NOT rasterize (edit mode needs vector)
    const newGroup = await MembranePathTool.regenerateIconsVector(
      canvas,
      rasterizedImage as any,
      worldBezierPoints
    );

    return newGroup;
  }
}
