-- Track AI diagram generations per user
CREATE TABLE IF NOT EXISTS public.diagram_generations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  object_count INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_diagram_gen_user_date ON public.diagram_generations(user_id, created_at DESC);

ALTER TABLE public.diagram_generations ENABLE ROW LEVEL SECURITY;

-- Users can read their own generations
CREATE POLICY "Users can read own diagram generations"
  ON public.diagram_generations FOR SELECT
  USING (auth.uid() = user_id);

-- Service role inserts (edge function)
CREATE POLICY "Service role can insert diagram generations"
  ON public.diagram_generations FOR INSERT
  WITH CHECK (true);
