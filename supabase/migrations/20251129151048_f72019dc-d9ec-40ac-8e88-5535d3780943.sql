-- Create AI Icons category
INSERT INTO icon_categories (id, name, created_at)
VALUES ('ai-icons', 'AI Icons', now())
ON CONFLICT (id) DO NOTHING;