-- Saved datasets (reusable data tables for Chart Studio)
CREATE TABLE IF NOT EXISTS chart_studio_saved_datasets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Dataset',
  columns JSONB NOT NULL,
  rows JSONB NOT NULL,
  row_count INTEGER NOT NULL DEFAULT 0,
  col_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cs_saved_datasets_user
  ON chart_studio_saved_datasets(user_id, updated_at DESC);

ALTER TABLE chart_studio_saved_datasets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own saved datasets"
  ON chart_studio_saved_datasets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create saved datasets"
  ON chart_studio_saved_datasets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own saved datasets"
  ON chart_studio_saved_datasets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved datasets"
  ON chart_studio_saved_datasets FOR DELETE USING (auth.uid() = user_id);

-- Saved graph presets (chart settings without data)
CREATE TABLE IF NOT EXISTS chart_studio_saved_graphs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Untitled Graph',
  chart_type TEXT NOT NULL DEFAULT 'column',
  settings JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cs_saved_graphs_user
  ON chart_studio_saved_graphs(user_id, updated_at DESC);

ALTER TABLE chart_studio_saved_graphs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own saved graphs"
  ON chart_studio_saved_graphs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create saved graphs"
  ON chart_studio_saved_graphs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own saved graphs"
  ON chart_studio_saved_graphs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own saved graphs"
  ON chart_studio_saved_graphs FOR DELETE USING (auth.uid() = user_id);

-- Auto-update timestamps (reuse existing function from projects migration)
CREATE TRIGGER cs_saved_datasets_updated_at
  BEFORE UPDATE ON chart_studio_saved_datasets
  FOR EACH ROW EXECUTE FUNCTION update_chart_studio_updated_at();

CREATE TRIGGER cs_saved_graphs_updated_at
  BEFORE UPDATE ON chart_studio_saved_graphs
  FOR EACH ROW EXECUTE FUNCTION update_chart_studio_updated_at();
