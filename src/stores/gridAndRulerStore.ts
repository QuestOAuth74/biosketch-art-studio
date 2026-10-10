import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface GridAndRulerState {
  // State
  gridEnabled: boolean;
  rulersEnabled: boolean;
  snapToGrid: boolean;
  gridSize: number;
  gridPattern: 'lines' | 'dots' | 'isometric';

  // Actions
  setGridEnabled: (enabled: boolean) => void;
  setRulersEnabled: (enabled: boolean) => void;
  setSnapToGrid: (enabled: boolean) => void;
  setGridSize: (size: number) => void;
  setGridPattern: (pattern: 'lines' | 'dots' | 'isometric') => void;
  resetToDefaults: () => void;
}

export const useGridAndRulerStore = create<GridAndRulerState>()(
  persist(
    (set) => ({
      // Defaults — grid, rulers, and snap active by default
      gridEnabled: true,
      rulersEnabled: true,
      snapToGrid: false,
      gridSize: 20,
      gridPattern: 'lines',

      // Actions
      setGridEnabled: (enabled) => set({ gridEnabled: enabled }),
      setRulersEnabled: (enabled) => set({ rulersEnabled: enabled }),
      setSnapToGrid: (enabled) => set({ snapToGrid: enabled }),
      setGridSize: (size) => set({ gridSize: Math.max(10, Math.min(100, size)) }),
      setGridPattern: (pattern) => set({ gridPattern: pattern }),

      resetToDefaults: () => set({
        gridEnabled: false,
        rulersEnabled: false,
        snapToGrid: false,
        gridSize: 20,
        gridPattern: 'lines',
      }),
    }),
    {
      name: 'grid-ruler-settings',
      version: 2,
      migrate: (persisted: any) => ({
        ...persisted,
        // v2: snap-to-grid should default to off
        snapToGrid: false,
      }),
    }
  )
);
