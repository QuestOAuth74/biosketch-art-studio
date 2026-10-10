import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { cursorEvents } from '@/lib/cursorEvents';

// 8 distinct colors assigned deterministically per user
const PRESENCE_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#06b6d4', // cyan
  '#3b82f6', // blue
  '#8b5cf6', // violet
  '#ec4899', // pink
];

function hashUserId(userId: string): number {
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function getUserColor(userId: string): string {
  return PRESENCE_COLORS[hashUserId(userId) % PRESENCE_COLORS.length];
}

export interface PresenceUser {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  color: string;
}

// Presence payload — join/leave metadata only (no cursor; cursors travel via broadcast)
interface TrackPayload {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  color: string;
}

// High-frequency cursor broadcast payload (sent via channel.send, not channel.track)
interface CursorBroadcastPayload {
  userId: string;
  x: number;
  y: number;
}

interface UsePresenceReturn {
  presentUsers: PresenceUser[];
  myColor: string;
  broadcastCursor: (x: number, y: number) => void;
}

/** Throttle for cursor broadcasts — ~60 fps. */
const CURSOR_THROTTLE_MS = 16;

/** Build the presentUsers list from a Supabase presenceState, excluding myUserId. */
export function buildPresentUsers(
  presenceState: Record<string, TrackPayload[]>,
  myUserId: string,
): PresenceUser[] {
  return Object.entries(presenceState)
    .filter(([key]) => key !== myUserId)
    .map(([, presences]) => {
      const p = presences[0] as TrackPayload;
      return {
        userId: p.userId,
        displayName: p.displayName || 'Unknown',
        avatarUrl: p.avatarUrl ?? null,
        color: p.color,
      };
    });
}

export function usePresence(
  projectId: string | null,
  userId: string | null | undefined,
  displayName: string | null | undefined,
  avatarUrl: string | null | undefined,
  isObserver: boolean = false,
): UsePresenceReturn {
  const [presentUsers, setPresentUsers] = useState<PresenceUser[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastCursorSentRef = useRef<number>(0);
  const myColor = userId ? getUserColor(userId) : PRESENCE_COLORS[0];

  useEffect(() => {
    if (!projectId || !userId) return;

    const channelName = `presence:${projectId}`;
    const channel = supabase.channel(channelName, {
      config: { presence: { key: userId } },
    });

    // Presence sync — fires on join/leave only (cursor moves no longer go through track)
    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState<TrackPayload>();
      const users = buildPresentUsers(state as Record<string, TrackPayload[]>, userId);
      setPresentUsers(users);
    });

    // High-frequency cursor broadcasts — routed to RemoteCursors via cursorEvents pub/sub,
    // bypassing React state in Canvas.tsx entirely.
    channel.on('broadcast', { event: 'cursor-move' }, ({ payload }) => {
      const p = payload as CursorBroadcastPayload;
      if (p.userId === userId) return; // Supabase doesn't echo to sender but be explicit
      cursorEvents.emit(projectId, p.userId, p.x, p.y);
    });

    channel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && !isObserver) {
        const payload: TrackPayload = {
          userId,
          displayName: displayName || 'Unknown',
          avatarUrl: avatarUrl ?? null,
          color: myColor,
        };
        await channel.track(payload);
      }
    });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [projectId, userId, displayName, avatarUrl, myColor, isObserver]);

  /**
   * Send cursor position as a low-latency broadcast (not a presence track).
   * Throttled to ~60 fps. Canvas.tsx calls this from FabricCanvas's mouse:move handler.
   */
  const broadcastCursor = useCallback((x: number, y: number) => {
    if (isObserver) return; // Stealth mode — don't broadcast cursor

    const now = Date.now();
    if (now - lastCursorSentRef.current < CURSOR_THROTTLE_MS) return;
    lastCursorSentRef.current = now;

    if (!channelRef.current || !userId) return;
    channelRef.current.send({
      type: 'broadcast',
      event: 'cursor-move',
      payload: { userId, x, y } as CursorBroadcastPayload,
    });
  }, [userId, isObserver]);

  return { presentUsers, myColor, broadcastCursor };
}
