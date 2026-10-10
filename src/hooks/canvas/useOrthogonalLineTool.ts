import { useEffect, useRef } from "react";
import type { Canvas } from "fabric";
import type { RefObject } from "react";
import { toast } from "sonner";
import { OrthogonalLineTool } from "@/lib/orthogonalLineTool";

export function useOrthogonalLineTool(
  canvas: Canvas | null,
  activeTool: string,
  onShapeCreated: (() => void) | undefined,
  onToolChange: ((tool: string) => void) | undefined,
  saveState: () => void,
  smartConnectorsEnabled: boolean,
  autoPathfindingEnabled: boolean,
  connectionSyncManagerRef: RefObject<any>
) {
  const orthogonalLineToolRef = useRef<any>(null);

  // Orthogonal Line Tool with 90-degree bends
  useEffect(() => {
    if (!canvas || !activeTool.startsWith("orthogonal-line")) {
      if (orthogonalLineToolRef.current) {
        orthogonalLineToolRef.current.cancel();
        orthogonalLineToolRef.current = null;
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
      smoothCorners: false,
      cornerRadius: 10,
    };

    // Parse activeTool to set markers and styles
    if (activeTool.startsWith('orthogonal-line-custom-')) {
      // Extract custom markers from tool name
      // Format: orthogonal-line-custom-{startMarker}-{endMarker}
      const parts = activeTool.split('-');
      if (parts.length >= 5) {
        options.startMarker = parts[3]; // e.g., 'dot', 'arrow', 'none', 'bar'
        options.endMarker = parts[4];
      }
    } else if (activeTool.includes('double-arrow')) {
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

    // Initialize orthogonal line tool
    orthogonalLineToolRef.current = new OrthogonalLineTool(canvas, options, smartConnectorsEnabled, autoPathfindingEnabled, 15);
    orthogonalLineToolRef.current.start();

    // Click to add waypoints
    const handleMouseDown = (e: any) => {
      e.e?.stopImmediatePropagation?.();
      e.e?.preventDefault?.();
      const pointer = canvas.getPointer(e.e);

      // Check if clicking near the first waypoint to close the loop
      if (orthogonalLineToolRef.current?.isClickNearFirstPoint(pointer.x, pointer.y)) {
        orthogonalLineToolRef.current?.closePath();
        const line = orthogonalLineToolRef.current?.finish();
        if (line) {
          // Register line with connection sync manager
          if (connectionSyncManagerRef.current) {
            connectionSyncManagerRef.current.registerLine(line);
          }
          toast.success("Closed orthogonal line created!");
          if (onShapeCreated) onShapeCreated();
          // Save state for undo/redo
          saveState();
        }
        onToolChange?.("select");
      }
      // Check if clicking near the last waypoint to complete the line
      else if (orthogonalLineToolRef.current?.isClickNearLastPoint(pointer.x, pointer.y)) {
        const line = orthogonalLineToolRef.current?.finish();
        if (line) {
          // Register line with connection sync manager
          if (connectionSyncManagerRef.current) {
            connectionSyncManagerRef.current.registerLine(line);
          }
          toast.success("Orthogonal line created!");
          if (onShapeCreated) onShapeCreated();
          // Save state for undo/redo
          saveState();
        }
        onToolChange?.("select");
      } else {
        orthogonalLineToolRef.current?.addPoint(pointer.x, pointer.y);

        // Check if line should auto-finish (after clicking a connection point)
        if (orthogonalLineToolRef.current?.checkAndResetAutoFinish()) {
          const line = orthogonalLineToolRef.current?.finish();
          if (line) {
            // Register line with connection sync manager
            if (connectionSyncManagerRef.current) {
              connectionSyncManagerRef.current.registerLine(line);
            }
            toast.success("Orthogonal line created!");
            if (onShapeCreated) onShapeCreated();
            // Save state for undo/redo
            saveState();
            onToolChange?.("select");
          }
        }
      }
    };

    // Update preview as mouse moves
    const handleMouseMove = (e: any) => {
      const pointer = canvas.getPointer(e.e);
      orthogonalLineToolRef.current?.updatePreview(pointer.x, pointer.y);
      orthogonalLineToolRef.current?.updateFirstPointHighlight(pointer.x, pointer.y);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        const line = orthogonalLineToolRef.current?.finish();
        if (line) {
          // Register line with connection sync manager
          if (connectionSyncManagerRef.current) {
            connectionSyncManagerRef.current.registerLine(line);
          }
          toast.success("Orthogonal line created!");
          if (onShapeCreated) onShapeCreated();
          // Save state for undo/redo
          saveState();
        }
        onToolChange?.("select");
      } else if (e.key === "Escape") {
        orthogonalLineToolRef.current?.cancel();
        onToolChange?.("select");
        toast.info("Orthogonal line tool cancelled");
      }
    };

    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    window.addEventListener("keydown", handleKeyDown);

    toast.info("Click to add waypoints. Click last point or press Enter to finish. Click first point to close loop. Escape to cancel.");

    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      window.removeEventListener("keydown", handleKeyDown);
      if (orthogonalLineToolRef.current) {
        orthogonalLineToolRef.current.cancel();
      }
    };
  }, [canvas, activeTool, onShapeCreated, onToolChange, autoPathfindingEnabled, smartConnectorsEnabled]);
}
