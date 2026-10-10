/**
 * useDiagramIcons — resolves SVG icons for diagram nodes from this app's own
 * curated `icons` table (no external repo, no licensing concerns).
 *
 * Two-pass resolution:
 *   1. EXACT  — match each node label's own words against the `icons` table.
 *   2. SEMANTIC — for labels that found nothing, expand them via the
 *      `semantic-icon-search` edge function ("JAK2" → kinase, protein,
 *      enzyme…) and match again. Semantic expansion only runs for misses, so
 *      the (LLM-backed) edge function is called as little as possible.
 *
 * Exact-label words are weighted 3×, semantic words 1×, so a precise icon
 * always wins over a loosely-related one. Pass 1 results render immediately;
 * pass 2 fills in the rest.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { SciDiagram } from "@/lib/sciDiagram";

interface IconRow { id: string; name: string; svg_content: string | null; }

/** node-id → label used for icon lookup (chemistry atoms are skipped). */
function iconTargets(d: SciDiagram): { id: string; label: string }[] {
  if (d.kind === "cellular") return d.nodes.map((n) => ({ id: n.id, label: n.label }));
  if (d.kind === "lab") return d.steps.map((s) => ({ id: s.id, label: s.apparatus || s.label }));
  if (d.kind === "physics") return [{ id: "__mass", label: d.massLabel }];
  return [];
}

const wordsOf = (s: string): string[] => s.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
const svgToDataUri = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`;
const uniq = <T,>(a: T[]): T[] => Array.from(new Set(a));

/** semantic expansions are stable per label — cache across renders. */
const termCache = new Map<string, string[]>();

/** One batched `icons` query: OR of partial name matches on the given words. */
async function queryIcons(words: string[]): Promise<IconRow[]> {
  if (words.length === 0) return [];
  const orFilter = words.slice(0, 90).map((w) => `name.ilike.%${w}%`).join(",");
  const { data, error } = await supabase
    .from("icons")
    .select("id,name,svg_content")
    .or(orFilter)
    .not("svg_content", "is", null)
    .limit(300);
  if (error || !data) return [];
  return (data as IconRow[]).filter((r) => !!r.svg_content);
}

/** Expand a label into related scientific terms via the edge function. */
async function expandTerms(label: string): Promise<string[]> {
  const key = label.toLowerCase();
  const cached = termCache.get(key);
  if (cached) return cached;
  try {
    const { data } = await supabase.functions.invoke("semantic-icon-search", {
      body: { query: label },
    });
    const terms: string[] = Array.isArray(data?.terms) && data.terms.length
      ? data.terms
      : [label];
    termCache.set(key, terms);
    return terms;
  } catch {
    return [label];
  }
}

/** Best icon for a node: exact-label words weighted 3×, semantic words 1×. */
function pickIcon(candidates: IconRow[], strong: Set<string>, weak: Set<string>): string | null {
  let best: IconRow | null = null;
  let bestScore = 0;
  for (const c of candidates) {
    const cw = wordsOf(c.name);
    const score = 3 * cw.filter((w) => strong.has(w)).length
                + 1 * cw.filter((w) => weak.has(w)).length;
    if (score > bestScore ||
        (score === bestScore && score > 0 && best && c.name.length < best.name.length)) {
      best = c;
      bestScore = score;
    }
  }
  return best && bestScore > 0 && best.svg_content ? svgToDataUri(best.svg_content) : null;
}

export function useDiagramIcons(diagram: SciDiagram): Record<string, string> {
  const [icons, setIcons] = useState<Record<string, string>>({});

  useEffect(() => {
    const targets = iconTargets(diagram);
    if (targets.length === 0) { setIcons({}); return; }

    let cancelled = false;
    (async () => {
      // ── pass 1: exact label-word match ──
      const cand1 = await queryIcons(uniq(targets.flatMap((t) => wordsOf(t.label))));
      if (cancelled) return;

      const resolved: Record<string, string> = {};
      const unmatched: { id: string; label: string }[] = [];
      for (const t of targets) {
        const hit = pickIcon(cand1, new Set(wordsOf(t.label)), new Set());
        if (hit) resolved[t.id] = hit;
        else unmatched.push(t);
      }
      if (!cancelled) setIcons({ ...resolved }); // render exact matches now

      // ── pass 2: semantic expansion — only for labels with no exact match ──
      if (unmatched.length === 0) return;
      const expansions = await Promise.all(unmatched.map((t) => expandTerms(t.label)));
      if (cancelled) return;

      const cand2 = await queryIcons(uniq(expansions.flat().flatMap(wordsOf)));
      if (cancelled) return;

      unmatched.forEach((t, i) => {
        const hit = pickIcon(
          cand2,
          new Set(wordsOf(t.label)),
          new Set(expansions[i].flatMap(wordsOf)),
        );
        if (hit) resolved[t.id] = hit;
      });
      if (!cancelled) setIcons({ ...resolved });
    })();

    return () => { cancelled = true; };
  }, [diagram]);

  return icons;
}
