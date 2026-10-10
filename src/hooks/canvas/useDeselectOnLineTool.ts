import { useEffect } from "react";
import { Canvas } from "fabric";

export function useDeselectOnLineTool(
  canvas: Canvas | null,
  activeTool: string,
) {
  useEffect(() => {
    if (!canvas) return;

    const isLineTool = activeTool.startsWith('straight-line') ||
                       activeTool.startsWith('curved-line') ||
                       activeTool.startsWith('orthogonal-line') ||
                       activeTool === 'bezier' ||
                       activeTool === 'pen';

    if (isLineTool) {
      canvas.discardActiveObject();
      canvas.requestRenderAll();
    }
  }, [canvas, activeTool]);
}
