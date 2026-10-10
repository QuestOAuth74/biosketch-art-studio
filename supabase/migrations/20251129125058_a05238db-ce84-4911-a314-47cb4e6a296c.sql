-- Create community downloads tracking table
CREATE TABLE public.community_downloads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES canvas_projects(id) ON DELETE CASCADE,
  download_format text NOT NULL,
  downloaded_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, project_id)
);

ALTER TABLE public.community_downloads ENABLE ROW LEVEL SECURITY;

-- Users can view their own downloads
CREATE POLICY "Users can view own downloads"
  ON public.community_downloads FOR SELECT
  USING (auth.uid() = user_id);

-- Users can record their own downloads
CREATE POLICY "Users can record own downloads"
  ON public.community_downloads FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all downloads
CREATE POLICY "Admins can view all downloads"
  ON public.community_downloads FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Function to calculate download quota with unlimited unlock
CREATE OR REPLACE FUNCTION public.get_user_download_quota(check_user_id uuid)
RETURNS TABLE(
  downloads_used integer,
  shared_projects integer,
  has_unlimited boolean,
  remaining_downloads integer,
  can_download boolean,
  projects_until_unlimited integer
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH download_count AS (
    SELECT COUNT(*)::integer AS count
    FROM community_downloads
    WHERE user_id = check_user_id
  ),
  shared_count AS (
    SELECT COUNT(*)::integer AS count
    FROM canvas_projects
    WHERE user_id = check_user_id
      AND is_public = true
      AND approval_status = 'approved'
  )
  SELECT 
    dc.count AS downloads_used,
    sc.count AS shared_projects,
    sc.count >= 3 AS has_unlimited,
    CASE 
      WHEN sc.count >= 3 THEN NULL
      ELSE GREATEST(0, 3 - dc.count)
    END AS remaining_downloads,
    CASE 
      WHEN sc.count >= 3 THEN true
      ELSE dc.count < 3
    END AS can_download,
    GREATEST(0, 3 - sc.count) AS projects_until_unlimited
  FROM download_count dc, shared_count sc;
$$;

-- Function to check project ownership
CREATE OR REPLACE FUNCTION public.check_project_ownership(check_user_id uuid, check_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM canvas_projects
    WHERE id = check_project_id AND user_id = check_user_id
  );
$$;