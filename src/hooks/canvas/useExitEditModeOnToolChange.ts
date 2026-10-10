import { useEffect } from "react";

interface UseExitEditModeOnToolChangeParams {
  activeTool: string;
  isBezierEditMode: boolean;
  exitBezierEditMode: () => void;
  isCurvedLineEditMode: boolean;
  exitCurvedLineEditMode: () => void;
  isStraightLineEditMode: boolean;
  exitStraightLineEditMode: () => void;
  isOrthogonalLineEditMode: boolean;
  exitOrthogonalLineEditMode: () => void;
  isImageEditMode: boolean;
  exitImageEditMode: () => void;
}

export function useExitEditModeOnToolChange({
  activeTool,
  isBezierEditMode,
  exitBezierEditMode,
  isCurvedLineEditMode,
  exitCurvedLineEditMode,
  isStraightLineEditMode,
  exitStraightLineEditMode,
  isOrthogonalLineEditMode,
  exitOrthogonalLineEditMode,
  isImageEditMode,
  exitImageEditMode,
}: UseExitEditModeOnToolChangeParams) {
  useEffect(() => {
    if (isBezierEditMode && activeTool !== 'select') {
      exitBezierEditMode();
    }
    if (isCurvedLineEditMode && activeTool !== 'select') {
      exitCurvedLineEditMode();
    }
    if (isStraightLineEditMode && activeTool !== 'select') {
      exitStraightLineEditMode();
    }
    if (isOrthogonalLineEditMode && activeTool !== 'select') {
      exitOrthogonalLineEditMode();
    }
    if (isImageEditMode && activeTool !== 'select') {
      exitImageEditMode();
    }
  }, [activeTool, isBezierEditMode, exitBezierEditMode, isCurvedLineEditMode, exitCurvedLineEditMode, isStraightLineEditMode, exitStraightLineEditMode, isOrthogonalLineEditMode, exitOrthogonalLineEditMode, isImageEditMode, exitImageEditMode]);
}
