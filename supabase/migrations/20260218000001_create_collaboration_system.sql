-- Collaboration System Migration
-- Creates the full collaboration schema: groups, project sharing, and project pages.
--
-- Key design decisions:
--   - group creation is handled via create_group() SECURITY DEFINER RPC, which atomically
--     inserts the group and owner member row, bypassing the RLS bootstrapping problem.
--   - page creation is handled via create_page() SECURITY DEFINER RPC for the same reason.
--   - project_collaborators uses email (not user_id) as the stable invitation key, so
--     non-users can be invited before they have an account. user_id is resolved on acceptance.
--
-- Squashes:
--   20260218000001_create_collaboration_system.sql
--   20260219000001_invitation_recipient_select.sql
--   20260220000001_page_project_access.sql
--   20260221000001_project_pages_idempotent.sql
--   20260221000001_create_page_rpc_and_collab_email.sql

-- ============================================================
-- CLEANUP: drop manually-created objects that predate this migration
-- ============================================================

DROP TABLE IF EXISTS public.project_collaborators CASCADE;
DROP TABLE IF EXISTS public.project_pages CASCADE;
DROP TYPE IF EXISTS public.collaboration_role CASCADE;

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE public.group_role AS ENUM ('owner', 'admin', 'member');
CREATE TYPE public.collaboration_permission AS ENUM ('view', 'edit');

-- ============================================================
-- TABLES
-- ============================================================

CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  avatar_url TEXT,
  created_by UUID DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.group_role NOT NULL DEFAULT 'member',
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, user_id)
);

CREATE TABLE public.group_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token UUID NOT NULL DEFAULT gen_random_uuid(),
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_role public.group_role NOT NULL DEFAULT 'member',
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  accepted_at TIMESTAMPTZ,
  declined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (group_id, email)
);

-- email is the stable invitation key; user_id is nullable and resolved on acceptance.
-- This supports inviting people who don't have an account yet.
CREATE TABLE public.project_collaborators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.canvas_projects(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  permission public.collaboration_permission NOT NULL DEFAULT 'view',
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  invitation_token UUID NOT NULL DEFAULT gen_random_uuid(),
  UNIQUE (project_id, email)
);

-- Dynamic group → project access
CREATE TABLE public.project_group_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.canvas_projects(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  permission public.collaboration_permission NOT NULL DEFAULT 'view',
  granted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (project_id, group_id)
);

-- Project pages: curated collections of projects for sharing
CREATE TABLE public.project_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.project_page_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.project_pages(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.canvas_projects(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (page_id, project_id)
);

-- Individual invitation to a page (email-based, supports new users)
CREATE TABLE public.project_page_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.project_pages(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  permission public.collaboration_permission NOT NULL DEFAULT 'view',
  invited_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,
  invitation_token UUID NOT NULL DEFAULT gen_random_uuid(),
  UNIQUE (page_id, email)
);

-- Dynamic group → page access
CREATE TABLE public.project_page_group_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id UUID NOT NULL REFERENCES public.project_pages(id) ON DELETE CASCADE,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  permission public.collaboration_permission NOT NULL DEFAULT 'view',
  granted_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (page_id, group_id)
);

-- ============================================================
-- FOREIGN KEYS FOR POSTGREST EMBEDDED JOINS
-- ============================================================

-- Required for PostgREST to resolve profiles(...) joins from group_members and group_invitations.
-- Without these, the embedded join syntax errors silently, leaving member lists empty.

ALTER TABLE public.group_members
  ADD CONSTRAINT fk_group_members_profile
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.group_invitations
  ADD CONSTRAINT fk_group_invitations_invited_by_profile
  FOREIGN KEY (invited_by) REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Allows PostgREST to resolve profiles(full_name, avatar_url) via project_collaborators.user_id
ALTER TABLE public.project_collaborators
  ADD CONSTRAINT fk_project_collaborators_profile
  FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX idx_group_members_group_id ON public.group_members(group_id);
CREATE INDEX idx_group_members_user_id ON public.group_members(user_id);
CREATE UNIQUE INDEX idx_group_invitations_token ON public.group_invitations(token);
CREATE INDEX idx_group_invitations_group_id ON public.group_invitations(group_id);
CREATE INDEX idx_project_collaborators_project_id ON public.project_collaborators(project_id);
CREATE INDEX idx_project_collaborators_user_id ON public.project_collaborators(user_id);
CREATE UNIQUE INDEX idx_project_collaborators_token ON public.project_collaborators(invitation_token);
CREATE INDEX idx_project_group_access_project_id ON public.project_group_access(project_id);
CREATE INDEX idx_project_group_access_group_id ON public.project_group_access(group_id);
CREATE INDEX idx_project_pages_created_by ON public.project_pages(created_by);
CREATE INDEX idx_project_page_items_page_id ON public.project_page_items(page_id);
CREATE UNIQUE INDEX idx_project_page_access_token ON public.project_page_access(invitation_token);
CREATE INDEX idx_project_page_access_page_id ON public.project_page_access(page_id);
CREATE INDEX idx_project_page_group_access_page_id ON public.project_page_group_access(page_id);
CREATE INDEX idx_project_page_group_access_group_id ON public.project_page_group_access(group_id);

-- ============================================================
-- TRIGGERS
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_groups_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END; $$;

CREATE TRIGGER on_groups_updated
  BEFORE UPDATE ON public.groups
  FOR EACH ROW EXECUTE FUNCTION public.handle_groups_updated_at();

CREATE OR REPLACE FUNCTION public.handle_project_pages_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END; $$;

CREATE TRIGGER on_project_pages_updated
  BEFORE UPDATE ON public.project_pages
  FOR EACH ROW EXECUTE FUNCTION public.handle_project_pages_updated_at();

-- ============================================================
-- SECURITY DEFINER FUNCTIONS
-- ============================================================

CREATE OR REPLACE FUNCTION public.user_is_group_member(check_user_id UUID, check_group_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = check_group_id AND user_id = check_user_id
  );
END; $$;

CREATE OR REPLACE FUNCTION public.user_is_group_manager(check_user_id UUID, check_group_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = check_group_id AND user_id = check_user_id AND role IN ('owner', 'admin')
  );
END; $$;

CREATE OR REPLACE FUNCTION public.user_is_group_owner(check_user_id UUID, check_group_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = check_group_id AND user_id = check_user_id AND role = 'owner'
  );
END; $$;

-- Atomically creates a group and adds the caller as owner.
-- Runs as SECURITY DEFINER to bypass the RLS bootstrapping problem:
-- no members exist yet when the group is first created, so RLS on group_members
-- cannot be satisfied by a normal client INSERT.
CREATE OR REPLACE FUNCTION public.create_group(
  p_name TEXT,
  p_description TEXT DEFAULT NULL
)
RETURNS TABLE (id UUID, name TEXT, description TEXT, created_by UUID, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_group_id UUID;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.groups (name, description, created_by)
  VALUES (p_name, p_description, v_user_id)
  RETURNING public.groups.id INTO v_group_id;

  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_group_id, v_user_id, 'owner');

  RETURN QUERY
    SELECT g.id, g.name, g.description, g.created_by, g.created_at
    FROM public.groups g
    WHERE g.id = v_group_id;
END;
$$;

-- Allow group members to see each other's profiles.
-- Without this, profiles RLS only allows auth.uid() = id (own profile),
-- so all group members except yourself appear as "Unknown user".
CREATE OR REPLACE FUNCTION public.user_shares_group_with(check_user_id UUID, target_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.group_members gm1
    JOIN public.group_members gm2 ON gm1.group_id = gm2.group_id
    WHERE gm1.user_id = check_user_id
      AND gm2.user_id = target_user_id
  );
END; $$;

-- Replaces the existing stub that returned false.
-- Includes: individual collaborators, group-based access, and page-based access.
CREATE OR REPLACE FUNCTION public.user_can_edit_project(check_user_id UUID, check_project_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.project_collaborators
    WHERE project_id = check_project_id AND user_id = check_user_id
      AND permission = 'edit' AND accepted_at IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM public.project_group_access pga
    JOIN public.group_members gm ON gm.group_id = pga.group_id
    WHERE pga.project_id = check_project_id AND gm.user_id = check_user_id
      AND pga.permission = 'edit'
  ) OR EXISTS (
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

-- Replaces the existing stub that returned false.
-- Includes: individual collaborators, group-based access, and page-based access.
CREATE OR REPLACE FUNCTION public.user_is_project_collaborator(check_user_id UUID, check_project_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.project_collaborators
    WHERE project_id = check_project_id AND user_id = check_user_id AND accepted_at IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM public.project_group_access pga
    JOIN public.group_members gm ON gm.group_id = pga.group_id
    WHERE pga.project_id = check_project_id AND gm.user_id = check_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.project_page_items ppi
    WHERE ppi.project_id = check_project_id
      AND (
        EXISTS (
          SELECT 1 FROM public.project_page_access ppa
          WHERE ppa.page_id = ppi.page_id AND ppa.user_id = check_user_id
            AND ppa.accepted_at IS NOT NULL
        ) OR EXISTS (
          SELECT 1 FROM public.project_page_group_access ppga
          JOIN public.group_members gm ON gm.group_id = ppga.group_id
          WHERE ppga.page_id = ppi.page_id AND gm.user_id = check_user_id
        )
      )
  );
END; $$;

-- Creates a page and sets the caller as owner.
-- SECURITY DEFINER bypasses the RLS bootstrapping problem on project_pages INSERT
-- (same pattern as create_group).
CREATE OR REPLACE FUNCTION public.create_page(p_name TEXT, p_description TEXT DEFAULT NULL)
RETURNS TABLE (id UUID)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_page_id UUID;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  INSERT INTO public.project_pages (name, description, created_by)
  VALUES (p_name, p_description, v_user_id)
  RETURNING project_pages.id INTO v_page_id;

  RETURN QUERY SELECT v_page_id;
END; $$;

-- Check if a user can access a page (owner, accepted invitee, or group member)
CREATE OR REPLACE FUNCTION public.user_can_access_page(check_user_id UUID, check_page_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.project_pages
    WHERE id = check_page_id AND created_by = check_user_id
  ) OR EXISTS (
    SELECT 1 FROM public.project_page_access
    WHERE page_id = check_page_id AND user_id = check_user_id AND accepted_at IS NOT NULL
  ) OR EXISTS (
    SELECT 1 FROM public.project_page_group_access ppga
    JOIN public.group_members gm ON gm.group_id = ppga.group_id
    WHERE ppga.page_id = check_page_id AND gm.user_id = check_user_id
  );
END; $$;

-- ============================================================
-- GRANTS
-- ============================================================

GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_invitations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_collaborators TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_group_access TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_pages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_page_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_page_access TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_page_group_access TO authenticated;

GRANT EXECUTE ON FUNCTION public.user_is_group_member(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_group_manager(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_group_owner(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_edit_project(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_is_project_collaborator(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_group(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_page(TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_shares_group_with(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_page(UUID, UUID) TO authenticated;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_group_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_page_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_page_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_page_group_access ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- POLICIES
-- ============================================================

-- groups
CREATE POLICY "Group members can view their groups"
  ON public.groups FOR SELECT
  USING (user_is_group_member(auth.uid(), id));

CREATE POLICY "Authenticated users can create groups"
  ON public.groups FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Group managers can update their groups"
  ON public.groups FOR UPDATE
  USING (user_is_group_manager(auth.uid(), id))
  WITH CHECK (user_is_group_manager(auth.uid(), id));

CREATE POLICY "Group owners can delete their groups"
  ON public.groups FOR DELETE
  USING (user_is_group_owner(auth.uid(), id));

-- group_members
CREATE POLICY "Group members can view membership"
  ON public.group_members FOR SELECT
  USING (user_is_group_member(auth.uid(), group_id));

CREATE POLICY "Group managers can add members"
  ON public.group_members FOR INSERT
  WITH CHECK (user_is_group_manager(auth.uid(), group_id));

CREATE POLICY "Group creators can add themselves as owner"
  ON public.group_members FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND role = 'owner'
    AND EXISTS (
      SELECT 1 FROM public.groups
      WHERE id = group_id AND created_by = auth.uid()
    )
  );

CREATE POLICY "Group managers can update member roles"
  ON public.group_members FOR UPDATE
  USING (user_is_group_manager(auth.uid(), group_id))
  WITH CHECK (user_is_group_manager(auth.uid(), group_id));

CREATE POLICY "Group managers or self can remove members"
  ON public.group_members FOR DELETE
  USING (user_is_group_manager(auth.uid(), group_id) OR user_id = auth.uid());

-- group_invitations
CREATE POLICY "Group managers can view invitations"
  ON public.group_invitations FOR SELECT
  USING (user_is_group_manager(auth.uid(), group_id) OR invited_by = auth.uid());

CREATE POLICY "Invited user can view their group invitation"
  ON public.group_invitations FOR SELECT
  USING (lower(auth.jwt() ->> 'email') = lower(email));

CREATE POLICY "Group managers can create invitations"
  ON public.group_invitations FOR INSERT
  WITH CHECK (user_is_group_manager(auth.uid(), group_id) AND auth.uid() = invited_by);

CREATE POLICY "Group managers can delete invitations"
  ON public.group_invitations FOR DELETE
  USING (user_is_group_manager(auth.uid(), group_id));

-- No UPDATE on group_invitations — acceptance handled by accept-group-invitation edge function

-- project_collaborators
CREATE POLICY "Project owners and collaborators can view collaborators"
  ON public.project_collaborators FOR SELECT
  USING (user_owns_project(auth.uid(), project_id) OR user_id = auth.uid());

CREATE POLICY "Invited user can view their project invitation"
  ON public.project_collaborators FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Project owners can invite collaborators"
  ON public.project_collaborators FOR INSERT
  WITH CHECK (user_owns_project(auth.uid(), project_id) AND auth.uid() = invited_by);

CREATE POLICY "Project owners or self can remove collaborators"
  ON public.project_collaborators FOR DELETE
  USING (user_owns_project(auth.uid(), project_id) OR user_id = auth.uid());

-- No UPDATE on project_collaborators — acceptance handled by accept-project-invitation edge function

-- project_group_access
CREATE POLICY "Project owners can view group access"
  ON public.project_group_access FOR SELECT
  USING (user_owns_project(auth.uid(), project_id) OR EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_id = project_group_access.group_id AND user_id = auth.uid()
  ));

CREATE POLICY "Project owners can grant group access"
  ON public.project_group_access FOR INSERT
  WITH CHECK (user_owns_project(auth.uid(), project_id) AND auth.uid() = granted_by);

CREATE POLICY "Project owners can remove group access"
  ON public.project_group_access FOR DELETE
  USING (user_owns_project(auth.uid(), project_id));

-- project_pages
CREATE POLICY "Users can view accessible pages"
  ON public.project_pages FOR SELECT
  USING (user_can_access_page(auth.uid(), id));

CREATE POLICY "Authenticated users can create pages"
  ON public.project_pages FOR INSERT
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Page owners can update their pages"
  ON public.project_pages FOR UPDATE
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Page owners can delete their pages"
  ON public.project_pages FOR DELETE
  USING (created_by = auth.uid());

-- project_page_items
CREATE POLICY "Users can view items in accessible pages"
  ON public.project_page_items FOR SELECT
  USING (user_can_access_page(auth.uid(), page_id));

CREATE POLICY "Page owners can add items"
  ON public.project_page_items FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.project_pages WHERE id = page_id AND created_by = auth.uid()
  ));

CREATE POLICY "Page owners can update item order"
  ON public.project_page_items FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.project_pages WHERE id = page_id AND created_by = auth.uid()
  ));

CREATE POLICY "Page owners can remove items"
  ON public.project_page_items FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.project_pages WHERE id = page_id AND created_by = auth.uid()
  ));

-- project_page_access
CREATE POLICY "Page owners can view invitations"
  ON public.project_page_access FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.project_pages WHERE id = page_id AND created_by = auth.uid()
  ));

CREATE POLICY "Invited user can view their page invitation"
  ON public.project_page_access FOR SELECT
  USING (lower(auth.jwt() ->> 'email') = lower(email));

CREATE POLICY "Page owners can create invitations"
  ON public.project_page_access FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.project_pages WHERE id = page_id AND created_by = auth.uid())
    AND auth.uid() = invited_by
  );

CREATE POLICY "Page owners can delete invitations"
  ON public.project_page_access FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.project_pages WHERE id = page_id AND created_by = auth.uid()
  ));

-- project_page_group_access
CREATE POLICY "Page owners and group members can view page group access"
  ON public.project_page_group_access FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.project_pages WHERE id = page_id AND created_by = auth.uid())
    OR EXISTS (SELECT 1 FROM public.group_members WHERE group_id = project_page_group_access.group_id AND user_id = auth.uid())
  );

CREATE POLICY "Page owners can grant group access to pages"
  ON public.project_page_group_access FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.project_pages WHERE id = page_id AND created_by = auth.uid())
    AND auth.uid() = granted_by
  );

CREATE POLICY "Page owners can remove group access from pages"
  ON public.project_page_group_access FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.project_pages WHERE id = page_id AND created_by = auth.uid()
  ));

-- canvas_projects: allow edit-permission collaborators to save
CREATE POLICY "Edit collaborators can update projects"
  ON public.canvas_projects FOR UPDATE
  USING (user_can_edit_project(auth.uid(), id))
  WITH CHECK (user_can_edit_project(auth.uid(), id));

-- canvas_projects: allow accepted individual collaborators to view shared projects
CREATE POLICY "Accepted collaborators can view shared projects"
  ON public.canvas_projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_collaborators
      WHERE project_id = canvas_projects.id
        AND user_id = auth.uid()
        AND accepted_at IS NOT NULL
    )
  );

-- canvas_projects: allow group members to view group-shared projects
CREATE POLICY "Group members can view group-shared projects"
  ON public.canvas_projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_group_access pga
      JOIN public.group_members gm ON gm.group_id = pga.group_id
      WHERE pga.project_id = canvas_projects.id AND gm.user_id = auth.uid()
    )
  );

-- canvas_projects: allow page members to view projects in their accessible pages
CREATE POLICY "Page members can view projects in accessible pages"
  ON public.canvas_projects FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.project_page_items ppi
      WHERE ppi.project_id = canvas_projects.id
        AND public.user_can_access_page(auth.uid(), ppi.page_id)
    )
  );

-- canvas_projects: allow page members with edit permission to save changes
CREATE POLICY "Page members with edit permission can update projects in pages"
  ON public.canvas_projects FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.project_page_items ppi
      WHERE ppi.project_id = canvas_projects.id
        AND (
          EXISTS (
            SELECT 1 FROM public.project_page_access ppa
            WHERE ppa.page_id = ppi.page_id
              AND ppa.user_id = auth.uid()
              AND ppa.accepted_at IS NOT NULL
              AND ppa.permission = 'edit'
          ) OR EXISTS (
            SELECT 1 FROM public.project_page_group_access ppga
            JOIN public.group_members gm ON gm.group_id = ppga.group_id
            WHERE ppga.page_id = ppi.page_id
              AND gm.user_id = auth.uid()
              AND ppga.permission = 'edit'
          )
        )
    )
  );

-- profiles: allow group co-members and project collaborators to see each other
CREATE POLICY "Group co-members can view each other's profiles"
  ON public.profiles FOR SELECT
  USING (user_shares_group_with(auth.uid(), profiles.id));

CREATE POLICY "Project collaborators can view each other's profiles"
  ON public.profiles FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.project_collaborators pc1
      JOIN public.project_collaborators pc2 ON pc1.project_id = pc2.project_id
      WHERE pc1.user_id = auth.uid()
        AND pc2.user_id = profiles.id
        AND pc1.accepted_at IS NOT NULL
        AND pc2.accepted_at IS NOT NULL
    )
  );
