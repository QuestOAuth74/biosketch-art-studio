import type { Canvas as FabricCanvas, FabricObject } from 'fabric';
import { Shadow } from 'fabric';

const PLACEHOLDER_SRC = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQABNjN9GQAAAABJRElEQkSuQmCC';

/** True when the image has no real rendered content (placeholder or missing src). */
function needsRegeneration(obj: any): boolean {
  if (!obj.src) return true;
  // Exact match
  if (obj.src === PLACEHOLDER_SRC) return true;
  // Fuzzy match: browser may normalize the base64 or the element src
  if (obj.src.startsWith('data:image/png;base64,iVBORw0KGgo')) return true;
  // Check if the loaded image is tiny (1x1 placeholder)
  const el = obj._element || obj.getElement?.();
  if (el && el.naturalWidth <= 1 && el.naturalHeight <= 1) return true;
  return false;
}

/**
 * Restores all custom properties on a single Fabric object after it has been
 * deserialised from JSON (either via canvas.loadFromJSON or util.enlivenObjects).
 *
 * Fabric.js does not automatically restore arbitrary custom properties, so we
 * must copy them from the raw serialised data back onto the live object.
 *
 * This function is the single source of truth for per-object restoration and is
 * used by loadProject, loadSharedProject, loadTemplate, the recovery-state loader,
 * and the real-time sync receive path.
 */
export function restoreObjectCustomProps(
  obj: FabricObject,
  data: Record<string, unknown>,
): void {
  // Restore membrane shape properties FIRST (before bezier paths)
  // Membranes store bezier points but should NOT be marked as isBezierPath
  if (data.isMembraneShape) {
    (obj as any).isMembraneShape = true;
    if (data.membraneOptions) (obj as any).membraneOptions = data.membraneOptions;
    if (data.bezierPoints) (obj as any).bezierPoints = data.bezierPoints;
    if (data.worldBezierPoints) (obj as any).worldBezierPoints = data.worldBezierPoints;
    if (data.isClosed !== undefined) (obj as any).isClosed = data.isClosed;
    if (data.id) (obj as any).id = data.id;
    // Rasterized membranes (FabricImage) also carry isMembraneShape
    if (data.isRasterizedMembrane) (obj as any).isRasterizedMembrane = true;
    if (data.originalScaleX) (obj as any).originalScaleX = data.originalScaleX;
    if (data.originalScaleY) (obj as any).originalScaleY = data.originalScaleY;

    // Vector membrane groups need subTarget selection and caching disabled;
    // rasterized membrane images should keep caching enabled for performance.
    if (obj.type === 'group') {
      obj.set({
        subTargetCheck: true,
        interactive: true,
        objectCaching: false,
      });
    }

    // Ensure all child icons are not selectable/evented (only group is)
    // and apply penumbra shadow indicator for grouped objects
    if (obj.type === 'group' && (obj as any)._objects) {
      (obj as any)._objects.forEach((icon: any) => {
        icon.set({ selectable: false, evented: false });
      });
      obj.set({
        shadow: new Shadow({
          color: 'rgba(59, 130, 246, 0.25)',
          blur: 12,
          offsetX: 0,
          offsetY: 0,
        }),
      });
    }

    // Re-apply toObject override for membrane shapes
    const _toObjectMembrane = obj.toObject.bind(obj);
    (obj as any).toObject = (props?: string[]) =>
      _toObjectMembrane([
        ...(props || []),
        'isMembraneShape',
        'membraneOptions',
        'bezierPoints',
        'worldBezierPoints',
        'isClosed',
        'id',
        'isRasterizedMembrane',
        'originalScaleX',
        'originalScaleY',
      ]);

    // Migration check: legacy membranes with iconSVG but no iconId
    if (
      data.membraneOptions &&
      (data.membraneOptions as any).iconSVG &&
      !(data.membraneOptions as any).iconId
    ) {
      (obj as any).membraneOptions.isLegacy = true;
    }
  }

  // Restore triple membrane properties
  if (data.isTripleMembrane) {
    (obj as any).isTripleMembrane = true;
    if (data.tripleMembraneOptions) (obj as any).tripleMembraneOptions = data.tripleMembraneOptions;
    if (data.bezierPoints) (obj as any).bezierPoints = data.bezierPoints;
    if (data.worldBezierPoints) (obj as any).worldBezierPoints = data.worldBezierPoints;
    if (data.isClosed !== undefined) (obj as any).isClosed = data.isClosed;
    if (data.id) (obj as any).id = data.id;
    if (data.originalScaleX) (obj as any).originalScaleX = data.originalScaleX;
    if (data.originalScaleY) (obj as any).originalScaleY = data.originalScaleY;
    if (data.isRasterizedMembrane) (obj as any).isRasterizedMembrane = true;

    const _toObjectTriple = obj.toObject.bind(obj);
    (obj as any).toObject = (props?: string[]) =>
      _toObjectTriple([
        ...(props || []),
        'isTripleMembrane',
        'tripleMembraneOptions',
        'bezierPoints',
        'worldBezierPoints',
        'isClosed',
        'id',
        'originalScaleX',
        'originalScaleY',
        'isRasterizedMembrane',
      ]);
  // Restore DNA helix properties
  } else if (data.isDNAHelix) {
    (obj as any).isDNAHelix = true;
    if (data.dnaHelixOptions) (obj as any).dnaHelixOptions = data.dnaHelixOptions;
    if (data.bezierPoints) (obj as any).bezierPoints = data.bezierPoints;
    if (data.worldBezierPoints) (obj as any).worldBezierPoints = data.worldBezierPoints;
    if (data.isClosed !== undefined) (obj as any).isClosed = data.isClosed;
    if (data.id) (obj as any).id = data.id;
    if (data.originalScaleX) (obj as any).originalScaleX = data.originalScaleX;
    if (data.originalScaleY) (obj as any).originalScaleY = data.originalScaleY;
    if (data.isRasterizedHelix) (obj as any).isRasterizedHelix = true;

    const _toObjectHelix = obj.toObject.bind(obj);
    (obj as any).toObject = (props?: string[]) =>
      _toObjectHelix([
        ...(props || []),
        'isDNAHelix',
        'dnaHelixOptions',
        'bezierPoints',
        'worldBezierPoints',
        'isClosed',
        'id',
        'originalScaleX',
        'originalScaleY',
        'isRasterizedHelix',
      ]);

  } else if (data.bezierPoints && !data.isMembraneShape && !data.isTripleMembrane && !data.isDNAHelix) {
    // Restore bezier path properties (but NOT for membrane/triple membrane shapes)
    (obj as any).bezierPoints = data.bezierPoints;
    (obj as any).isBezierPath = true;
    (obj as any).bezierPointsAreLocal = data.bezierPointsAreLocal;

    // Re-apply toObject override to ensure properties are serialised on future saves
    const _toObjectBezier = obj.toObject.bind(obj);
    (obj as any).toObject = (props?: string[]) =>
      _toObjectBezier([
        ...(props || []),
        'bezierPoints',
        'bezierPointsAreLocal',
        'isBezierPath',
        'id',
      ]);
  }

  // Restore straight line properties
  if (data.isStraightLine) {
    (obj as any).isStraightLine = true;
    if (data.straightLineStart) (obj as any).straightLineStart = data.straightLineStart;
    if (data.straightLineEnd) (obj as any).straightLineEnd = data.straightLineEnd;
    if (data.straightLineControlPoint)
      (obj as any).straightLineControlPoint = data.straightLineControlPoint;
    if (data.straightLineVersion) (obj as any).straightLineVersion = data.straightLineVersion;
  }

  // Restore curved line properties
  if (data.isCurvedLine) {
    (obj as any).isCurvedLine = true;
    if (data.curvedLineStart) (obj as any).curvedLineStart = data.curvedLineStart;
    if (data.curvedLineEnd) (obj as any).curvedLineEnd = data.curvedLineEnd;
    if (data.curvedLineControlPoint)
      (obj as any).curvedLineControlPoint = data.curvedLineControlPoint;
    if (data.curvedLocalStart) (obj as any).curvedLocalStart = data.curvedLocalStart;
    if (data.curvedLocalEnd) (obj as any).curvedLocalEnd = data.curvedLocalEnd;
    if (data.curvedLocalControl) (obj as any).curvedLocalControl = data.curvedLocalControl;
  }

  // Restore orthogonal line properties
  if (data.isOrthogonalLine) {
    (obj as any).isOrthogonalLine = true;
    if (data.orthogonalLineWaypoints)
      (obj as any).orthogonalLineWaypoints = data.orthogonalLineWaypoints;
    if (data.orthogonalLineLocalWaypoints)
      (obj as any).orthogonalLineLocalWaypoints = data.orthogonalLineLocalWaypoints;
    if (data.orthogonalLineLocalPoints)
      (obj as any).orthogonalLineLocalPoints = data.orthogonalLineLocalPoints;
    if (data.cornerStyle) (obj as any).cornerStyle = data.cornerStyle;
  }

  // Restore freeform line properties
  if (data.isFreeformLine) {
    (obj as any).isFreeformLine = true;
    if (data.originalFreeformPoints) (obj as any).originalFreeformPoints = data.originalFreeformPoints;
    if (data.currentSmoothingStrength !== undefined) (obj as any).currentSmoothingStrength = data.currentSmoothingStrength;
    if (data.startMarker) (obj as any).startMarker = data.startMarker;
    if (data.endMarker) (obj as any).endMarker = data.endMarker;
    if (data.lineThickness !== undefined) (obj as any).lineThickness = data.lineThickness;
    // Ensure freeform paths are interactive after deserialization
    obj.set({ selectable: true, evented: true });
  }

  // Restore endpoint marker types for ALL line types (critical for reconnectLineMarkers)
  if (data.startMarkerType) (obj as any).startMarkerType = data.startMarkerType;
  if (data.endMarkerType) (obj as any).endMarkerType = data.endMarkerType;
  if (data.markerOptions) (obj as any).markerOptions = data.markerOptions;

  // Restore other custom properties
  if (data.isMaskedImage) (obj as any).isMaskedImage = true;
  if (data.isConnector) (obj as any).isConnector = true;

  // Restore crop configuration
  if (data.cropConfig) (obj as any).cropConfig = data.cropConfig;

  // Restore user asset reference properties
  if (data.assetId) (obj as any).assetId = data.assetId;
  if (data.isUserAsset) (obj as any).isUserAsset = true;
  if (data.colorMapConfig) (obj as any).colorMapConfig = data.colorMapConfig;
  if (data.originalImageSrc) (obj as any).originalImageSrc = data.originalImageSrc;

  // Restore reference guide properties (pinned AI reference images)
  // Opacity is preserved from saved data (user-adjustable), not forced to a fixed value.
  if (data.isReferenceGuide) {
    (obj as any).isReferenceGuide = true;
    obj.set({ lockRotation: true });
  }

  // Restore icon reference properties
  if (data.iconId) (obj as any).iconId = data.iconId;
  if (data.isLibraryIcon) (obj as any).isLibraryIcon = true;

  // Restore icon styling properties (tone/tint)
  if (data.iconToneColor) (obj as any).iconToneColor = data.iconToneColor;
  if (data.iconToneIntensity !== undefined) (obj as any).iconToneIntensity = data.iconToneIntensity;
  if (data.iconToneHue !== undefined) (obj as any).iconToneHue = data.iconToneHue;
  if (data.originalColors) {
    // Convert serialised plain object back to Map
    (obj as any).originalColors = new Map(Object.entries(data.originalColors as object));
  }

  // Restore line connection attachments (smart connectors)
  if (data.startAttachment) (obj as any).startAttachment = data.startAttachment;
  if (data.endAttachment) (obj as any).endAttachment = data.endAttachment;

  // Restore pathfinding properties
  if (data.autoPathfindingEnabled !== undefined)
    (obj as any).autoPathfindingEnabled = data.autoPathfindingEnabled;
  if (data.manualPathOverride !== undefined)
    (obj as any).manualPathOverride = data.manualPathOverride;

  // Restore line gradient properties
  if (data.gradientConfig) (obj as any).gradientConfig = data.gradientConfig;
  if (data.gradientOriginalStroke)
    (obj as any).gradientOriginalStroke = data.gradientOriginalStroke;

  // Restore user group flag
  if (data.isUserGroup) {
    (obj as any).isUserGroup = true;
  }

  // Restore table properties
  if (data.customType === 'table') {
    (obj as any).customType = 'table';
    if (data.tableConfig) (obj as any).tableConfig = data.tableConfig;

    if (obj.type === 'group') {
      obj.set({ subTargetCheck: true });

      // Re-mark IText children with cell metadata and sync handlers
      const cfg = (obj as any).tableConfig;
      if (cfg && cfg.cellData) {
        const children = (obj as any)._objects || [];
        let cellIndex = 0;
        for (const child of children) {
          if (child.type === 'i-text') {
            const r = Math.floor(cellIndex / cfg.cols);
            const c = cellIndex % cfg.cols;
            (child as any).isTableCell = true;
            (child as any).cellRow = r;
            (child as any).cellCol = c;
            child.set({ selectable: true, evented: true, hasBorders: false, hasControls: false });
            // Sync edits back to tableConfig.cellData
            child.on('editing:exited', () => {
              if (cfg.cellData && cfg.cellData[r]) {
                cfg.cellData[r][c] = child.text || '';
              }
            });
            cellIndex++;
          }
        }
      }
    }

    const _toObjectTable = obj.toObject.bind(obj);
    (obj as any).toObject = (props?: string[]) =>
      _toObjectTable([...(props || []), 'customType', 'tableConfig']);
  }
}

/**
 * Runs all global post-load reconnection and rasterisation steps on the canvas
 * after objects have been deserialised and per-object custom props restored.
 *
 * This is shared between loadProject, loadSharedProject, loadTemplate, the
 * recovery-state loader, and the real-time sync receive path.
 */
export async function runPostLoadGlobalSteps(canvas: FabricCanvas): Promise<void> {
  // Heal canvases corrupted by the pre-fix copy/paste bug: a serialized
  // ActiveSelection wrapper would round-trip as a stuck selection-rectangle
  // layer with its real children nested inside. Re-parent the children to
  // the canvas (preserving their world transforms) and discard the wrapper.
  const stranded = canvas.getObjects().filter((o: any) =>
    o.type === 'ActiveSelection' || o.type === 'activeSelection'
  );
  for (const wrapper of stranded) {
    const removed = (wrapper as any).removeAll?.() ?? [];
    for (const child of removed) {
      canvas.add(child);
    }
    canvas.remove(wrapper);
  }

  // Fix objects saved with visible:false due to previous culling bug.
  // Older saves may have serialized culled (hidden) objects — force all visible on load.
  canvas.getObjects().forEach((obj: any) => {
    if (!obj.visible && !obj.isGridLine && !obj.isRuler) {
      obj.visible = true;
      obj.dirty = true;
    }
  });

  // Helper: collect all objects recursively (including group children)
  const collectAllObjects = (objects: any[]): { obj: any; parent: any | null }[] => {
    const result: { obj: any; parent: any | null }[] = [];
    for (const obj of objects) {
      result.push({ obj, parent: null });
      if (obj.type === 'group' && obj._objects) {
        for (const child of obj._objects) {
          result.push({ obj: child, parent: obj });
        }
      }
    }
    return result;
  };

  // Re-register all connector attachments with ConnectionSyncManager
  if ((canvas as any).connectionSyncManager) {
    (canvas as any).connectionSyncManager.reloadAllAttachments();
  }

  // Reload images with CORS to prevent canvas tainting
  const { reloadCanvasImagesWithCORS } = await import('@/lib/utils');
  reloadCanvasImagesWithCORS(canvas);

  // Normalise all text fonts to use full font stacks (including text in groups)
  const { normalizeCanvasTextFonts } = await import('@/lib/fontLoader');
  normalizeCanvasTextFonts(canvas);

  // Remove stray endpoint markers (from old saves) and recreate from line properties
  const { reconnectLineMarkers } = await import('@/lib/lineEndpointRenderer');
  reconnectLineMarkers(canvas);

  // Remove transient UI elements by flag and reconnect curved lines
  const { cleanupOrphanHandles, reconnectCurvedLines } = await import('@/lib/curvedLineTool');
  cleanupOrphanHandles(canvas);
  reconnectCurvedLines(canvas);

  // Reconnect all straight lines with their control handles
  const { reconnectStraightLines } = await import('@/lib/straightLineTool');
  reconnectStraightLines(canvas);

  // Re-apply color maps to images that have a saved colorMapConfig
  const { SCIENTIFIC_COLOR_MAPS, interpolateColorMap } = await import('@/lib/scientificColorMaps');
  const { FabricImage } = await import('fabric');
  for (const obj of canvas.getObjects()) {
    const imgObj = obj as any;
    if (!imgObj.colorMapConfig || !(obj instanceof FabricImage)) continue;

    const config = imgObj.colorMapConfig;
    const colorMap = SCIENTIFIC_COLOR_MAPS[config.mapName];
    if (!colorMap) continue;

    // Need the original (un-mapped) image as source
    const origSrc: string | undefined = imgObj.originalImageSrc || imgObj.getSrc?.();
    if (!origSrc) continue;

    try {
      const originalImg = new Image();
      originalImg.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        originalImg.onload = () => resolve();
        originalImg.onerror = () => reject(new Error('Failed to load image for color map'));
        originalImg.src = origSrc;
      });

      const offscreen = document.createElement('canvas');
      offscreen.width = originalImg.width;
      offscreen.height = originalImg.height;
      const ctx = offscreen.getContext('2d');
      if (!ctx) continue;

      ctx.drawImage(originalImg, 0, 0);
      const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
      const data = imageData.data;

      // Build lookup table
      const lut = new Array(256);
      for (let i = 0; i < 256; i++) {
        const hex = interpolateColorMap(colorMap, i / 255);
        lut[i] = {
          r: parseInt(hex.slice(1, 3), 16),
          g: parseInt(hex.slice(3, 5), 16),
          b: parseInt(hex.slice(5, 7), 16),
        };
      }

      const intensityValue = config.intensity ?? 1;
      for (let i = 0; i < data.length; i += 4) {
        const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
        const mapped = lut[gray];
        if (intensityValue < 1.0) {
          data[i]     = Math.round(data[i]     * (1 - intensityValue) + mapped.r * intensityValue);
          data[i + 1] = Math.round(data[i + 1] * (1 - intensityValue) + mapped.g * intensityValue);
          data[i + 2] = Math.round(data[i + 2] * (1 - intensityValue) + mapped.b * intensityValue);
        } else {
          data[i] = mapped.r;
          data[i + 1] = mapped.g;
          data[i + 2] = mapped.b;
        }
      }

      ctx.putImageData(imageData, 0, 0);
      const mappedImg = new Image();
      mappedImg.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        mappedImg.onload = () => resolve();
        mappedImg.onerror = () => reject(new Error('Failed to create color-mapped image'));
        mappedImg.src = offscreen.toDataURL();
      });

      // Preserve properties across setElement
      const props = {
        left: imgObj.left, top: imgObj.top,
        scaleX: imgObj.scaleX, scaleY: imgObj.scaleY,
        angle: imgObj.angle, flipX: imgObj.flipX, flipY: imgObj.flipY,
        opacity: imgObj.opacity, filters: imgObj.filters,
        clipPath: imgObj.clipPath, strokeWidth: imgObj.strokeWidth, stroke: imgObj.stroke,
      };

      imgObj.setElement(mappedImg);
      imgObj.set(props);
      // Explicitly invalidate cache (required when clipPath/crop is present)
      imgObj.dirty = true;
      if (imgObj.clipPath) imgObj.clipPath.dirty = true;
      imgObj.setCoords();
    } catch (e) {
      console.error('[postProcess] Failed to re-apply color map:', e);
    }
  }

  // Rasterise all membrane shapes for performance
  // (For the sync receive path this is a no-op since membranes arrive with their src already set)
  // Searches both top-level objects and group children.
  const { MembranePathTool } = await import('@/lib/membranePathTool');
  const { Group: FabricGroup } = await import('fabric');
  const allWithParent = collectAllObjects(canvas.getObjects());
  const membraneEntries = allWithParent.filter(({ obj }) => (obj as any).isMembraneShape);

  // Helper to replace an object either on the canvas or inside its parent group
  const replaceObject = (original: any, replacement: any, parent: any | null) => {
    if (parent && parent._objects) {
      const idx = parent._objects.indexOf(original);
      if (idx >= 0) {
        // Preserve group-local coordinates from the original
        replacement.set({
          left: original.left,
          top: original.top,
          originX: original.originX,
          originY: original.originY,
          angle: original.angle || 0,
        });
        parent._objects[idx] = replacement;
        replacement.group = parent;
        replacement.setCoords();
        parent.dirty = true;
      }
    } else {
      const originalIndex = canvas.getObjects().indexOf(original);
      canvas.remove(original);
      canvas.insertAt(originalIndex, replacement);
    }
  };

  // Process vector membranes (not yet rasterised) — skip those inside groups
  for (const { obj: m, parent } of membraneEntries.filter(({ obj }) => !(obj as any).isRasterizedMembrane)) {
    if (parent) continue; // vector membranes render fine inside groups, skip rasterization
    try {
      const savedClipPath = m.clipPath;
      const rasterized = await MembranePathTool.rasterizeMembrane(m as any);
      if (savedClipPath) {
        rasterized.clipPath = savedClipPath;
        rasterized.dirty = true;
      }
      replaceObject(m, rasterized, parent);
    } catch (e) {
      console.error('[postProcess] Failed to rasterize vector membrane:', e);
    }
  }

  // Process rasterised membranes that are missing their src
  // (saved without src to reduce save size; regenerate from stored path data)
  for (const { obj: m, parent } of membraneEntries.filter(({ obj }) => (obj as any).isRasterizedMembrane && needsRegeneration(obj))) {
    try {
      const {
        membraneOptions: opts,
        worldBezierPoints: pts,
        isClosed: closed,
        bezierPoints,
        id,
        originalScaleX,
        originalScaleY,
      } = m as any;

      if (!opts || !pts) continue;

      // Save eraser clipPath before reconstruction so it can be reapplied
      const savedClipPath = m.clipPath;

      const tool = new MembranePathTool(canvas, opts);
      const icons = await tool.placeIconsAlongPath(pts, closed);

      const grp = new FabricGroup(icons, {
        left: m.left,
        top: m.top,
        angle: m.angle,
        scaleX: originalScaleX || 1,
        scaleY: originalScaleY || 1,
        originX: m.originX,
        originY: m.originY,
      });

      (grp as any).isMembraneShape = true;
      (grp as any).membraneOptions = opts;
      (grp as any).worldBezierPoints = pts;
      (grp as any).bezierPoints = bezierPoints || pts;
      (grp as any).isClosed = closed;
      (grp as any).id = id;

      if (parent) {
        // For membranes inside groups: render to image and update the existing
        // FabricImage element in-place (avoids coordinate mismatch from replacement)
        const multiplier = 2;
        const dataURL = grp.toDataURL({ format: 'png', quality: 1, multiplier });
        const imgEl = new Image();
        imgEl.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          imgEl.onload = () => resolve();
          imgEl.onerror = () => reject(new Error('Failed to load regenerated membrane'));
          imgEl.src = dataURL;
        });
        (m as any).setElement(imgEl);
        m.set({ dirty: true } as any);
        if (savedClipPath) {
          m.clipPath = savedClipPath;
          (savedClipPath as any).dirty = true;
        }
        if (parent.dirty !== undefined) parent.dirty = true;
      } else {
        const rasterized = await MembranePathTool.rasterizeMembrane(grp);
        if (savedClipPath) {
          rasterized.clipPath = savedClipPath;
          rasterized.dirty = true;
        }
        replaceObject(m, rasterized, parent);
      }
    } catch (e) {
      console.error('[postProcess] Failed to regenerate membrane from path:', e);
    }
  }

  // Rasterise all triple membrane shapes (including those inside groups)
  const { TripleMembranePathTool } = await import('@/lib/tripleMembranePathTool');
  const tripleMembraneEntries = collectAllObjects(canvas.getObjects()).filter(({ obj }) => (obj as any).isTripleMembrane);

  // Process vector triple membranes (not yet rasterised) — skip those inside groups
  for (const { obj: m, parent } of tripleMembraneEntries.filter(({ obj }) => !(obj as any).isRasterizedMembrane)) {
    if (parent) continue; // vector membranes render fine inside groups
    try {
      const savedClipPath = m.clipPath;
      const rasterized = await TripleMembranePathTool.rasterizeMembrane(m as any);
      if (savedClipPath) {
        rasterized.clipPath = savedClipPath;
        rasterized.dirty = true;
      }
      replaceObject(m, rasterized, parent);
    } catch (e) {
      console.error('[postProcess] Failed to rasterize vector triple membrane:', e);
    }
  }

  // Process rasterised triple membranes missing their src
  for (const { obj: m, parent } of tripleMembraneEntries.filter(({ obj }) => (obj as any).isRasterizedMembrane && needsRegeneration(obj))) {
    try {
      const {
        tripleMembraneOptions: opts,
        worldBezierPoints: pts,
        isClosed: closed,
        bezierPoints,
        id,
        originalScaleX,
        originalScaleY,
      } = m as any;

      if (!opts || !pts) continue;

      const savedClipPath = m.clipPath;
      const tool = new TripleMembranePathTool(canvas, opts);
      const bands = tool.generateBands(pts, closed);

      const grp = new FabricGroup(bands, {
        left: m.left,
        top: m.top,
        angle: m.angle,
        scaleX: originalScaleX || 1,
        scaleY: originalScaleY || 1,
        originX: m.originX,
        originY: m.originY,
      });

      (grp as any).isTripleMembrane = true;
      (grp as any).tripleMembraneOptions = opts;
      (grp as any).worldBezierPoints = pts;
      (grp as any).bezierPoints = bezierPoints || pts;
      (grp as any).isClosed = closed;
      (grp as any).id = id;

      if (parent) {
        // For membranes inside groups: render to image and update the existing
        // FabricImage element in-place (avoids coordinate mismatch from replacement)
        const multiplier = 2;
        const dataURL = grp.toDataURL({ format: 'png', quality: 1, multiplier });
        const imgEl = new Image();
        imgEl.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          imgEl.onload = () => resolve();
          imgEl.onerror = () => reject(new Error('Failed to load regenerated triple membrane'));
          imgEl.src = dataURL;
        });
        (m as any).setElement(imgEl);
        m.set({ dirty: true } as any);
        if (savedClipPath) {
          m.clipPath = savedClipPath;
          (savedClipPath as any).dirty = true;
        }
        if (parent.dirty !== undefined) parent.dirty = true;
      } else {
        const rasterized = await TripleMembranePathTool.rasterizeMembrane(grp);
        if (savedClipPath) {
          rasterized.clipPath = savedClipPath;
          rasterized.dirty = true;
        }
        replaceObject(m, rasterized, parent);
      }
    } catch (e) {
      console.error('[postProcess] Failed to regenerate triple membrane from path:', e);
    }
  }

  // Rasterise all DNA helix shapes (including those inside groups)
  const { DNAHelixTool } = await import('@/lib/dnaHelixTool');
  const dnaHelixEntries = collectAllObjects(canvas.getObjects()).filter(({ obj }) => (obj as any).isDNAHelix);

  // Process vector DNA helices (not yet rasterised) — skip those inside groups
  for (const { obj: m, parent } of dnaHelixEntries.filter(({ obj }) => !(obj as any).isRasterizedHelix)) {
    if (parent) continue; // vector helices render fine inside groups
    try {
      const savedClipPath = m.clipPath;
      const rasterized = await DNAHelixTool.rasterizeHelix(m as any);
      if (savedClipPath) {
        rasterized.clipPath = savedClipPath;
        rasterized.dirty = true;
      }
      replaceObject(m, rasterized, parent);
    } catch (e) {
      console.error('[postProcess] Failed to rasterize vector DNA helix:', e);
    }
  }

  // Process rasterised DNA helices missing their src
  for (const { obj: m, parent } of dnaHelixEntries.filter(({ obj }) => (obj as any).isRasterizedHelix && needsRegeneration(obj))) {
    try {
      const {
        dnaHelixOptions: opts,
        worldBezierPoints: pts,
        isClosed: closed,
        bezierPoints,
        id,
        originalScaleX,
        originalScaleY,
      } = m as any;

      if (!opts || !pts) continue;

      const savedClipPath = m.clipPath;
      const tool = new DNAHelixTool(canvas, opts);
      const helixPaths = tool.generateHelix(pts, closed);

      const grp = new FabricGroup(helixPaths, {
        left: m.left,
        top: m.top,
        angle: m.angle,
        scaleX: originalScaleX || 1,
        scaleY: originalScaleY || 1,
        originX: m.originX,
        originY: m.originY,
      });

      (grp as any).isDNAHelix = true;
      (grp as any).dnaHelixOptions = opts;
      (grp as any).worldBezierPoints = pts;
      (grp as any).bezierPoints = bezierPoints || pts;
      (grp as any).isClosed = closed;
      (grp as any).id = id;

      if (parent) {
        // For helices inside groups: render to image and update in-place
        const multiplier = 2;
        const dataURL = grp.toDataURL({ format: 'png', quality: 1, multiplier });
        const imgEl = new Image();
        imgEl.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          imgEl.onload = () => resolve();
          imgEl.onerror = () => reject(new Error('Failed to load regenerated helix'));
          imgEl.src = dataURL;
        });
        (m as any).setElement(imgEl);
        m.set({ dirty: true } as any);
        if (savedClipPath) {
          m.clipPath = savedClipPath;
          (savedClipPath as any).dirty = true;
        }
        if (parent.dirty !== undefined) parent.dirty = true;
      } else {
        const rasterized = await DNAHelixTool.rasterizeHelix(grp);
        if (savedClipPath) {
          rasterized.clipPath = savedClipPath;
          rasterized.dirty = true;
        }
        replaceObject(m, rasterized, parent);
      }
    } catch (e) {
      console.error('[postProcess] Failed to regenerate DNA helix from path:', e);
    }
  }

  // Final pass: await image decode on all objects so group caches are valid.
  // Without this, groups containing <image> elements render blank because
  // the image pixels haven't loaded when Fabric caches the group.
  const decodePromises: Promise<void>[] = [];
  for (const obj of canvas.getObjects()) {
    const collectDecodes = (o: any) => {
      if ((o.type === 'image' || o.type === 'Image') && o._element?.decode) {
        decodePromises.push(
          (o._element as HTMLImageElement).decode().then(() => {
            o.dirty = true;
          }).catch(() => {})
        );
      }
      if (o._objects) {
        for (const child of o._objects) collectDecodes(child);
      }
    };
    collectDecodes(obj);
  }
  if (decodePromises.length > 0) {
    await Promise.all(decodePromises);
    // Invalidate all group caches after decoding
    for (const obj of canvas.getObjects()) {
      if (obj.type === 'group') (obj as any).dirty = true;
    }
  }
}
