import { useEffect } from "react";
import type { Canvas } from "fabric";

export function useErasableObjects(canvas: Canvas | null) {
  // Make all objects erasable by default
  useEffect(() => {
    if (!canvas) return;

    const handleObjectAdded = (e: any) => {
      const obj = e.target;
      if (obj && !(obj as any).isGridLine && !(obj as any).isRuler) {
        (obj as any).erasable = true;
      }
    };

    // Set existing objects as erasable
    canvas.getObjects().forEach((obj) => {
      if (!(obj as any).isGridLine && !(obj as any).isRuler) {
        (obj as any).erasable = true;
      }
    });

    canvas.on("object:added", handleObjectAdded);

    return () => {
      canvas.off("object:added", handleObjectAdded);
    };
  }, [canvas]);
}
