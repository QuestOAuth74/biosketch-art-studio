// ─── Shared Canvas Data Loader ───────────────────────────────────────────────
// Reconstructs icon/asset references in canvas data and runs post-load
// processing. Used by both the main CanvasContext and the AnimationContext.

import { supabase } from "@/integrations/supabase/client";
import { restoreObjectCustomProps, runPostLoadGlobalSteps } from "./canvasPostProcessing";
import type { Canvas as FabricCanvas } from "fabric";

// ─── Pre-load: Reconstruct references in canvas JSON ────────────────────────

/**
 * Reconstructs `libraryIcon` and `userAsset` references in the raw canvas JSON
 * so that Fabric.js can deserialise them. Mutates `canvasData.objects` in place.
 */
export async function reconstructCanvasReferences(
  canvasData: Record<string, any>,
): Promise<void> {
  if (!canvasData.objects || canvasData.objects.length === 0) return;

  const { loadSVGFromString, util } = await import("fabric");

  const iconSvgCache = new Map<string, string>();
  const assetContentCache = new Map<string, { content: string; mimeType: string }>();

  // ── Icon reconstruction ──────────────────────────────────────────────────

  const reconstructIcon = async (iconObj: any): Promise<boolean> => {
    let svgContent = iconSvgCache.get(iconObj.iconId);

    if (!svgContent) {
      const { data, error } = await supabase
        .from("icons")
        .select("svg_content")
        .eq("id", iconObj.iconId)
        .single();

      if (error || !data?.svg_content) {
        console.error(`Failed to load icon ${iconObj.iconId}:`, error);
        return false;
      }
      svgContent = data.svg_content;
      iconSvgCache.set(iconObj.iconId, svgContent);
    }

    const svgResult = await loadSVGFromString(svgContent, undefined, {
      crossOrigin: "anonymous",
    });
    const tempGroup = util.groupSVGElements(svgResult.objects, svgResult.options);

    const setImageCrossOrigin = (obj: any) => {
      if (obj.type === "image" || obj.type === "Image") {
        obj.set({ crossOrigin: "anonymous" });
      }
      if (obj._objects) obj._objects.forEach((c: any) => setImageCrossOrigin(c));
    };
    setImageCrossOrigin(tempGroup);

    const originalType = iconObj.originalType || "Group";
    const normalizedType = originalType.toLowerCase();

    if (normalizedType === "group") {
      const groupData = tempGroup.toObject();
      iconObj.objects = groupData.objects;
      iconObj.type = originalType;
    } else if (normalizedType === "path" && tempGroup._objects?.[0]) {
      const pathData = tempGroup._objects[0].toObject();
      iconObj.path = pathData.path;
      iconObj.type = originalType;
    } else if (normalizedType === "image") {
      if (tempGroup.type === "image" || tempGroup.type === "Image") {
        const imageData = tempGroup.toObject();
        iconObj.src = imageData.src;
        iconObj.crossOrigin = "anonymous";
        iconObj.type = originalType;
      } else if (tempGroup._objects?.[0]) {
        const imageData = tempGroup._objects[0].toObject();
        iconObj.src = imageData.src;
        iconObj.crossOrigin = "anonymous";
        iconObj.type = originalType;
      } else {
        const groupData = tempGroup.toObject();
        iconObj.objects = groupData.objects;
        iconObj.type = originalType;
      }
    } else {
      const groupData = tempGroup.toObject();
      iconObj.objects = groupData.objects;
      iconObj.type = "Group";
    }

    return true;
  };

  // ── User asset reconstruction ────────────────────────────────────────────

  const reconstructUserAsset = async (assetObj: any): Promise<boolean> => {
    let cached = assetContentCache.get(assetObj.assetId);

    if (!cached) {
      const { data: assetData, error: assetError } = await supabase
        .from("user_assets")
        .select("storage_path, mime_type, file_type")
        .eq("id", assetObj.assetId)
        .single();

      if (assetError || !assetData) {
        console.error(`Failed to load user asset ${assetObj.assetId}:`, assetError);
        return false;
      }

      const { data: fileData, error: downloadError } = await supabase.storage
        .from("user-assets")
        .download(assetData.storage_path);

      if (downloadError || !fileData) {
        console.error(`Failed to download user asset ${assetObj.assetId}:`, downloadError);
        return false;
      }

      let content: string;
      if (assetData.mime_type === "image/svg+xml") {
        content = await fileData.text();
      } else {
        content = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("Failed to read asset file"));
          reader.readAsDataURL(fileData);
        });
      }

      cached = { content, mimeType: assetData.mime_type };
      assetContentCache.set(assetObj.assetId, cached);
    }

    const originalType = assetObj.originalType || "Image";

    if (cached.mimeType === "image/svg+xml") {
      const svgResult = await loadSVGFromString(cached.content, undefined, {
        crossOrigin: "anonymous",
      });
      const tempGroup = util.groupSVGElements(svgResult.objects, svgResult.options);
      const groupData = tempGroup.toObject();
      assetObj.objects = groupData.objects;
      assetObj.type = originalType || "Group";
    } else {
      assetObj.src = cached.content;
      assetObj.crossOrigin = "anonymous";
      assetObj.type = originalType || "Image";
      if (assetObj.colorMapConfig) {
        assetObj.originalImageSrc = cached.content;
      }
    }

    return true;
  };

  // ── Nested icon reconstruction (for membranes) ──────────────────────────

  const reconstructNestedIcons = async (nestedObjects: any[]): Promise<void> => {
    for (const nested of nestedObjects) {
      if (nested.type === "libraryIcon" && nested.iconId) {
        try {
          await reconstructIcon(nested);
        } catch (error) {
          console.error(`Error reconstructing nested icon ${nested.iconId}:`, error);
        }
      }
      if (nested.objects) {
        await reconstructNestedIcons(nested.objects);
      }
    }
  };

  // ── Process all objects (recursively, to handle groups) ─────────────────

  const processObject = async (objData: any) => {
    // Reconstruct nested icons in membrane groups
    if (objData.isMembraneShape && objData.objects) {
      await reconstructNestedIcons(objData.objects);
    }

    // Library icon references
    if (objData.type === "libraryIcon" && objData.iconId) {
      try {
        await reconstructIcon(objData);
      } catch (error) {
        console.error(`Error reconstructing icon ${objData.iconId}:`, error);
      }
    }

    // User asset references
    if (objData.type === "userAsset" && objData.assetId) {
      try {
        const success = await reconstructUserAsset(objData);
        if (success) {
          delete objData._fallbackSrc;
        }
        if (!success) {
          if (objData._fallbackSrc) {
            // Reconstruction failed but we have inline fallback — restore image
            console.warn(`Asset ${objData.assetId} reconstruction failed - using inline fallback`);
            objData.src = objData._fallbackSrc;
            objData.crossOrigin = "anonymous";
            objData.type = objData.originalType || "Image";
            delete objData._fallbackSrc;
          } else {
            // No fallback available - replace with placeholder
            objData.type = "Rect";
            objData.fill = "#f0f0f0";
            objData.stroke = "#cc0000";
            objData.strokeWidth = 2;
            objData.strokeDashArray = [5, 5];
            objData.width = objData.width || 200;
            objData.height = objData.height || 200;
            delete objData.assetId;
            delete objData.isUserAsset;
            delete objData.originalType;
          }
        }
      } catch (error) {
        console.error(`Error reconstructing user asset ${objData.assetId}:`, error);
      }
    }

    // Recurse into group children
    if (objData.type === "group" && objData.objects) {
      for (const child of objData.objects) {
        await processObject(child);
      }
    }
  };

  for (const objData of canvasData.objects) {
    await processObject(objData);
  }
}

// ─── Post-load: Restore custom props & run global steps ─────────────────────

/**
 * After `canvas.loadFromJSON(canvasData)`, call this to restore custom
 * properties on each object and run all global post-load steps (CORS,
 * fonts, membrane rasterisation, etc.).
 */
export async function postProcessLoadedCanvas(
  canvas: FabricCanvas,
  canvasData: Record<string, any>,
): Promise<void> {
  // Remove stray UI elements
  const strayUIElements = canvas.getObjects().filter(
    (obj: any) => obj.isGridLine || obj.isRuler,
  );
  strayUIElements.forEach((obj) => canvas.remove(obj));

  // Restore custom properties from raw data (recursing into groups)
  const restoreRecursive = (objects: FabricObject[], dataArray: any[]) => {
    dataArray.forEach((objData: any, index: number) => {
      const obj = objects[index];
      if (!obj || !objData) return;
      restoreObjectCustomProps(obj, objData);
      // Recurse into group children
      if (obj.type === 'group' && (obj as any)._objects && objData.objects) {
        restoreRecursive((obj as any)._objects, objData.objects);
      }
    });
  };
  if (canvasData.objects) {
    restoreRecursive(canvas.getObjects(), canvasData.objects);
  }

  // Run global reconnection & rasterisation steps
  await runPostLoadGlobalSteps(canvas);

  // Force-invalidate cache on all groups so child images (membranes, etc.)
  // are re-rendered from their fully-decoded image elements
  for (const obj of canvas.getObjects()) {
    if (obj.type === 'group') (obj as any).dirty = true;
  }
  canvas.requestRenderAll();
}
