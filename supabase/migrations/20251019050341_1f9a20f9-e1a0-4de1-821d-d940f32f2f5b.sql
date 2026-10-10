-- Add missing anatomy category
INSERT INTO icon_categories (id, name) 
VALUES ('anatomy', 'Anatomy')
ON CONFLICT (id) DO NOTHING;