import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

/** Track a tool page visit (once per session per tool) */
export function useTrackToolVisit(toolId: string) {
  useEffect(() => {
    const key = `tool_visited_${toolId}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");

    fetch(`${SUPABASE_URL}/functions/v1/track-tool-visit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tool_id: toolId }),
    }).catch(() => {});
  }, [toolId]);
}

/** Fetch all tool visit counts */
export function useToolVisitCounts() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("tool_visits")
      .select("tool_id, visit_count")
      .then(({ data }) => {
        if (data) {
          const map: Record<string, number> = {};
          data.forEach((row: any) => {
            map[row.tool_id] = row.visit_count;
          });
          setCounts(map);
        }
        setLoading(false);
      });
  }, []);

  return { counts, loading };
}
