-- Scientific Illustrator: saved diagrams.
-- Stores the renderer-agnostic SciDiagram JSON so a user can reopen a diagram
-- after a refresh and build a named library. Per-user; RLS-isolated.

CREATE TABLE IF NOT EXISTS public.scientific_diagrams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL DEFAULT 'Untitled diagram'
              CHECK (length(title) BETWEEN 1 AND 200),
  category    TEXT NOT NULL CHECK (category IN ('cellular','chemical','physics','lab')),
  source_text TEXT,                       -- the prose prompt the diagram came from
  diagram     JSONB NOT NULL,             -- the SciDiagram model
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scientific_diagrams_user
  ON public.scientific_diagrams (user_id, updated_at DESC);

ALTER TABLE public.scientific_diagrams ENABLE ROW LEVEL SECURITY;

-- ─── RLS: each user sees and edits only their own diagrams ─────────────────
DROP POLICY IF EXISTS "Users read own scientific_diagrams" ON public.scientific_diagrams;
CREATE POLICY "Users read own scientific_diagrams" ON public.scientific_diagrams
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own scientific_diagrams" ON public.scientific_diagrams;
CREATE POLICY "Users insert own scientific_diagrams" ON public.scientific_diagrams
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own scientific_diagrams" ON public.scientific_diagrams;
CREATE POLICY "Users update own scientific_diagrams" ON public.scientific_diagrams
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users delete own scientific_diagrams" ON public.scientific_diagrams;
CREATE POLICY "Users delete own scientific_diagrams" ON public.scientific_diagrams
  FOR DELETE USING (auth.uid() = user_id);

-- ─── keep updated_at fresh ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_scientific_diagrams_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_scientific_diagrams_updated_at ON public.scientific_diagrams;
CREATE TRIGGER trg_scientific_diagrams_updated_at
  BEFORE UPDATE ON public.scientific_diagrams
  FOR EACH ROW EXECUTE FUNCTION public.handle_scientific_diagrams_updated_at();
