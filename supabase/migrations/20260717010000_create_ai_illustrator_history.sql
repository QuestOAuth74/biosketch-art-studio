-- AI Illustrator history — dedicated table for per-user generation snapshots
-- (image + prompt + mode). Split from the credit ledger `ai_generations`
-- because the July 2026 credit migration dropped and repurposed that table
-- name, silently taking the AI Illustrator's save path with it.
--
-- We create this under a distinct name so the two concerns never collide
-- again: `ai_generations` = credit ledger (one row per spend event),
-- `ai_illustrator_history` = user-facing gallery of past generations.

CREATE TABLE IF NOT EXISTS public.ai_illustrator_history (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  mode       text NOT NULL,
  prompt     text NOT NULL,
  image_url  text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_illustrator_history_user
  ON public.ai_illustrator_history (user_id, created_at DESC);

ALTER TABLE public.ai_illustrator_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own AI illustrator history"
  ON public.ai_illustrator_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own AI illustrator history"
  ON public.ai_illustrator_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own AI illustrator history"
  ON public.ai_illustrator_history FOR DELETE
  USING (auth.uid() = user_id);
