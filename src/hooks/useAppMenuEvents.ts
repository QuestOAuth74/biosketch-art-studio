import { useEffect, useRef } from 'react';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import { useFileActions } from '@/hooks/useFileActions';
import { useViewActions } from '@/hooks/useViewActions';
import { useAboutDialog } from '@/components/app/AboutDialog';

export function useAppMenuEvents() {
  const file = useFileActions();
  const view = useViewActions();

  const actionsRef = useRef({ ...file, ...view });
  actionsRef.current = { ...file, ...view };

  useEffect(() => {
    let unlistenMenu: UnlistenFn | null = null;
    let unlistenOpen: UnlistenFn | null = null;

    listen<string>('app-menu', (event) => {
      const a = actionsRef.current;
      switch (event.payload) {
        case 'new': a.newProject(); break;
        case 'open': void a.openProject(); break;
        case 'save': void a.saveProject(); break;
        case 'save-as': void a.saveProjectAs(); break;
        case 'zoom-in': a.zoomIn(); break;
        case 'zoom-out': a.zoomOut(); break;
        case 'zoom-fit': a.zoomToFit(); break;
        case 'zoom-100': a.zoomTo100(); break;
        case 'toggle-fullscreen': void a.toggleFullscreen(); break;
        case 'toggle-grid': a.toggleGrid(); break;
        case 'toggle-rulers': a.toggleRulers(); break;
        case 'about': useAboutDialog.getState().show(); break;
      }
    }).then((fn) => { unlistenMenu = fn; });

    // Launched with a file (double-click in Explorer/Finder)
    listen<string>('app-open-file', (event) => {
      if (event.payload) void actionsRef.current.openProject(event.payload);
    }).then((fn) => { unlistenOpen = fn; });

    return () => {
      unlistenMenu?.();
      unlistenOpen?.();
    };
  }, []);
}
