import { useEffect, type RefObject } from "react";
import type { Canvas } from "fabric";
import type { ConnectionPointManager } from "@/lib/connectionPointManager";

/**
 * Hook #7: Shows/hides connection points based on active tool and edit mode.
 * Extracted from FabricCanvas.tsx lines 354-376.
 */
export function useConnectionPointVisibility(
  canvas: Canvas | null,
  connectionPointManagerRef: RefObject<ConnectionPointManager | null>,
  activeTool: string,
  smartConnectorsEnabled: boolean,
  isStraightLineEditMode: boolean,
  isCurvedLineEditMode: boolean,
  isOrthogonalLineEditMode: boolean,
  isBezierEditMode: boolean,
) {
  useEffect(() => {
    if (!canvas || !connectionPointManagerRef.current) return;

    const isLineTool = activeTool.startsWith('straight-line') ||
                       activeTool.startsWith('curved-line') ||
                       activeTool.startsWith('orthogonal-line') ||
                       activeTool === 'bezier' ||
                       activeTool === 'pen';

    const shouldShowPoints = (isLineTool || isStraightLineEditMode || isCurvedLineEditMode ||
                              isOrthogonalLineEditMode || isBezierEditMode) && smartConnectorsEnabled;

    if (shouldShowPoints) {
      connectionPointManagerRef.current.show();
    } else {
      connectionPointManagerRef.current.hide();
    }
  }, [canvas, activeTool, smartConnectorsEnabled, isStraightLineEditMode, isCurvedLineEditMode,
      isOrthogonalLineEditMode, isBezierEditMode]);
}
