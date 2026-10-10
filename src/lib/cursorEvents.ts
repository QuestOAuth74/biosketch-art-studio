/**
 * Module-level pub/sub for cursor position updates.
 *
 * usePresence receives cursor-move broadcast events from Supabase and calls
 * cursorEvents.emit(). RemoteCursors subscribes via cursorEvents.on() and
 * updates its own local state — so cursor moves never touch React state in
 * Canvas.tsx (no cascade re-renders of the main canvas component).
 */

type CursorHandler = (userId: string, x: number, y: number) => void;

const subs = new Map<string, Set<CursorHandler>>();

export const cursorEvents = {
  emit(projectId: string, userId: string, x: number, y: number) {
    subs.get(projectId)?.forEach((fn) => fn(userId, x, y));
  },

  on(projectId: string, fn: CursorHandler): () => void {
    if (!subs.has(projectId)) subs.set(projectId, new Set());
    subs.get(projectId)!.add(fn);
    return () => subs.get(projectId)?.delete(fn);
  },
};
