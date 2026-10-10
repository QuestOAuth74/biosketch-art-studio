import { Canvas as FabricCanvas } from "fabric";
import { supabase } from "@/integrations/supabase/client";
import { reloadCanvasImagesWithCORS } from "@/lib/utils";
import { restoreObjectCustomProps, runPostLoadGlobalSteps } from "@/lib/canvasPostProcessing";

// Helper function to safely encode SVG to base64 with unicode support
const svgToBase64 = (svgContent: string): string => {
  try {
    // Use TextEncoder to handle unicode properly
    const encoder = new TextEncoder();
    const data = encoder.encode(svgContent);
    let binary = '';
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i]);
    }
    return btoa(binary);
  } catch (error) {
    // Fallback: URL encode the SVG instead
    return encodeURIComponent(svgContent);
  }
};

export async function generateIconThumbnail(svgContent: string): Promise<string> {
  try {
    // For icons, create a simple thumbnail by converting SVG to data URL
    const blob = new Blob([svgContent], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 200;
        canvas.height = 200;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, 200, 200);
          
          // Calculate scaling to fit within canvas while maintaining aspect ratio
          const scale = Math.min(180 / img.width, 180 / img.height);
          const x = (200 - img.width * scale) / 2;
          const y = (200 - img.height * scale) / 2;
          
          ctx.drawImage(img, x, y, img.width * scale, img.height * scale);
        }
        
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(url);
        // Return a simple data URL as fallback
        const base64 = svgToBase64(svgContent);
        resolve(`data:image/svg+xml;base64,${base64}`);
      };
      
      img.src = url;
    });
  } catch (error) {
    console.error('Error generating icon thumbnail:', error);
    const base64 = svgToBase64(svgContent);
    return `data:image/svg+xml;base64,${base64}`;
  }
}

export async function generateProjectThumbnail(
  canvasData: any,
  canvasWidth: number,
  canvasHeight: number,
  projectId: string,
  userId: string
): Promise<string | null> {
  try {
    // Icon-by-reference: Reconstruct icons from references before loading
    if (canvasData.objects && canvasData.objects.length > 0) {
      const { loadSVGFromString, util } = await import('fabric');

      // Helper to recursively reconstruct nested icons
      const reconstructNestedIcons = async (nestedObjects: any[]) => {
        if (!nestedObjects || !Array.isArray(nestedObjects)) return;

        for (const nested of nestedObjects) {
          if (nested.type === 'libraryIcon' && nested.iconId) {
            try {
              const { data: iconData } = await supabase
                .from('icons')
                .select('svg_content')
                .eq('id', nested.iconId)
                .single();

              if (iconData?.svg_content) {
                const svgResult = await loadSVGFromString(iconData.svg_content, undefined, {
                  crossOrigin: 'anonymous'
                });
                const tempGroup = util.groupSVGElements(svgResult.objects, svgResult.options);

                const originalType = nested.originalType || 'Group';
                const normalizedType = originalType.toLowerCase();

                if (normalizedType === 'group') {
                  nested.objects = tempGroup.toObject().objects;
                  nested.type = originalType;
                } else if (normalizedType === 'path' && tempGroup._objects && tempGroup._objects[0]) {
                  const pathData = tempGroup._objects[0].toObject();
                  nested.path = pathData.path;
                  nested.type = originalType;
                } else if (normalizedType === 'image') {
                  if (tempGroup.type === 'image' || tempGroup.type === 'Image') {
                    const imageData = tempGroup.toObject();
                    nested.src = imageData.src;
                    nested.crossOrigin = 'anonymous';
                    nested.type = originalType;
                  } else if (tempGroup._objects && tempGroup._objects[0]) {
                    const imageData = tempGroup._objects[0].toObject();
                    nested.src = imageData.src;
                    nested.crossOrigin = 'anonymous';
                    nested.type = originalType;
                  }
                } else {
                  nested.objects = tempGroup.toObject().objects;
                  nested.type = originalType;
                }

                delete nested.iconId;
                delete nested.isLibraryIcon;
              }
            } catch (error) {
              console.error(`Failed to load nested icon ${nested.iconId}:`, error);
            }
          } else if (nested.objects) {
            // Recursively process deeper nesting
            await reconstructNestedIcons(nested.objects);
          }
        }
      };

      for (const objData of canvasData.objects) {
        // Process membrane groups and rasterized membranes
        if (objData.isMembraneShape && objData.objects) {
          await reconstructNestedIcons(objData.objects);
        }
        if (objData.isRasterizedMembrane && objData.vectorObjects && objData.vectorObjects.objects) {
          await reconstructNestedIcons(objData.vectorObjects.objects);
        }

        // Process top-level library icons (type is 'libraryIcon' in saved data)
        if (objData.type === 'libraryIcon' && objData.iconId) {
          try {
            const { data: iconData } = await supabase
              .from('icons')
              .select('svg_content')
              .eq('id', objData.iconId)
              .single();

            if (!iconData?.svg_content) continue;

            const svgResult = await loadSVGFromString(iconData.svg_content, undefined, {
              crossOrigin: 'anonymous'
            });
            const tempGroup = util.groupSVGElements(svgResult.objects, svgResult.options);

            const originalType = objData.originalType || 'Group';
            const normalizedType = originalType.toLowerCase();

            if (normalizedType === 'group') {
              const groupData = tempGroup.toObject();
              objData.objects = groupData.objects;
              objData.type = originalType;
            } else if (normalizedType === 'path' && tempGroup._objects && tempGroup._objects[0]) {
              const pathData = tempGroup._objects[0].toObject();
              objData.path = pathData.path;
              objData.type = originalType;
            } else if (normalizedType === 'image') {
              // Image icons can be returned directly as Image objects or wrapped in a Group
              if (tempGroup.type === 'image' || tempGroup.type === 'Image') {
                // tempGroup is directly an Image object
                const imageData = tempGroup.toObject();
                objData.src = imageData.src;
                objData.crossOrigin = 'anonymous';
                objData.type = originalType;
              } else if (tempGroup._objects && tempGroup._objects[0]) {
                // tempGroup is a Group containing an Image
                const imageData = tempGroup._objects[0].toObject();
                objData.src = imageData.src;
                objData.crossOrigin = 'anonymous';
                objData.type = originalType;
              } else {
                // Fallback to group
                const groupData = tempGroup.toObject();
                objData.objects = groupData.objects;
                objData.type = originalType;
              }
            } else {
              // Fallback to group
              const groupData = tempGroup.toObject();
              objData.objects = groupData.objects;
              objData.type = originalType;
            }

            // Remove the iconId marker since we've reconstructed the icon
            delete objData.iconId;
            delete objData.isLibraryIcon;
          } catch (error) {
            console.error(`Failed to load icon ${objData.iconId}:`, error);
          }
        }
      }

      // Asset-by-reference: Reconstruct user assets from storage
      for (const objData of canvasData.objects) {
        if (objData.type === 'userAsset' && objData.assetId) {
          try {
            // Look up asset metadata
            const { data: assetData } = await supabase
              .from('user_assets')
              .select('storage_path, mime_type')
              .eq('id', objData.assetId)
              .single();

            if (!assetData) continue;

            // Download content from storage
            const { data: fileData } = await supabase.storage
              .from('user-assets')
              .download(assetData.storage_path);

            if (!fileData) continue;

            const originalType = objData.originalType || 'Image';

            if (assetData.mime_type === 'image/svg+xml') {
              // SVG asset
              const svgContent = await fileData.text();
              const svgResult = await loadSVGFromString(svgContent, undefined, {
                crossOrigin: 'anonymous'
              });
              const tempGroup = util.groupSVGElements(svgResult.objects, svgResult.options);
              const groupData = tempGroup.toObject();
              objData.objects = groupData.objects;
              objData.type = originalType;
            } else {
              // Raster asset (PNG/JPG) - convert to data URL
              const content = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result as string);
                reader.onerror = () => reject(new Error('Failed to read asset'));
                reader.readAsDataURL(fileData);
              });
              objData.src = content;
              objData.crossOrigin = 'anonymous';
              objData.type = originalType;
            }

            delete objData.assetId;
            delete objData.isUserAsset;
          } catch (error) {
            console.error(`Failed to load user asset ${objData.assetId}:`, error);
          }
        }
      }
    }

    // Create a temporary canvas for thumbnail generation
    const tempCanvas = new FabricCanvas(null, {
      width: canvasWidth,
      height: canvasHeight,
    });

    // Keep a copy of the raw object data for custom property restoration
    const rawObjects = canvasData.objects ? [...canvasData.objects] : [];

    // Load the canvas data
    await tempCanvas.loadFromJSON(canvasData);

    // Restore custom properties (colorMapConfig, etc.) that Fabric doesn't auto-restore
    if (rawObjects.length > 0) {
      const loadedObjects = tempCanvas.getObjects();
      rawObjects.forEach((objData: any, index: number) => {
        const obj = loadedObjects[index];
        if (obj && objData) restoreObjectCustomProps(obj, objData);
      });
    }

    // Run all post-load steps (CORS reload, color maps, font normalization, etc.)
    await runPostLoadGlobalSteps(tempCanvas);

    // Regenerate rasterized membranes (they don't have src saved)
    // Exclude triple membranes - they are handled by runPostLoadGlobalSteps above
    const membraneObjects = tempCanvas.getObjects().filter((obj: any) => (obj.isMembraneShape || obj.isRasterizedMembrane) && !obj.isTripleMembrane && !obj.isDNAHelix);
    const rasterizedMembranes = membraneObjects.filter((obj: any) => obj.isRasterizedMembrane && !(obj as any).src);

    if (rasterizedMembranes.length > 0) {
      const { MembranePathTool } = await import('@/lib/membranePathTool');
      const { Group: FabricGroup } = await import('fabric');

      for (const rasterizedMembrane of rasterizedMembranes) {
        try {
          const membraneOptions = (rasterizedMembrane as any).membraneOptions;
          const worldBezierPoints = (rasterizedMembrane as any).worldBezierPoints;
          const isClosed = (rasterizedMembrane as any).isClosed;

          if (!membraneOptions || !worldBezierPoints) {
            console.warn('[Thumbnail] Missing membrane options or bezier points');
            continue;
          }

          const tempTool = new MembranePathTool(tempCanvas as any, membraneOptions);
          const regeneratedIcons = await tempTool.placeIconsAlongPath(worldBezierPoints, isClosed);

          const vectorGroup = new FabricGroup(regeneratedIcons, {
            left: rasterizedMembrane.left,
            top: rasterizedMembrane.top,
            angle: rasterizedMembrane.angle,
            scaleX: (rasterizedMembrane as any).originalScaleX || 1,
            scaleY: (rasterizedMembrane as any).originalScaleY || 1,
            originX: rasterizedMembrane.originX,
            originY: rasterizedMembrane.originY,
          });

          // Copy metadata
          (vectorGroup as any).isMembraneShape = true;
          (vectorGroup as any).membraneOptions = membraneOptions;
          (vectorGroup as any).worldBezierPoints = worldBezierPoints;
          (vectorGroup as any).bezierPoints = (rasterizedMembrane as any).bezierPoints || worldBezierPoints;
          (vectorGroup as any).isClosed = isClosed;
          (vectorGroup as any).id = (rasterizedMembrane as any).id;

          const newRasterized = await MembranePathTool.rasterizeMembrane(vectorGroup);
          const originalIndex = tempCanvas.getObjects().indexOf(rasterizedMembrane);
          tempCanvas.remove(rasterizedMembrane);
          tempCanvas.insertAt(originalIndex, newRasterized);
        } catch (error) {
          console.error('[Thumbnail] Failed to regenerate membrane:', error);
        }
      }
    }

    // Always set a white background for thumbnails — JPEG has no transparency support.
    // This also overrides any grid Pattern that may have been serialized as backgroundColor.
    tempCanvas.backgroundColor = '#ffffff';

    // Attach after:render handler so gradient lines are drawn on the correct
    // canvas context (including the export context used by toDataURL).
    const { drawAllLineGradients } = await import('@/lib/lineGradientRenderer');
    const afterRenderHandler = (e: any) => {
      drawAllLineGradients(tempCanvas, undefined, e.ctx);
    };
    tempCanvas.on('after:render', afterRenderHandler);

    tempCanvas.renderAll(); // Must be synchronous — toDataURL() reads pixels immediately after

    // Calculate thumbnail dimensions (max 800x600, maintain aspect ratio)
    const maxWidth = 800;
    const maxHeight = 600;
    const scale = Math.min(
      maxWidth / canvasWidth,
      maxHeight / canvasHeight,
      1 // Don't scale up
    );

    const thumbnailWidth = Math.floor(canvasWidth * scale);
    const thumbnailHeight = Math.floor(canvasHeight * scale);

    // Generate thumbnail as data URL
    const dataUrl = tempCanvas.toDataURL({
      format: 'jpeg',
      quality: 0.8,
      multiplier: scale,
    });

    // Remove handler
    tempCanvas.off('after:render', afterRenderHandler);

    // Convert data URL to blob
    const response = await fetch(dataUrl);
    const blob = await response.blob();

    // Upload to Supabase Storage
    const fileName = `${userId}/${projectId}-${Date.now()}.jpg`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('project-thumbnails')
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('Error uploading thumbnail:', uploadError);
      return null;
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('project-thumbnails')
      .getPublicUrl(uploadData.path);

    // Cleanup
    tempCanvas.dispose();

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error generating thumbnail:', error);
    return null;
  }
}
