-- Built-in templates table: admin-editable templates that override hardcoded defaults
CREATE TABLE IF NOT EXISTS built_in_templates (
  id TEXT PRIMARY KEY,                    -- matches template id from templates.ts (e.g. 'western-blot')
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category TEXT NOT NULL DEFAULT 'scientific',
  thumbnail TEXT,                          -- base64 SVG data URI
  canvas_data JSONB NOT NULL DEFAULT '{}', -- Fabric.js canvas JSON
  dimensions JSONB NOT NULL DEFAULT '{"width": 1200, "height": 800}',
  paper_size TEXT NOT NULL DEFAULT 'letter',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast sorted listing
CREATE INDEX idx_built_in_templates_sort ON built_in_templates (sort_order, name);
CREATE INDEX idx_built_in_templates_category ON built_in_templates (category);

-- RLS: anyone can read, only admins can write
ALTER TABLE built_in_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read built-in templates"
  ON built_in_templates FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage built-in templates"
  ON built_in_templates FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_roles.user_id = auth.uid()
      AND user_roles.role = 'admin'
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_built_in_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_built_in_templates_updated_at
  BEFORE UPDATE ON built_in_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_built_in_templates_updated_at();
