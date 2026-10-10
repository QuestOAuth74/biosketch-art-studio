import { useEffect, useRef } from "react";
import type { Canvas } from "fabric";
import { toast } from "sonner";
import { CustomPolygonTool } from "@/lib/customPolygonTool";

export function usePolygonTool(
  canvas: Canvas | null,
  activeTool: string,
  onShapeCreated: (() => void) | undefined,
  saveState: () => void
) {
  const customPolygonToolRef = useRef<any>(null);

  // Custom Polygon Tool - Click to place vertices
  useEffect(() => {
    if (!canvas || activeTool !== "custom-polygon") {
      // Clean up polygon tool when switching away
      if (customPolygonToolRef.current) {
        customPolygonToolRef.current.cancel();
        customPolygonToolRef.current = null;
      }
      return;
    }

    // Disable selection while using polygon tool
    canvas.selection = false;
    canvas.isDrawingMode = false;

    // Initialize custom polygon tool
    customPolygonToolRef.current = new CustomPolygonTool(canvas, {
      snap: false,
      minVertices: 3,
    });

    customPolygonToolRef.current.start();

    const handleCanvasClick = (e: any) => {
      const pointer = canvas.getPointer(e.e);

      // Check if clicking near first vertex to close
      if (customPolygonToolRef.current?.isCloseableDistance(pointer.x, pointer.y)) {
        const polygon = customPolygonToolRef.current.closePolygon();
        if (polygon) {
          canvas.add(polygon);
          canvas.setActiveObject(polygon);
          toast.success("Polygon created!");
          if (onShapeCreated) onShapeCreated();
          // Save state for undo/redo
          saveState();

          // Reset for next polygon
          customPolygonToolRef.current = new CustomPolygonTool(canvas, {
            snap: false,
            minVertices: 3,
          });
          customPolygonToolRef.current.start();
        }
      } else {
        customPolygonToolRef.current?.addVertex(pointer.x, pointer.y);
      }
    };

    const handleMouseMove = (e: any) => {
      const pointer = canvas.getPointer(e.e);
      customPolygonToolRef.current?.updatePreview(pointer.x, pointer.y);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        customPolygonToolRef.current?.cancel();
        customPolygonToolRef.current = null;
      } else if (e.key === "Enter") {
        e.preventDefault();
        const polygon = customPolygonToolRef.current?.closePolygon();
        if (polygon) {
          canvas.add(polygon);
          canvas.setActiveObject(polygon);
          toast.success("Polygon created!");
          if (onShapeCreated) onShapeCreated();
          // Save state for undo/redo
          saveState();

          // Reset for next polygon
          customPolygonToolRef.current = new CustomPolygonTool(canvas, {
            snap: false,
            minVertices: 3,
          });
          customPolygonToolRef.current.start();
        }
      } else if (e.key === "Backspace") {
        e.preventDefault();
        customPolygonToolRef.current?.undoLastVertex();
      }
    };

    canvas.on("mouse:down", handleCanvasClick);
    canvas.on("mouse:move", handleMouseMove);
    window.addEventListener("keydown", handleKeyDown);

    toast.info("Click to place vertices. Click first vertex or press Enter to close.");

    return () => {
      canvas.off("mouse:down", handleCanvasClick);
      canvas.off("mouse:move", handleMouseMove);
      window.removeEventListener("keydown", handleKeyDown);

      // Re-enable selection when leaving polygon tool
      canvas.selection = true;

      if (customPolygonToolRef.current) {
        customPolygonToolRef.current.cancel();
      }
    };
  }, [canvas, activeTool, onShapeCreated]);
}
