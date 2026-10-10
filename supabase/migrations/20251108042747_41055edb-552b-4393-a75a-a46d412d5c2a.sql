-- Create tool_feedback table for canvas rating system
CREATE TABLE public.tool_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  rating TEXT NOT NULL CHECK (rating IN ('thumbs_up', 'thumbs_down')),
  page TEXT NOT NULL DEFAULT 'canvas',
  user_agent TEXT,
  session_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tool_feedback ENABLE ROW LEVEL SECURITY;

-- Allow anyone (including anonymous) to insert feedback
CREATE POLICY "Anyone can submit feedback"
  ON public.tool_feedback
  FOR INSERT
  WITH CHECK (true);

-- Only admins can view feedback
CREATE POLICY "Admins can view all feedback"
  ON public.tool_feedback
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for performance
CREATE INDEX idx_tool_feedback_created_at ON public.tool_feedback(created_at DESC);
CREATE INDEX idx_tool_feedback_rating ON public.tool_feedback(rating);
CREATE INDEX idx_tool_feedback_page ON public.tool_feedback(page);