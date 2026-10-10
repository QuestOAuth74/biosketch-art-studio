-- Create email_subscriptions table for newsletter signups
CREATE TABLE IF NOT EXISTS public.email_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  subscribed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  subscription_source TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  unsubscribed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_email_subscriptions_email ON public.email_subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_email_subscriptions_user_id ON public.email_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_email_subscriptions_is_active ON public.email_subscriptions(is_active);

-- Enable Row Level Security
ALTER TABLE public.email_subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own subscriptions
CREATE POLICY "Users can view own subscriptions"
  ON public.email_subscriptions
  FOR SELECT
  USING (
    auth.uid() = user_id OR 
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- RLS Policy: Anyone can subscribe (supports non-authenticated signups)
CREATE POLICY "Anyone can subscribe"
  ON public.email_subscriptions
  FOR INSERT
  WITH CHECK (true);

-- RLS Policy: Users can update their own subscriptions
CREATE POLICY "Users can update own subscriptions"
  ON public.email_subscriptions
  FOR UPDATE
  USING (
    auth.uid() = user_id OR 
    email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

-- RLS Policy: Admins can view all subscriptions
CREATE POLICY "Admins can view all subscriptions"
  ON public.email_subscriptions
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policy: Admins can update all subscriptions
CREATE POLICY "Admins can update all subscriptions"
  ON public.email_subscriptions
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS Policy: Admins can delete subscriptions
CREATE POLICY "Admins can delete subscriptions"
  ON public.email_subscriptions
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));