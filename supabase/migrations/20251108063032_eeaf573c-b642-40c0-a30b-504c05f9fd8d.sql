-- Add is_viewed column to tool_feedback table
ALTER TABLE public.tool_feedback
ADD COLUMN is_viewed BOOLEAN NOT NULL DEFAULT false;

-- Create index for better query performance
CREATE INDEX idx_tool_feedback_is_viewed ON public.tool_feedback(is_viewed);

-- Update RLS policy to allow admins to update is_viewed
CREATE POLICY "Admins can update feedback viewed status"
ON public.tool_feedback
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));