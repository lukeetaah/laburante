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

CREATE INDEX IF NOT EXISTS idx_user_activity_weeks_week_user
  ON public.user_activity_weeks(week_start, user_id);

ALTER TABLE public.user_activity_weeks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_activity_weeks FROM PUBLIC, anon, authenticated, service_role;

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
  FROM auth.users AS u
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
SET search_path = pg_catalog, auth
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
SET search_path = pg_catalog, auth
AS $$
DECLARE
  v_weeks INTEGER := LEAST(GREATEST(COALESCE(p_weeks, 12), 4), 52);
  v_today_local DATE := (NOW() AT TIME ZONE 'America/Argentina/Buenos_Aires')::DATE;
  v_current_week_start DATE := v_today_local - (EXTRACT(ISODOW FROM v_today_local)::INTEGER - 1);
  v_first_week DATE := v_current_week_start - ((v_weeks - 1) * 7);
  v_first_recorded_week DATE;
  v_measurement_available_from DATE;
  v_summary JSONB;
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  SELECT MIN(week_start)
  INTO v_first_recorded_week
  FROM public.user_activity_weeks;

  -- La primera semana observada siempre se trata como parcial. La medición
  -- comienza en la semana calendario completa siguiente, sin reconstruir nada.
  v_measurement_available_from := CASE
    WHEN v_first_recorded_week IS NULL THEN NULL
    ELSE v_first_recorded_week + 7
  END;

  -- Incluye una semana técnica anterior al primer período visible para que
  -- la variación de la primera fila no quede artificialmente en cero. El
  -- filtro de cohort_json mantiene intacto el rango que ve el panel.
  WITH weeks AS MATERIALIZED (
    SELECT
      (v_first_week - 7) + (series.week_index * 7) AS week_start,
      (v_first_week - 7) + (series.week_index * 7) + 6 AS week_end
    FROM generate_series(0, v_weeks) AS series(week_index)
  ),
  profile_state AS MATERIALIZED (
    SELECT
      p.id,
      (
        trim(COALESCE(p.name, '')) <> ''
        AND trim(COALESCE(p.provincia, '')) <> ''
        AND trim(COALESCE(p.localidad, '')) <> ''
        AND EXISTS (
          SELECT 1
          FROM public.contact_methods AS c
          WHERE c.profile_id = p.id
        )
        AND (
          p.account_type = 'empresa'
          OR (
            p.account_type <> 'empresa'
            AND p.modalidad IS NOT NULL
            AND (
              p.intent = 'buscar'
              OR EXISTS (
                SELECT 1
                FROM public.skills AS s
                WHERE s.profile_id = p.id
              )
              OR EXISTS (
                SELECT 1
                FROM public.services AS s
                WHERE s.profile_id = p.id
              )
            )
          )
        )
      ) AS profile_complete,
      -- El directorio real consulta public_profiles, restringe a personas
      -- activas y con intención de ofrecer, y no muestra estados ocultos.
      -- public_profiles también expone empresas ocultas para identidad de
      -- contactos; esa excepción no se cuenta como visibilidad pública aquí.
      (p.status = 'activo') AS profile_visible,
      (
        p.status = 'activo'
        AND p.account_type <> 'empresa'
        AND p.intent IN ('ofrecer', 'ambas')
      ) AS service_provider,
      COALESCE(p.whatsapp_verified, FALSE) AS whatsapp_verified
    FROM public.profiles AS p
  ),
  cohort_users AS MATERIALIZED (
    SELECT
      u.id AS user_id,
      w.week_start AS cohort_week
    FROM weeks AS w
    JOIN auth.users AS u
      ON u.created_at >= (w.week_start::TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')
     AND u.created_at < ((w.week_start + 7)::TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')
  ),
  cohort_rows AS (
    SELECT
      w.week_start,
      w.week_end,
      COUNT(cu.user_id)::BIGINT AS cohort_size,
      COUNT(ps.id)::BIGINT AS profiles_count,
      COUNT(ps.id) FILTER (WHERE ps.profile_complete)::BIGINT AS profiles_complete,
      COUNT(ps.id) FILTER (WHERE ps.profile_visible)::BIGINT AS profiles_visible,
      COUNT(ps.id) FILTER (WHERE ps.whatsapp_verified)::BIGINT AS whatsapp_verified,
      COUNT(ps.id) FILTER (WHERE ps.service_provider)::BIGINT AS service_providers
    FROM weeks AS w
    LEFT JOIN cohort_users AS cu ON cu.cohort_week = w.week_start
    LEFT JOIN profile_state AS ps ON ps.id = cu.user_id
    GROUP BY w.week_start, w.week_end
  ),
  cohort_rows_with_previous AS (
    SELECT
      current_cohort.*,
      COALESCE(previous_cohort.cohort_size, 0)::BIGINT AS previous_size
    FROM cohort_rows AS current_cohort
    LEFT JOIN cohort_rows AS previous_cohort
      ON previous_cohort.week_start = current_cohort.week_start - 7
  ),
  activity_by_cohort AS (
    SELECT
      cu.cohort_week,
      aw.week_start AS activity_week,
      COUNT(DISTINCT aw.user_id)::BIGINT AS active_users
    FROM public.user_activity_weeks AS aw
    JOIN cohort_users AS cu ON cu.user_id = aw.user_id
    WHERE v_measurement_available_from IS NOT NULL
      AND aw.week_start >= v_measurement_available_from
      AND aw.week_start < v_current_week_start
    GROUP BY cu.cohort_week, aw.week_start
  ),
  retention_cells AS (
    SELECT
      cr.week_start AS cohort_week,
      cr.cohort_size,
      rel.relative_week,
      cr.week_start + (rel.relative_week * 7) AS activity_week,
      CASE
        WHEN cr.week_start + (rel.relative_week * 7) >= v_current_week_start THEN 'in_progress'
        WHEN v_measurement_available_from IS NULL
          OR cr.week_start + (rel.relative_week * 7) < v_measurement_available_from THEN 'no_data'
        ELSE 'measured'
      END AS state
    FROM cohort_rows_with_previous AS cr
    CROSS JOIN LATERAL generate_series(1, v_weeks) AS rel(relative_week)
  ),
  retention_values AS (
    SELECT
      rc.cohort_week,
      rc.relative_week,
      rc.state,
      CASE
        WHEN rc.state = 'measured' THEN COALESCE(ab.active_users, 0)::BIGINT
        ELSE NULL
      END AS active_users,
      CASE
        WHEN rc.state = 'measured' AND rc.cohort_size > 0 THEN
          ROUND((COALESCE(ab.active_users, 0)::NUMERIC / rc.cohort_size) * 100, 1)
        ELSE NULL
      END AS retention_percent
    FROM retention_cells AS rc
    LEFT JOIN activity_by_cohort AS ab
      ON ab.cohort_week = rc.cohort_week
     AND ab.activity_week = rc.activity_week
  ),
  cohort_json AS (
    SELECT COALESCE(jsonb_agg(
      jsonb_build_object(
        'week_start', cr.week_start,
        'week_end', cr.week_end,
        'cohort_size', cr.cohort_size,
        'previous_size', cr.previous_size,
        'absolute_change', cr.cohort_size - cr.previous_size,
        'percent_change', CASE
          WHEN cr.previous_size > 0
          THEN ROUND(((cr.cohort_size - cr.previous_size)::NUMERIC / cr.previous_size) * 100, 1)
          ELSE NULL
        END,
        'profiles_count', cr.profiles_count,
        'profiles_complete', cr.profiles_complete,
        'profiles_visible', cr.profiles_visible,
        'whatsapp_verified', cr.whatsapp_verified,
        'service_providers', cr.service_providers,
        'retention', (
          SELECT COALESCE(jsonb_agg(
            jsonb_build_object(
              'relative_week', rv.relative_week,
              'state', rv.state,
              'active_users', rv.active_users,
              'retention_percent', rv.retention_percent
            ) ORDER BY rv.relative_week
          ), '[]'::JSONB)
          FROM retention_values AS rv
          WHERE rv.cohort_week = cr.week_start
        )
      ) ORDER BY cr.week_start DESC
    ), '[]'::JSONB) AS cohorts
    FROM cohort_rows_with_previous AS cr
    WHERE cr.week_start >= v_first_week
  ),
  metrics AS (
    SELECT
      (SELECT COUNT(*)::BIGINT FROM auth.users) AS total_accounts,
      (
        SELECT COUNT(*)::BIGINT
        FROM auth.users AS u
        WHERE u.created_at >= ((v_current_week_start - 7)::TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')
          AND u.created_at < (v_current_week_start::TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')
      ) AS new_last_week,
      CASE
        WHEN v_measurement_available_from IS NOT NULL
          AND v_current_week_start - 7 >= v_measurement_available_from
        THEN (
          SELECT COUNT(DISTINCT aw.user_id)::BIGINT
          FROM public.user_activity_weeks AS aw
          WHERE aw.week_start = v_current_week_start - 7
        )
        ELSE NULL
      END AS active_last_week,
      CASE
        WHEN v_measurement_available_from IS NOT NULL
          AND v_current_week_start - 7 >= v_measurement_available_from
        THEN 'measured'
        ELSE 'no_data'
      END AS active_last_week_state,
      (SELECT COUNT(*)::BIGINT FROM profile_state WHERE profile_complete) AS profiles_complete,
      (SELECT COUNT(*)::BIGINT FROM profile_state WHERE profile_visible) AS profiles_visible,
      (SELECT COUNT(*)::BIGINT FROM profile_state WHERE service_provider) AS service_providers
  )
  SELECT jsonb_build_object(
    'generated_at', NOW(),
    'timezone', 'America/Argentina/Buenos_Aires',
    'first_week', v_first_week,
    'current_week_start', v_current_week_start,
    'instrumentation_started_week', v_first_recorded_week,
    'measurement_available_from', v_measurement_available_from,
    'metrics', jsonb_build_object(
      'total_accounts', metrics.total_accounts,
      'new_last_week', metrics.new_last_week,
      'active_last_week', metrics.active_last_week,
      'active_last_week_state', metrics.active_last_week_state,
      'profiles_complete', metrics.profiles_complete,
      'profiles_visible', metrics.profiles_visible,
      'service_providers', metrics.service_providers
    ),
    'cohorts', cohort_json.cohorts
  )
  INTO v_summary
  FROM metrics
  CROSS JOIN cohort_json;

  RETURN v_summary;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_growth_cohort_summary(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_growth_cohort_summary(INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_get_growth_cohort_members(
  p_cohort_week DATE,
  p_relative_week INTEGER DEFAULT NULL,
  p_include_inactive BOOLEAN DEFAULT TRUE,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth
AS $$
DECLARE
  v_limit INTEGER;
  v_offset INTEGER;
  v_total_count BIGINT;
  v_members JSONB;
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'admin_only';
  END IF;

  IF p_cohort_week IS NULL THEN
    RAISE EXCEPTION 'invalid_cohort_week';
  END IF;

  IF p_relative_week IS NOT NULL AND (p_relative_week < 1 OR p_relative_week > 52) THEN
    RAISE EXCEPTION 'invalid_relative_week';
  END IF;

  v_limit := COALESCE(p_limit, 50);
  IF v_limit < 1 OR v_limit > 100 THEN
    RAISE EXCEPTION 'invalid_page_limit';
  END IF;

  v_offset := COALESCE(p_offset, 0);
  IF v_offset < 0 OR v_offset > 1000000 THEN
    RAISE EXCEPTION 'invalid_page_offset';
  END IF;

  -- Primero se filtran y ordenan únicamente las cuentas de Auth. Esto deja
  -- el conteo exacto y aplica LIMIT/OFFSET antes de calcular atributos y
  -- relaciones del perfil, evitando materializar todos los perfiles.
  WITH eligible_members AS MATERIALIZED (
    SELECT
      u.id AS user_id,
      u.created_at AS account_created_at
    FROM auth.users AS u
    WHERE u.created_at >= (p_cohort_week::TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')
      AND u.created_at < ((p_cohort_week + 7)::TIMESTAMP AT TIME ZONE 'America/Argentina/Buenos_Aires')
      AND (
        COALESCE(p_include_inactive, TRUE)
        OR (
          p_relative_week IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.user_activity_weeks AS aw
            WHERE aw.user_id = u.id
              AND aw.week_start = p_cohort_week + (p_relative_week * 7)
          )
        )
      )
  ),
  page_members AS (
    SELECT *
    FROM eligible_members
    ORDER BY account_created_at ASC, user_id ASC
    LIMIT v_limit
    OFFSET v_offset
  ),
  page_profiles AS MATERIALIZED (
    SELECT
      pm.user_id,
      pm.account_created_at,
      u.last_sign_in_at,
      p.name,
      COALESCE(p.account_type, 'persona')::TEXT AS account_type,
      p.status::TEXT AS profile_status,
      CASE WHEN p.id IS NULL THEN FALSE ELSE (
        trim(COALESCE(p.name, '')) <> ''
        AND trim(COALESCE(p.provincia, '')) <> ''
        AND trim(COALESCE(p.localidad, '')) <> ''
        AND EXISTS (
          SELECT 1
          FROM public.contact_methods AS c
          WHERE c.profile_id = p.id
        )
        AND (
          p.account_type = 'empresa'
          OR (
            p.account_type <> 'empresa'
            AND p.modalidad IS NOT NULL
            AND (
              p.intent = 'buscar'
              OR EXISTS (
                SELECT 1
                FROM public.skills AS s
                WHERE s.profile_id = p.id
              )
              OR EXISTS (
                SELECT 1
                FROM public.services AS s
                WHERE s.profile_id = p.id
              )
            )
          )
        )
      ) END AS profile_complete,
      (p.status = 'activo') AS profile_visible,
      COALESCE(p.whatsapp_verified, FALSE) AS whatsapp_verified,
      (
        p.status = 'activo'
        AND p.account_type <> 'empresa'
        AND p.intent IN ('ofrecer', 'ambas')
      ) AS offers_services,
      CASE
        WHEN p_relative_week IS NULL THEN FALSE
        ELSE EXISTS (
          SELECT 1
          FROM public.user_activity_weeks AS aw
          WHERE aw.user_id = pm.user_id
            AND aw.week_start = p_cohort_week + (p_relative_week * 7)
        )
      END AS active_in_selected_week,
      'No registrado'::TEXT AS acquisition_source
    FROM page_members AS pm
    JOIN auth.users AS u ON u.id = pm.user_id
    LEFT JOIN public.profiles AS p ON p.id = pm.user_id
  )
  SELECT
    (SELECT COUNT(*)::BIGINT FROM eligible_members),
    COALESCE((
      SELECT jsonb_agg(to_jsonb(page_profiles) ORDER BY page_profiles.account_created_at, page_profiles.user_id)
      FROM page_profiles
    ), '[]'::JSONB)
  INTO v_total_count, v_members;

  RETURN jsonb_build_object(
    'members', v_members,
    'total_count', v_total_count,
    'limit', v_limit,
    'offset', v_offset
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_growth_cohort_members(DATE, INTEGER, BOOLEAN, INTEGER, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_growth_cohort_members(DATE, INTEGER, BOOLEAN, INTEGER, INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';
