-- Line presets: admin-curated line styles grouped by category
CREATE TABLE IF NOT EXISTS public.line_presets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Lines', 'Arrows', 'Inhibitor', 'Dots', 'Neurons', 'Circular', 'Brackets')),
  fabric_json JSONB NOT NULL,
  thumbnail TEXT,
  sort_order INTEGER DEFAULT 0,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX idx_line_presets_category ON public.line_presets(category, sort_order);

-- RLS: all authenticated users can read, only admins can write
ALTER TABLE public.line_presets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active line presets"
  ON public.line_presets FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage line presets"
  ON public.line_presets FOR ALL
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
  );
