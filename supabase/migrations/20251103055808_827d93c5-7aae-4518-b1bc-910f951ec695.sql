-- Create table to track AI icon generation usage
CREATE TABLE public.ai_generation_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  month_year TEXT NOT NULL,
  prompt TEXT,
  style TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX idx_ai_generation_usage_user_month 
ON public.ai_generation_usage(user_id, month_year);

CREATE INDEX idx_ai_generation_usage_user_generated 
ON public.ai_generation_usage(user_id, generated_at DESC);

-- Enable RLS
ALTER TABLE public.ai_generation_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own usage
CREATE POLICY "Users can view own usage"
ON public.ai_generation_usage
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- RLS Policy: Admins can view all usage
CREATE POLICY "Admins can view all usage"
ON public.ai_generation_usage
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));

-- Function to get user's generation count for current month
CREATE OR REPLACE FUNCTION get_user_generation_count(
  _user_id UUID,
  _month_year TEXT
)
RETURNS INTEGER
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM ai_generation_usage
  WHERE user_id = _user_id
    AND month_year = _month_year;
$$;

-- Function to check if user can generate
CREATE OR REPLACE FUNCTION can_user_generate(_user_id UUID)
RETURNS JSONB
LANGUAGE PLPGSQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_month TEXT;
  generation_count INTEGER;
  is_admin_user BOOLEAN;
BEGIN
  current_month := to_char(now(), 'YYYY-MM');
  is_admin_user := has_role(_user_id, 'admin');
  
  IF is_admin_user THEN
    RETURN jsonb_build_object(
      'canGenerate', true,
      'isAdmin', true,
      'used', 0,
      'limit', null,
      'remaining', null,
      'monthYear', current_month
    );
  END IF;
  
  generation_count := get_user_generation_count(_user_id, current_month);
  
  RETURN jsonb_build_object(
    'canGenerate', generation_count < 2,
    'isAdmin', false,
    'used', generation_count,
    'limit', 2,
    'remaining', GREATEST(0, 2 - generation_count),
    'monthYear', current_month
  );
END;
$$;