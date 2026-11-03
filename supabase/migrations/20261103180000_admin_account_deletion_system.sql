-- ============================================================================
-- LABURANTE: Sistema de Eliminación Administrativa Segura de Cuentas
--
-- 1. Tablas de auditoría y operaciones con estados persistentes e idempotencia
-- 2. Adaptación de claves foráneas de job_requests para evitar CASCADE destructivo
-- 3. Bypass seguro de triggers de transición para mantenimiento administrativo
-- 4. RPCs atómicas y modulares para preparación, purga pública y auditoría
-- ============================================================================

-- 1. TABLAS DE OPERACIONES Y AUDITORÍA
CREATE TABLE IF NOT EXISTS public.admin_account_deletion_operations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  target_user_id UUID NOT NULL,
  admin_user_id UUID NOT NULL,
  account_type TEXT NOT NULL,
  reason TEXT NOT NULL CHECK (char_length(trim(reason)) >= 10),
  status TEXT NOT NULL CHECK (status IN (
    'in_progress',
    'storage_cleared',
    'db_cleared',
    'completed',
    'failed_storage',
    'failed_db',
    'failed_auth'
  )),
  completed_stages TEXT[] NOT NULL DEFAULT '{}',
  error_details TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  completed_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_account_deletion_target
  ON public.admin_account_deletion_operations (target_user_id)
  WHERE status NOT IN ('completed');

CREATE INDEX IF NOT EXISTS idx_account_deletion_operations_admin
  ON public.admin_account_deletion_operations (admin_user_id, started_at DESC);

CREATE TABLE IF NOT EXISTS public.admin_account_deletion_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  operation_id UUID NOT NULL REFERENCES public.admin_account_deletion_operations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE INDEX IF NOT EXISTS idx_account_deletion_events_op
  ON public.admin_account_deletion_events (operation_id, created_at ASC);

ALTER TABLE public.admin_account_deletion_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_account_deletion_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_account_deletion_operations, public.admin_account_deletion_events FROM PUBLIC, anon;
GRANT SELECT ON TABLE public.admin_account_deletion_operations, public.admin_account_deletion_events TO authenticated;

DROP POLICY IF EXISTS "Admins can view account deletion operations" ON public.admin_account_deletion_operations;
CREATE POLICY "Admins can view account deletion operations"
  ON public.admin_account_deletion_operations FOR SELECT TO authenticated
  USING (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

DROP POLICY IF EXISTS "Admins can view account deletion events" ON public.admin_account_deletion_events;
CREATE POLICY "Admins can view account deletion events"
  ON public.admin_account_deletion_events FOR SELECT TO authenticated
  USING (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

-- 2. INTEGRIDAD REFERENCIAL DE JOB REQUESTS
-- Snapshot de nombre profesional para conservar trazabilidad histórica
ALTER TABLE public.job_requests
  ADD COLUMN IF NOT EXISTS professional_name TEXT;

-- Permitir desvinculación segura sin perder registros terminales
ALTER TABLE public.job_requests
  ALTER COLUMN profile_id DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.job_requests'::regclass
      AND conname = 'job_requests_profile_id_fkey'
  ) THEN
    ALTER TABLE public.job_requests DROP CONSTRAINT job_requests_profile_id_fkey;
  END IF;

  ALTER TABLE public.job_requests
    ADD CONSTRAINT job_requests_profile_id_fkey
    FOREIGN KEY (profile_id)
    REFERENCES public.profiles(id)
    ON DELETE SET NULL;
END $$;

-- 3. PERMITIR BYPASS DE TRANSICIÓN PARA OPERACIONES DE MANTENIMIENTO ADMINISTRATIVO
CREATE OR REPLACE FUNCTION public.enforce_job_request_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  actor_id UUID := auth.uid();
  is_admin BOOLEAN := COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
                      OR auth.role() = 'service_role'
                      OR current_setting('app.admin_account_deletion', true) = '1';
BEGIN
  IF is_admin THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF actor_id IS NULL OR NEW.client_id <> actor_id THEN
      RAISE EXCEPTION 'job_request_actor_not_allowed';
    END IF;
    IF NEW.client_id = NEW.profile_id THEN
      RAISE EXCEPTION 'self_job_request_not_allowed';
    END IF;
    NEW.status := 'solicitado';
    NEW.budget_amount := NULL;
    NEW.budget_details := NULL;
    NEW.budget_estimated_time := NULL;
    NEW.budget_created_at := NULL;
    RETURN NEW;
  END IF;

  IF actor_id IS NULL
     OR (actor_id <> OLD.client_id AND actor_id <> OLD.profile_id) THEN
    RAISE EXCEPTION 'job_request_actor_not_allowed';
  END IF;

  IF NEW.client_id IS DISTINCT FROM OLD.client_id
     OR NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
    RAISE EXCEPTION 'job_request_participants_immutable';
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelado'
     AND OLD.status NOT IN ('completado', 'cancelado') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'solicitado'
     AND actor_id = OLD.profile_id
     AND NEW.status = 'presupuestado' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'presupuestado'
     AND actor_id = OLD.client_id
     AND NEW.status = 'aceptado' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'aceptado'
     AND (actor_id = OLD.client_id OR actor_id = OLD.profile_id)
     AND NEW.status = 'en_progreso' THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('aceptado', 'en_progreso')
     AND (actor_id = OLD.client_id OR actor_id = OLD.profile_id)
     AND NEW.status = 'completado' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'invalid_job_request_transition';
END;
$$;

-- 4. LIMPIEZA DE SOBRECARGAS PREVIAS AMBIGUAS
DROP FUNCTION IF EXISTS public.admin_delete_account(UUID);
DROP FUNCTION IF EXISTS public.admin_delete_account(UUID, TEXT);

-- 5. RPC FASE 1: PREPARACIÓN Y ANONIMIZACIÓN (IDEMPOTENTE)
CREATE OR REPLACE FUNCTION public.admin_prepare_account_deletion(
  p_target_user_id UUID,
  p_admin_user_id UUID,
  p_reason TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_role TEXT := 'persona';
  v_name TEXT := 'Usuario';
  v_operation_id UUID;
  v_existing_status TEXT;
  v_active_jobs_cancelled INTEGER := 0;
  v_active_inquiries_cancelled INTEGER := 0;
BEGIN
  -- Validar privilegios del llamador
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin'
     AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Solo un administrador autorizado puede preparar la eliminación de cuentas';
  END IF;

  -- Validar parámetros
  IF p_target_user_id IS NULL OR p_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Los identificadores de usuario objetivo y administrador son obligatorios';
  END IF;

  IF p_target_user_id = p_admin_user_id THEN
    RAISE EXCEPTION 'No se puede eliminar la cuenta administradora activa';
  END IF;

  IF char_length(trim(COALESCE(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'El motivo de eliminación debe contener al menos 10 caracteres';
  END IF;

  -- Habilitar bypass de mantenimiento para triggers de transición
  PERFORM set_config('app.admin_account_deletion', '1', true);
  PERFORM set_config('app.company_candidate_resolution', '1', true);

  -- Adquirir bloqueo y metadata si el perfil aún existe
  SELECT COALESCE(account_type, 'persona'), name
    INTO v_role, v_name
    FROM public.profiles
   WHERE id = p_target_user_id
     FOR UPDATE;

  -- Gestión de idempotencia sobre la operación activa
  SELECT id, status INTO v_operation_id, v_existing_status
    FROM public.admin_account_deletion_operations
   WHERE target_user_id = p_target_user_id
     AND status NOT IN ('completed')
   LIMIT 1
     FOR UPDATE;

  IF v_operation_id IS NULL THEN
    -- Verificar si ya fue completada previamente
    IF EXISTS (
      SELECT 1 FROM public.admin_account_deletion_operations
      WHERE target_user_id = p_target_user_id AND status = 'completed'
    ) THEN
      RAISE EXCEPTION 'La cuenta objetivo ya fue eliminada y auditada previamente';
    END IF;

    INSERT INTO public.admin_account_deletion_operations (
      target_user_id,
      admin_user_id,
      account_type,
      reason,
      status,
      completed_stages,
      started_at,
      updated_at
    ) VALUES (
      p_target_user_id,
      p_admin_user_id,
      v_role,
      trim(p_reason),
      'in_progress',
      ARRAY['initialized'],
      clock_timestamp(),
      clock_timestamp()
    ) RETURNING id INTO v_operation_id;

    INSERT INTO public.admin_account_deletion_events (
      operation_id,
      event_type,
      details
    ) VALUES (
      v_operation_id,
      'operation_started',
      jsonb_build_object(
        'target_user_id', p_target_user_id,
        'account_type', v_role,
        'name_snapshot', v_name,
        'reason', trim(p_reason)
      )
    );
  END IF;

  -- 1. Snapshot de nombres profesionales en job_requests para cuando el perfil se elimine
  UPDATE public.job_requests j
     SET professional_name = COALESCE(j.professional_name, p.name)
    FROM public.profiles p
   WHERE j.profile_id = p.id
     AND j.profile_id = p_target_user_id;

  -- 2. Cancelar solicitudes activas de trabajo
  WITH cancelled_jobs AS (
    UPDATE public.job_requests
       SET status = 'cancelado',
           cancel_reason = 'Cuenta eliminada por administración',
           cancelled_by = CASE WHEN client_id = p_target_user_id THEN 'cliente' ELSE 'profesional' END,
           updated_at = clock_timestamp()
     WHERE (client_id = p_target_user_id OR profile_id = p_target_user_id)
       AND status IN ('solicitado', 'presupuestado', 'aceptado', 'en_progreso')
     RETURNING id
  )
  SELECT COUNT(*) INTO v_active_jobs_cancelled FROM cancelled_jobs;

  -- 3. Cancelar procesos activos de selección empresa-candidato
  WITH cancelled_inquiries AS (
    UPDATE public.company_candidate_inquiries
       SET process_status = 'cancelado',
           status = 'cerrada',
           rejection_comment = 'Cuenta eliminada por administración',
           resolved_at = clock_timestamp(),
           resolved_by = p_admin_user_id,
           updated_at = clock_timestamp()
     WHERE (company_id = p_target_user_id OR profile_id = p_target_user_id)
       AND process_status IN ('abierto', 'en_evaluacion')
     RETURNING id, company_id, profile_id
  )
  INSERT INTO public.company_candidate_inquiry_events (
    inquiry_id,
    company_id,
    profile_id,
    event_type,
    actor_id,
    created_at
  )
  SELECT
    ci.id,
    ci.company_id,
    ci.profile_id,
    'cancelado',
    p_admin_user_id,
    clock_timestamp()
  FROM cancelled_inquiries ci
  ON CONFLICT (inquiry_id, event_type) DO NOTHING;

  GET DIAGNOSTICS v_active_inquiries_cancelled = ROW_COUNT;

  -- 4. Anonimizar reseñas emitidas por el usuario
  UPDATE public.recommendations
     SET from_name = 'Usuario eliminado'
   WHERE from_user_id = p_target_user_id;

  -- Registrar evento de preparación
  INSERT INTO public.admin_account_deletion_events (
    operation_id,
    event_type,
    details
  ) VALUES (
    v_operation_id,
    'preparation_completed',
    jsonb_build_object(
      'active_jobs_cancelled', v_active_jobs_cancelled,
      'active_inquiries_cancelled', v_active_inquiries_cancelled
    )
  );

  RETURN jsonb_build_object(
    'operation_id', v_operation_id,
    'account_type', v_role,
    'status', 'in_progress',
    'active_jobs_cancelled', v_active_jobs_cancelled,
    'active_inquiries_cancelled', v_active_inquiries_cancelled
  );
END;
$$;

-- 6. RPC FASE 3: PURGA DE ESQUEMA PÚBLICO
CREATE OR REPLACE FUNCTION public.admin_finalize_account_deletion(
  p_target_user_id UUID,
  p_operation_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin'
     AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Solo un administrador autorizado puede finalizar la eliminación';
  END IF;

  -- Eliminar dependencias accesorias sin tocar tablas de trazabilidad
  DELETE FROM public.whatsapp_verification_requests WHERE profile_id = p_target_user_id;
  DELETE FROM public.company_opportunity_shares WHERE source_company_id = p_target_user_id OR recipient_company_id = p_target_user_id;
  DELETE FROM public.company_opportunities WHERE source_company_id = p_target_user_id;
  DELETE FROM public.company_saved_profiles WHERE company_id = p_target_user_id;
  DELETE FROM public.company_projects WHERE company_id = p_target_user_id;
  DELETE FROM public.company_shortlists WHERE company_id = p_target_user_id;
  DELETE FROM public.profile_categories WHERE profile_id = p_target_user_id;
  DELETE FROM public.skills WHERE profile_id = p_target_user_id;
  DELETE FROM public.services WHERE profile_id = p_target_user_id;
  DELETE FROM public.contact_methods WHERE profile_id = p_target_user_id;
  DELETE FROM public.profile_languages WHERE profile_id = p_target_user_id;

  -- Eliminar perfil público (las foreign keys ON DELETE SET NULL conservan solicitudes y trazabilidad)
  DELETE FROM public.profiles WHERE id = p_target_user_id;

  -- Actualizar estado de la operación
  UPDATE public.admin_account_deletion_operations
     SET status = 'db_cleared',
         completed_stages = array_append(completed_stages, 'db_cleared'),
         updated_at = clock_timestamp()
   WHERE id = p_operation_id;

  INSERT INTO public.admin_account_deletion_events (
    operation_id,
    event_type,
    details
  ) VALUES (
    p_operation_id,
    'db_cleared',
    jsonb_build_object('target_user_id', p_target_user_id)
  );

  RETURN true;
END;
$$;

-- 7. RPC FASE 4: AUDITORÍA Y CIERRE
CREATE OR REPLACE FUNCTION public.admin_complete_deletion_audit(
  p_operation_id UUID,
  p_status TEXT,
  p_error_details TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin'
     AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Solo un administrador autorizado puede actualizar la auditoría';
  END IF;

  UPDATE public.admin_account_deletion_operations
     SET status = p_status,
         error_details = p_error_details,
         completed_stages = CASE
           WHEN p_status = 'completed' AND NOT ('completed' = ANY(completed_stages))
             THEN array_append(completed_stages, 'completed')
           WHEN p_status = 'storage_cleared' AND NOT ('storage_cleared' = ANY(completed_stages))
             THEN array_append(completed_stages, 'storage_cleared')
           ELSE completed_stages
         END,
         completed_at = CASE WHEN p_status = 'completed' THEN clock_timestamp() ELSE completed_at END,
         updated_at = clock_timestamp()
   WHERE id = p_operation_id;

  INSERT INTO public.admin_account_deletion_events (
    operation_id,
    event_type,
    details
  ) VALUES (
    p_operation_id,
    p_status,
    jsonb_build_object('error_details', p_error_details)
  );
END;
$$;

-- 8. REVOCACIÓN Y ASIGNACIÓN ESTRICTA DE PERMISOS
REVOKE ALL ON FUNCTION public.admin_prepare_account_deletion(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_finalize_account_deletion(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_complete_deletion_audit(UUID, TEXT, TEXT) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.admin_prepare_account_deletion(UUID, UUID, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_finalize_account_deletion(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_complete_deletion_audit(UUID, TEXT, TEXT) TO service_role;
