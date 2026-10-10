import { useEffect } from "react";
import type { Canvas } from "fabric";
import { EraserBrush } from "@erase2d/fabric";

export function useEraserTool(
  canvas: Canvas | null,
  activeTool: string,
  saveState: () => void,
  effectiveReadOnly: boolean
) {
  // Handle eraser tool - using @erase2d/fabric EraserBrush
  useEffect(() => {
    if (!canvas || effectiveReadOnly) return;

    if (activeTool === "eraser") {
      canvas.isDrawingMode = true;
      canvas.selection = false;

      // Use EraserBrush from @erase2d/fabric package
      const eraserBrush = new EraserBrush(canvas);
      eraserBrush.width = 20;
      canvas.freeDrawingBrush = eraserBrush;

      canvas.defaultCursor = "crosshair";
      canvas.hoverCursor = "crosshair";

      // Listen to eraser events for save state and realtime sync
      const handleEraserEnd = () => {
        saveState();
        // Fire a canvas-level event so useCanvasSync can schedule a broadcast.
        // The eraser brush "end" event is brush-scoped; we promote it to a canvas event.
        canvas.fire('erasing:end' as any);
      };

      if (typeof eraserBrush.on === 'function') {
        eraserBrush.on("end", handleEraserEnd);
      }

      return () => {
        // Safely remove event listener if method exists
        if (typeof eraserBrush.off === 'function') {
          eraserBrush.off("end", handleEraserEnd);
        }
        canvas.isDrawingMode = false;
        canvas.selection = true;
        canvas.defaultCursor = "default";
        canvas.hoverCursor = "move";
      };
    }
  }, [canvas, activeTool, saveState, effectiveReadOnly]);
}
