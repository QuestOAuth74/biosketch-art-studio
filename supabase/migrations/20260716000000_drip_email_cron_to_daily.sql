-- Reduce drip email cron from hourly to once-daily to lower background load.
--
-- Previous schedule (from 20260315100001 + 20260601000000): '0 * * * *'
-- New schedule: '0 14 * * *' — once daily at 14:00 UTC
-- (mid-morning US East / afternoon Europe — reasonable send window).
--
-- The eligibility windows in send-drip-email/index.ts are wide
-- (features_7d = 3-day window, reengage_90d = 30-day window),
-- so a single daily check still catches every eligible user.
--
-- Idempotent: unschedule the existing job (if present) and reschedule.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-drip-emails') THEN
    PERFORM cron.unschedule('send-drip-emails');
  END IF;

  PERFORM cron.schedule(
    'send-drip-emails',
    '0 14 * * *',
    $cron$
    SELECT net.http_post(
      url := 'https://tljsbmpglwmzyaoxsqyj.supabase.co/functions/v1/send-drip-email',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{}'::jsonb
    );
    $cron$
  );
END $$;
