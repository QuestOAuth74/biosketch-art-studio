-- Rolling 24h unique visitor tracking (IP-hashed for privacy).
-- Populated by edge function `track-visit` on each route change.

CREATE TABLE IF NOT EXISTS public.visitor_pings (
  ip_hash TEXT PRIMARY KEY,
  last_seen TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS visitor_pings_last_seen_idx
  ON public.visitor_pings (last_seen);

ALTER TABLE public.visitor_pings ENABLE ROW LEVEL SECURITY;

-- No direct table access; only the RPC is callable by clients.
-- Edge function writes via service role key (bypasses RLS).

CREATE OR REPLACE FUNCTION public.get_unique_visitors_24h()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.visitor_pings
  WHERE last_seen > now() - interval '24 hours';
$$;

GRANT EXECUTE ON FUNCTION public.get_unique_visitors_24h() TO anon, authenticated;

COMMENT ON FUNCTION public.get_unique_visitors_24h() IS
  'Returns count of unique visitor IPs seen in the past 24 hours.';

-- Upsert helper called by the edge function with the service role.
CREATE OR REPLACE FUNCTION public.record_visitor_ping(p_ip_hash TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.visitor_pings (ip_hash, last_seen)
  VALUES (p_ip_hash, now())
  ON CONFLICT (ip_hash)
  DO UPDATE SET last_seen = now();

  -- Opportunistic cleanup: prune rows older than 24h on ~1% of calls.
  IF random() < 0.01 THEN
    DELETE FROM public.visitor_pings
    WHERE last_seen < now() - interval '24 hours';
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_visitor_ping(TEXT) FROM anon, authenticated;
