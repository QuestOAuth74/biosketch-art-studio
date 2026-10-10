-- Create metrics_inflation_log table for audit trail
CREATE TABLE public.metrics_inflation_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inflated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  inflated_by UUID REFERENCES public.profiles(id),
  percentage INTEGER NOT NULL,
  variation_mode TEXT NOT NULL CHECK (variation_mode IN ('uniform', 'varied')),
  tier_filter TEXT CHECK (tier_filter IN ('all', 'tier1', 'tier2', 'tier3')),
  projects_affected INTEGER NOT NULL,
  total_views_before INTEGER NOT NULL,
  total_views_after INTEGER NOT NULL,
  total_likes_before INTEGER NOT NULL,
  total_likes_after INTEGER NOT NULL,
  total_clones_before INTEGER NOT NULL,
  total_clones_after INTEGER NOT NULL
);

-- Enable RLS
ALTER TABLE public.metrics_inflation_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can insert inflation logs"
ON public.metrics_inflation_log
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view inflation logs"
ON public.metrics_inflation_log
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Create index for faster queries
CREATE INDEX idx_metrics_inflation_log_inflated_at ON public.metrics_inflation_log(inflated_at DESC);