-- Tool visit tracking (works for anonymous visitors)
CREATE TABLE IF NOT EXISTS public.tool_visits (
  tool_id TEXT PRIMARY KEY,
  visit_count BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS but allow public read
ALTER TABLE public.tool_visits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tool visits"
  ON public.tool_visits FOR SELECT
  USING (true);

-- RPC to atomically increment visit count (called by edge function)
CREATE OR REPLACE FUNCTION public.increment_tool_visit(p_tool_id TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.tool_visits (tool_id, visit_count, updated_at)
  VALUES (p_tool_id, 1, now())
  ON CONFLICT (tool_id)
  DO UPDATE SET
    visit_count = tool_visits.visit_count + 1,
    updated_at = now();
END;
$$;

-- Seed with initial zero counts for all current tools
INSERT INTO public.tool_visits (tool_id, visit_count) VALUES
  ('pedigree', 0),
  ('codons', 0),
  ('gantt', 0),
  ('smiles', 0),
  ('molecular-weight', 0),
  ('buffer-calculator', 0),
  ('latex', 0),
  ('heatmap', 0)
ON CONFLICT (tool_id) DO NOTHING;
