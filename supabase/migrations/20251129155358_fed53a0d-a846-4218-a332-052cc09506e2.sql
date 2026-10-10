-- Add optional generation_type column to ai_generation_usage table for analytics
ALTER TABLE public.ai_generation_usage
ADD COLUMN IF NOT EXISTS generation_type TEXT CHECK (generation_type IN ('icon', 'figure', 'powerpoint'));

-- Add comment to document the column
COMMENT ON COLUMN public.ai_generation_usage.generation_type IS 'Optional field to track which AI feature generated this usage record: icon, figure, or powerpoint';