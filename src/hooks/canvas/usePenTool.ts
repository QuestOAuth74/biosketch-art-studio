import { useEffect, useRef } from "react";
import type { Canvas } from "fabric";
import type { RefObject } from "react";
import { toast } from "sonner";
import { EnhancedBezierTool } from "@/lib/enhancedBezierTool";

export function usePenTool(
  canvas: Canvas | null,
  activeTool: string,
  onShapeCreated: (() => void) | undefined,
  onToolChange: ((tool: string) => void) | undefined,
  saveState: () => void,
  smartConnectorsEnabled: boolean,
  autoPathfindingEnabled: boolean,
  connectionSyncManagerRef: RefObject<any>
) {
  const bezierToolRef = useRef<any>(null);

  // Enhanced Pen Tool with smooth bezier curves (draw.io style)
  useEffect(() => {
    if (!canvas || activeTool !== "pen") {
      // Clean up bezier tool when switching away
      if (bezierToolRef.current) {
        const state = bezierToolRef.current.getState();
        if (state.isDrawing && state.pointCount >= 2) {
          // Auto-finish the path if we have at least 2 points
          const path = bezierToolRef.current.finish();
          if (path) {
            // Register path with connection sync manager
            if (connectionSyncManagerRef.current) {
              connectionSyncManagerRef.current.registerLine(path);
            }
            toast.success("Bezier path created! Double-click to edit anchor points.");
          }
        } else {
          // Cancel if incomplete
          bezierToolRef.current.cancel();
        }
        bezierToolRef.current = null;
      }
      return;
    }

    // Disable selection and drawing mode while using pen tool
    canvas.selection = false;
    canvas.isDrawingMode = false;

    // Initialize enhanced bezier tool
    bezierToolRef.current = new EnhancedBezierTool(canvas, {
      smooth: 0.5,
      snap: true,
    }, smartConnectorsEnabled, 15, autoPathfindingEnabled);

    bezierToolRef.current.start();

    const handleCanvasClick = (e: any) => {
      const pointer = canvas.getPointer(e.e);

      // Check if still drawing before and after adding point
      const wasDrawing = bezierToolRef.current?.getState().isDrawing;
      bezierToolRef.current?.addPoint(pointer.x, pointer.y);
      const isStillDrawing = bezierToolRef.current?.getState().isDrawing;

      // If bezier tool auto-finished (closed the path or clicked connection point), finish and switch to select
      if (wasDrawing && !isStillDrawing) {
        const path = bezierToolRef.current?.finish();
        if (path) {
          // Register path with connection sync manager
          if (connectionSyncManagerRef.current) {
            connectionSyncManagerRef.current.registerLine(path);
          }
          toast.success("Bezier path created! Double-click to edit anchor points.");
          if (onShapeCreated) onShapeCreated();
          saveState();
          onToolChange?.("select");
        }
      }
    };

    const handleMouseMove = (e: any) => {
      const state = bezierToolRef.current?.getState();
      if (state?.isDrawing && state.pointCount > 0) {
        const pointer = canvas.getPointer(e.e);
        bezierToolRef.current?.updatePreview(pointer.x, pointer.y);
        bezierToolRef.current?.updateFirstPointHighlight(pointer.x, pointer.y);
        bezierToolRef.current?.updateLastPointHighlight(pointer.x, pointer.y);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        bezierToolRef.current?.cancel();
        onToolChange?.("select");
        toast.info("Bezier drawing cancelled");
      } else if (e.key === "Enter") {
        const path = bezierToolRef.current?.finish();
        if (path) {
          // Register path with connection sync manager
          if (connectionSyncManagerRef.current) {
            connectionSyncManagerRef.current.registerLine(path);
          }
          toast.success("Bezier path created! Double-click to edit anchor points.");
          if (onShapeCreated) onShapeCreated();
          saveState();
          onToolChange?.("select");
        }
      }
    };

    canvas.on("mouse:down", handleCanvasClick);
    canvas.on("mouse:move", handleMouseMove);
    window.addEventListener("keydown", handleKeyDown);

    toast.info("Click to add points. Press Enter to finish, Escape to cancel.");

    return () => {
      canvas.off("mouse:down", handleCanvasClick);
      canvas.off("mouse:move", handleMouseMove);
      window.removeEventListener("keydown", handleKeyDown);

      // Re-enable selection when leaving pen tool
      canvas.selection = true;

      if (bezierToolRef.current) {
        const state = bezierToolRef.current.getState();
        if (state.isDrawing && state.pointCount >= 2) {
          const path = bezierToolRef.current.finish();
          if (path && connectionSyncManagerRef.current) {
            connectionSyncManagerRef.current.registerLine(path);
          }
        } else {
          bezierToolRef.current.cancel();
        }
      }
    };
  }, [canvas, activeTool, onShapeCreated, onToolChange, saveState, smartConnectorsEnabled, autoPathfindingEnabled]);
}
