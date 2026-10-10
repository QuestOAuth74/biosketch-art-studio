-- Add custom_unit column to canvas_projects table
-- This stores the unit type for custom canvas dimensions (px, in, cm, mm)

ALTER TABLE public.canvas_projects
ADD COLUMN custom_unit TEXT DEFAULT 'px'
CHECK (custom_unit IN ('px', 'in', 'cm', 'mm'));

-- Add comment for documentation
COMMENT ON COLUMN public.canvas_projects.custom_unit IS 'Unit type for custom canvas dimensions: pixels (px), inches (in), centimeters (cm), or millimeters (mm)';
