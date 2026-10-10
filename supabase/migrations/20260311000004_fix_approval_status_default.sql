-- FIX: The approval_status column was created with DEFAULT 'pending', which means
-- every new project starts as 'pending'. The lock-pending RLS policy then blocks
-- ALL saves — not just submitted projects. Only projects that have been explicitly
-- submitted for review should be 'pending'.
--
-- This migration:
-- 1. Changes the column default to NULL (no review status until user submits)
-- 2. Sets all non-public projects from 'pending' to NULL so they can be saved again
-- 3. Sets rejected projects back to NULL so owners can continue editing

-- Step 1: Change the default so new projects start with NULL (not 'pending')
ALTER TABLE public.canvas_projects
  ALTER COLUMN approval_status SET DEFAULT NULL;

-- Step 2: Fix existing private projects that were incorrectly set to 'pending'.
-- Only projects with is_public = true AND approval_status = 'pending' are
-- legitimately awaiting review. Everything else should be NULL.
UPDATE public.canvas_projects
SET approval_status = NULL
WHERE approval_status = 'pending'
  AND (is_public IS NOT TRUE);

-- Step 3: Rejected projects should also be reset to NULL so the owner can edit
-- and resubmit. The 'rejected' status serves no ongoing purpose once the owner
-- has been notified.
UPDATE public.canvas_projects
SET approval_status = NULL
WHERE approval_status = 'rejected';
