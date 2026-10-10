-- Schedule hourly drip email processing via pg_cron + pg_net
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

SELECT cron.schedule(
  'send-drip-emails',
  '0 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://tljsbmpglwmzyaoxsqyj.supabase.co/functions/v1/send-drip-email',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);
