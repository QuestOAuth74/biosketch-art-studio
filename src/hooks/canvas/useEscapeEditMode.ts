import { useEffect } from "react";

/**
 * Hook #1: Keyboard handler for Escape key to exit edit modes.
 * Extracted from FabricCanvas.tsx lines 308-333.
 */
export function useEscapeEditMode({
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
  isMembraneEditMode,
  exitMembraneEditMode,
}: {
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
  isMembraneEditMode: boolean;
  exitMembraneEditMode: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isBezierEditMode) {
        exitBezierEditMode();
      }
      if (e.key === 'Escape' && isCurvedLineEditMode) {
        exitCurvedLineEditMode();
      }
      if (e.key === 'Escape' && isStraightLineEditMode) {
        exitStraightLineEditMode();
      }
      if (e.key === 'Escape' && isOrthogonalLineEditMode) {
        exitOrthogonalLineEditMode();
      }
      if (e.key === 'Escape' && isImageEditMode) {
        exitImageEditMode();
      }
      if (e.key === 'Escape' && isMembraneEditMode) {
        exitMembraneEditMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isBezierEditMode, exitBezierEditMode, isCurvedLineEditMode, exitCurvedLineEditMode, isStraightLineEditMode, exitStraightLineEditMode, isOrthogonalLineEditMode, exitOrthogonalLineEditMode, isImageEditMode, exitImageEditMode, isMembraneEditMode, exitMembraneEditMode]);
}
