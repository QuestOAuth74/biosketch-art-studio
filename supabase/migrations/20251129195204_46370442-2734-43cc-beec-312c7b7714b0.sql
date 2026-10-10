-- Create table for AI icon generation history
CREATE TABLE ai_icon_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  style TEXT NOT NULL,
  creativity_level TEXT NOT NULL DEFAULT 'balanced',
  background_type TEXT NOT NULL DEFAULT 'transparent',
  reference_image_url TEXT NOT NULL,
  generated_image_url TEXT NOT NULL,
  icon_name TEXT,
  description TEXT,
  is_saved_to_library BOOLEAN DEFAULT FALSE,
  is_submitted_for_review BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE ai_icon_generations ENABLE ROW LEVEL SECURITY;

-- Users can view their own generations
CREATE POLICY "Users can view own generations" 
ON ai_icon_generations
FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own generations  
CREATE POLICY "Users can insert own generations" 
ON ai_icon_generations
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can update their own generations
CREATE POLICY "Users can update own generations" 
ON ai_icon_generations
FOR UPDATE 
USING (auth.uid() = user_id);

-- Users can delete their own generations
CREATE POLICY "Users can delete own generations" 
ON ai_icon_generations
FOR DELETE 
USING (auth.uid() = user_id);

-- Admins can view all generations
CREATE POLICY "Admins can view all generations"
ON ai_icon_generations
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Create index for faster queries
CREATE INDEX idx_ai_icon_generations_user_id ON ai_icon_generations(user_id);
CREATE INDEX idx_ai_icon_generations_created_at ON ai_icon_generations(created_at DESC);