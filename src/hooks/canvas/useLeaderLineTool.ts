import { useEffect, useRef } from "react";
import type { Canvas } from "fabric";
import { LeaderLineTool } from "@/lib/leaderLineTool";

export function useLeaderLineTool(
  canvas: Canvas | null,
  activeTool: string,
  onToolChange: ((tool: string) => void) | undefined,
  saveState: () => void
) {
  const leaderLineToolRef = useRef<any>(null);

  // Leader Line Tool
  useEffect(() => {
    if (!canvas || activeTool !== "leader-line") {
      if (leaderLineToolRef.current) {
        leaderLineToolRef.current.cancel();
        leaderLineToolRef.current = null;
      }
      return;
    }

    leaderLineToolRef.current = new LeaderLineTool(
      canvas,
      undefined,
      () => onToolChange?.("select"),
      () => saveState() // Save state for undo/redo when line is created
    );
    leaderLineToolRef.current.start();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        leaderLineToolRef.current?.cancel();
        leaderLineToolRef.current = null;
        onToolChange?.("select");
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (leaderLineToolRef.current) {
        leaderLineToolRef.current.cancel();
        leaderLineToolRef.current = null;
      }
    };
  }, [canvas, activeTool, onToolChange]);
}
