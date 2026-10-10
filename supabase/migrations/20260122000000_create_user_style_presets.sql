-- Create user_style_presets table
CREATE TABLE public.user_style_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text', 'shape', 'line', 'mixed')),
  properties JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX idx_user_style_presets_user_id ON public.user_style_presets(user_id);
CREATE INDEX idx_user_style_presets_type ON public.user_style_presets(user_id, type);
CREATE INDEX idx_user_style_presets_last_used ON public.user_style_presets(user_id, last_used_at DESC NULLS LAST);

-- Enable RLS
ALTER TABLE public.user_style_presets ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own presets"
  ON public.user_style_presets FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create presets"
  ON public.user_style_presets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own presets"
  ON public.user_style_presets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own presets"
  ON public.user_style_presets FOR DELETE
  USING (auth.uid() = user_id);
