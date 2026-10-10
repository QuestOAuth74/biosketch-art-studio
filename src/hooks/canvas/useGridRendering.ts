import { useEffect } from "react";
import { Pattern, type Canvas } from "fabric";

/**
 * Hook #5: Renders grid overlays (lines, dots, isometric) on the canvas.
 * Uses canvas.backgroundColor with a Pattern so the grid is NOT a canvas object
 * and cannot interfere with drag selection or target finding.
 */
export function useGridRendering(
  canvas: Canvas | null,
  gridEnabled: boolean,
  gridPattern: string,
  gridSize: number,
  zoom: number,
  canvasLoadVersion: number,
  syncVersion: number,
) {
  // Main grid rendering
  useEffect(() => {
    if (!canvas) return;

    // Remove any legacy grid Rect objects from older versions
    const objectsToRemove = canvas.getObjects().filter(obj => (obj as any).isGridLine);
    if (objectsToRemove.length > 0) {
      objectsToRemove.forEach(obj => canvas.remove(obj));
    }

    if (gridEnabled) {
      let patternCanvas: HTMLCanvasElement;

      if (gridPattern === 'lines') {
        patternCanvas = document.createElement('canvas');
        patternCanvas.width = gridSize;
        patternCanvas.height = gridSize;
        const ctx = patternCanvas.getContext('2d')!;

        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, gridSize);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(gridSize, 0);
        ctx.stroke();

      } else if (gridPattern === 'dots') {
        patternCanvas = document.createElement('canvas');
        patternCanvas.width = gridSize;
        patternCanvas.height = gridSize;
        const ctx = patternCanvas.getContext('2d')!;

        ctx.fillStyle = '#d0d0d0';
        ctx.beginPath();
        ctx.arc(gridSize / 2, gridSize / 2, 1.5, 0, Math.PI * 2);
        ctx.fill();

      } else if (gridPattern === 'isometric') {
        const isoSize = gridSize * 2;
        const angleRad = (30 * Math.PI) / 180;
        const tanAngle = Math.tan(angleRad);

        patternCanvas = document.createElement('canvas');
        patternCanvas.width = isoSize;
        patternCanvas.height = isoSize;
        const ctx = patternCanvas.getContext('2d')!;

        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(isoSize, 0);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(isoSize, isoSize * tanAngle);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(isoSize, 0);
        ctx.lineTo(0, isoSize * tanAngle);
        ctx.stroke();

      } else {
        canvas.backgroundColor = '';
        canvas.requestRenderAll();
        return;
      }

      // Set grid as canvas background — not a selectable/targetable object
      canvas.backgroundColor = new Pattern({ source: patternCanvas, repeat: 'repeat' });
    } else {
      // Grid disabled — clear the background pattern
      canvas.backgroundColor = '';
    }

    canvas.requestRenderAll();
  }, [canvas, gridEnabled, gridPattern, gridSize, zoom, canvasLoadVersion, syncVersion]);

  // Clean up legacy on-canvas ruler objects
  useEffect(() => {
    if (!canvas) return;
    const rulersToRemove = canvas.getObjects().filter(obj => (obj as any).isRuler);
    if (rulersToRemove.length > 0) {
      rulersToRemove.forEach(obj => canvas.remove(obj));
      canvas.requestRenderAll();
    }
  }, [canvas, canvasLoadVersion]);
}
