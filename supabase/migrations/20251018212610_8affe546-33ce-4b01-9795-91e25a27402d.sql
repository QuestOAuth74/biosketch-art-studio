-- Create testimonials table for user feedback
CREATE TABLE public.testimonials (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  country text NOT NULL,
  scientific_discipline text NOT NULL,
  message text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  is_approved boolean DEFAULT false,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  CONSTRAINT message_length CHECK (char_length(message) >= 10 AND char_length(message) <= 500),
  CONSTRAINT name_length CHECK (char_length(name) >= 2 AND char_length(name) <= 100)
);

-- Enable Row Level Security
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can create testimonials (subject to approval)
CREATE POLICY "Anyone can submit testimonials"
ON public.testimonials
FOR INSERT
TO public
WITH CHECK (true);

-- Policy: Only approved testimonials are publicly viewable
CREATE POLICY "Approved testimonials are viewable by all"
ON public.testimonials
FOR SELECT
TO public
USING (is_approved = true);

-- Policy: Admins can view all testimonials
CREATE POLICY "Admins can view all testimonials"
ON public.testimonials
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Admins can update testimonials (for approval)
CREATE POLICY "Admins can update testimonials"
ON public.testimonials
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Policy: Admins can delete testimonials
CREATE POLICY "Admins can delete testimonials"
ON public.testimonials
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create index for faster queries
CREATE INDEX idx_testimonials_approved ON public.testimonials(is_approved, created_at DESC);