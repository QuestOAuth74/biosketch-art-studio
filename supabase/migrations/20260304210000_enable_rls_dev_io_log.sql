-- Enable RLS on dev_io_log table to fix security vulnerability
ALTER TABLE public.dev_io_log ENABLE ROW LEVEL SECURITY;

-- Revoke public anonymous access
REVOKE ALL ON public.dev_io_log FROM anon;

-- Allow authenticated users to insert their own logs
CREATE POLICY "Authenticated users can insert logs"
  ON public.dev_io_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow authenticated users to read logs
CREATE POLICY "Authenticated users can read logs"
  ON public.dev_io_log
  FOR SELECT
  TO authenticated
  USING (true);

-- Service role retains full access (bypasses RLS by default)
