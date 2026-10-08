-- ============================================================================
-- MIGRATION: Producción - Hardening Integral v4
-- Plataforma: LABURANTE
-- Entorno: Producción (Zero-Downtime, Non-Blocking, Strict Multi-Tenancy)
-- ============================================================================

-- ============================================================================
-- PARTE 1: ÍNDICES CONCURRENTES (Ejecutar fuera de bloques de transacción)
-- ============================================================================

-- Índice de unicidad compuesto en company_projects para permitir FK de tenancy
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS company_projects_company_id_id_idx
  ON public.company_projects(company_id, id);

-- Índice parcial para expiración eficiente de reseñas pendientes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_recommendations_expiration
  ON public.recommendations(status, expires_at)
  WHERE status = 'pendiente';

-- Índice de soporte para filtrado de shortlist por empresa y proyecto
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_company_shortlists_company_project
  ON public.company_shortlists(company_id, project_id);


-- ============================================================================
-- PARTE 2: DDL SEGURO Y TENANCY COMPUESTO (company_shortlists <-> company_projects)
-- ============================================================================

-- 1. Asegurar restricción UNIQUE en company_projects usando el índice concurrente
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_projects_company_id_id_key'
  ) THEN
    ALTER TABLE public.company_projects
      ADD CONSTRAINT company_projects_company_id_id_key
      UNIQUE USING INDEX company_projects_company_id_id_idx;
  END IF;
END $$;

-- 2. Agregar columna project_id a company_shortlists si no existe
ALTER TABLE public.company_shortlists
  ADD COLUMN IF NOT EXISTS project_id UUID;

-- 3. Clave foránea compuesta estricta: garantiza que project_id pertenezca OBLIGATORIAMENTE
--    a la MISMA empresa (company_id). Si el proyecto se borra, project_id pasa a NULL.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_shortlists_company_project_fkey'
  ) THEN
    ALTER TABLE public.company_shortlists
      ADD CONSTRAINT company_shortlists_company_project_fkey
      FOREIGN KEY (company_id, project_id)
      REFERENCES public.company_projects(company_id, id)
      ON DELETE SET NULL
      NOT VALID;

    ALTER TABLE public.company_shortlists
      VALIDATE CONSTRAINT company_shortlists_company_project_fkey;
  END IF;
END $$;


-- ============================================================================
-- PARTE 3: RESEÑAS - CICLO DE VIDA, IDENTIDAD INMUTABLE Y TRANSICIONES DE ESTADO
-- ============================================================================

-- 1. Agregar columna expires_at a recommendations si no existe
ALTER TABLE public.recommendations
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Backfill seguro de expires_at para reseñas pendientes históricas
UPDATE public.recommendations
   SET expires_at = created_at + INTERVAL '30 days'
 WHERE expires_at IS NULL;

-- 2. Actualizar constraint de status con NOT VALID + VALIDATE (sin bloqueo prolongado)
ALTER TABLE public.recommendations DROP CONSTRAINT IF EXISTS recommendations_status_check;
ALTER TABLE public.recommendations
  ADD CONSTRAINT recommendations_status_check
  CHECK (status IN ('pendiente', 'visible', 'oculto', 'reportado', 'caducada'))
  NOT VALID;
ALTER TABLE public.recommendations
  VALIDATE CONSTRAINT recommendations_status_check;

-- 3. Trigger BEFORE INSERT: Derivación autoritativa estricta (Sin fallbacks inseguros)
CREATE OR REPLACE FUNCTION public.validate_recommendation_anti_fraud()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_is_admin BOOLEAN := COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
  v_email_confirmed_at TIMESTAMPTZ;
  v_user_created_at TIMESTAMPTZ;
  v_recent_same_profile_count INTEGER;
  v_recent_user_reviews_count INTEGER;
  v_duplicate_content_count INTEGER;
  v_author_name TEXT;
  v_target_status TEXT;
BEGIN
  -- 1. Exigir autenticación
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated_review';
  END IF;

  -- Admin bypass
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- 2. Forzar from_user_id al actor autenticado
  NEW.from_user_id := v_actor_id;

  -- Auto-reseña no permitida
  IF NEW.from_user_id = NEW.to_profile_id THEN
    RAISE EXCEPTION 'self_review_not_allowed';
  END IF;

  -- 3. Verificar perfil destinatario activo
  SELECT status INTO v_target_status FROM public.profiles WHERE id = NEW.to_profile_id;
  IF v_target_status IS NULL THEN
    RAISE EXCEPTION 'target_profile_not_found';
  ELSIF v_target_status <> 'activo' THEN
    RAISE EXCEPTION 'target_profile_inactive';
  END IF;

  -- 4. FUENTE AUTORITATIVA EXCLUSIVA: public.profiles
  -- Si el autor no tiene un perfil activo con nombre real, se ABORTA la operación.
  -- CERO fallbacks a raw_user_meta_data o nombres genéricos.
  SELECT name INTO v_author_name
  FROM public.profiles
  WHERE id = v_actor_id
    AND status = 'activo';

  IF v_author_name IS NULL OR trim(v_author_name) = '' THEN
    RAISE EXCEPTION 'author_profile_required';
  END IF;

  NEW.from_name := trim(v_author_name);

  -- 5. Advisory lock contra race conditions de inserción
  PERFORM pg_advisory_xact_lock(hashtext('review_' || v_actor_id::text));

  -- 6. Verificar email confirmado y antigüedad mínima de 5 minutos
  SELECT email_confirmed_at, created_at
    INTO v_email_confirmed_at, v_user_created_at
  FROM auth.users
  WHERE id = v_actor_id;

  IF v_email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'email_confirmation_required_for_reviews';
  END IF;

  IF v_user_created_at > (NOW() - INTERVAL '5 minutes') THEN
    RAISE EXCEPTION 'account_too_new_for_reviews';
  END IF;

  -- 7. Anti-duplicados por perfil
  SELECT COUNT(*)
    INTO v_recent_same_profile_count
  FROM public.recommendations r
  WHERE r.from_user_id = NEW.from_user_id
    AND r.to_profile_id = NEW.to_profile_id
    AND r.status IN ('pendiente', 'visible');

  IF v_recent_same_profile_count > 0 THEN
    RAISE EXCEPTION 'already_reviewed_profile';
  END IF;

  -- 8. Rate Limiting: Máximo 3 por hora
  SELECT COUNT(*)
    INTO v_recent_user_reviews_count
  FROM public.recommendations r
  WHERE r.from_user_id = NEW.from_user_id
    AND r.created_at > (NOW() - INTERVAL '1 hour');

  IF v_recent_user_reviews_count >= 3 THEN
    RAISE EXCEPTION 'review_rate_limit_hourly_exceeded';
  END IF;

  -- 9. Anti-spam por contenido idéntico
  SELECT COUNT(*)
    INTO v_duplicate_content_count
  FROM public.recommendations r
  WHERE r.from_user_id = NEW.from_user_id
    AND md5(trim(lower(r.text))) = md5(trim(lower(NEW.text)))
    AND r.created_at > (NOW() - INTERVAL '7 days');

  IF v_duplicate_content_count > 0 THEN
    RAISE EXCEPTION 'duplicate_review_content';
  END IF;

  -- Ciclo inicial estricto
  NEW.status := 'pendiente';
  NEW.created_at := NOW();
  NEW.expires_at := NOW() + INTERVAL '30 days';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_recommendation_anti_fraud_trigger ON public.recommendations;
CREATE TRIGGER validate_recommendation_anti_fraud_trigger
  BEFORE INSERT ON public.recommendations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_recommendation_anti_fraud();

-- 4. Trigger BEFORE UPDATE: Inmutabilidad de identidad y matriz de transiciones de status
CREATE OR REPLACE FUNCTION public.validate_recommendation_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_is_admin BOOLEAN := COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
  v_is_author BOOLEAN := (v_actor_id IS NOT NULL AND v_actor_id = OLD.from_user_id);
  v_is_recipient BOOLEAN := (v_actor_id IS NOT NULL AND v_actor_id = OLD.to_profile_id);
BEGIN
  -- Administrador tiene bypass de moderación completa
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- INMUTABILIDAD ESTRICTA: Ni autor ni receptor pueden modificar estos campos
  IF NEW.from_user_id IS DISTINCT FROM OLD.from_user_id THEN
    RAISE EXCEPTION 'from_user_id_immutable';
  END IF;

  IF NEW.to_profile_id IS DISTINCT FROM OLD.to_profile_id THEN
    RAISE EXCEPTION 'to_profile_id_immutable';
  END IF;

  IF NEW.from_name IS DISTINCT FROM OLD.from_name THEN
    RAISE EXCEPTION 'from_name_immutable';
  END IF;

  IF NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'created_at_immutable';
  END IF;

  IF NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    RAISE EXCEPTION 'expires_at_immutable';
  END IF;

  -- CASO 1: AUTOR (edición de texto/contexto)
  IF v_is_author AND NOT v_is_recipient THEN
    -- El autor NO puede cambiar el status
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      RAISE EXCEPTION 'author_cannot_change_status';
    END IF;
    RETURN NEW;
  END IF;

  -- CASO 2: RECEPTOR (moderación en su perfil)
  IF v_is_recipient THEN
    -- El receptor NO puede alterar el contenido redactado por el autor
    IF NEW.text IS DISTINCT FROM OLD.text OR NEW.context IS DISTINCT FROM OLD.context THEN
      RAISE EXCEPTION 'recipient_cannot_edit_content';
    END IF;

    -- MATRIZ DE TRANSICIÓN DE ESTADO EXPLÍCITA PARA EL RECEPTOR:
    -- pendiente -> visible  (Aprobar y publicar)
    -- visible   -> oculto   (Ocultar temporalmente)
    -- oculto    -> visible  (Republicar)
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF (OLD.status = 'pendiente' AND NEW.status = 'visible')
         OR (OLD.status = 'visible' AND NEW.status = 'oculto')
         OR (OLD.status = 'oculto' AND NEW.status = 'visible') THEN
        RETURN NEW;
      ELSE
        RAISE EXCEPTION 'invalid_status_transition_for_recipient';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- Terceros no autorizados
  RAISE EXCEPTION 'unauthorized_recommendation_update';
END;
$$;

DROP TRIGGER IF EXISTS validate_recommendation_update_trigger ON public.recommendations;
CREATE TRIGGER validate_recommendation_update_trigger
  BEFORE UPDATE ON public.recommendations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_recommendation_update();


-- ============================================================================
-- PARTE 4: EXPIRACIÓN AUTOMÁTICA DE RESEÑAS (Scheduler y Seguridad de RPC)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.expire_pending_recommendations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_updated INTEGER := 0;
BEGIN
  UPDATE public.recommendations
     SET status = 'caducada'
   WHERE status = 'pendiente'
     AND expires_at IS NOT NULL
     AND expires_at <= NOW();

  GET DIAGNOSTICS v_updated = ROW_COUNT;
  RETURN v_updated;
END;
$$;

-- SEGURIDAD ESTRICTA: Solo service_role puede invocar la función de mantenimiento desatendida.
-- Usuarios autenticados generales NO tienen acceso a dispararla arbitrariamente.
REVOKE ALL ON FUNCTION public.expire_pending_recommendations() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expire_pending_recommendations() TO service_role;

-- RPC administrativo para permitir ejecución manual bajo demanda desde Admin.tsx
CREATE OR REPLACE FUNCTION public.admin_expire_pending_recommendations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'admin_privilege_required';
  END IF;

  RETURN public.expire_pending_recommendations();
END;
$$;

REVOKE ALL ON FUNCTION public.admin_expire_pending_recommendations() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_expire_pending_recommendations() TO authenticated;


-- ============================================================================
-- PARTE 5: RECORDATORIOS DE PERFILES - WORKFLOW ATÓMICO CON REINTENTOS
-- ============================================================================

-- Tabla de tracking para garantizar atomicidad, cooldown y reintentos ante fallas externas
CREATE TABLE IF NOT EXISTS public.profile_completion_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('claimed', 'sent', 'failed')),
  missing_fields TEXT[] NOT NULL DEFAULT '{}',
  notification_id UUID REFERENCES public.notifications(id) ON DELETE SET NULL,
  last_error TEXT,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profile_completion_reminders_status
  ON public.profile_completion_reminders(status, sent_at);

ALTER TABLE public.profile_completion_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.profile_completion_reminders FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.profile_completion_reminders TO service_role;

-- Función de inserción de notificación interna (desacoplada de auth.uid() para crons y service_role)
CREATE OR REPLACE FUNCTION public._insert_system_notification_internal(
  p_target_user_id UUID,
  p_title TEXT,
  p_message TEXT,
  p_link TEXT,
  p_dedupe_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'invalid_target_user';
  END IF;

  INSERT INTO public.notifications (
    user_id,
    created_by,
    dedupe_key,
    title,
    message,
    type,
    link
  )
  VALUES (
    p_target_user_id,
    NULL,
    p_dedupe_key,
    p_title,
    p_message,
    'system',
    p_link
  )
  ON CONFLICT (dedupe_key) DO UPDATE
    SET updated_at = NOW()
  RETURNING id INTO v_notification_id;

  IF v_notification_id IS NULL THEN
    SELECT id INTO v_notification_id
    FROM public.notifications
    WHERE dedupe_key = p_dedupe_key;
  END IF;

  RETURN v_notification_id;
END;
$$;

REVOKE ALL ON FUNCTION public._insert_system_notification_internal(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public._insert_system_notification_internal(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;

-- Función de claim atómico y evaluación determinista de completitud mínima útil
CREATE OR REPLACE FUNCTION public.process_incomplete_profile_reminders_batch(p_limit INTEGER DEFAULT 25)
RETURNS TABLE (
  reminder_id UUID,
  profile_id UUID,
  missing_fields TEXT[],
  notification_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_rec RECORD;
  v_missing TEXT[];
  v_is_seeker BOOLEAN;
  v_notif_id UUID;
  v_rem_id UUID;
BEGIN
  FOR v_rec IN
    SELECT
      p.id,
      p.name,
      p.intent,
      p.provincia,
      p.localidad,
      EXISTS(SELECT 1 FROM public.contact_methods c WHERE c.profile_id = p.id AND trim(COALESCE(c.value, '')) <> '') AS has_contacts,
      EXISTS(SELECT 1 FROM public.skills s WHERE s.profile_id = p.id) AS has_skills,
      EXISTS(SELECT 1 FROM public.services s WHERE s.profile_id = p.id) AS has_services
    FROM public.profiles p
    WHERE p.status = 'activo'
      -- Período de gracia mínimo: 48 horas tras el registro
      AND p.created_at < (NOW() - INTERVAL '48 hours')
      -- Cooldown de 30 días si ya se envió con éxito
      AND NOT EXISTS (
        SELECT 1 FROM public.profile_completion_reminders r
        WHERE r.profile_id = p.id
          AND r.status = 'sent'
          AND r.sent_at > (NOW() - INTERVAL '30 days')
      )
      -- Protección contra lock colgado: si está en 'claimed', permitir re-claim sólo tras 15 minutos
      AND NOT EXISTS (
        SELECT 1 FROM public.profile_completion_reminders r
        WHERE r.profile_id = p.id
          AND r.status = 'claimed'
          AND r.claimed_at > (NOW() - INTERVAL '15 minutes')
      )
    ORDER BY p.created_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  LOOP
    v_missing := ARRAY[]::TEXT[];
    v_is_seeker := (v_rec.intent = 'buscar');

    -- REGLAS DETERMINÍSTICAS BLOQUEANTES (Sin porcentajes arbitrarios)
    IF trim(COALESCE(v_rec.name, '')) = '' THEN
      v_missing := array_append(v_missing, 'nombre');
    END IF;

    IF trim(COALESCE(v_rec.provincia, '')) = '' OR trim(COALESCE(v_rec.localidad, '')) = '' THEN
      v_missing := array_append(v_missing, 'ubicacion');
    END IF;

    -- Al menos un método de contacto es OBLIGATORIO para todos
    IF NOT v_rec.has_contacts THEN
      v_missing := array_append(v_missing, 'contacto');
    END IF;

    -- Si ofrece servicios o es profesional, exige al menos 1 skill u oficio
    IF NOT v_is_seeker THEN
      IF NOT v_rec.has_skills AND NOT v_rec.has_services THEN
        v_missing := array_append(v_missing, 'oficios_o_habilidades');
      END IF;
    END IF;

    -- Si falta al menos un requisito indispensable, se genera el recordatorio
    IF array_length(v_missing, 1) > 0 THEN
      -- Inserción in-app notification server-side segura
      v_notif_id := public._insert_system_notification_internal(
        v_rec.id,
        'Completá tu perfil para recibir propuestas',
        'Tu perfil no cuenta con datos de contacto u oficios necesarios para que otros usuarios y empresas puedan comunicarse.',
        '/crear-perfil',
        format('profile_completion_%s_%s', v_rec.id, to_char(NOW(), 'YYYY_MM'))
      );

      -- Registrar reclamo atómico
      INSERT INTO public.profile_completion_reminders (
        profile_id,
        status,
        missing_fields,
        notification_id,
        claimed_at,
        sent_at
      )
      VALUES (
        v_rec.id,
        'sent',
        v_missing,
        v_notif_id,
        NOW(),
        NOW()
      )
      RETURNING id INTO v_rem_id;

      -- Actualizar perfil
      UPDATE public.profiles
         SET profile_completion_reminder_sent_at = NOW()
       WHERE id = v_rec.id;

      reminder_id := v_rem_id;
      profile_id := v_rec.id;
      missing_fields := v_missing;
      notification_id := v_notif_id;
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.process_incomplete_profile_reminders_batch(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_incomplete_profile_reminders_batch(INTEGER) TO service_role;

-- Envoltura administrativa para Admin.tsx
CREATE OR REPLACE FUNCTION public.admin_process_incomplete_profile_reminders(p_limit INTEGER DEFAULT 25)
RETURNS TABLE (
  reminder_id UUID,
  profile_id UUID,
  missing_fields TEXT[],
  notification_id UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'admin_privilege_required';
  END IF;

  RETURN QUERY SELECT * FROM public.process_incomplete_profile_reminders_batch(p_limit);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_process_incomplete_profile_reminders(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_process_incomplete_profile_reminders(INTEGER) TO authenticated;


-- ============================================================================
-- PARTE 6: BACKFILL HISTÓRICO SEGURO (company_saved_profiles -> company_shortlists)
-- ============================================================================

-- Backfill tolerante a fallos: NUNCA descarta candidatos históricos.
-- Si el project_id no existe, fue eliminado o pertenece a otra empresa, se migra con project_id = NULL.
DO $$
BEGIN
  IF to_regclass('public.company_saved_profiles') IS NOT NULL THEN
    INSERT INTO public.company_shortlists (
      company_id,
      candidate_profile_id,
      project_id,
      status,
      created_at,
      updated_at
    )
    SELECT
      csp.company_id,
      csp.profile_id,
      CASE
        WHEN csp.project_id IS NOT NULL AND EXISTS (
          SELECT 1 FROM public.company_projects cp
          WHERE cp.id = csp.project_id
            AND cp.company_id = csp.company_id
        ) THEN csp.project_id
        ELSE NULL
      END AS project_id,
      'interesante' AS status,
      csp.created_at,
      csp.created_at AS updated_at
    FROM public.company_saved_profiles csp
    ON CONFLICT (company_id, candidate_profile_id)
    DO UPDATE SET
      project_id = COALESCE(
        company_shortlists.project_id,
        CASE
          WHEN EXCLUDED.project_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.company_projects cp
            WHERE cp.id = EXCLUDED.project_id
              AND cp.company_id = company_shortlists.company_id
          ) THEN EXCLUDED.project_id
          ELSE NULL
        END
      ),
      updated_at = NOW();
  END IF;
END $$;
