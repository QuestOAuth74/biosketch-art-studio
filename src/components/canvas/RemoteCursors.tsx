import { useEffect, useState, type RefObject } from 'react';
import type { PresenceUser } from '@/hooks/usePresence';
import { cursorEvents } from '@/lib/cursorEvents';

interface RemoteCursorsProps {
  users: PresenceUser[];
  /**
   * Ref to the div that wraps FabricCanvas inside the scroll area.
   * Used to locate the scroll area ancestor for offset calculation.
   */
  canvasContainerRef: RefObject<HTMLDivElement>;
  /**
   * Increments whenever the canvas viewport changes (pan or zoom).
   * Forces a re-render so cursor positions update even when the remote
   * user hasn't moved their mouse.
   */
  viewportVersion: number;
  /** The current project — used to subscribe to the correct cursor event stream. */
  projectId: string | null;
  /** The local user's ID — used to ignore our own events on echo (defensive). */
  myUserId: string | null | undefined;
}

/**
 * Renders other users' cursor positions as colored labels overlaid on the canvas.
 *
 * Cursor positions are received via the cursorEvents module (fed by usePresence's
 * low-latency broadcast listener) so state updates only re-render this component,
 * not the parent Canvas.tsx.
 *
 * Coordinates arrive in Fabric canvas space and are converted to screen space using
 * the viewportTransform-aware formula (same as computePinScreenPos in Canvas.tsx):
 *   screenX = (canvasEl.left - scrollEl.left) + cursorX * vpt[0] + vpt[4]
 *   screenY = (canvasEl.top  - scrollEl.top)  + cursorY * vpt[3] + vpt[5]
 */
export function RemoteCursors({
  users,
  canvasContainerRef,
  viewportVersion: _viewportVersion, // consumed only to trigger re-renders on pan/zoom
  projectId,
  myUserId,
}: RemoteCursorsProps) {
  // Cursor positions keyed by userId — updated at ~60 fps via broadcast events
  const [cursors, setCursors] = useState<Record<string, { x: number; y: number }>>({});

  // Subscribe to cursor broadcast events routed through cursorEvents pub/sub
  useEffect(() => {
    if (!projectId) return;
    return cursorEvents.on(projectId, (userId, x, y) => {
      if (userId === myUserId) return;
      setCursors((prev) => ({ ...prev, [userId]: { x, y } }));
    });
  }, [projectId, myUserId]);

  // Remove stale cursor entries when users leave
  useEffect(() => {
    const activeIds = new Set(users.map((u) => u.userId));
    setCursors((prev) => {
      const next: Record<string, { x: number; y: number }> = {};
      for (const [id, pos] of Object.entries(prev)) {
        if (activeIds.has(id)) next[id] = pos;
      }
      return next;
    });
  }, [users]);

  // Only render users who are online AND have a cursor position
  const visible = users.filter((u) => cursors[u.userId]);
  if (visible.length === 0) return null;

  // Read the live viewportTransform from the Fabric canvas instance.
  const fc = (window as any).fabricCanvas;
  const vpt: number[] = fc?.viewportTransform ?? [1, 0, 0, 1, 0, 0];
  const canvasEl = fc?.getElement?.() as HTMLCanvasElement | undefined;

  // Locate the nearest Radix ScrollArea viewport ancestor of the canvas wrapper.
  const containerEl = canvasContainerRef.current;
  const scrollEl =
    (containerEl?.closest('[data-radix-scroll-area-viewport]') as HTMLElement | null) ??
    (containerEl?.parentElement as HTMLElement | null);

  // Pixel offset of the Fabric <canvas> element relative to the scroll area's top-left.
  let canvasOffsetX = 0;
  let canvasOffsetY = 0;
  if (canvasEl && scrollEl) {
    const cr = canvasEl.getBoundingClientRect();
    const sr = scrollEl.getBoundingClientRect();
    canvasOffsetX = cr.left - sr.left;
    canvasOffsetY = cr.top - sr.top;
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 50 }}>
      {visible.map((u) => {
        const cursor = cursors[u.userId];
        // Apply viewportTransform: scale + pan offset, then add canvas element offset.
        const screenX = canvasOffsetX + cursor.x * vpt[0] + vpt[4];
        const screenY = canvasOffsetY + cursor.y * vpt[3] + vpt[5];
        return (
          <div
            key={u.userId}
            className="absolute flex flex-col items-start"
            style={{ left: screenX, top: screenY, transform: 'translate(4px, 4px)' }}
          >
            {/* Cursor arrow */}
            <svg width="14" height="18" viewBox="0 0 14 18" fill="none">
              <path
                d="M0 0 L0 14 L4 10 L7 17 L9 16 L6 9 L12 9 Z"
                fill={u.color}
                stroke="white"
                strokeWidth="1"
              />
            </svg>
            {/* Name label */}
            <span
              className="mt-0.5 px-1.5 py-0.5 rounded text-white text-[10px] font-medium whitespace-nowrap"
              style={{ backgroundColor: u.color }}
            >
              {u.displayName}
            </span>
          </div>
        );
      })}
    </div>
  );
}
