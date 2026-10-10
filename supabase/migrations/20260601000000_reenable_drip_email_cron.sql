-- Re-enable the hourly drip email cron job that was unscheduled in
-- 20260530000000_disable_drip_email_cron.sql.
--
-- The send-drip-email edge function and the drip_emails_sent dedupe
-- table were intentionally left in place during the disable, so this
-- just re-schedules the trigger. The function still drives the four
-- existing campaigns: welcome_24h, features_7d, milestone_30d, and
-- reengage_90d.
--
-- Idempotent: only schedule if the job isn't already present.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-drip-emails') THEN
    PERFORM cron.schedule(
      'send-drip-emails',
      '0 * * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://tljsbmpglwmzyaoxsqyj.supabase.co/functions/v1/send-drip-email',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := '{}'::jsonb
      );
      $cron$
    );
  END IF;
END $$;
