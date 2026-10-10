-- Add re-engagement email type to the drip_emails_sent check constraint
ALTER TABLE public.drip_emails_sent
  DROP CONSTRAINT IF EXISTS drip_emails_sent_email_type_check;

ALTER TABLE public.drip_emails_sent
  ADD CONSTRAINT drip_emails_sent_email_type_check
  CHECK (email_type IN ('welcome_24h', 'features_7d', 'milestone_30d', 'reengage_90d'));
