import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LinePreset, LinePresetCategory, LINE_PRESET_CATEGORIES } from "@/types/linePresets";
import { toast } from "sonner";

export function useLinePresets() {
  const [presets, setPresets] = useState<Record<LinePresetCategory, LinePreset[]>>(
    () => Object.fromEntries(LINE_PRESET_CATEGORIES.map(c => [c, []])) as any
  );
  const [loading, setLoading] = useState(true);

  const fetchPresets = useCallback(async () => {
    setLoading(true);
    try {
    const { data, error } = await (supabase as any)
      .from("line_presets")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    if (error) {
      console.error("Failed to load line presets:", error);
      setLoading(false);
      return;
    }

    const grouped = Object.fromEntries(
      LINE_PRESET_CATEGORIES.map(c => [c, []])
    ) as Record<LinePresetCategory, LinePreset[]>;

    for (const preset of (data || []) as LinePreset[]) {
      if (grouped[preset.category]) {
        grouped[preset.category].push(preset);
      }
    }

    setPresets(grouped);
    setLoading(false);
    } catch (e) {
      console.error("Line presets fetch error:", e);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPresets();
  }, [fetchPresets]);

  const savePreset = useCallback(async (
    name: string,
    category: LinePresetCategory,
    fabricJson: Record<string, any>,
    thumbnail?: string,
  ) => {
    // Normalize position to origin so preset can be placed anywhere
    const normalized = { ...fabricJson, left: 0, top: 0 };

    const { error } = await (supabase as any).from("line_presets").insert({
      name,
      category,
      fabric_json: normalized,
      thumbnail: thumbnail || null,
    });

    if (error) {
      toast.error("Failed to save line preset: " + error.message);
      return false;
    }

    toast.success(`Line preset "${name}" saved to ${category}`);
    fetchPresets();
    return true;
  }, [fetchPresets]);

  const deletePreset = useCallback(async (id: string) => {
    const { error } = await (supabase as any)
      .from("line_presets")
      .update({ is_active: false })
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete preset");
      return;
    }

    toast.success("Preset deleted");
    fetchPresets();
  }, [fetchPresets]);

  return { presets, loading, fetchPresets, savePreset, deletePreset };
}
