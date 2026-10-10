-- Scholars program: users submit URLs of citations / .edu blog posts / social
-- posts about BioSketch; admins verify manually and grant AI generation
-- credits via the existing admin_grant_ai_credits RPC. This table is the
-- application queue + audit trail.
CREATE TABLE public.scholar_applications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track text NOT NULL CHECK (track IN ('citation', 'academic', 'community')),
  url text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  admin_note text,
  credits_granted integer,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_scholar_applications_user_id ON public.scholar_applications(user_id);
CREATE INDEX idx_scholar_applications_status ON public.scholar_applications(status);
CREATE INDEX idx_scholar_applications_created_at ON public.scholar_applications(created_at DESC);

ALTER TABLE public.scholar_applications ENABLE ROW LEVEL SECURITY;

-- Users: insert their own applications, view their own applications.
CREATE POLICY "Users can submit own applications"
  ON public.scholar_applications FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own applications"
  ON public.scholar_applications FOR SELECT
  USING (auth.uid() = user_id);

-- Admins: view + update every application. Uses the has_role helper the rest
-- of the app already uses for admin gating (see user_roles table).
CREATE POLICY "Admins can view all applications"
  ON public.scholar_applications FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update applications"
  ON public.scholar_applications FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
