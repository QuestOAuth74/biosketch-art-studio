-- Stop the automated drip email campaign.
--
-- The hourly pg_cron job 'send-drip-emails' was triggering the
-- send-drip-email edge function which sent the welcome_24h,
-- features_7d, milestone_30d, and reengage_90d emails configured
-- in supabase/migrations/20260315100001_drip_email_cron_job.sql
-- and supabase/migrations/20260322100000_add_reengagement_drip_email.sql.
--
-- Unschedule the cron only. The drip_emails_sent tracking table and
-- the edge function source are left in place so the campaign can be
-- restarted later by re-running cron.schedule(...) without losing the
-- history of which users were already mailed at each stage.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-drip-emails') THEN
    PERFORM cron.unschedule('send-drip-emails');
  END IF;
END $$;
