-- Verification query to check if the expanded preset types constraint is active
-- Run this in your Supabase SQL Editor to verify the migration was applied

-- Check the constraint definition
SELECT
  conname AS constraint_name,
  pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conname = 'user_style_presets_type_check'
  AND conrelid = 'public.user_style_presets'::regclass;

-- If the constraint includes 'image', 'textbox', etc., the migration was successful
-- If it only shows 'text', 'shape', 'line', 'mixed', you need to run the migration
