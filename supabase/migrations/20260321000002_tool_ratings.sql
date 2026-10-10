-- Tool ratings (works for anonymous visitors via localStorage dedup)
CREATE TABLE IF NOT EXISTS public.tool_ratings (
  tool_id TEXT PRIMARY KEY,
  total_ratings INT NOT NULL DEFAULT 0,
  rating_sum INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Public read access
ALTER TABLE public.tool_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tool ratings"
  ON public.tool_ratings FOR SELECT
  USING (true);

-- RPC to submit a rating (atomic upsert)
CREATE OR REPLACE FUNCTION public.submit_tool_rating(p_tool_id TEXT, p_rating INT, p_previous_rating INT DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- If user is updating their previous rating, adjust the sum
  IF p_previous_rating > 0 THEN
    INSERT INTO public.tool_ratings (tool_id, total_ratings, rating_sum, updated_at)
    VALUES (p_tool_id, 1, p_rating, now())
    ON CONFLICT (tool_id)
    DO UPDATE SET
      rating_sum = tool_ratings.rating_sum - p_previous_rating + p_rating,
      updated_at = now();
  ELSE
    INSERT INTO public.tool_ratings (tool_id, total_ratings, rating_sum, updated_at)
    VALUES (p_tool_id, 1, p_rating, now())
    ON CONFLICT (tool_id)
    DO UPDATE SET
      total_ratings = tool_ratings.total_ratings + 1,
      rating_sum = tool_ratings.rating_sum + p_rating,
      updated_at = now();
  END IF;

  SELECT jsonb_build_object(
    'total_ratings', tr.total_ratings,
    'rating_sum', tr.rating_sum
  ) INTO result
  FROM public.tool_ratings tr
  WHERE tr.tool_id = p_tool_id;

  RETURN result;
END;
$$;

-- Seed rows for all current tools
INSERT INTO public.tool_ratings (tool_id) VALUES
  ('pedigree'), ('codons'), ('gantt'), ('smiles'),
  ('molecular-weight'), ('buffer-calculator'), ('latex'), ('heatmap'),
  ('dilution-calculator'), ('punnett-square'), ('phylo-tree'),
  ('gel-electrophoresis'), ('unit-converter'), ('dna-tools'),
  ('plasmid-viewer'), ('volcano-plot'), ('dose-response'),
  ('kaplan-meier'), ('enzyme-kinetics')
ON CONFLICT (tool_id) DO NOTHING;
