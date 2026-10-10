-- Add missing icon categories that have icons but no category entries
INSERT INTO icon_categories (id, name) 
VALUES 
  ('anatomic-icons', 'Anatomic Icons'),
  ('physiology', 'Physiology')
ON CONFLICT (id) DO NOTHING;