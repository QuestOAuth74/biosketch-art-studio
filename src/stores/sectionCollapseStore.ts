import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SectionCollapseState {
  // Map of section IDs to their collapsed state
  sections: Record<string, boolean>;

  // Toggle a specific section
  toggleSection: (sectionId: string) => void;

  // Set a specific section's state
  setSection: (sectionId: string, collapsed: boolean) => void;

  // Get a section's state with optional default value
  getSection: (sectionId: string, defaultCollapsed?: boolean) => boolean;

  // Reset all sections to default (collapsed)
  resetAll: () => void;
}

export const useSectionCollapseStore = create<SectionCollapseState>()(
  persist(
    (set, get) => ({
      sections: {},

      toggleSection: (sectionId: string) =>
        set((state) => {
          // Get current value, defaulting to true (collapsed) if undefined
          const currentValue = state.sections[sectionId] ?? true;
          return {
            sections: {
              ...state.sections,
              [sectionId]: !currentValue,
            },
          };
        }),

      setSection: (sectionId: string, collapsed: boolean) =>
        set((state) => ({
          sections: {
            ...state.sections,
            [sectionId]: collapsed,
          },
        })),

      getSection: (sectionId: string, defaultCollapsed: boolean = true) => {
        const state = get();
        // Use provided default or true (collapsed) if not set
        return state.sections[sectionId] ?? defaultCollapsed;
      },

      resetAll: () => set({ sections: {} }),
    }),
    {
      name: 'section-collapse-storage',
    }
  )
);
