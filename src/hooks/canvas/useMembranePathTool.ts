import { useEffect, useRef, RefObject } from "react";
import { Canvas } from "fabric";
import { toast } from "sonner";
import { MembranePathTool } from "@/lib/membranePathTool";

export function useMembranePathTool(
  canvas: Canvas | null,
  activeTool: string,
  onShapeCreated: (() => void) | undefined,
  onToolChange: ((tool: string) => void) | undefined,
  saveState: () => void,
  membraneSettings: any,
  defaultMembraneIconSVGRef: RefObject<string | null>
) {
  const membranePathToolRef = useRef<MembranePathTool | null>(null);

  // Membrane Path Tool Handler - Click-based membrane creation
  useEffect(() => {
    if (!canvas || activeTool !== "membrane-path") {
      if (membranePathToolRef.current) {
        membranePathToolRef.current.cancel();
        membranePathToolRef.current = null;
      }
      return;
    }

    // Initialize membrane tool with settings from admin panel
    const initializeMembraneTool = () => {
      // Fallback icon if not preloaded yet
      const FALLBACK_MEMBRANE_ICON = `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="20" r="15" fill="#3b82f6"/><circle cx="50" cy="80" r="15" fill="#3b82f6"/><line x1="50" y1="35" x2="50" y2="65" stroke="#1e40af" stroke-width="3"/></svg>`;

      // Use preloaded icon or fallback
      const iconSVG = defaultMembraneIconSVGRef.current || FALLBACK_MEMBRANE_ICON;

      const defaultOptions = {
        iconSVG,
        iconSize: membraneSettings?.default_icon_size ?? 40,
        spacing: membraneSettings?.default_spacing ?? 0,
        rotateToPath: membraneSettings?.default_rotate_to_path ?? true,
        doubleSided: membraneSettings?.default_double_sided ?? true,
        orientationOffset: membraneSettings?.default_orientation_offset ?? 270,
      };

      membranePathToolRef.current = new MembranePathTool(canvas, defaultOptions);
      membranePathToolRef.current.start();

      toast.info("Click to place points. Click first point to close. Press Enter to finish.");
    };

    const handleCanvasClick = async (e: any) => {
      const pointer = canvas.getPointer(e.e);
      const membrane = await membranePathToolRef.current?.addPoint(pointer.x, pointer.y);

      // If membrane was created (path auto-closed), switch to select tool
      if (membrane) {
        toast.success("Membrane shape created!");
        if (onShapeCreated) onShapeCreated();
        saveState();
        onToolChange?.("select");
      }
    };

    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        membranePathToolRef.current?.cancel();
        onToolChange?.("select");
        toast.info("Membrane path cancelled");
      } else if (e.key === "Enter") {
        const membrane = await membranePathToolRef.current?.finish();
        if (membrane) {
          toast.success("Membrane shape created!");
          if (onShapeCreated) onShapeCreated();
          saveState();
          onToolChange?.("select");
        }
      }
    };

    canvas.on("mouse:down", handleCanvasClick);
    window.addEventListener("keydown", handleKeyDown);

    initializeMembraneTool();

    return () => {
      canvas.off("mouse:down", handleCanvasClick);
      window.removeEventListener("keydown", handleKeyDown);
      if (membranePathToolRef.current) {
        membranePathToolRef.current.cancel();
      }
    };
  }, [canvas, activeTool, onShapeCreated, onToolChange, saveState, membraneSettings]);
}
