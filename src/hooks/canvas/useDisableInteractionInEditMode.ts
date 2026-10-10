import { useEffect } from "react";
import { Canvas } from "fabric";

export function useDisableInteractionInEditMode(
  canvas: Canvas | null,
  isStraightLineEditMode: boolean,
  isCurvedLineEditMode: boolean,
  isOrthogonalLineEditMode: boolean,
  isBezierEditMode: boolean,
) {
  useEffect(() => {
    if (!canvas) return;

    const isInLineEditMode = isStraightLineEditMode || isCurvedLineEditMode ||
                             isOrthogonalLineEditMode || isBezierEditMode;

    canvas.forEachObject((obj) => {
      const objData = obj as any;

      // Skip anchor handles, connection points, and other UI elements
      if (
        objData.isAnchorHandle ||
        objData.isConnectionPoint ||
        objData.isControlHandle ||
        objData.isHandleLine ||
        objData.isTemp
      ) {
        return;
      }

      // Disable interaction with canvas objects when in edit mode
      if (isInLineEditMode) {
        obj.set({
          selectable: false,
          evented: false,
        });
      } else {
        // Re-enable interaction when exiting edit mode
        obj.set({
          selectable: true,
          evented: true,
        });
      }
    });

    canvas.requestRenderAll();
  }, [canvas, isStraightLineEditMode, isCurvedLineEditMode, isOrthogonalLineEditMode, isBezierEditMode]);
}
