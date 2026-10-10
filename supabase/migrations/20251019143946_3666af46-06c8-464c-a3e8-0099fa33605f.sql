-- Create table for tracking reviewed/ignored icons
CREATE TABLE public.icon_review_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  icon_id uuid REFERENCES public.icons(id) ON DELETE CASCADE NOT NULL,
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamp with time zone DEFAULT now(),
  ignore_reason text,
  UNIQUE(icon_id)
);

-- Enable RLS
ALTER TABLE public.icon_review_status ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Only admins can manage icon review status"
ON public.icon_review_status
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster lookups
CREATE INDEX idx_icon_review_status_icon_id ON public.icon_review_status(icon_id);