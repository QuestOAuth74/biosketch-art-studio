import { useEffect, useRef } from 'react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { ask } from '@tauri-apps/plugin-dialog';
import { useCanvas } from '@/contexts/CanvasContext';

export function useUnsavedWarning() {
  const { saveStatus } = useCanvas();
  const statusRef = useRef(saveStatus);
  statusRef.current = saveStatus;

  useEffect(() => {
    let unlisten: (() => void) | null = null;
    const win = getCurrentWindow();
    win.onCloseRequested(async (event) => {
      if (statusRef.current === 'unsaved') {
        const proceed = await ask('You have unsaved changes. Close anyway?', {
          title: 'Unsaved changes',
          kind: 'warning',
        });
        if (!proceed) event.preventDefault();
      }
    }).then((fn) => { unlisten = fn; });
    return () => { unlisten?.(); };
  }, []);
}
