-- ============================================================================
-- Migration: Fix Admin Dashboard Queries with is_public Filter
-- Date: 2024-12-19
-- Description:
--   The existing idx_canvas_projects_pending index doesn't cover queries
--   that filter by BOTH approval_status AND is_public.
--
--   SubmittedProjects.tsx queries:
--     WHERE is_public = true AND approval_status = 'pending'
--
--   This requires a composite index covering both columns.
--
-- Root Cause of 11-14 Second scrollThroughSections:
--   - Admin page loads all 5 manager components on page load
--   - Each component runs COUNT query with is_public filter
--   - Without proper index, each COUNT is a full table scan
--   - 5 full table scans × 2-3s each = 10-15s total
--
-- Expected Impact:
--   - Query time: 10,000ms → 50ms per component (200x faster)
--   - scrollThroughSections: 14s → 2-3s (page load only)
--   - Eliminates full table scans on canvas_projects
-- ============================================================================

-- Drop the old partial index (replaced by composite index below)
DROP INDEX IF EXISTS idx_canvas_projects_pending;

-- Create composite index covering both is_public and approval_status
-- This supports queries with either or both conditions
CREATE INDEX IF NOT EXISTS idx_canvas_projects_public_approval
  ON canvas_projects(is_public, approval_status, created_at DESC)
  WHERE is_public = true;

-- Also create index for approved projects (used when switching tabs)
CREATE INDEX IF NOT EXISTS idx_canvas_projects_approved
  ON canvas_projects(approval_status, updated_at DESC)
  WHERE is_public = true AND approval_status = 'approved';

-- Index for rejected projects
CREATE INDEX IF NOT EXISTS idx_canvas_projects_rejected
  ON canvas_projects(approval_status, updated_at DESC)
  WHERE is_public = true AND approval_status = 'rejected';

COMMENT ON INDEX idx_canvas_projects_public_approval IS
  'Composite index for admin dashboard queries filtering by is_public and approval_status. Supports SubmittedProjects component COUNT and SELECT queries. Includes created_at for sorting.';

COMMENT ON INDEX idx_canvas_projects_approved IS
  'Partial index for approved public projects. Used when admin switches to approved tab in SubmittedProjects component.';

COMMENT ON INDEX idx_canvas_projects_rejected IS
  'Partial index for rejected public projects. Used when admin switches to rejected tab in SubmittedProjects component.';
