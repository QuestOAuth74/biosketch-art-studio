import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CommandUsage {
  count: number;
  lastUsed: number;
}

interface CommandPaletteState {
  // State
  recentCommands: string[];
  commandUsage: Record<string, CommandUsage>;

  // Actions
  addRecentCommand: (commandId: string) => void;
  trackCommandUsage: (commandId: string) => void;
  clearHistory: () => void;
}

export const useCommandPaletteStore = create<CommandPaletteState>()(
  persist(
    (set) => ({
      // Defaults
      recentCommands: [],
      commandUsage: {},

      // Actions
      addRecentCommand: (commandId) =>
        set((state) => ({
          recentCommands: [
            commandId,
            ...state.recentCommands.filter(id => id !== commandId)
          ].slice(0, 5), // Keep only last 5
        })),

      trackCommandUsage: (commandId) =>
        set((state) => ({
          commandUsage: {
            ...state.commandUsage,
            [commandId]: {
              count: (state.commandUsage[commandId]?.count || 0) + 1,
              lastUsed: Date.now(),
            },
          },
        })),

      clearHistory: () =>
        set({
          recentCommands: [],
          commandUsage: {},
        }),
    }),
    {
      name: 'command-palette-history',
    }
  )
);
