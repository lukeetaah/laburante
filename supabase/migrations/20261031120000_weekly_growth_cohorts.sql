-- LABURANTE - adquisición, activación y retención semanal
--
-- Esta migración no modifica user_activity, que sigue siendo la fuente usada
-- por los recordatorios de inactividad. user_activity_weeks es un registro
-- separado, mínimo e idempotente para medir retorno semanal desde el momento
-- en que se instala la instrumentación.

CREATE TABLE IF NOT EXISTS public.user_activity_weeks (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start DATE NOT NULL,
  first_authenticated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_user_activity_weeks_week_start
  ON public.user_activity_weeks(week_start);

ALTER TABLE public.user_activity_weeks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_activity_weeks FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.user_activity_weeks TO service_role;
GRANT INSERT ON TABLE public.user_activity_weeks TO service_role;

-- Recupera sólo las fechas canónicas de creación de las cuentas que el panel
-- ya tiene en pantalla. La última conexión continúa pasando por la Edge
-- Function existente y su RPC auditada.
CREATE OR REPLACE FUNCTION public.admin_get_auth_created_at_by_ids(target_user_ids UUID[])
RETURNS TABLE(user_id UUID, account_created_at TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, auth
AS $$
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  IF target_user_ids IS NULL OR COALESCE(array_length(target_user_ids, 1), 0) > 5000 THEN
    RAISE EXCEPTION 'invalid_user_id_batch';
  END IF;

  RETURN QUERY
  SELECT u.id, u.created_at
  FROM auth.users u
  WHERE u.id = ANY(target_user_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_auth_created_at_by_ids(UUID[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_auth_created_at_by_ids(UUID[]) TO authenticated;

-- La semana y la identidad se calculan en el servidor. El cliente no puede
-- elegir otro usuario, otra zona horaria ni una fecha histórica.
CREATE OR REPLACE FUNCTION public.record_my_weekly_activity()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_now TIMESTAMPTZ := NOW();
  v_local_date DATE := (v_now AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
  v_week_start DATE := v_local_date - (EXTRACT(ISODOW FROM v_local_date)::INTEGER - 1);
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated_weekly_activity';
  END IF;

  INSERT INTO public.user_activity_weeks(user_id, week_start, first_authenticated_at)
  VALUES (v_user_id, v_week_start, v_now)
  ON CONFLICT (user_id, week_start) DO NOTHING;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.record_my_weekly_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_my_weekly_activity() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_growth_cohort_summary(p_weeks INTEGER DEFAULT 12)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_weeks INTEGER := LEAST(GREATEST(COALESCE(p_weeks, 12), 4), 52);
  v_today_local DATE := (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
  v_current_week_start DATE := v_today_local - (EXTRACT(ISODOW FROM v_today_local)::INTEGER - 1);
  v_first_week DATE := v_current_week_start - ((v_weeks - 1) * 7);
  v_measurement_start DATE;
  v_total_accounts BIGINT;
  v_new_last_week BIGINT;
  v_active_last_week BIGINT;
  v_profiles_complete BIGINT;
  v_profiles_visible BIGINT;
  v_service_providers BIGINT;
  v_cohorts JSONB;
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  SELECT MIN(week_start) INTO v_measurement_start
  FROM public.user_activity_weeks;

  SELECT COUNT(*) INTO v_total_accounts FROM auth.users;

  SELECT COUNT(*) INTO v_new_last_week
  FROM auth.users u
  WHERE (u.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE
    - (EXTRACT(ISODOW FROM (u.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires'))::INTEGER - 1)
    = v_current_week_start - 7;

  SELECT COUNT(DISTINCT aw.user_id) INTO v_active_last_week
  FROM public.user_activity_weeks aw
  WHERE aw.week_start = v_current_week_start - 7;

  SELECT COUNT(*) INTO v_profiles_complete
  FROM public.profiles p
  WHERE trim(COALESCE(p.name, '')) <> ''
    AND trim(COALESCE(p.provincia, '')) <> ''
    AND trim(COALESCE(p.localidad, '')) <> ''
    AND EXISTS (SELECT 1 FROM public.contact_methods c WHERE c.profile_id = p.id)
    AND (
      p.account_type = 'empresa'
      OR (
        p.modalidad IS NOT NULL
        AND (
          p.intent = 'buscar'
          OR EXISTS (SELECT 1 FROM public.skills s WHERE s.profile_id = p.id)
          OR EXISTS (SELECT 1 FROM public.services s WHERE s.profile_id = p.id)
        )
      )
    );

  SELECT COUNT(*) INTO v_profiles_visible
  FROM public.profiles p
  WHERE p.status = 'activo';

  SELECT COUNT(*) INTO v_service_providers
  FROM public.profiles p
  WHERE p.status = 'activo'
    AND p.account_type <> 'empresa'
    AND p.intent IN ('ofrecer', 'ambas');

  WITH weeks AS (
    SELECT v_first_week + (series.week_index * 7) AS week_start
    FROM generate_series(0, v_weeks - 1) AS series(week_index)
  ), cohort_rows AS (
    SELECT
      c.week_start,
      c.week_start + 6 AS week_end,
      COUNT(u.id)::BIGINT AS cohort_size,
      COUNT(p.id)::BIGINT AS profiles_count,
      COUNT(p.id) FILTER (WHERE
        trim(COALESCE(p.name, '')) <> ''
        AND trim(COALESCE(p.provincia, '')) <> ''
        AND trim(COALESCE(p.localidad, '')) <> ''
        AND EXISTS (SELECT 1 FROM public.contact_methods cm WHERE cm.profile_id = p.id)
        AND (p.account_type = 'empresa' OR (p.modalidad IS NOT NULL AND (p.intent = 'buscar' OR EXISTS (SELECT 1 FROM public.skills s WHERE s.profile_id = p.id) OR EXISTS (SELECT 1 FROM public.services s WHERE s.profile_id = p.id))))
      )::BIGINT AS profiles_complete,
      COUNT(p.id) FILTER (WHERE p.status = 'activo')::BIGINT AS profiles_visible,
      COUNT(p.id) FILTER (WHERE p.whatsapp_verified = TRUE)::BIGINT AS whatsapp_verified,
      COUNT(p.id) FILTER (WHERE p.account_type <> 'empresa' AND p.intent IN ('ofrecer', 'ambas') AND p.status = 'activo')::BIGINT AS service_providers,
      COALESCE((
        SELECT COUNT(*)::BIGINT
        FROM auth.users prev
        WHERE (prev.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE
          - (EXTRACT(ISODOW FROM (prev.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires'))::INTEGER - 1)
          = c.week_start - 7
      ), 0) AS previous_size
    FROM weeks c
    LEFT JOIN auth.users u
      ON (u.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE
        - (EXTRACT(ISODOW FROM (u.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires'))::INTEGER - 1)
        = c.week_start
    LEFT JOIN public.profiles p ON p.id = u.id
    GROUP BY c.week_start
  )
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'week_start', cohort.week_start,
      'week_end', cohort.week_end,
      'cohort_size', cohort.cohort_size,
      'previous_size', cohort.previous_size,
      'absolute_change', cohort.cohort_size - cohort.previous_size,
      'percent_change', CASE WHEN cohort.previous_size > 0 THEN ROUND(((cohort.cohort_size - cohort.previous_size)::NUMERIC / cohort.previous_size) * 100, 1) ELSE NULL END,
      'profiles_count', cohort.profiles_count,
      'profiles_complete', cohort.profiles_complete,
      'profiles_visible', cohort.profiles_visible,
      'whatsapp_verified', cohort.whatsapp_verified,
      'service_providers', cohort.service_providers,
      'retention', (
        SELECT COALESCE(jsonb_agg(jsonb_build_object(
          'relative_week', rel.n,
          'state', CASE
            WHEN cohort.week_start + (rel.n * 7) > v_current_week_start THEN 'in_progress'
            WHEN v_measurement_start IS NULL OR cohort.week_start + (rel.n * 7) < v_measurement_start THEN 'no_data'
            ELSE 'measured'
          END,
          'active_users', CASE
            WHEN cohort.week_start + (rel.n * 7) <= v_current_week_start
              AND v_measurement_start IS NOT NULL
              AND cohort.week_start + (rel.n * 7) >= v_measurement_start
            THEN (
              SELECT COUNT(DISTINCT aw.user_id)::BIGINT
              FROM public.user_activity_weeks aw
              JOIN auth.users au ON au.id = aw.user_id
              WHERE aw.week_start = cohort.week_start + (rel.n * 7)
                AND (au.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE
                  - (EXTRACT(ISODOW FROM (au.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires'))::INTEGER - 1)
                  = cohort.week_start
            )
            ELSE NULL
          END,
          'retention_percent', CASE
            WHEN cohort.cohort_size > 0
              AND cohort.week_start + (rel.n * 7) <= v_current_week_start
              AND v_measurement_start IS NOT NULL
              AND cohort.week_start + (rel.n * 7) >= v_measurement_start
            THEN ROUND((
              (SELECT COUNT(DISTINCT aw.user_id)::NUMERIC
               FROM public.user_activity_weeks aw
               JOIN auth.users au ON au.id = aw.user_id
               WHERE aw.week_start = cohort.week_start + (rel.n * 7)
                 AND (au.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE
                   - (EXTRACT(ISODOW FROM (au.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires'))::INTEGER - 1)
                   = cohort.week_start
              ) / cohort.cohort_size) * 100, 1)
            ELSE NULL
          END
        ) ORDER BY rel.n), '[]'::JSONB)
        FROM generate_series(1, v_weeks) AS rel(n)
      )
    ) ORDER BY cohort.week_start DESC
  ), '[]'::JSONB) INTO v_cohorts
  FROM cohort_rows cohort;

  RETURN jsonb_build_object(
    'generated_at', NOW(),
    'timezone', 'America/Argentina/Buenos_Aires',
    'first_week', v_first_week,
    'current_week_start', v_current_week_start,
    'measurement_available_from', v_measurement_start,
    'metrics', jsonb_build_object(
      'total_accounts', v_total_accounts,
      'new_last_week', v_new_last_week,
      'active_last_week', v_active_last_week,
      'profiles_complete', v_profiles_complete,
      'profiles_visible', v_profiles_visible,
      'service_providers', v_service_providers
    ),
    'cohorts', v_cohorts
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_growth_cohort_summary(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_growth_cohort_summary(INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_growth_cohort_members(
  p_cohort_week DATE,
  p_relative_week INTEGER DEFAULT NULL,
  p_include_inactive BOOLEAN DEFAULT TRUE
)
RETURNS TABLE (
  user_id UUID,
  account_created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ,
  name TEXT,
  account_type TEXT,
  profile_status TEXT,
  profile_complete BOOLEAN,
  profile_visible BOOLEAN,
  whatsapp_verified BOOLEAN,
  offers_services BOOLEAN,
  active_in_selected_week BOOLEAN,
  acquisition_source TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_activity_week DATE;
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  IF p_relative_week IS NOT NULL AND p_relative_week < 1 THEN
    RAISE EXCEPTION 'invalid_relative_week';
  END IF;

  v_activity_week := CASE WHEN p_relative_week IS NULL THEN NULL ELSE p_cohort_week + (p_relative_week * 7) END;

  RETURN QUERY
  SELECT
    u.id,
    u.created_at,
    u.last_sign_in_at,
    p.name,
    COALESCE(p.account_type, 'sin_perfil')::TEXT,
    p.status::TEXT,
    CASE WHEN p.id IS NULL THEN FALSE ELSE (
      trim(COALESCE(p.name, '')) <> ''
      AND trim(COALESCE(p.provincia, '')) <> ''
      AND trim(COALESCE(p.localidad, '')) <> ''
      AND EXISTS (SELECT 1 FROM public.contact_methods c WHERE c.profile_id = p.id)
      AND (p.account_type = 'empresa' OR (p.modalidad IS NOT NULL AND (p.intent = 'buscar' OR EXISTS (SELECT 1 FROM public.skills s WHERE s.profile_id = p.id) OR EXISTS (SELECT 1 FROM public.services s WHERE s.profile_id = p.id))))
    ) END,
    COALESCE(p.status = 'activo', FALSE),
    COALESCE(p.whatsapp_verified, FALSE),
    COALESCE(p.account_type <> 'empresa' AND p.intent IN ('ofrecer', 'ambas') AND p.status = 'activo', FALSE),
    CASE WHEN v_activity_week IS NULL THEN FALSE ELSE EXISTS (
      SELECT 1 FROM public.user_activity_weeks aw WHERE aw.user_id = u.id AND aw.week_start = v_activity_week
    ) END,
    'No registrado'::TEXT
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE (u.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE
    - (EXTRACT(ISODOW FROM (u.created_at AT TIME ZONE 'America/Argentina/Buenos_Aires'))::INTEGER - 1)
    = p_cohort_week
    AND (p_include_inactive OR (v_activity_week IS NOT NULL AND EXISTS (SELECT 1 FROM public.user_activity_weeks aw WHERE aw.user_id = u.id AND aw.week_start = v_activity_week)))
  ORDER BY u.created_at ASC, u.id ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_growth_cohort_members(DATE, INTEGER, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_growth_cohort_members(DATE, INTEGER, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';
