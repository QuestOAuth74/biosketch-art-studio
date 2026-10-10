-- Performance optimization indexes to reduce I/O timeouts
-- Adds partial and composite indexes for frequently queried tables

-- Login attempts table indexes
-- Used by RateLimitManager for polling queries
CREATE INDEX IF NOT EXISTS idx_login_attempts_created_at
  ON login_attempts(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_email_created
  ON login_attempts(email, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_login_attempts_attempt_time_success
  ON login_attempts(attempt_time DESC, success);

-- Contact messages table partial index
-- Used by AdminNotificationBell for COUNT queries
CREATE INDEX IF NOT EXISTS idx_contact_messages_unread
  ON contact_messages(is_read, created_at DESC)
  WHERE is_read = false;

-- Testimonials table partial index
-- Used by AdminNotificationBell for COUNT queries
CREATE INDEX IF NOT EXISTS idx_testimonials_unapproved
  ON testimonials(is_approved, created_at DESC)
  WHERE is_approved = false;

-- Icon submissions table partial index
-- Used by AdminNotificationBell for COUNT queries
CREATE INDEX IF NOT EXISTS idx_icon_submissions_pending
  ON icon_submissions(approval_status, created_at DESC)
  WHERE approval_status = 'pending';

-- Tool feedback table partial index
-- Used by AdminNotificationBell for COUNT queries
CREATE INDEX IF NOT EXISTS idx_tool_feedback_unviewed
  ON tool_feedback(is_viewed, created_at DESC)
  WHERE is_viewed = false;

-- Canvas projects composite index for better query performance
CREATE INDEX IF NOT EXISTS idx_canvas_projects_public_approved_views
  ON canvas_projects(is_public, approval_status, view_count DESC)
  WHERE is_public = true AND approval_status = 'approved';
