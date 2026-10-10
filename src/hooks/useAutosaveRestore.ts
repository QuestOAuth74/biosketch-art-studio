import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { useCanvas } from '@/contexts/CanvasContext';
import { useFileSession } from '@/stores/fileSessionStore';
import { readAutosaveSnapshot, clearAutosaveSnapshot } from '@/hooks/useAutosave';

/**
 * On canvas-ready, if an autosave snapshot exists and no file is being
 * opened, surface a toast with a "Restore" action. Fires at most once per
 * app session.
 */
export function useAutosaveRestore() {
  const { canvas, setProjectName, setSaveStatus } = useCanvas();
  const { setCurrentFilePath } = useFileSession();
  const promptedRef = useRef(false);

  useEffect(() => {
    if (!canvas || promptedRef.current) return;
    const snap = readAutosaveSnapshot();
    if (!snap) return;
    promptedRef.current = true;

    const savedAt = new Date(snap.savedAt);
    const relative = Math.max(1, Math.round((Date.now() - savedAt.getTime()) / 60_000));
    const timeLabel = relative < 60 ? `${relative} min ago` : savedAt.toLocaleString();

    toast('Unsaved work found', {
      description: `From ${timeLabel}. Restore it?`,
      duration: 20_000,
      action: {
        label: 'Restore',
        onClick: async () => {
          try {
            await canvas.loadFromJSON(snap.canvas);
            canvas.renderAll();
            setProjectName(snap.projectName);
            setCurrentFilePath(snap.filePath);
            setSaveStatus('unsaved');
            toast.success('Previous session restored');
          } catch (e: any) {
            toast.error(e?.message || 'Could not restore');
          }
        },
      },
      cancel: {
        label: 'Dismiss',
        onClick: () => clearAutosaveSnapshot(),
      },
    });
  }, [canvas, setProjectName, setCurrentFilePath, setSaveStatus]);
}
