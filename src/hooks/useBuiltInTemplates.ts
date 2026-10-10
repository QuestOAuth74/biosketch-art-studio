import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TEMPLATES, Template } from "@/lib/templates";

/**
 * Hook that fetches built-in templates from the database.
 * Falls back to hardcoded TEMPLATES if database is empty, errors, or table doesn't exist.
 * Never throws — always returns a valid template array.
 */
export function useBuiltInTemplates() {
  const [templates, setTemplates] = useState<Template[]>(TEMPLATES);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const fetchFromDB = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("built_in_templates")
          .select("id, name, description, category, thumbnail, canvas_data, dimensions, paper_size")
          .eq("is_active", true)
          .order("sort_order", { ascending: true });

        if (cancelled) return;

        if (!error && data && data.length > 0) {
          const mapped: Template[] = data.map((t: any) => ({
            id: t.id,
            name: t.name,
            description: t.description || '',
            category: (t.category || 'scientific') as Template['category'],
            thumbnail: t.thumbnail || '',
            canvasData: t.canvas_data || { version: '6.0.0', objects: [] },
            dimensions: t.dimensions || { width: 1200, height: 800 },
            paperSize: t.paper_size || 'letter',
          }));
          setTemplates(mapped);
        }
        // If error or empty — keep the default TEMPLATES (set in useState init)
      } catch {
        // Silently fall back to hardcoded
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    fetchFromDB();

    return () => { cancelled = true; };
  }, []);

  return { templates, isLoading };
}
