-- Update the default AI provider settings to include generation_mode
UPDATE ai_provider_settings
SET setting_value = jsonb_set(
  setting_value,
  '{generation_mode}',
  '"full"'::jsonb
)
WHERE setting_key = 'powerpoint_generation'
AND NOT setting_value ? 'generation_mode';