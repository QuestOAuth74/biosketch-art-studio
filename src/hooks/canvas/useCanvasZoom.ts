import { useEffect, type RefObject } from "react";
import { Canvas } from "fabric";

export function useCanvasZoom(
  canvas: Canvas | null,
  zoom: number,
  canvasDimensions: { width: number; height: number },
  throttledCullRef: RefObject<(() => void) | null>,
) {
  // Handle canvas dimension changes (also accounts for current zoom)
  useEffect(() => {
    if (!canvas || !canvas.lowerCanvasEl) return;

    try {
      const zoomLevel = zoom / 100;
      canvas.setDimensions({
        width: canvasDimensions.width * zoomLevel,
        height: canvasDimensions.height * zoomLevel,
      });
      canvas.requestRenderAll();
    } catch (error) {
      console.error("Error setting canvas dimensions:", error);
    }
  }, [canvas, canvasDimensions, zoom]);

  // Handle zoom changes with culling
  useEffect(() => {
    if (!canvas) return;

    const zoomLevel = zoom / 100;

    // Use Fabric's native zoom for proper object control handling
    canvas.setZoom(zoomLevel);

    // Resize the HTML canvas element to match the zoomed dimensions
    // so content isn't clipped by the fixed-size canvas
    try {
      canvas.setDimensions({
        width: canvasDimensions.width * zoomLevel,
        height: canvasDimensions.height * zoomLevel,
      });
    } catch (error) {
      console.error("Error resizing canvas for zoom:", error);
    }

    canvas.requestRenderAll();

    // Trigger culling after zoom change
    if (throttledCullRef.current) {
      throttledCullRef.current();
    }
  }, [canvas, zoom, canvasDimensions]);
}
