import { useCallback } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useCanvas } from '@/contexts/CanvasContext';
import { useGridAndRulerStore } from '@/stores/gridAndRulerStore';

export function useViewActions() {
  const { zoomIn, zoomOut, zoomToFit, resetZoom } = useCanvas();
  const { gridEnabled, rulersEnabled, setGridEnabled, setRulersEnabled } = useGridAndRulerStore();

  const toggleFullscreen = useCallback(async () => {
    const win = getCurrentWindow();
    const isFs = await win.isFullscreen();
    await win.setFullscreen(!isFs);
  }, []);

  const toggleGrid = useCallback(() => setGridEnabled(!gridEnabled), [gridEnabled, setGridEnabled]);
  const toggleRulers = useCallback(() => setRulersEnabled(!rulersEnabled), [rulersEnabled, setRulersEnabled]);

  return {
    zoomIn,
    zoomOut,
    zoomToFit,
    zoomTo100: resetZoom,
    toggleFullscreen,
    toggleGrid,
    toggleRulers,
  };
}
