import { useEffect, useRef } from "react";
import type { Canvas } from "fabric";
import type { RefObject } from "react";
import { toast } from "sonner";
import { CurvedLineTool } from "@/lib/curvedLineTool";

export function useCurvedLineTool(
  canvas: Canvas | null,
  activeTool: string,
  onShapeCreated: (() => void) | undefined,
  onToolChange: ((tool: string) => void) | undefined,
  saveState: () => void,
  smartConnectorsEnabled: boolean,
  lineSnapThreshold: number | undefined,
  connectionSyncManagerRef: RefObject<any>
) {
  const curvedLineToolRef = useRef<any>(null);

  // Curved Line Tool with adjustable control points
  useEffect(() => {
    if (!canvas || !activeTool.startsWith("curved-line")) {
      if (curvedLineToolRef.current) {
        curvedLineToolRef.current.cancel();
        curvedLineToolRef.current = null;
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
    if (activeTool.startsWith('curved-line-custom-')) {
      // Extract custom markers from tool name
      // Format: curved-line-custom-{startMarker}-{endMarker}
      const parts = activeTool.split('-');
      if (parts.length >= 5) {
        options.startMarker = parts[3]; // e.g., 'dot', 'arrow', 'none', 'bar', 'block', 'back-arrow'
        options.endMarker = parts[4];
      }
    } else if (activeTool.includes('double-arrow')) {
      options.startMarker = 'arrow';
      options.endMarker = 'arrow';
    } else if (activeTool.includes('arrow')) {
      options.endMarker = 'arrow';
    }

    if (activeTool.includes('dots')) {
      options.startMarker = 'dot';
      options.endMarker = 'dot';
    }

    if (activeTool.includes('diamonds')) {
      options.startMarker = 'diamond';
      options.endMarker = 'diamond';
    }

    if (activeTool.includes('circles')) {
      options.startMarker = 'circle';
      options.endMarker = 'circle';
    }

    if (activeTool.includes('dashed')) {
      options.lineStyle = 'dashed';
    } else if (activeTool.includes('dotted')) {
      options.lineStyle = 'dotted';
    }

    // Initialize curved line tool
    curvedLineToolRef.current = new CurvedLineTool(canvas, options, saveState, smartConnectorsEnabled, lineSnapThreshold || 15);
    curvedLineToolRef.current.start();

    // Two-click drawing handlers
    let hasStartPoint = false;

    const handleMouseDown = (e: any) => {
      e.e?.stopImmediatePropagation?.();
      e.e?.preventDefault?.();
      const pointer = canvas.getPointer(e.e);
      if (!hasStartPoint) {
        curvedLineToolRef.current?.setStartPoint(pointer.x, pointer.y);
        hasStartPoint = true;
      } else {
        const curve = curvedLineToolRef.current?.setEndPoint(pointer.x, pointer.y);
        if (curve) {
          // Register line with connection sync manager
          if (connectionSyncManagerRef.current) {
            connectionSyncManagerRef.current.registerLine(curve);
          }
          toast.success("Curved line created! Drag the control point to adjust.");
          if (onShapeCreated) onShapeCreated();
          // Save state for undo/redo
          saveState();
          // Re-initialize for next line
          curvedLineToolRef.current = new CurvedLineTool(canvas, options, saveState, smartConnectorsEnabled, lineSnapThreshold || 15);
          curvedLineToolRef.current.start();
          hasStartPoint = false;
        }
      }
    };

    const handleMouseMove = (e: any) => {
      if (hasStartPoint) {
        const pointer = canvas.getPointer(e.e);
        curvedLineToolRef.current?.updatePreview(pointer.x, pointer.y);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        curvedLineToolRef.current?.cancel();
        onToolChange?.("select");
        hasStartPoint = false;
        toast.info("Curved line tool cancelled");
      }
    };

    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    window.addEventListener("keydown", handleKeyDown);

    toast.info("Click start point, then end point. Drag control point to adjust curve.");

    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      window.removeEventListener("keydown", handleKeyDown);
      if (curvedLineToolRef.current) {
        curvedLineToolRef.current.cancel();
      }
    };
  }, [canvas, activeTool, onShapeCreated, onToolChange, smartConnectorsEnabled]);
}
