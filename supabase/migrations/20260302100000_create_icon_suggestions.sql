-- Create icon_suggestions table for text-based icon requests
CREATE TABLE public.icon_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL,
  icon_names text NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_icon_suggestions_user_id ON public.icon_suggestions(user_id);
CREATE INDEX idx_icon_suggestions_status ON public.icon_suggestions(status);

-- Enable RLS
ALTER TABLE public.icon_suggestions ENABLE ROW LEVEL SECURITY;

-- Users can view their own suggestions
CREATE POLICY "Users can view own suggestions"
  ON public.icon_suggestions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create suggestions
CREATE POLICY "Users can submit suggestions"
  ON public.icon_suggestions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all suggestions
CREATE POLICY "Admins can view all suggestions"
  ON public.icon_suggestions
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update any suggestion
CREATE POLICY "Admins can update suggestions"
  ON public.icon_suggestions
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete any suggestion
CREATE POLICY "Admins can delete suggestions"
  ON public.icon_suggestions
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create update trigger for updated_at
CREATE OR REPLACE FUNCTION update_icon_suggestions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER icon_suggestions_updated_at
  BEFORE UPDATE ON public.icon_suggestions
  FOR EACH ROW
  EXECUTE FUNCTION update_icon_suggestions_updated_at();
