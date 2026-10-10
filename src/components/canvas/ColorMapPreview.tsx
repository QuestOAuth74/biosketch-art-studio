/**
 * ColorMapPreview component
 * Displays a visual gradient preview of a scientific color map
 */

import { ColorMapDefinition } from "@/lib/scientificColorMaps";
import { useMemo } from "react";

interface ColorMapPreviewProps {
  colorMap: ColorMapDefinition;
  className?: string;
  height?: number;
}

export const ColorMapPreview = ({ colorMap, className = "", height = 20 }: ColorMapPreviewProps) => {
  // Generate CSS gradient from color map
  const gradientStyle = useMemo(() => {
    const colors = colorMap.colors;
    const stops = colors.map((color, index) => {
      const position = (index / (colors.length - 1)) * 100;
      return `${color} ${position}%`;
    }).join(', ');

    return {
      background: `linear-gradient(to right, ${stops})`,
      height: `${height}px`
    };
  }, [colorMap, height]);

  return (
    <div
      className={`rounded ${className}`}
      style={gradientStyle}
      title={colorMap.description}
    />
  );
};
