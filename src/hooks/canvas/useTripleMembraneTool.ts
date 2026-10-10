import { useEffect, useRef } from "react";
import { Canvas } from "fabric";
import { toast } from "sonner";
import { TripleMembranePathTool } from "@/lib/tripleMembranePathTool";

export function useTripleMembraneTool(
  canvas: Canvas | null,
  activeTool: string,
  onShapeCreated: (() => void) | undefined,
  onToolChange: ((tool: string) => void) | undefined,
  saveState: () => void
) {
  const tripleMembraneToolRef = useRef<TripleMembranePathTool | null>(null);

  // Triple Membrane Tool Handler
  useEffect(() => {
    if (!canvas || activeTool !== "triple-membrane") {
      if (tripleMembraneToolRef.current) {
        tripleMembraneToolRef.current.cancel();
        tripleMembraneToolRef.current = null;
      }
      return;
    }

    tripleMembraneToolRef.current = new TripleMembranePathTool(canvas);
    tripleMembraneToolRef.current.start();

    toast.info("Click to place points. Click first point to close. Press Enter to finish.");

    const handleCanvasClick = async (e: any) => {
      const pointer = canvas.getPointer(e.e);
      const membrane = await tripleMembraneToolRef.current?.addPoint(pointer.x, pointer.y);
      if (membrane) {
        toast.success("Triple membrane created!");
        if (onShapeCreated) onShapeCreated();
        saveState();
        onToolChange?.("select");
      }
    };

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        tripleMembraneToolRef.current?.cancel();
        onToolChange?.("select");
        toast.info("Triple membrane cancelled");
      } else if (e.key === "Enter") {
        const membrane = await tripleMembraneToolRef.current?.finish();
        if (membrane) {
          toast.success("Triple membrane created!");
          if (onShapeCreated) onShapeCreated();
          saveState();
          onToolChange?.("select");
        }
      }
    };

    canvas.on("mouse:down", handleCanvasClick);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      canvas.off("mouse:down", handleCanvasClick);
      window.removeEventListener("keydown", handleKeyDown);
      if (tripleMembraneToolRef.current) {
        tripleMembraneToolRef.current.cancel();
      }
    };
  }, [canvas, activeTool, onShapeCreated, onToolChange, saveState]);
}
