import { useEffect, useRef } from 'react';
import { useCanvas, CANVAS_CUSTOM_PROPS } from '@/contexts/CanvasContext';
import { useFileSession } from '@/stores/fileSessionStore';

const AUTOSAVE_KEY = 'biosketch-autosave';
const AUTOSAVE_INTERVAL_MS = 10_000;

interface AutosavePayload {
  canvas: any;
  projectName: string;
  dimensions: { width: number; height: number };
  filePath: string | null;
  savedAt: string;
}

/**
 * Debounces `canvas.toJSON()` to localStorage every ~10 seconds while there
 * are unsaved changes. Cleared after an explicit file save (saveStatus flips
 * to 'saved' via useFileActions). Readable by useAutosaveRestore on launch.
 */
export function useAutosave() {
  const { canvas, projectName, canvasDimensions, saveStatus } = useCanvas();
  const { currentFilePath } = useFileSession();
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!canvas) return;

    const takeSnapshot = () => {
      if (saveStatus !== 'unsaved') return;
      try {
        const payload: AutosavePayload = {
          canvas: canvas.toJSON(CANVAS_CUSTOM_PROPS),
          projectName,
          dimensions: canvasDimensions,
          filePath: currentFilePath,
          savedAt: new Date().toISOString(),
        };
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(payload));
      } catch (e) {
        // localStorage can throw on quota; silent — autosave is best-effort.
        console.warn('[autosave] failed', e);
      }
    };

    timerRef.current = window.setInterval(takeSnapshot, AUTOSAVE_INTERVAL_MS);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [canvas, projectName, canvasDimensions, currentFilePath, saveStatus]);

  // Clear snapshot when user explicitly saves (saveStatus returns to 'saved').
  useEffect(() => {
    if (saveStatus === 'saved') {
      localStorage.removeItem(AUTOSAVE_KEY);
    }
  }, [saveStatus]);
}

export function readAutosaveSnapshot(): AutosavePayload | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AutosavePayload;
  } catch {
    return null;
  }
}

export function clearAutosaveSnapshot() {
  localStorage.removeItem(AUTOSAVE_KEY);
}
