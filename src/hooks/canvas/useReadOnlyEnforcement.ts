import { useEffect } from "react";
import type { Canvas } from "fabric";

/**
 * Hook #4: Enforces read-only/lock state on canvas objects.
 * Makes objects non-interactive when locked, restores when unlocked.
 * Extracted from FabricCanvas.tsx lines 3587-3631.
 */
export function useReadOnlyEnforcement(canvas: Canvas | null, effectiveReadOnly: boolean) {
  useEffect(() => {
    if (!canvas) return;

    canvas.selection = !effectiveReadOnly;

    canvas.getObjects().forEach((obj: any) => {
      if (obj.isGridLine || obj.isRuler || obj.isAlignmentGuide || obj.isSpacingGuide) return;

      if (effectiveReadOnly) {
        if (obj._prelock_selectable === undefined) {
          obj._prelock_selectable = obj.selectable !== false;
          obj._prelock_evented = obj.evented !== false;
        }
        obj.set({ selectable: false, evented: false });
      } else if (obj._prelock_selectable !== undefined) {
        obj.set({ selectable: obj._prelock_selectable, evented: obj._prelock_evented });
        delete obj._prelock_selectable;
        delete obj._prelock_evented;
      }
    });

    const lockNewObj = (e: any) => {
      if (!effectiveReadOnly) return;
      const obj = e.target as any;
      if (obj.isGridLine || obj.isRuler) return;
      obj.set({ selectable: false, evented: false });
    };
    canvas.on('object:added', lockNewObj);

    if (effectiveReadOnly) {
      canvas.defaultCursor = 'not-allowed';
      canvas.hoverCursor = 'not-allowed';
      canvas.discardActiveObject();
    } else {
      canvas.defaultCursor = 'default';
      canvas.hoverCursor = 'move';
    }

    canvas.requestRenderAll();

    return () => { canvas.off('object:added', lockNewObj); };
  }, [canvas, effectiveReadOnly]);
}
