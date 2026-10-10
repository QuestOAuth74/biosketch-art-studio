-- Add canvas_data column to icons table for group/composite icons
-- Stores serialized Fabric.js objects so components retain native properties
ALTER TABLE public.icons ADD COLUMN IF NOT EXISTS canvas_data jsonb DEFAULT NULL;

-- Add a comment for documentation
COMMENT ON COLUMN public.icons.canvas_data IS 'Serialized Fabric.js objects for group icons. When present, icon is placed as editable group rather than flat SVG.';
