import { useState, useEffect } from "react";
import { Canvas, Textbox } from "fabric";
import { ensureFontLoaded, getCanvasFontFamily, getBaseFontName } from "@/lib/fontLoader";
import { toast } from "sonner";

/**
 * Hook to manage text properties (font, size, color) for selected text objects
 */
export const useTextProperties = (
  selectedObject: any,
  canvas: Canvas | null,
  addToRecentColors: (color: string) => void,
  getTextObject: (obj: any) => Textbox | null
) => {
  const [textFont, setTextFont] = useState("Inter");
  const [textSize, setTextSize] = useState(24);
  const [textColor, setTextColor] = useState("#000000");

  // Update text properties when selected object changes
  useEffect(() => {
    const textObj = getTextObject(selectedObject);
    if (textObj) {
      setTextFont(getBaseFontName(textObj.fontFamily));
      setTextSize(textObj.fontSize || 24);
      setTextColor((textObj.fill as string) || "#000000");
    }
  }, [selectedObject, getTextObject]);

  const handleFontChange = async (font: string) => {
    const loaded = await ensureFontLoaded(font);
    if (!loaded) {
      toast.error(`Font "${font}" failed to load`);
      return;
    }

    const canvasFont = getCanvasFontFamily(font);
    setTextFont(font);

    const textObj = getTextObject(selectedObject);
    if (canvas && textObj) {
      textObj.set({ fontFamily: canvasFont });
      canvas.requestRenderAll();
    }
  };

  const handleTextSizeChange = (size: string) => {
    const numSize = parseInt(size);
    if (!isNaN(numSize)) {
      setTextSize(numSize);
      const textObj = getTextObject(selectedObject);
      if (canvas && textObj) {
        textObj.set({ fontSize: numSize });
        canvas.requestRenderAll();
      }
    }
  };

  const handleTextColorChange = (color: string) => {
    setTextColor(color);
    addToRecentColors(color);
    const textObj = getTextObject(selectedObject);
    if (canvas && textObj) {
      textObj.set({ fill: color });
      canvas.requestRenderAll();
    }
  };

  return {
    textFont,
    textSize,
    textColor,
    setTextFont,
    setTextSize,
    setTextColor,
    handleFontChange,
    handleTextSizeChange,
    handleTextColorChange,
  };
};
