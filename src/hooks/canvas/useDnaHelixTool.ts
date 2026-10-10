import { useEffect, useRef } from "react";
import { Canvas } from "fabric";
import { toast } from "sonner";
import { DNAHelixTool } from "@/lib/dnaHelixTool";

export function useDnaHelixTool(
  canvas: Canvas | null,
  activeTool: string,
  onShapeCreated: (() => void) | undefined,
  onToolChange: ((tool: string) => void) | undefined,
  saveState: () => void
) {
  const dnaHelixToolRef = useRef<DNAHelixTool | null>(null);

  // DNA Helix Tool Handler
  useEffect(() => {
    if (!canvas || activeTool !== "dna-helix") {
      if (dnaHelixToolRef.current) {
        dnaHelixToolRef.current.cancel();
        dnaHelixToolRef.current = null;
      }
      return;
    }

    dnaHelixToolRef.current = new DNAHelixTool(canvas);
    dnaHelixToolRef.current.start();

    toast.info("Click to place spine points. Press Enter to finish.");

    const handleCanvasClick = async (e: any) => {
      const pointer = canvas.getPointer(e.e);
      const helix = await dnaHelixToolRef.current?.addPoint(pointer.x, pointer.y);
      if (helix) {
        toast.success("DNA helix created!");
        if (onShapeCreated) onShapeCreated();
        saveState();
        onToolChange?.("select");
      }
    };

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dnaHelixToolRef.current?.cancel();
        onToolChange?.("select");
        toast.info("DNA helix cancelled");
      } else if (e.key === "Enter") {
        const helix = await dnaHelixToolRef.current?.finish();
        if (helix) {
          toast.success("DNA helix created!");
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
      if (dnaHelixToolRef.current) {
        dnaHelixToolRef.current.cancel();
      }
    };
  }, [canvas, activeTool, onShapeCreated, onToolChange, saveState]);
}
