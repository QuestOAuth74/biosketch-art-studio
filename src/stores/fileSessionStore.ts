import { create } from 'zustand';

const RECENT_KEY = 'biosketch-recent-files';
const MAX_RECENT = 10;

const readRecent = (): string[] => {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((s) => typeof s === 'string') : [];
  } catch {
    return [];
  }
};

interface FileSessionState {
  currentFilePath: string | null;
  recentFiles: string[];
  setCurrentFilePath: (p: string | null) => void;
  addRecentFile: (p: string) => void;
  clearRecentFiles: () => void;
}

export const useFileSession = create<FileSessionState>((set) => ({
  currentFilePath: null,
  recentFiles: readRecent(),
  setCurrentFilePath: (p) => set({ currentFilePath: p }),
  addRecentFile: (p) =>
    set((s) => {
      const next = [p, ...s.recentFiles.filter((f) => f !== p)].slice(0, MAX_RECENT);
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      return { recentFiles: next };
    }),
  clearRecentFiles: () => {
    localStorage.removeItem(RECENT_KEY);
    set({ recentFiles: [] });
  },
}));
