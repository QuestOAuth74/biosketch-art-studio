// Chart Studio — editor state hook

import { useCallback, useEffect, useState } from "react";
import type { ElementKey, EditorState, EditorMode } from "./types";
import { keysEqual } from "./elementKey";

export interface EditorApi {
  state: EditorState;
  select: (k: ElementKey | null) => void;
  hover: (k: ElementKey | null) => void;
  setMode: (m: EditorMode) => void;
  deselect: () => void;
  isSelected: (k: ElementKey) => boolean;
  isHovering: (k: ElementKey) => boolean;
}

export function useEditor(): EditorApi {
  const [state, setState] = useState<EditorState>({
    selected: null,
    hovering: null,
    mode: "idle",
  });

  const select = useCallback((k: ElementKey | null) => {
    setState((s) => (keysEqual(s.selected, k) ? s : { ...s, selected: k }));
  }, []);

  const hover = useCallback((k: ElementKey | null) => {
    setState((s) => (keysEqual(s.hovering, k) ? s : { ...s, hovering: k }));
  }, []);

  const setMode = useCallback((m: EditorMode) => {
    setState((s) => (s.mode === m ? s : { ...s, mode: m }));
  }, []);

  const deselect = useCallback(() => {
    setState((s) => (s.selected === null && s.mode === "idle" ? s : { ...s, selected: null, mode: "idle" }));
  }, []);

  // Esc deselects. Consumers that want different Esc behaviour should handle it before this listener.
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setState((s) => (s.selected === null && s.mode === "idle" ? s : { ...s, selected: null, mode: "idle" }));
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  return {
    state,
    select,
    hover,
    setMode,
    deselect,
    isSelected: (k) => keysEqual(state.selected, k),
    isHovering: (k) => keysEqual(state.hovering, k),
  };
}
