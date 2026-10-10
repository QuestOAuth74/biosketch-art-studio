-- Create icon_submissions table
CREATE TABLE public.icon_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text NOT NULL,
  svg_content text NOT NULL,
  thumbnail text,
  description text,
  usage_rights text NOT NULL CHECK (usage_rights IN ('free_to_share', 'own_rights', 'licensed', 'public_domain')),
  usage_rights_details text,
  approval_status text NOT NULL DEFAULT 'pending' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  rejection_reason text,
  admin_notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id)
);

-- Create indexes
CREATE INDEX idx_icon_submissions_user_id ON public.icon_submissions(user_id);
CREATE INDEX idx_icon_submissions_status ON public.icon_submissions(approval_status);
CREATE INDEX idx_icon_submissions_category ON public.icon_submissions(category);

-- Enable RLS
ALTER TABLE public.icon_submissions ENABLE ROW LEVEL SECURITY;

-- Users can view their own submissions
CREATE POLICY "Users can view own submissions"
  ON public.icon_submissions
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create submissions
CREATE POLICY "Users can submit icons"
  ON public.icon_submissions
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their pending submissions
CREATE POLICY "Users can update pending submissions"
  ON public.icon_submissions
  FOR UPDATE
  USING (auth.uid() = user_id AND approval_status = 'pending');

-- Users can delete their pending submissions
CREATE POLICY "Users can delete pending submissions"
  ON public.icon_submissions
  FOR DELETE
  USING (auth.uid() = user_id AND approval_status = 'pending');

-- Admins can view all submissions
CREATE POLICY "Admins can view all submissions"
  ON public.icon_submissions
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update any submission
CREATE POLICY "Admins can update submissions"
  ON public.icon_submissions
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete any submission
CREATE POLICY "Admins can delete submissions"
  ON public.icon_submissions
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create update trigger for updated_at
CREATE OR REPLACE FUNCTION update_icon_submissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER icon_submissions_updated_at
  BEFORE UPDATE ON public.icon_submissions
  FOR EACH ROW
  EXECUTE FUNCTION update_icon_submissions_updated_at();