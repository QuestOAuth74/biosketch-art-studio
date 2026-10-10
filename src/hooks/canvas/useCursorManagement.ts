import { useEffect } from "react";
import type { Canvas } from "fabric";

/**
 * Hook #2: Updates canvas cursor based on the active tool.
 * Extracted from FabricCanvas.tsx lines 4947-4969.
 */
export function useCursorManagement(canvas: Canvas | null, activeTool: string, effectiveReadOnly: boolean) {
  useEffect(() => {
    if (!canvas) return;

    if (effectiveReadOnly) {
      canvas.defaultCursor = 'not-allowed';
      canvas.hoverCursor = 'not-allowed';
      return;
    }

    if (activeTool === "text") {
      canvas.defaultCursor = "text";
      canvas.hoverCursor = "text";
    } else if (activeTool === "freeform-line") {
      canvas.defaultCursor = "crosshair";
      canvas.hoverCursor = "crosshair";
    } else if (activeTool === "pen") {
      canvas.defaultCursor = "crosshair";
      canvas.hoverCursor = "crosshair";
    } else if (activeTool === "eraser") {
      canvas.defaultCursor = "crosshair";
      canvas.hoverCursor = "crosshair";
    } else if (
      activeTool.startsWith('connector-') ||
      activeTool.startsWith('line-') ||
      activeTool.startsWith('straight-line') ||
      activeTool.startsWith('orthogonal-line') ||
      activeTool.startsWith('curved-line') ||
      activeTool.startsWith('membrane-brush') ||
      activeTool === 'membrane-path' ||
      activeTool === 'triple-membrane' ||
      activeTool === 'dna-helix' ||
      activeTool === 'chart' ||
      activeTool === 'table' ||
      activeTool === 'leader-line' ||
      activeTool === 'bracket'
    ) {
      canvas.defaultCursor = "crosshair";
      canvas.hoverCursor = "crosshair";
    } else {
      canvas.defaultCursor = "default";
      canvas.hoverCursor = "move";
    }
  }, [canvas, activeTool, effectiveReadOnly]);
}
