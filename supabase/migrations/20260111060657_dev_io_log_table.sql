-- Create dev_io_log table for tracking database operations in development
CREATE TABLE public.dev_io_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  operation_type TEXT NOT NULL,
  table_name TEXT,
  data_size_kb NUMERIC,
  source TEXT NOT NULL,
  query_details JSONB,
  error TEXT,
  duration_ms NUMERIC
);

-- Add table comment
COMMENT ON TABLE public.dev_io_log IS 'Development-only table for tracking database I/O operations';

-- Create indexes
CREATE INDEX dev_io_log_timestamp_idx ON public.dev_io_log(timestamp DESC);
CREATE INDEX dev_io_log_source_idx ON public.dev_io_log(source);
CREATE INDEX dev_io_log_operation_type_idx ON public.dev_io_log(operation_type);

-- Disable RLS (this is a dev-only diagnostics table)
ALTER TABLE public.dev_io_log DISABLE ROW LEVEL SECURITY;

-- Grant permissions to all roles
GRANT ALL ON public.dev_io_log TO anon;
GRANT ALL ON public.dev_io_log TO authenticated;
GRANT ALL ON public.dev_io_log TO service_role;
