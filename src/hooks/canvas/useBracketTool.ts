import { useEffect, useRef } from "react";
import type { Canvas } from "fabric";
import { BracketTool } from "@/lib/bracketTool";

export function useBracketTool(
  canvas: Canvas | null,
  activeTool: string,
  onToolChange: ((tool: string) => void) | undefined,
  saveState: () => void
) {
  const bracketToolRef = useRef<any>(null);

  // Bracket Tool
  useEffect(() => {
    if (!canvas || activeTool !== "bracket") {
      if (bracketToolRef.current) {
        bracketToolRef.current.cancel();
        bracketToolRef.current = null;
      }
      return;
    }

    bracketToolRef.current = new BracketTool(
      canvas,
      undefined,
      () => onToolChange?.("select"),
      () => saveState() // Save state for undo/redo when bracket is created
    );
    bracketToolRef.current.start();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        bracketToolRef.current?.cancel();
        bracketToolRef.current = null;
        onToolChange?.("select");
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (bracketToolRef.current) {
        bracketToolRef.current.cancel();
        bracketToolRef.current = null;
      }
    };
  }, [canvas, activeTool, onToolChange]);
}
