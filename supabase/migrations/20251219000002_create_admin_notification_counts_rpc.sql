-- ============================================================================
-- Migration: Create Admin Notification Counts RPC Function
-- Date: 2024-12-19
-- Description:
--   Creates RPC function to batch 5 separate COUNT queries into 1 call.
--   Replaces individual queries in AdminNotificationBell component.
--
-- Current Problem:
--   - AdminNotificationBell makes 5 parallel COUNT queries every 60 seconds
--   - Each query is a separate network roundtrip
--   - With 5 concurrent admins: 25 queries/minute
--
-- Solution:
--   - Single RPC function executes all 5 counts in one transaction
--   - Reduces network roundtrips from 5 to 1 (80% reduction)
--   - All counts execute with consistent snapshot
--
-- Expected Impact:
--   - Network roundtrips: 5 -> 1
--   - Query time: 500ms (5x100ms) -> 150ms
--   - With caching: 25 queries/min -> 1 query/min (96% reduction)
--
-- Safety:
--   - SECURITY DEFINER with explicit search_path
--   - Read-only function (no data modification)
--   - Uses existing partial indexes from previous migrations
-- ============================================================================

-- Drop function if exists (for clean re-deployment)
DROP FUNCTION IF EXISTS get_admin_notification_counts();

-- Create function to get all admin notification counts in one query
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
    -- Canvas projects pending approval (uses idx_canvas_projects_pending)
    (SELECT COUNT(*) FROM canvas_projects WHERE approval_status = 'pending'),

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

-- Add comment for documentation
COMMENT ON FUNCTION get_admin_notification_counts() IS
  'Returns all admin notification counts in a single query. Combines 5 COUNT queries into 1 RPC call to reduce network overhead. Used by AdminNotificationBell component polling every 5 minutes (was 60 seconds). All queries use partial indexes for optimal performance.';
