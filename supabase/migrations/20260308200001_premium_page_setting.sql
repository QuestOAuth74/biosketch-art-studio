-- Add premium page setting (disabled by default until admin edits content)
INSERT INTO public.site_settings (setting_key, setting_value)
VALUES ('premium_page', '{
  "enabled": false,
  "title": "Open Science Starts With You",
  "content": null,
  "updated_at": null
}'::jsonb);
