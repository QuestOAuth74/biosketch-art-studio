import { useState, useEffect } from "react";
import { Canvas, FabricImage, filters } from "fabric";
import { applyImageFilters as applyImageFiltersUtil } from "@/lib/imageFilters";

/**
 * Hook to manage image tone/tinting properties
 */
export const useImageToneManagement = (
  selectedObject: any,
  canvas: Canvas | null,
  addToRecentColors: (color: string) => void
) => {
  const [imageToneColor, setImageToneColor] = useState("#3b82f6");
  const [imageToneOpacity, setImageToneOpacity] = useState(0.3);

  const handleImageToneChange = (
    color: string,
    opacity: number = imageToneOpacity
  ) => {
    setImageToneColor(color);
    addToRecentColors(color);
    if (
      canvas &&
      selectedObject &&
      (selectedObject.type === "image" || selectedObject instanceof FabricImage)
    ) {
      const imageObj = selectedObject as FabricImage;

      // Get existing filter config
      const existingFilterConfig = (imageObj as any).imageFilters;

      // Clear existing filters
      imageObj.filters = [];

      // Apply blend color filter
      const blendFilter = new filters.BlendColor({
        color: color,
        mode: "tint",
        alpha: opacity,
      });

      imageObj.filters.push(blendFilter);

      // Re-apply image filters if they exist
      if (existingFilterConfig) {
        applyImageFiltersUtil(imageObj, existingFilterConfig);
      } else {
        imageObj.applyFilters();
      }

      canvas.requestRenderAll();
      canvas.fire('object:modified', { target: imageObj });
    }
  };

  const handleImageToneOpacityChange = (opacity: number) => {
    setImageToneOpacity(opacity);
    handleImageToneChange(imageToneColor, opacity);
  };

  const handleRemoveImageTone = () => {
    if (
      canvas &&
      selectedObject &&
      (selectedObject.type === "image" || selectedObject instanceof FabricImage)
    ) {
      const imageObj = selectedObject as FabricImage;
      const existingFilterConfig = (imageObj as any).imageFilters;

      imageObj.filters = [];

      // Re-apply image filters if they exist
      if (existingFilterConfig) {
        applyImageFiltersUtil(imageObj, existingFilterConfig);
      } else {
        imageObj.applyFilters();
      }

      canvas.requestRenderAll();
      canvas.fire('object:modified', { target: imageObj });
      setImageToneOpacity(0.3);
    }
  };

  return {
    imageToneColor,
    imageToneOpacity,
    setImageToneColor,
    setImageToneOpacity,
    handleImageToneChange,
    handleImageToneOpacityChange,
    handleRemoveImageTone,
  };
};
