import { create } from 'zustand';

const KEY = 'biosketch-settings';

interface Settings {
  watermarkEnabled: boolean;
}

const defaults: Settings = {
  watermarkEnabled: true,
};

const readSettings = (): Settings => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw);
    return { ...defaults, ...parsed };
  } catch {
    return defaults;
  }
};

interface SettingsState extends Settings {
  setWatermarkEnabled: (v: boolean) => void;
}

export const useSettings = create<SettingsState>((set) => ({
  ...readSettings(),
  setWatermarkEnabled: (v) =>
    set((s) => {
      const next = { ...s, watermarkEnabled: v };
      localStorage.setItem(KEY, JSON.stringify({ watermarkEnabled: next.watermarkEnabled }));
      return { watermarkEnabled: v };
    }),
}));
