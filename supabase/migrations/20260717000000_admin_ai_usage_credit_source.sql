-- Extend get_admin_ai_usage to include the new ai_generations ledger so the
-- admin analytics view can show credit source (grant vs purchased) and
-- refunded state.
--
-- Legacy rows from ai_generation_usage / diagram_generations pre-date the
-- credit ledger, so they surface with credit_source = NULL (rendered as an
-- em-dash / "unknown" chip on the client).
--
-- Postgres won't allow CREATE OR REPLACE to change the RETURNS row shape, so
-- we DROP + CREATE.

DROP FUNCTION IF EXISTS public.get_admin_ai_usage(timestamp with time zone, timestamp with time zone);

CREATE FUNCTION public.get_admin_ai_usage(
  _from_date timestamp with time zone,
  _to_date timestamp with time zone
)
RETURNS TABLE(
  id uuid,
  user_id uuid,
  generated_at timestamp with time zone,
  month_year text,
  prompt text,
  style text,
  generation_type text,
  credit_source text,
  refunded_at timestamp with time zone
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only admins can call this
  IF NOT has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  RETURN QUERY
  -- Legacy per-feature log: no credit_source, kept for historical continuity.
  SELECT
    a.id,
    a.user_id,
    a.generated_at,
    a.month_year,
    a.prompt,
    a.style,
    a.generation_type,
    NULL::text  AS credit_source,
    NULL::timestamptz AS refunded_at
  FROM ai_generation_usage a
  WHERE a.generated_at >= _from_date
    AND a.generated_at <= _to_date

  UNION ALL

  -- Legacy diagram log.
  SELECT
    d.id,
    d.user_id,
    d.created_at AS generated_at,
    to_char(d.created_at, 'YYYY-MM') AS month_year,
    d.prompt,
    NULL::text AS style,
    'diagram'::text AS generation_type,
    NULL::text AS credit_source,
    NULL::timestamptz AS refunded_at
  FROM diagram_generations d
  WHERE d.created_at >= _from_date
    AND d.created_at <= _to_date

  UNION ALL

  -- New credit ledger: authoritative for anything post-launch. Exposes
  -- credit_source (grant | purchased) and refunded_at so the admin can
  -- distinguish paid activity + track refunds.
  SELECT
    g.id,
    g.user_id,
    g.created_at AS generated_at,
    to_char(g.created_at, 'YYYY-MM') AS month_year,
    NULL::text AS prompt,
    NULL::text AS style,
    g.feature AS generation_type,
    g.credit_source,
    g.refunded_at
  FROM ai_generations g
  WHERE g.created_at >= _from_date
    AND g.created_at <= _to_date

  ORDER BY generated_at DESC;
END;
$function$;
