-- The project_comments table pre-existed (created outside this repo) with the
-- body column named `comment_text`. The previous migration's CREATE TABLE was
-- skipped because the table already existed, so the client code, the
-- notify_project_owner_on_comment trigger, and the intended length CHECK all
-- expect a `body` column that never got created — making every comment insert
-- fail. Rename the column to reconcile, and add the length constraint.

ALTER TABLE public.project_comments RENAME COLUMN comment_text TO body;

ALTER TABLE public.project_comments ALTER COLUMN body SET NOT NULL;

ALTER TABLE public.project_comments
  DROP CONSTRAINT IF EXISTS project_comments_body_length;
ALTER TABLE public.project_comments
  ADD CONSTRAINT project_comments_body_length CHECK (length(body) BETWEEN 1 AND 2000);
