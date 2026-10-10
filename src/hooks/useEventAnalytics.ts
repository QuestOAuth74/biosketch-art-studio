import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SearchEvent {
  query: string;
  result_count: number;
  created_at: string;
}

interface ClickEvent {
  norm_x: number;
  norm_y: number;
  tool: string;
}

interface SessionEvent {
  duration_minutes: number;
  ended_at: string;
}

interface ToolEvent {
  tool: string;
  count: number;
}

async function fetchEvents(eventType: string, limit = 5000) {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const { data: { session } } = await supabase.auth.getSession();
  const accessToken = session?.access_token;

  const params = new URLSearchParams({
    event_type: `eq.${eventType}`,
    order: "created_at.desc",
    limit: String(limit),
  });

  const res = await fetch(`${supabaseUrl}/rest/v1/analytics_events?${params}`, {
    headers: {
      apikey: supabaseKey,
      Authorization: `Bearer ${accessToken || supabaseKey}`,
    },
  });

  if (!res.ok) throw new Error(`Failed to fetch ${eventType} events`);
  return res.json();
}

export function useTopSearches() {
  return useQuery({
    queryKey: ["analytics", "top-searches"],
    queryFn: async () => {
      const rows = await fetchEvents("icon_search", 10000);

      const counts: Record<string, { count: number; total_results: number }> = {};
      for (const row of rows) {
        const q = (row.event_data as SearchEvent).query?.toLowerCase().trim();
        if (!q) continue;
        if (!counts[q]) counts[q] = { count: 0, total_results: 0 };
        counts[q].count++;
        counts[q].total_results += (row.event_data as SearchEvent).result_count ?? 0;
      }

      return Object.entries(counts)
        .map(([query, { count, total_results }]) => ({
          query,
          count,
          avg_results: Math.round(total_results / count),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 20);
    },
    staleTime: 60_000,
  });
}

export function useClickHeatmap() {
  return useQuery({
    queryKey: ["analytics", "click-heatmap"],
    queryFn: async () => {
      const rows = await fetchEvents("canvas_click", 10000);
      return rows.map((r: any) => r.event_data as ClickEvent);
    },
    staleTime: 60_000,
  });
}

export function useSessionStats() {
  return useQuery({
    queryKey: ["analytics", "session-stats"],
    queryFn: async () => {
      const rows = await fetchEvents("canvas_session_end", 5000);
      const durations = rows
        .map((r: any) => (r.event_data as SessionEvent).duration_minutes)
        .filter((d: number) => d != null && d > 0);

      if (durations.length === 0) {
        return { avg: 0, median: 0, total_sessions: 0, buckets: [] };
      }

      durations.sort((a: number, b: number) => a - b);
      const avg = durations.reduce((s: number, v: number) => s + v, 0) / durations.length;
      const median = durations[Math.floor(durations.length / 2)];

      // Bucket into time ranges
      const bucketDefs = [
        { label: "< 1 min", min: 0, max: 1 },
        { label: "1-5 min", min: 1, max: 5 },
        { label: "5-15 min", min: 5, max: 15 },
        { label: "15-30 min", min: 15, max: 30 },
        { label: "30-60 min", min: 30, max: 60 },
        { label: "60+ min", min: 60, max: Infinity },
      ];

      const buckets = bucketDefs.map(({ label, min, max }) => ({
        label,
        count: durations.filter((d: number) => d >= min && d < max).length,
      }));

      return {
        avg: +avg.toFixed(1),
        median: +median.toFixed(1),
        total_sessions: durations.length,
        buckets,
      };
    },
    staleTime: 60_000,
  });
}

export function useTopTools() {
  return useQuery({
    queryKey: ["analytics", "top-tools"],
    queryFn: async () => {
      const rows = await fetchEvents("tool_use", 10000);

      const counts: Record<string, number> = {};
      for (const row of rows) {
        const tool = (row.event_data as { tool: string }).tool;
        if (!tool) continue;
        counts[tool] = (counts[tool] || 0) + 1;
      }

      return Object.entries(counts)
        .map(([tool, count]) => ({ tool, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15) as ToolEvent[];
    },
    staleTime: 60_000,
  });
}
