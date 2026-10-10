import { useEffect, useRef } from "react";
import type { Canvas } from "fabric";
import type { RefObject } from "react";
import { toast } from "sonner";
import { StraightLineTool } from "@/lib/straightLineTool";

export function useStraightLineTool(
  canvas: Canvas | null,
  activeTool: string,
  onShapeCreated: (() => void) | undefined,
  onToolChange: ((tool: string) => void) | undefined,
  saveState: () => void,
  smartConnectorsEnabled: boolean,
  lineSnapThreshold: number | undefined,
  connectionSyncManagerRef: RefObject<any>
) {
  const straightLineToolRef = useRef<any>(null);

  // Straight Line Tool with customizable markers
  useEffect(() => {
    if (!canvas || !activeTool.startsWith("straight-line")) {
      if (straightLineToolRef.current) {
        straightLineToolRef.current.cancel();
        straightLineToolRef.current = null;
      }
      return;
    }

    // Parse tool options from activeTool string
    const options: any = {
      startMarker: 'none',
      endMarker: 'none',
      lineStyle: 'solid',
      strokeWidth: 2,
      strokeColor: '#000000',
      snap: true,
      gridSize: 20,
    };

    // Parse activeTool to set markers and styles
    if (activeTool.includes('double-arrow')) {
      options.startMarker = 'arrow';
      options.endMarker = 'arrow';
    } else if (activeTool.includes('arrow')) {
      options.endMarker = 'arrow';
    }

    if (activeTool.includes('dot')) {
      options.startMarker = 'dot';
      options.endMarker = 'dot';
    }

    if (activeTool.includes('diamond')) {
      options.startMarker = 'diamond';
      options.endMarker = 'diamond';
    }

    if (activeTool.includes('circle')) {
      options.startMarker = 'circle';
      options.endMarker = 'circle';
    }

    if (activeTool.includes('dashed')) {
      options.lineStyle = 'dashed';
    } else if (activeTool.includes('dotted')) {
      options.lineStyle = 'dotted';
    }

    // Initialize straight line tool
    straightLineToolRef.current = new StraightLineTool(canvas, options, saveState, smartConnectorsEnabled, lineSnapThreshold || 15);
    straightLineToolRef.current.start();

    // Two-click drawing handlers (like curved line)
    let hasStartPoint = false;

    const handleMouseDown = (e: any) => {
      e.e?.stopImmediatePropagation?.();
      e.e?.preventDefault?.();
      const pointer = canvas.getPointer(e.e);
      if (!hasStartPoint) {
        straightLineToolRef.current?.setStartPoint(pointer.x, pointer.y);
        hasStartPoint = true;
      } else {
        const line = straightLineToolRef.current?.setEndPoint(pointer.x, pointer.y);
        if (line) {
          toast.success("Straight line created!");
          if (onShapeCreated) onShapeCreated();
          // Save state for undo/redo
          saveState();
          // Register line with connection sync manager
          if (connectionSyncManagerRef.current) {
            connectionSyncManagerRef.current.registerLine(line);
          }
          // Re-initialize for next line
          straightLineToolRef.current = new StraightLineTool(canvas, options, saveState, smartConnectorsEnabled, lineSnapThreshold || 15);
          straightLineToolRef.current.start();
          hasStartPoint = false;
        }
      }
    };

    const handleMouseMove = (e: any) => {
      if (hasStartPoint) {
        const pointer = canvas.getPointer(e.e);
        straightLineToolRef.current?.updatePreview(pointer.x, pointer.y);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        straightLineToolRef.current?.cancel();
        onToolChange?.("select");
        hasStartPoint = false;
        toast.info("Straight line tool cancelled");
      }
    };

    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    window.addEventListener("keydown", handleKeyDown);

    toast.info("Click start point, then end point. Press Escape to exit.");

    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      window.removeEventListener("keydown", handleKeyDown);
      if (straightLineToolRef.current) {
        straightLineToolRef.current.cancel();
      }
    };
  }, [canvas, activeTool, onShapeCreated, onToolChange, smartConnectorsEnabled]);
}
