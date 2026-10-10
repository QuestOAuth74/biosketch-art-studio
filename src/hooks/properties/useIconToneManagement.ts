import { useState } from "react";
import { Canvas, Group, FabricObject, FabricImage, filters } from "fabric";

/**
 * Hook to manage icon tone/tinting for SVG groups
 */
export const useIconToneManagement = (
  selectedObject: any,
  canvas: Canvas | null
) => {
  const [iconToneColor, setIconToneColor] = useState("#3b82f6");
  const [iconToneIntensity, setIconToneIntensity] = useState(0.2);

  // Helper to convert hex to HSL
  const hexToHSL = (hex: string): { h: number; s: number; l: number } => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0,
      s = 0,
      l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
          break;
        case g:
          h = ((b - r) / d + 2) / 6;
          break;
        case b:
          h = ((r - g) / d + 4) / 6;
          break;
      }
    }

    return { h: h * 360, s: s * 100, l: l * 100 };
  };

  const handleIconToneChange = (
    color: string,
    intensity: number = iconToneIntensity
  ) => {
    setIconToneColor(color);
    setIconToneIntensity(intensity);

    if (canvas && selectedObject && selectedObject.type === "group") {
      const group = selectedObject as Group;
      const { h } = hexToHSL(color);

      // Apply CSS filter-like effects using custom properties
      (group as any).iconToneColor = color;
      (group as any).iconToneIntensity = intensity;
      (group as any).iconToneHue = h;

      // Apply blend color filter to simulate tone for images
      const blendFilter = new filters.BlendColor({
        color: color,
        mode: "tint",
        alpha: intensity,
      });

      // Store original colors if not already stored
      if (!(group as any).originalColors) {
        const originalColors = new Map();
        const storeColors = (obj: FabricObject, path: string = "") => {
          if (obj.type === "group") {
            (obj as Group)
              .getObjects()
              .forEach((child, idx) => storeColors(child, `${path}/${idx}`));
          } else {
            originalColors.set(path, { fill: obj.fill, stroke: obj.stroke });
          }
        };
        storeColors(group);
        (group as any).originalColors = originalColors;
      }

      const originalColors = (group as any).originalColors as Map<
        string,
        { fill: any; stroke: any }
      >;

      // Blend color helper - always blend from ORIGINAL color
      const blendColor = (
        originalColor: string,
        tintColor: string,
        intensity: number
      ): string => {
        if (
          !originalColor ||
          originalColor === "transparent" ||
          originalColor === "none"
        )
          return originalColor;

        // Handle hex colors
        const origHex = originalColor;
        if (origHex.startsWith("#")) {
          const orig = parseInt(origHex.slice(1), 16);
          const tint = parseInt(tintColor.slice(1), 16);

          const origR = (orig >> 16) & 0xff;
          const origG = (orig >> 8) & 0xff;
          const origB = orig & 0xff;

          const tintR = (tint >> 16) & 0xff;
          const tintG = (tint >> 8) & 0xff;
          const tintB = tint & 0xff;

          const newR = Math.round(origR * (1 - intensity) + tintR * intensity);
          const newG = Math.round(origG * (1 - intensity) + tintG * intensity);
          const newB = Math.round(origB * (1 - intensity) + tintB * intensity);

          return `#${((1 << 24) + (newR << 16) + (newG << 8) + newB)
            .toString(16)
            .slice(1)}`;
        }
        return originalColor;
      };

      // Apply tint to all objects using ORIGINAL colors
      const applyTintToObject = (obj: FabricObject, path: string = "") => {
        if (obj.type === "group") {
          (obj as Group)
            .getObjects()
            .forEach((child, idx) =>
              applyTintToObject(child, `${path}/${idx}`)
            );
        } else if (obj.type === "image" || obj instanceof FabricImage) {
          // For raster images in the group, apply filter
          const imgObj = obj as FabricImage;
          imgObj.filters = [blendFilter];
          imgObj.applyFilters();
        } else {
          // Get ORIGINAL colors from stored map
          const stored = originalColors.get(path);
          if (stored) {
            const originalFill = stored.fill;
            const originalStroke = stored.stroke;

            // Blend from ORIGINAL, not current
            if (
              originalFill &&
              typeof originalFill === "string" &&
              originalFill !== "transparent" &&
              originalFill !== "none"
            ) {
              obj.set({ fill: blendColor(originalFill, color, intensity) });
            }
            if (
              originalStroke &&
              typeof originalStroke === "string" &&
              originalStroke !== "transparent" &&
              originalStroke !== "none"
            ) {
              obj.set({ stroke: blendColor(originalStroke, color, intensity) });
            }
          }
        }
      };

      group
        .getObjects()
        .forEach((child, idx) => applyTintToObject(child, `/${idx}`));
      canvas.requestRenderAll();
      canvas.fire('object:modified', { target: selectedObject });
    }
  };

  const handleIconToneIntensityChange = (intensity: number) => {
    setIconToneIntensity(intensity);
    handleIconToneChange(iconToneColor, intensity);
  };

  const handleRemoveIconTone = () => {
    if (canvas && selectedObject && selectedObject.type === "group") {
      const group = selectedObject as Group;

      // Restore original colors
      if ((group as any).originalColors) {
        const originalColors = (group as any).originalColors as Map<
          string,
          any
        >;

        const restoreColors = (obj: FabricObject, path: string = "") => {
          if (obj.type === "group") {
            (obj as Group)
              .getObjects()
              .forEach((child, idx) => restoreColors(child, `${path}/${idx}`));
          } else {
            const stored = originalColors.get(path);
            if (stored) {
              obj.set({ fill: stored.fill, stroke: stored.stroke });
            }
            // Clear image filters
            if (obj.type === "image" || obj instanceof FabricImage) {
              (obj as FabricImage).filters = [];
              (obj as FabricImage).applyFilters();
            }
          }
        };

        restoreColors(group);
        delete (group as any).originalColors;
        delete (group as any).iconToneColor;
        delete (group as any).iconToneIntensity;
        delete (group as any).iconToneHue;
      }

      canvas.requestRenderAll();
      canvas.fire('object:modified', { target: selectedObject });
      setIconToneIntensity(0.2);
    }
  };

  return {
    iconToneColor,
    iconToneIntensity,
    setIconToneColor,
    setIconToneIntensity,
    handleIconToneChange,
    handleIconToneIntensityChange,
    handleRemoveIconTone,
  };
};
