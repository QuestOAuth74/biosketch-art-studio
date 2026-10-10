import { useEffect } from "react";
import { PencilBrush, Path, type Canvas } from "fabric";

export function useFreeformLineTool(
  canvas: Canvas | null,
  activeTool: string,
  effectiveReadOnly: boolean,
  onShapeCreated: (() => void) | undefined,
  saveState: () => void
) {
  // Custom PencilBrush class to store original points for re-smoothing
  class FreeformPencilBrush extends PencilBrush {
    createPath(pathData: any): Path {
      const path = super.createPath(pathData);
      // Store original decimated points for re-smoothing
      const points = (this as any)._points;
      (path as any).originalFreeformPoints = points ? points.map((p: any) => ({ x: p.x, y: p.y })) : [];
      (path as any).currentSmoothingStrength = 0; // Start with no smoothing
      return path;
    }
  }

  // Handle freeform line drawing
  useEffect(() => {
    if (!canvas || effectiveReadOnly) return;

    if (activeTool === "freeform-line") {
      canvas.isDrawingMode = true;
      canvas.selection = false; // Disable selection while drawing

      // Create and configure the custom pencil brush
      const brush = new FreeformPencilBrush(canvas);
      brush.color = "#000000";
      brush.width = 2;

      // CRITICAL: Set decimate to very low for smooth curves
      // decimate controls path simplification (0 = no simplification, keeps all points)
      (brush as any).decimate = 0.01; // Keep almost all points for smooth curves

      // Ensure smooth rendering
      (brush as any).strokeLineCap = "round";
      (brush as any).strokeLineJoin = "round";
      canvas.freeDrawingBrush = brush;

      // Handle path creation
      const handlePathCreated = (e: any) => {
        const path = e.path as Path;
        if (path) {
          // Mark as freeform line
          (path as any).isFreeformLine = true;
          (path as any).startMarker = "none";
          (path as any).endMarker = "none";
          (path as any).lineThickness = 2;

          // Set path properties with round caps
          // Use 'transparent' instead of null — null can cause hit-detection
          // issues in Fabric.js v6 where the bounding box isn't computed properly.
          path.set({
            fill: 'transparent',
            stroke: "#000000",
            strokeWidth: 2,
            strokeUniform: true,
            strokeLineCap: "round",
            strokeLineJoin: "round",
            selectable: true,
            evented: true,
            hasControls: true,
            hasBorders: true,
            objectCaching: false, // Prevent stale cache during transforms
          });

          // Update interactive bounding box after property changes
          path.setCoords();

          canvas.setActiveObject(path);
          canvas.requestRenderAll();
          if (onShapeCreated) onShapeCreated();
          // Save state for undo/redo
          saveState();
        }
      };

      canvas.on("path:created", handlePathCreated);

      return () => {
        canvas.off("path:created", handlePathCreated);
        canvas.isDrawingMode = false;
        canvas.selection = true; // Re-enable selection
      };
    } else {
      canvas.isDrawingMode = false;
      canvas.selection = true;
    }
  }, [canvas, activeTool, effectiveReadOnly]);
}
