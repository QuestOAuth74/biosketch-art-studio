import { useEffect, type RefObject } from "react";

/**
 * Hook #3: Prevents the default browser context menu on the canvas element.
 * Extracted from FabricCanvas.tsx lines 3209-3222.
 */
export function useContextMenuPrevention(canvasRef: RefObject<HTMLCanvasElement | null>) {
  useEffect(() => {
    const canvasElement = canvasRef.current;
    if (!canvasElement) return;

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    canvasElement.addEventListener('contextmenu', handleContextMenu);

    return () => {
      canvasElement.removeEventListener('contextmenu', handleContextMenu);
    };
  }, []);
}
