-- Project-scoped asset access for collaboration.
--
-- When a project references user assets (images), collaborators need to:
--   1. Query the user_assets table for metadata (storage_path, mime_type)
--   2. Download the file bytes from the user-assets storage bucket
--
-- This migration creates a junction table (project_asset_references) that tracks
-- which assets are used in which projects, then adds RLS policies so that anyone
-- with access to the project can also access its assets.

-- ============================================================
-- JUNCTION TABLE
-- ============================================================

CREATE TABLE public.project_asset_references (
  project_id UUID NOT NULL REFERENCES public.canvas_projects(id) ON DELETE CASCADE,
  asset_id   UUID NOT NULL REFERENCES public.user_assets(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (project_id, asset_id)
);

CREATE INDEX idx_par_asset_id   ON public.project_asset_references(asset_id);
CREATE INDEX idx_par_project_id ON public.project_asset_references(project_id);

ALTER TABLE public.project_asset_references ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, DELETE ON public.project_asset_references TO authenticated;

-- ============================================================
-- HELPER FUNCTION
-- ============================================================

-- SECURITY DEFINER so inner RLS checks on canvas_projects / project_collaborators
-- don't interfere.  Returns true if the user can access the asset via any project.
CREATE OR REPLACE FUNCTION public.user_can_access_project_asset(
  check_user_id UUID,
  check_asset_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM project_asset_references par
    JOIN canvas_projects cp ON cp.id = par.project_id
    WHERE par.asset_id = check_asset_id
      AND (
        -- project owner
        cp.user_id = check_user_id
        -- direct / group / page collaborator
        OR user_is_project_collaborator(check_user_id, cp.id)
        -- public approved project (shared link viewers)
        OR (cp.is_public = true AND cp.approval_status = 'approved')
      )
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.user_can_access_project_asset(UUID, UUID) TO authenticated;

-- ============================================================
-- RLS: project_asset_references
-- ============================================================

-- Anyone who can view the project can see its asset references
CREATE POLICY "Project participants can view asset references"
  ON public.project_asset_references FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM canvas_projects WHERE id = project_id AND user_id = auth.uid())
    OR user_is_project_collaborator(auth.uid(), project_id)
    OR EXISTS (SELECT 1 FROM canvas_projects WHERE id = project_id AND is_public = true)
  );

-- Anyone who can edit the project can add/remove asset references
CREATE POLICY "Project editors can insert asset references"
  ON public.project_asset_references FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM canvas_projects WHERE id = project_id AND user_id = auth.uid())
    OR user_can_edit_project(auth.uid(), project_id)
  );

CREATE POLICY "Project editors can delete asset references"
  ON public.project_asset_references FOR DELETE
  USING (
    EXISTS (SELECT 1 FROM canvas_projects WHERE id = project_id AND user_id = auth.uid())
    OR user_can_edit_project(auth.uid(), project_id)
  );

-- ============================================================
-- RLS: user_assets – add project-scoped SELECT access
-- ============================================================

-- Keep existing "Anyone can view shared assets" policy (is_shared = true OR owner).
-- Add a new policy for project-referenced assets.
CREATE POLICY "Users can view assets referenced by their projects"
  ON public.user_assets FOR SELECT
  USING (user_can_access_project_asset(auth.uid(), id));

-- ============================================================
-- RLS: storage.objects – allow downloading project-referenced assets
-- ============================================================

-- Also allow downloading community-shared assets (is_shared = true)
CREATE POLICY "Users can download project-referenced or shared assets"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'user-assets'
    AND EXISTS (
      SELECT 1
      FROM public.user_assets ua
      WHERE ua.storage_path = name
        AND (
          ua.is_shared = true
          OR public.user_can_access_project_asset(auth.uid(), ua.id)
        )
    )
  );
