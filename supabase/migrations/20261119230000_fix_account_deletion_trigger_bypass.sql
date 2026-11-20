-- ============================================================================
-- LABURANTE: Corrección del flujo de eliminación administrativa de cuentas
--
-- Problemas corregidos:
--
-- 1. enforce_candidate_inquiry_transition no tenía bypass para app.admin_account_deletion.
--    Al ejecutar admin_prepare_account_deletion via service_role:
--      - auth.uid() = NULL
--      - auth.jwt()->'app_metadata'->>'role' != 'admin'  (es el JWT del service_role)
--    → El trigger caía en la rama `actor_id IS NULL` → RAISE 'candidate_inquiry_actor_not_allowed'
--    → La Edge Function devolvía HTTP 502 con el error real, pero supabase-js
--      descartaba el body → el frontend mostraba "etapa desconocida".
--
-- 2. La RPC insertaba explícitamente en company_candidate_inquiry_events DESPUÉS
--    del UPDATE de company_candidate_inquiries. Pero el trigger AFTER UPDATE
--    (record_candidate_inquiry_resolution) ya insertaba ese evento al detectar el
--    cambio de process_status. El ON CONFLICT (inquiry_id, event_type) de la RPC
--    era incorrecto: el índice único real es uq_company_candidate_inquiry_events_terminal
--    sobre (inquiry_id), no sobre (inquiry_id, event_type). Esto producía una
--    violación de unique constraint si el trigger ya había insertado la fila.
--    Corrección: eliminar el INSERT explícito de la RPC — el trigger lo gestiona.
--
-- 3. Se actualiza enforce_candidate_inquiry_transition para aceptar el bypass
--    app.admin_account_deletion = '1', con la misma lógica que enforce_job_request_transition.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Actualizar enforce_candidate_inquiry_transition con bypass administrativo
-- ============================================================================
CREATE OR REPLACE FUNCTION public.enforce_candidate_inquiry_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := auth.uid();
  is_admin BOOLEAN := COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
                      OR auth.role() = 'service_role'
                      OR COALESCE(current_setting('app.admin_account_deletion', true), '') = '1';
BEGIN
  -- Bypass para eliminación administrativa (service_role sin auth.uid())
  IF is_admin AND TG_OP = 'UPDATE' THEN
    -- Solo permitir bypass en UPDATE: el INSERT de nuevas inquiries sigue requiriendo actor_id.
    -- Para el bypass de migración inicial de datos se mantiene el setting dedicado.
    IF COALESCE(current_setting('app.admin_account_deletion', true), '') = '1'
       OR auth.role() = 'service_role' THEN
      RETURN NEW;
    END IF;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF actor_id IS NULL OR NEW.company_id <> actor_id THEN
      RAISE EXCEPTION 'candidate_inquiry_actor_not_allowed';
    END IF;
    IF NEW.company_id = NEW.profile_id THEN
      RAISE EXCEPTION 'self_candidate_inquiry_not_allowed';
    END IF;
    NEW.status := 'pendiente';
    NEW.archived_at := NULL;
    NEW.process_status := 'abierto';
    NEW.resolved_at := NULL;
    NEW.resolved_by := NULL;
    NEW.rejection_reason := NULL;
    NEW.rejection_comment := NULL;
    RETURN NEW;
  END IF;

  -- Sólo la propia migración usa esta marca transaccional para completar
  -- process_status histórico antes de exigir NOT NULL. No es una vía del API.
  IF current_setting('app.company_candidate_resolution_migration', true) = '1' THEN
    RETURN NEW;
  END IF;

  IF is_admin THEN
    IF OLD.process_status IN ('contratado', 'no_seleccionado', 'cancelado')
       AND (
         NEW.process_status IS DISTINCT FROM OLD.process_status
         OR NEW.status IS DISTINCT FROM OLD.status
         OR NEW.resolved_at IS DISTINCT FROM OLD.resolved_at
         OR NEW.resolved_by IS DISTINCT FROM OLD.resolved_by
       ) THEN
      RAISE EXCEPTION 'candidate_inquiry_process_already_resolved';
    END IF;
    IF NEW.process_status IS DISTINCT FROM OLD.process_status
       AND NEW.process_status IN ('contratado', 'no_seleccionado', 'cancelado') THEN
      NEW.resolved_at := clock_timestamp();
      NEW.resolved_by := actor_id;
    END IF;
    RETURN NEW;
  END IF;

  IF actor_id IS NULL
     OR (actor_id <> OLD.company_id AND actor_id <> OLD.profile_id) THEN
    RAISE EXCEPTION 'candidate_inquiry_actor_not_allowed';
  END IF;

  IF NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
    RAISE EXCEPTION 'candidate_inquiry_participants_immutable';
  END IF;

  IF actor_id = OLD.company_id THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'cerrada' THEN
      RAISE EXCEPTION 'only_profile_owner_can_decide_candidate_inquiry';
    END IF;
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status = 'cerrada'
       AND NEW.process_status IS DISTINCT FROM 'cancelado' THEN
      RAISE EXCEPTION 'candidate_inquiry_close_requires_process_resolution';
    END IF;

    IF NEW.process_status IS DISTINCT FROM OLD.process_status THEN
      IF OLD.process_status IN ('contratado', 'no_seleccionado', 'cancelado') THEN
        RAISE EXCEPTION 'candidate_inquiry_process_already_resolved';
      END IF;
      IF NEW.process_status NOT IN ('abierto', 'en_evaluacion', 'contratado', 'no_seleccionado', 'cancelado') THEN
        RAISE EXCEPTION 'invalid_candidate_inquiry_process_status';
      END IF;
      IF OLD.process_status = 'en_evaluacion'
         AND NEW.process_status NOT IN ('contratado', 'no_seleccionado', 'cancelado') THEN
        RAISE EXCEPTION 'candidate_inquiry_process_transition_not_allowed';
      END IF;
      IF NEW.process_status IN ('contratado', 'no_seleccionado') AND OLD.status <> 'aceptada' THEN
        RAISE EXCEPTION 'candidate_inquiry_requires_accepted_interaction';
      END IF;
      IF NEW.process_status IN ('contratado', 'no_seleccionado', 'cancelado') THEN
        IF COALESCE(current_setting('app.company_candidate_resolution', true), '') <> '1' THEN
          RAISE EXCEPTION 'candidate_inquiry_resolution_rpc_required';
        END IF;
        NEW.resolved_at := clock_timestamp();
        NEW.resolved_by := actor_id;
      ELSIF NEW.resolved_at IS DISTINCT FROM OLD.resolved_at
         OR NEW.resolved_by IS DISTINCT FROM OLD.resolved_by THEN
        RAISE EXCEPTION 'candidate_inquiry_resolution_fields_immutable';
      END IF;
    ELSIF NEW.resolved_at IS DISTINCT FROM OLD.resolved_at
       OR NEW.resolved_by IS DISTINCT FROM OLD.resolved_by THEN
      RAISE EXCEPTION 'candidate_inquiry_resolution_fields_immutable';
    END IF;

    IF OLD.status = 'pendiente' AND NEW.status = 'pendiente' THEN
      IF NEW.process_type IS NOT DISTINCT FROM OLD.process_type
         AND COALESCE(NULLIF(TRIM(NEW.message), ''), '') IS NOT DISTINCT FROM COALESCE(NULLIF(TRIM(OLD.message), ''), '')
         AND NEW.archived_at IS NOT DISTINCT FROM OLD.archived_at THEN
        RAISE EXCEPTION 'candidate_inquiry_content_unchanged';
      END IF;
    END IF;
  END IF;

  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at
     AND NOT (
       actor_id = OLD.company_id
       AND NEW.process_status IS NOT DISTINCT FROM OLD.process_status
       AND NEW.status IS NOT DISTINCT FROM OLD.status
       AND NEW.archived_at IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'candidate_inquiry_archive_not_allowed';
  END IF;

  IF actor_id = OLD.profile_id THEN
    IF NEW.status IS DISTINCT FROM OLD.status
       AND NEW.status NOT IN ('aceptada', 'rechazada', 'cerrada') THEN
      RAISE EXCEPTION 'invalid_candidate_inquiry_transition';
    END IF;
    IF NEW.process_status IS DISTINCT FROM OLD.process_status
       OR NEW.resolved_at IS DISTINCT FROM OLD.resolved_at
       OR NEW.resolved_by IS DISTINCT FROM OLD.resolved_by THEN
      RAISE EXCEPTION 'candidate_inquiry_process_fields_company_only';
    END IF;
    IF NEW.status <> 'rechazada' THEN
      NEW.rejection_reason := NULL;
      NEW.rejection_comment := NULL;
    END IF;
    IF NEW.process_type IS DISTINCT FROM OLD.process_type
       OR NEW.message IS DISTINCT FROM OLD.message THEN
      RAISE EXCEPTION 'candidate_inquiry_content_immutable_by_candidate';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 2. Corregir admin_prepare_account_deletion:
--    - Eliminar INSERT explícito en company_candidate_inquiry_events (ya lo hace
--      el trigger record_candidate_inquiry_resolution al detectar el UPDATE).
--    - Usar GET DIAGNOSTICS sobre el UPDATE de inquiries directamente.
-- ============================================================================
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

  -- 3. Cancelar procesos activos de selección empresa-candidato.
  --    El trigger record_candidate_inquiry_resolution (AFTER UPDATE OF process_status)
  --    inserta automáticamente el evento en company_candidate_inquiry_events al detectar
  --    el cambio a 'cancelado'. No se realiza INSERT explícito aquí para evitar conflicto
  --    con el índice único uq_company_candidate_inquiry_events_terminal (inquiry_id).
  UPDATE public.company_candidate_inquiries
     SET process_status = 'cancelado',
         status = 'cerrada',
         rejection_comment = 'Cuenta eliminada por administración',
         resolved_at = clock_timestamp(),
         resolved_by = p_admin_user_id,
         updated_at = clock_timestamp()
   WHERE (company_id = p_target_user_id OR profile_id = p_target_user_id)
     AND process_status IN ('abierto', 'en_evaluacion');

  GET DIAGNOSTICS v_active_inquiries_cancelled = ROW_COUNT;

  -- 4. Anonimizar reseñas emitidas por el usuario (si la tabla y columna existen)
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

-- Mantener permisos: solo service_role puede ejecutar estas RPCs
REVOKE ALL ON FUNCTION public.admin_prepare_account_deletion(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_prepare_account_deletion(UUID, UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.enforce_candidate_inquiry_transition() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
