-- ============================================================================
-- Migration: Update Admin Notification Counts RPC to Match Component Queries
-- Date: 2024-12-19
-- Description:
--   The current get_admin_notification_counts() RPC doesn't match actual
--   component queries. Components filter by is_public = true but RPC doesn't.
--
--   Mismatch:
--     RPC:       WHERE approval_status = 'pending'
--     Component: WHERE is_public = true AND approval_status = 'pending'
--
--   This causes notification counts to be incorrect and prevents index usage.
--
-- Fix:
--   Update RPC to include is_public = true filter to match components
-- ============================================================================

-- Drop existing function
DROP FUNCTION IF EXISTS get_admin_notification_counts();

-- Recreate with corrected filters
CREATE OR REPLACE FUNCTION get_admin_notification_counts()
RETURNS TABLE (
  pending_projects BIGINT,
  pending_testimonials BIGINT,
  pending_icons BIGINT,
  unread_messages BIGINT,
  unviewed_feedback BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Canvas projects pending approval (uses idx_canvas_projects_public_approval)
    -- FIXED: Added is_public = true to match SubmittedProjects component
    (SELECT COUNT(*) FROM canvas_projects
     WHERE is_public = true AND approval_status = 'pending'),

    -- Testimonials not approved (uses idx_testimonials_unapproved)
    (SELECT COUNT(*) FROM testimonials WHERE is_approved = false),

    -- Icon submissions pending (uses idx_icon_submissions_pending)
    (SELECT COUNT(*) FROM icon_submissions WHERE approval_status = 'pending'),

    -- Contact messages unread (uses idx_contact_messages_unread)
    (SELECT COUNT(*) FROM contact_messages WHERE is_read = false),

    -- Tool feedback not viewed (uses idx_tool_feedback_unviewed)
    (SELECT COUNT(*) FROM tool_feedback WHERE is_viewed = false);
END;
$$;

-- Grant execute permission to authenticated users (admins)
GRANT EXECUTE ON FUNCTION get_admin_notification_counts() TO authenticated;

-- Update comment
COMMENT ON FUNCTION get_admin_notification_counts() IS
  'Returns all admin notification counts in a single query. UPDATED to include is_public = true filter for canvas_projects to match component queries and enable index usage.';
