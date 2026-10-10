-- Update CHECK constraint on generation_type to include icon-customize and powerpoint_full
ALTER TABLE public.ai_generation_usage
DROP CONSTRAINT IF EXISTS ai_generation_usage_generation_type_check;

ALTER TABLE public.ai_generation_usage
ADD CONSTRAINT ai_generation_usage_generation_type_check
CHECK (generation_type IN ('icon', 'figure', 'powerpoint', 'icon-customize', 'powerpoint_full', 'reference-image'));
