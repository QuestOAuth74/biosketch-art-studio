import { useCallback } from 'react';
import { toast } from 'sonner';
import { useCanvas } from '@/contexts/CanvasContext';
import { useFileSession } from '@/stores/fileSessionStore';
import { saveProjectToFile, openProjectFromFile } from '@/lib/fileIO';

export function useFileActions() {
  const { canvas, projectName, setProjectName, canvasDimensions, setSaveStatus } = useCanvas();
  const { currentFilePath, setCurrentFilePath, addRecentFile } = useFileSession();

  const newProject = useCallback(() => {
    if (!canvas) return;
    canvas.clear();
    canvas.backgroundColor = '#ffffff';
    canvas.renderAll();
    setProjectName('Untitled');
    setCurrentFilePath(null);
    setSaveStatus('saved');
  }, [canvas, setProjectName, setCurrentFilePath, setSaveStatus]);

  const openProject = useCallback(async (explicitPath?: string) => {
    if (!canvas) return;
    try {
      const result = await openProjectFromFile(explicitPath);
      if (!result) return;
      await canvas.loadFromJSON(result.file.canvas);
      canvas.renderAll();
      setProjectName(result.file.projectName);
      setCurrentFilePath(result.path);
      addRecentFile(result.path);
      setSaveStatus('saved');
      toast.success('Project opened');
    } catch (e: any) {
      toast.error(e?.message || 'Open failed');
    }
  }, [canvas, setProjectName, setCurrentFilePath, addRecentFile, setSaveStatus]);

  const saveProject = useCallback(async (forceSaveAs = false) => {
    if (!canvas) return;
    try {
      const path = await saveProjectToFile({
        canvas,
        projectName,
        dimensions: canvasDimensions,
        path: forceSaveAs ? null : currentFilePath,
      });
      if (path) {
        setCurrentFilePath(path);
        addRecentFile(path);
        const basename = path.split(/[\\/]/).pop()?.replace(/\.biosketch$/i, '');
        if (basename) setProjectName(basename);
        setSaveStatus('saved');
        toast.success('Project saved');
      }
    } catch (e: any) {
      toast.error(e?.message || 'Save failed');
    }
  }, [canvas, projectName, canvasDimensions, currentFilePath, setCurrentFilePath, addRecentFile, setProjectName, setSaveStatus]);

  const saveProjectAs = useCallback(() => saveProject(true), [saveProject]);

  return { newProject, openProject, saveProject, saveProjectAs };
}
