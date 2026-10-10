import { supabase } from "@/integrations/supabase/client";

type EventType =
  | "icon_search"
  | "canvas_click"
  | "canvas_session_start"
  | "canvas_session_end"
  | "tool_use";

interface AnalyticsEvent {
  user_id: string;
  session_id: string;
  event_type: EventType;
  event_data: Record<string, unknown>;
  created_at: string;
}

const BATCH_SIZE = 20;
const FLUSH_INTERVAL_MS = 10_000;

let queue: AnalyticsEvent[] = [];
let flushTimer: ReturnType<typeof setInterval> | null = null;
let sessionId: string | null = null;
let cachedUserId: string | null = null;

function getSessionId(): string {
  if (!sessionId) {
    sessionId = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  }
  return sessionId;
}

async function getUserId(): Promise<string | null> {
  if (cachedUserId) return cachedUserId;
  try {
    const { data } = await supabase.auth.getUser();
    cachedUserId = data.user?.id ?? null;
    return cachedUserId;
  } catch {
    return null;
  }
}

async function flush() {
  if (queue.length === 0) return;

  const batch = queue.splice(0, BATCH_SIZE);

  try {
    // Use raw fetch to bypass TypeScript type checking for the new table
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    await fetch(`${supabaseUrl}/rest/v1/analytics_events`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseKey,
        Authorization: `Bearer ${accessToken || supabaseKey}`,
        Prefer: "return=minimal",
      },
      body: JSON.stringify(batch),
    });
  } catch {
    // Put failed events back at front of queue for retry
    queue.unshift(...batch);
  }
}

function startFlushTimer() {
  if (flushTimer) return;
  flushTimer = setInterval(flush, FLUSH_INTERVAL_MS);
}

function enqueue(event: AnalyticsEvent) {
  queue.push(event);
  startFlushTimer();
  if (queue.length >= BATCH_SIZE) {
    flush();
  }
}

export async function trackEvent(
  eventType: EventType,
  eventData: Record<string, unknown> = {}
) {
  const userId = await getUserId();
  if (!userId) return; // Don't track anonymous users

  enqueue({
    user_id: userId,
    session_id: getSessionId(),
    event_type: eventType,
    event_data: eventData,
    created_at: new Date().toISOString(),
  });
}

export function trackIconSearch(query: string, resultCount: number) {
  trackEvent("icon_search", { query, result_count: resultCount });
}

export function trackCanvasClick(
  x: number,
  y: number,
  canvasWidth: number,
  canvasHeight: number,
  tool: string
) {
  trackEvent("canvas_click", {
    x: Math.round(x),
    y: Math.round(y),
    canvas_width: canvasWidth,
    canvas_height: canvasHeight,
    norm_x: +(x / canvasWidth).toFixed(4),
    norm_y: +(y / canvasHeight).toFixed(4),
    tool,
  });
}

export function trackCanvasSessionStart() {
  trackEvent("canvas_session_start", {
    started_at: new Date().toISOString(),
  });
}

export function trackCanvasSessionEnd(durationMs: number) {
  trackEvent("canvas_session_end", {
    duration_ms: durationMs,
    duration_minutes: +(durationMs / 60_000).toFixed(2),
    ended_at: new Date().toISOString(),
  });
}

export function trackToolUse(tool: string) {
  trackEvent("tool_use", { tool });
}

export function flushAnalytics() {
  flush();
}

// Flush on page unload
if (typeof window !== "undefined") {
  window.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      flush();
    }
  });
  window.addEventListener("beforeunload", () => {
    flush();
  });
}
