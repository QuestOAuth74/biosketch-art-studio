ALTER TABLE powerpoint_generations
ADD COLUMN IF NOT EXISTS current_step text DEFAULT 'uploading';
