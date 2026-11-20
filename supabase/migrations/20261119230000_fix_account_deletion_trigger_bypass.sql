-- ============================================================================
-- LABURANTE: Corrección del flujo de eliminación administrativa de cuentas
--
-- CAUSA RAÍZ CONFIRMADA:
--
-- Al ejecutar admin_finalize_account_deletion vía service_role:
-- 1. Se ejecuta: DELETE FROM public.contact_methods WHERE profile_id = p_target_user_id;
-- 2. El trigger protect_verified_whatsapp_contact_method se dispara sobre cada método
--    de contacto. Dicho trigger solo comprobaba auth.jwt()->'app_metadata'->>'role' = 'admin'.
-- 3. Al invocarse desde la Edge Function mediante la clave service_role:
--      - auth.role() = 'service_role' (no 'admin' en app_metadata)
--      - El perfil objetivo posee whatsapp_verified = true
--    → El trigger arrojaba:
--      "No podés eliminar un método de contacto WhatsApp verificado. Contactá a soporte para actualizarlo."
--    → La transacción abortaba con estado 'failed_db' en fase 'database'.
--
-- SOLUCIONES:
-- 1. protect_verified_whatsapp_contact_method y protect_profile_verification_fields
--    ahora reconocen service_role y app.admin_account_deletion = '1'.
-- 2. admin_finalize_account_deletion activa PERFORM set_config('app.admin_account_deletion', '1', true)
--    al inicio de la transacción de purga.
-- 3. enforce_candidate_inquiry_transition incluye bypass para service_role y admin_account_deletion.
-- 4. admin_prepare_account_deletion delega el registro de eventos al trigger AFTER UPDATE.
-- ============================================================================

BEGIN;

-- ============================================================================
-- 1. Actualizar protect_verified_whatsapp_contact_method para permitir purga administrativa
-- ============================================================================
CREATE OR REPLACE FUNCTION public.protect_verified_whatsapp_contact_method()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_is_trusted_reset BOOLEAN;
  v_target_profile_id UUID;
  v_is_verified BOOLEAN;
BEGIN
  v_is_admin := (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    OR auth.role() = 'service_role'
    OR COALESCE(current_setting('app.admin_account_deletion', true), '') = '1'
  );
  IF v_is_admin THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  v_target_profile_id := COALESCE(OLD.profile_id, NEW.profile_id);
  v_is_trusted_reset := (current_setting('laburante.allow_whatsapp_reset', true) = 'true' AND auth.uid() = v_target_profile_id);

  IF v_is_trusted_reset THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  -- Comprobar si el perfil dueño tiene certificación de WhatsApp activa
  SELECT COALESCE(whatsapp_verified, false)
    INTO v_is_verified
  FROM public.profiles
  WHERE id = v_target_profile_id;

  IF v_is_verified IS TRUE THEN
    IF TG_OP = 'DELETE' AND OLD.type = 'whatsapp' THEN
      RAISE EXCEPTION 'No podés eliminar un método de contacto WhatsApp verificado. Contactá a soporte para actualizarlo.';
    ELSIF TG_OP = 'UPDATE' AND OLD.type = 'whatsapp' THEN
      IF NEW.type IS DISTINCT FROM 'whatsapp' OR NEW.value IS DISTINCT FROM OLD.value THEN
        RAISE EXCEPTION 'No podés modificar el número de WhatsApp verificado. Contactá a soporte para actualizarlo.';
      END IF;
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

-- ============================================================================
-- 2. Actualizar protect_profile_verification_fields para permitir purga administrativa
-- ============================================================================
CREATE OR REPLACE FUNCTION public.protect_profile_verification_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_is_trusted_reset BOOLEAN;
BEGIN
  v_is_admin := (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    OR auth.role() = 'service_role'
    OR COALESCE(current_setting('app.admin_account_deletion', true), '') = '1'
  );
  v_is_trusted_reset := (current_setting('laburante.allow_whatsapp_reset', true) = 'true' AND auth.uid() = OLD.id);

  IF NOT v_is_admin THEN
    IF NOT v_is_trusted_reset AND OLD.whatsapp_verified IS TRUE AND (NEW.whatsapp_verified IS NOT TRUE OR NEW.whatsapp_verified IS NULL) THEN
      NEW.whatsapp_verified := OLD.whatsapp_verified;
      NEW.whatsapp_verified_at := OLD.whatsapp_verified_at;
    END IF;

    IF (OLD.whatsapp_verified IS NOT TRUE OR OLD.whatsapp_verified IS NULL) AND NEW.whatsapp_verified IS TRUE THEN
      NEW.whatsapp_verified := false;
      NEW.whatsapp_verified_at := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================================================
-- 3. Actualizar admin_finalize_account_deletion activando flag de eliminación
-- ============================================================================
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

  -- Habilitar bypass de mantenimiento para triggers de protección de contactos y verificación
  PERFORM set_config('app.admin_account_deletion', '1', true);

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

-- ============================================================================
-- 4. Actualizar enforce_candidate_inquiry_transition con bypass administrativo
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
  IF is_admin AND TG_OP = 'UPDATE' THEN
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
-- 5. Actualizar admin_prepare_account_deletion
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
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin'
     AND auth.role() <> 'service_role' THEN
    RAISE EXCEPTION 'Solo un administrador autorizado puede preparar la eliminación de cuentas';
  END IF;

  IF p_target_user_id IS NULL OR p_admin_user_id IS NULL THEN
    RAISE EXCEPTION 'Los identificadores de usuario objetivo y administrador son obligatorios';
  END IF;

  IF p_target_user_id = p_admin_user_id THEN
    RAISE EXCEPTION 'No se puede eliminar la cuenta administradora activa';
  END IF;

  IF char_length(trim(COALESCE(p_reason, ''))) < 10 THEN
    RAISE EXCEPTION 'El motivo de eliminación debe contener al menos 10 caracteres';
  END IF;

  PERFORM set_config('app.admin_account_deletion', '1', true);
  PERFORM set_config('app.company_candidate_resolution', '1', true);

  SELECT COALESCE(account_type, 'persona'), name
    INTO v_role, v_name
    FROM public.profiles
   WHERE id = p_target_user_id
     FOR UPDATE;

  SELECT id, status INTO v_operation_id, v_existing_status
    FROM public.admin_account_deletion_operations
   WHERE target_user_id = p_target_user_id
     AND status NOT IN ('completed')
   LIMIT 1
     FOR UPDATE;

  IF v_operation_id IS NULL THEN
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

  -- 1. Snapshot de nombres profesionales en job_requests
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

  -- 4. Anonimizar reseñas emitidas
  UPDATE public.recommendations
     SET from_name = 'Usuario eliminado'
   WHERE from_user_id = p_target_user_id;

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

-- Permisos
REVOKE ALL ON FUNCTION public.admin_prepare_account_deletion(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_prepare_account_deletion(UUID, UUID, TEXT) TO service_role;

REVOKE ALL ON FUNCTION public.admin_finalize_account_deletion(UUID, UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_finalize_account_deletion(UUID, UUID) TO service_role;

REVOKE ALL ON FUNCTION public.enforce_candidate_inquiry_transition() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_verified_whatsapp_contact_method() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_verification_fields() FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
