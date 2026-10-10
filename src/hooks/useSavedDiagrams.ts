/**
 * useSavedDiagrams — persistence for the Scientific Illustrator.
 *
 * Reads/writes the `scientific_diagrams` table (one row = one saved diagram).
 * The table is new and not yet in the generated Supabase types, so the client
 * is accessed through a loose cast here; regenerate `types.ts` to type it.
 */
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DiagramKind, SciDiagram } from "@/lib/sciDiagram";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => (supabase as any).from("scientific_diagrams");

export interface SavedDiagram {
  id: string;
  title: string;
  category: DiagramKind;
  source_text: string | null;
  diagram: SciDiagram;
  updated_at: string;
}

export interface SaveInput {
  title: string;
  category: DiagramKind;
  source_text: string;
  diagram: SciDiagram;
}

export function useSavedDiagrams(userId: string | undefined) {
  const [items, setItems] = useState<SavedDiagram[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!userId) { setItems([]); return; }
    setLoading(true);
    const { data, error } = await db()
      .select("id,title,category,source_text,diagram,updated_at")
      .order("updated_at", { ascending: false })
      .limit(60);
    setLoading(false);
    if (!error && data) setItems(data as SavedDiagram[]);
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  /** Insert a new diagram, or update an existing one. Returns its row id. */
  const save = useCallback(async (
    existingId: string | null,
    input: SaveInput,
  ): Promise<string> => {
    if (!userId) throw new Error("Not signed in");

    if (existingId) {
      const { error } = await db().update(input).eq("id", existingId);
      if (error) throw error;
      await refresh();
      return existingId;
    }
    const { data, error } = await db()
      .insert({ ...input, user_id: userId })
      .select("id")
      .single();
    if (error) throw error;
    await refresh();
    return (data as { id: string }).id;
  }, [userId, refresh]);

  const remove = useCallback(async (id: string) => {
    const { error } = await db().delete().eq("id", id);
    if (error) throw error;
    setItems((xs) => xs.filter((x) => x.id !== id));
  }, []);

  return { items, loading, refresh, save, remove };
}
