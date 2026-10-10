-- Update user_can_edit_project() so admins only get edit access on pending projects.
-- For non-pending projects admins don't own, the RPC returns FALSE (view-only).

CREATE OR REPLACE FUNCTION public.user_can_edit_project(check_user_id UUID, check_project_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- Admins can edit projects that are pending approval (submitted for review)
  IF public.has_role(check_user_id, 'admin') THEN
    RETURN EXISTS (
      SELECT 1 FROM public.canvas_projects
      WHERE id = check_project_id
        AND approval_status = 'pending'
    );
  END IF;

  -- Individual collaborators with edit permission
  RETURN EXISTS (
    SELECT 1 FROM public.project_collaborators
    WHERE project_id = check_project_id AND user_id = check_user_id
      AND permission = 'edit' AND accepted_at IS NOT NULL
  ) OR EXISTS (
    -- Group-based edit access
    SELECT 1 FROM public.project_group_access pga
    JOIN public.group_members gm ON gm.group_id = pga.group_id
    WHERE pga.project_id = check_project_id AND gm.user_id = check_user_id
      AND pga.permission = 'edit'
  ) OR EXISTS (
    -- Page-based edit access (individual or group)
    SELECT 1 FROM public.project_page_items ppi
    WHERE ppi.project_id = check_project_id
      AND (
        EXISTS (
          SELECT 1 FROM public.project_page_access ppa
          WHERE ppa.page_id = ppi.page_id AND ppa.user_id = check_user_id
            AND ppa.accepted_at IS NOT NULL AND ppa.permission = 'edit'
        ) OR EXISTS (
          SELECT 1 FROM public.project_page_group_access ppga
          JOIN public.group_members gm ON gm.group_id = ppga.group_id
          WHERE ppga.page_id = ppi.page_id AND gm.user_id = check_user_id
            AND ppga.permission = 'edit'
        )
      )
  );
END; $$;
