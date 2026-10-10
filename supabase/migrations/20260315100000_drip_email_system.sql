-- ============================================================
-- Migration: Drip Email Campaign System
-- Creates tracking table and pg_cron scheduled job
-- ============================================================

-- 1. Tracking table for sent drip emails (deduplication)
CREATE TABLE public.drip_emails_sent (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_type TEXT NOT NULL CHECK (email_type IN ('welcome_24h', 'features_7d', 'milestone_30d')),
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, email_type)
);

CREATE INDEX idx_drip_emails_sent_user_id ON public.drip_emails_sent(user_id);

-- RLS: only service role needs access (edge function uses service role key)
ALTER TABLE public.drip_emails_sent ENABLE ROW LEVEL SECURITY;

-- 2. Add email_drip opt-out to notification_preferences default
-- (notification_preferences is a JSONB column on profiles — no schema change needed,
--  the edge function checks for email_drip.email = false)

-- 3. pg_cron job: runs every hour to trigger drip email processing
-- NOTE: Run this manually in Supabase SQL Editor since pg_cron
-- requires the cron extension and net extension:
--
-- SELECT cron.schedule(
--   'send-drip-emails',
--   '0 * * * *',  -- every hour on the hour
--   $$
--   SELECT net.http_post(
--     url := current_setting('app.settings.supabase_url') || '/functions/v1/send-drip-email',
--     headers := jsonb_build_object(
--       'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key'),
--       'Content-Type', 'application/json'
--     ),
--     body := '{}'::jsonb
--   );
--   $$
-- );
