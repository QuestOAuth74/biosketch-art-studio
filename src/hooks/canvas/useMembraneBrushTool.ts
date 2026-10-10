import { useEffect, useRef } from "react";
import { Canvas } from "fabric";
import { toast } from "sonner";
import { MembraneBrushTool } from "@/lib/membraneBrushTool";

export function useMembraneBrushTool(
  canvas: Canvas | null,
  activeTool: string,
  onShapeCreated: (() => void) | undefined,
  onToolChange: ((tool: string) => void) | undefined
) {
  const membraneBrushToolRef = useRef<MembraneBrushTool | null>(null);

  // Membrane Brush Tool Handler
  useEffect(() => {
    if (!canvas || !activeTool.startsWith("membrane-brush")) {
      if (membraneBrushToolRef.current) {
        membraneBrushToolRef.current.cancel();
        membraneBrushToolRef.current = null;
      }
      return;
    }

    // Parse membrane brush options from activeTool string
    // Format: membrane-brush:{JSON options}
    const optionsStr = activeTool.replace('membrane-brush:', '');
    let options: any;

    try {
      options = JSON.parse(optionsStr);
    } catch (error) {
      console.error("Failed to parse membrane brush options:", error);
      toast.error("Failed to initialize membrane brush");
      onToolChange?.("select");
      return;
    }

    if (!options.iconSVG) {
      toast.error("No icon selected for membrane brush");
      onToolChange?.("select");
      return;
    }

    // Initialize membrane brush tool
    membraneBrushToolRef.current = new MembraneBrushTool(canvas, options);
    membraneBrushToolRef.current.start();

    let isDrawing = false;

    const handleMouseDown = (e: any) => {
      e.e?.stopImmediatePropagation?.();
      e.e?.preventDefault?.();
      const pointer = canvas.getPointer(e.e);
      membraneBrushToolRef.current?.addPoint(pointer.x, pointer.y);
      isDrawing = true;
    };

    const handleMouseMove = (e: any) => {
      if (isDrawing) {
        const pointer = canvas.getPointer(e.e);
        membraneBrushToolRef.current?.addPoint(pointer.x, pointer.y);
        membraneBrushToolRef.current?.updatePreview();
      }
    };

    const handleMouseUp = async () => {
      if (isDrawing) {
        const membrane = await membraneBrushToolRef.current?.finish();
        if (membrane) {
          toast.success("Membrane created! You can continue drawing or press ESC to exit.");
          if (onShapeCreated) onShapeCreated();
          // Re-initialize for next membrane
          membraneBrushToolRef.current = new MembraneBrushTool(canvas, options);
          membraneBrushToolRef.current.start();
        }
        isDrawing = false;
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        membraneBrushToolRef.current?.cancel();
        onToolChange?.("select");
        isDrawing = false;
        toast.info("Membrane brush tool cancelled");
      }
    };

    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:up", handleMouseUp);
    window.addEventListener("keydown", handleKeyDown);

    toast.info("Click and drag to draw a membrane. Release to finish. Press ESC to exit.");

    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      canvas.off("mouse:up", handleMouseUp);
      window.removeEventListener("keydown", handleKeyDown);
      if (membraneBrushToolRef.current) {
        membraneBrushToolRef.current.cancel();
      }
    };
  }, [canvas, activeTool, onShapeCreated, onToolChange]);
}
