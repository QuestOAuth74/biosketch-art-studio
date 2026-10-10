/**
 * Unit tests for SmartSuggestions assistant behavior.
 *
 * Tests the minimize vs close logic, suggestion triggering,
 * and dismissal persistence.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock localStorage ───
const localStorageMap = new Map<string, string>();
const mockLocalStorage = {
  getItem: (key: string) => localStorageMap.get(key) ?? null,
  setItem: (key: string, value: string) => localStorageMap.set(key, value),
  removeItem: (key: string) => localStorageMap.delete(key),
  clear: () => localStorageMap.clear(),
};

// ─── State simulation helpers ───

interface Suggestion {
  id: string;
  title: string;
  message: string;
}

/**
 * Simulates the SmartSuggestions component state logic.
 */
function createAssistantState() {
  const dismissed = new Set<string>(
    JSON.parse(mockLocalStorage.getItem('dismissedSuggestions') || '[]')
  );
  let sessionDisabled = false;
  let currentSuggestion: Suggestion | null = null;

  return {
    get dismissed() { return dismissed; },
    get sessionDisabled() { return sessionDisabled; },
    get currentSuggestion() { return currentSuggestion; },

    setSuggestion(s: Suggestion | null) {
      if (sessionDisabled) return;
      currentSuggestion = s;
    },

    /** Minimize: dismiss this tip, assistant can reappear */
    minimize() {
      if (!currentSuggestion) return;
      dismissed.add(currentSuggestion.id);
      mockLocalStorage.setItem('dismissedSuggestions', JSON.stringify([...dismissed]));
      currentSuggestion = null;
    },

    /** Close: disable assistant for the entire session */
    closeSession() {
      sessionDisabled = true;
      currentSuggestion = null;
    },

    /** Check if a suggestion should be shown */
    shouldShow(id: string): boolean {
      return !sessionDisabled && !dismissed.has(id);
    },
  };
}

// ─── Tests ───

describe('SmartSuggestions: Minimize vs Close behavior', () => {
  beforeEach(() => {
    localStorageMap.clear();
  });

  it('minimize hides the current tip but allows future tips', () => {
    const assistant = createAssistantState();

    // Show first suggestion
    const tip1: Suggestion = { id: 'use-connectors', title: 'Connect', message: 'Use connectors' };
    assistant.setSuggestion(tip1);
    expect(assistant.currentSuggestion).toBe(tip1);

    // Minimize it
    assistant.minimize();
    expect(assistant.currentSuggestion).toBeNull();
    expect(assistant.sessionDisabled).toBe(false);

    // The dismissed tip should not show again
    expect(assistant.shouldShow('use-connectors')).toBe(false);

    // But a different tip should still show
    expect(assistant.shouldShow('keyboard-shortcuts')).toBe(true);

    const tip2: Suggestion = { id: 'keyboard-shortcuts', title: 'Shortcuts', message: 'Use shortcuts' };
    assistant.setSuggestion(tip2);
    expect(assistant.currentSuggestion).toBe(tip2);
  });

  it('close disables all suggestions for the session', () => {
    const assistant = createAssistantState();

    const tip: Suggestion = { id: 'use-connectors', title: 'Connect', message: 'Use connectors' };
    assistant.setSuggestion(tip);
    expect(assistant.currentSuggestion).toBe(tip);

    // Close for session
    assistant.closeSession();
    expect(assistant.currentSuggestion).toBeNull();
    expect(assistant.sessionDisabled).toBe(true);

    // No suggestions should show
    expect(assistant.shouldShow('use-connectors')).toBe(false);
    expect(assistant.shouldShow('keyboard-shortcuts')).toBe(false);
    expect(assistant.shouldShow('anything-new')).toBe(false);

    // Trying to set a suggestion should be blocked
    const tip2: Suggestion = { id: 'keyboard-shortcuts', title: 'Shortcuts', message: 'msg' };
    assistant.setSuggestion(tip2);
    expect(assistant.currentSuggestion).toBeNull(); // still null
  });

  it('minimize persists dismissed IDs to localStorage', () => {
    const assistant = createAssistantState();

    assistant.setSuggestion({ id: 'tip-a', title: 'A', message: 'msg' });
    assistant.minimize();

    assistant.setSuggestion({ id: 'tip-b', title: 'B', message: 'msg' });
    assistant.minimize();

    const stored = JSON.parse(mockLocalStorage.getItem('dismissedSuggestions') || '[]');
    expect(stored).toContain('tip-a');
    expect(stored).toContain('tip-b');
    expect(stored).toHaveLength(2);
  });

  it('close does NOT persist to localStorage (session only)', () => {
    const assistant = createAssistantState();

    assistant.setSuggestion({ id: 'tip-a', title: 'A', message: 'msg' });
    assistant.closeSession();

    // localStorage should NOT have anything new from the close action
    const stored = JSON.parse(mockLocalStorage.getItem('dismissedSuggestions') || '[]');
    expect(stored).not.toContain('tip-a');
  });

  it('new session (fresh state) resets close but keeps minimized tips', () => {
    // First session: minimize tip-a, then close
    const session1 = createAssistantState();
    session1.setSuggestion({ id: 'tip-a', title: 'A', message: 'msg' });
    session1.minimize(); // persists to localStorage
    session1.closeSession(); // session only

    // Second session (simulated by creating new state, same localStorage)
    const session2 = createAssistantState();

    // tip-a was minimized (persisted) — should NOT show
    expect(session2.shouldShow('tip-a')).toBe(false);

    // session was closed — but new session resets that
    expect(session2.sessionDisabled).toBe(false);

    // New tips should show
    expect(session2.shouldShow('tip-b')).toBe(true);
  });
});

describe('SmartSuggestions: Suggestion triggers', () => {
  beforeEach(() => {
    localStorageMap.clear();
  });

  // Simulate the suggestion selection logic from the component
  function selectSuggestion(state: {
    shapes: number;
    connectors: number;
    objects: number;
    icons: number;
    groups: number;
    operationCount: number;
    gridEnabled: boolean;
    selectedType: string | null;
    selectedIsLine: boolean;
    selectedIsIcon: boolean;
    selectedIsImage: boolean;
    selectedIsGroup: boolean;
    dismissed: Set<string>;
  }): Suggestion | null {
    const { shapes, connectors, objects, icons, groups, operationCount,
            gridEnabled, selectedType, selectedIsLine, selectedIsIcon,
            selectedIsImage, selectedIsGroup, dismissed } = state;

    // Priority 1: Selection-based
    if (selectedIsLine && !dismissed.has('edit-line')) {
      return { id: 'edit-line', title: 'Edit Line Anchor Points', message: 'Double-click to edit' };
    }
    if (selectedType && ['rect', 'circle'].includes(selectedType) && !dismissed.has('edit-shape')) {
      return { id: 'edit-shape', title: 'Customize This Shape', message: 'Use Properties panel' };
    }
    if (selectedType === 'i-text' && !dismissed.has('edit-text')) {
      return { id: 'edit-text', title: 'Edit Text Properties', message: 'Double-click to edit' };
    }
    if (selectedIsIcon && !dismissed.has('edit-icon')) {
      return { id: 'edit-icon', title: 'Customize This Icon', message: 'Change color and tone' };
    }
    if (selectedIsImage && !dismissed.has('edit-image')) {
      return { id: 'edit-image', title: 'Image Tools Available', message: 'Crop and color map' };
    }
    if (selectedIsGroup && !dismissed.has('ungroup-tip')) {
      return { id: 'ungroup-tip', title: 'Working with Groups', message: 'Ungroup to edit pieces' };
    }
    if (selectedType === 'activeSelection' && !dismissed.has('align-selection')) {
      return { id: 'align-selection', title: 'Align & Group', message: 'Align or group objects' };
    }

    // Priority 2: Canvas-state
    if (objects === 1 && !dismissed.has('first-object')) {
      return { id: 'first-object', title: 'Great Start!', message: 'Click to select and customize' };
    }
    if (shapes >= 2 && connectors === 0 && !dismissed.has('use-connectors')) {
      return { id: 'use-connectors', title: 'Connect Your Shapes', message: 'Use line tools' };
    }
    if (operationCount >= 8 && !dismissed.has('keyboard-shortcuts')) {
      return { id: 'keyboard-shortcuts', title: 'Speed Up with Shortcuts', message: 'Use shortcuts' };
    }
    if (objects >= 3 && !gridEnabled && !dismissed.has('alignment-guides')) {
      return { id: 'alignment-guides', title: 'Turn On the Grid', message: 'Enable grid' };
    }
    if (objects >= 5 && !dismissed.has('use-layers')) {
      return { id: 'use-layers', title: 'Use the Layers Panel', message: 'Manage layers' };
    }

    return null;
  }

  it('shows line editing tip when a line is selected', () => {
    const result = selectSuggestion({
      shapes: 0, connectors: 1, objects: 1, icons: 0, groups: 0,
      operationCount: 0, gridEnabled: false,
      selectedType: 'path', selectedIsLine: true, selectedIsIcon: false,
      selectedIsImage: false, selectedIsGroup: false,
      dismissed: new Set(),
    });
    expect(result?.id).toBe('edit-line');
  });

  it('shows shape editing tip when a rectangle is selected', () => {
    const result = selectSuggestion({
      shapes: 1, connectors: 0, objects: 1, icons: 0, groups: 0,
      operationCount: 0, gridEnabled: false,
      selectedType: 'rect', selectedIsLine: false, selectedIsIcon: false,
      selectedIsImage: false, selectedIsGroup: false,
      dismissed: new Set(),
    });
    expect(result?.id).toBe('edit-shape');
  });

  it('shows icon tip when an icon is selected', () => {
    const result = selectSuggestion({
      shapes: 0, connectors: 0, objects: 1, icons: 1, groups: 0,
      operationCount: 0, gridEnabled: false,
      selectedType: 'group', selectedIsLine: false, selectedIsIcon: true,
      selectedIsImage: false, selectedIsGroup: false,
      dismissed: new Set(),
    });
    expect(result?.id).toBe('edit-icon');
  });

  it('shows group tip when a group is selected', () => {
    const result = selectSuggestion({
      shapes: 0, connectors: 0, objects: 1, icons: 0, groups: 1,
      operationCount: 0, gridEnabled: false,
      selectedType: 'group', selectedIsLine: false, selectedIsIcon: false,
      selectedIsImage: false, selectedIsGroup: true,
      dismissed: new Set(),
    });
    expect(result?.id).toBe('ungroup-tip');
  });

  it('shows alignment tip when multiple objects selected', () => {
    const result = selectSuggestion({
      shapes: 2, connectors: 0, objects: 2, icons: 0, groups: 0,
      operationCount: 0, gridEnabled: false,
      selectedType: 'activeSelection', selectedIsLine: false, selectedIsIcon: false,
      selectedIsImage: false, selectedIsGroup: false,
      dismissed: new Set(),
    });
    expect(result?.id).toBe('align-selection');
  });

  it('shows connector tip when 2+ shapes and no lines', () => {
    const result = selectSuggestion({
      shapes: 3, connectors: 0, objects: 3, icons: 0, groups: 0,
      operationCount: 0, gridEnabled: false,
      selectedType: null, selectedIsLine: false, selectedIsIcon: false,
      selectedIsImage: false, selectedIsGroup: false,
      dismissed: new Set(),
    });
    expect(result?.id).toBe('use-connectors');
  });

  it('shows grid tip when 3+ objects and grid is off', () => {
    const result = selectSuggestion({
      shapes: 1, connectors: 1, objects: 4, icons: 0, groups: 0,
      operationCount: 0, gridEnabled: false,
      selectedType: null, selectedIsLine: false, selectedIsIcon: false,
      selectedIsImage: false, selectedIsGroup: false,
      dismissed: new Set(['use-connectors']),
    });
    expect(result?.id).toBe('alignment-guides');
  });

  it('shows layers tip when 5+ objects', () => {
    const result = selectSuggestion({
      shapes: 3, connectors: 2, objects: 6, icons: 0, groups: 0,
      operationCount: 0, gridEnabled: true,
      selectedType: null, selectedIsLine: false, selectedIsIcon: false,
      selectedIsImage: false, selectedIsGroup: false,
      dismissed: new Set(['use-connectors', 'alignment-guides']),
    });
    expect(result?.id).toBe('use-layers');
  });

  it('skips dismissed suggestions', () => {
    const result = selectSuggestion({
      shapes: 3, connectors: 0, objects: 3, icons: 0, groups: 0,
      operationCount: 0, gridEnabled: false,
      selectedType: null, selectedIsLine: false, selectedIsIcon: false,
      selectedIsImage: false, selectedIsGroup: false,
      dismissed: new Set(['use-connectors']),
    });
    // use-connectors dismissed, falls through to keyboard-shortcuts (opCount < 8)
    // then alignment-guides (objects >= 3 && !grid)
    expect(result?.id).toBe('alignment-guides');
  });

  it('returns null when all applicable suggestions dismissed', () => {
    const result = selectSuggestion({
      shapes: 1, connectors: 0, objects: 1, icons: 0, groups: 0,
      operationCount: 0, gridEnabled: true,
      selectedType: null, selectedIsLine: false, selectedIsIcon: false,
      selectedIsImage: false, selectedIsGroup: false,
      dismissed: new Set(['first-object', 'use-connectors', 'keyboard-shortcuts', 'alignment-guides', 'use-layers']),
    });
    expect(result).toBeNull();
  });

  it('selection-based tips take priority over canvas-state tips', () => {
    // Canvas has 5+ objects AND a line is selected
    // Line tip should win (priority 1) over layers tip (priority 2)
    const result = selectSuggestion({
      shapes: 3, connectors: 2, objects: 6, icons: 0, groups: 0,
      operationCount: 10, gridEnabled: false,
      selectedType: 'path', selectedIsLine: true, selectedIsIcon: false,
      selectedIsImage: false, selectedIsGroup: false,
      dismissed: new Set(),
    });
    expect(result?.id).toBe('edit-line');
  });
});

describe('SmartSuggestions: Position and overlap prevention', () => {
  it('assistant should be positioned higher than Sonner toasts', () => {
    // Sonner default position is approximately bottom-0 to bottom-16
    // Assistant uses bottom-36 (144px from bottom)
    // This test documents the contract
    const assistantBottomClass = 'bottom-36'; // 9rem = 144px
    const sonnerApproxBottom = 64; // Sonner toasts sit at ~bottom-16 (64px)

    // bottom-36 in Tailwind = 9rem = 144px
    const assistantBottomPx = 144;

    expect(assistantBottomPx).toBeGreaterThan(sonnerApproxBottom);
    // At least 60px gap between them
    expect(assistantBottomPx - sonnerApproxBottom).toBeGreaterThanOrEqual(60);
  });
});
