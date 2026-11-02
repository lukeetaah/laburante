-- ============================================================================
-- LABURANTE: cierre del proceso de selección Empresa ↔ Persona
--
-- Mantiene separado el estado de la interacción (company_candidate_inquiries.status)
-- del estado del proceso de selección (process_status). Es aditiva, conserva los
-- registros existentes como procesos abiertos y registra sólo decisiones nuevas.
-- ============================================================================

ALTER TABLE public.company_candidate_inquiries
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejection_comment TEXT,
  ADD COLUMN IF NOT EXISTS process_status TEXT,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conrelid = 'public.company_candidate_inquiries'::regclass
       AND conname = 'company_candidate_inquiries_process_status_check'
  ) THEN
    ALTER TABLE public.company_candidate_inquiries
      ADD CONSTRAINT company_candidate_inquiries_process_status_check
      CHECK (process_status IN ('abierto', 'en_evaluacion', 'contratado', 'no_seleccionado', 'cancelado'));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.company_candidate_inquiry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- El historial sobrevive a la baja de una cuenta sin bloquearla. Los UUID
  -- participantes son snapshots de trazabilidad, no datos personales nuevos.
  inquiry_id UUID REFERENCES public.company_candidate_inquiries(id) ON DELETE SET NULL,
  company_id UUID NOT NULL,
  profile_id UUID NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('contratado', 'no_seleccionado', 'cancelado')),
  actor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (inquiry_id, event_type)
);

CREATE INDEX IF NOT EXISTS idx_company_candidate_inquiry_events_inquiry
  ON public.company_candidate_inquiry_events(inquiry_id, created_at);

CREATE INDEX IF NOT EXISTS idx_company_candidate_inquiry_events_participants
  ON public.company_candidate_inquiry_events(company_id, profile_id, created_at);

-- Defensa adicional: una selección sólo puede tener un resultado terminal,
-- incluso si una intervención administrativa intentara cambiar de resultado.
CREATE UNIQUE INDEX IF NOT EXISTS uq_company_candidate_inquiry_events_terminal
  ON public.company_candidate_inquiry_events(inquiry_id)
  WHERE inquiry_id IS NOT NULL;

ALTER TABLE public.company_candidate_inquiry_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_candidate_inquiry_events FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.company_candidate_inquiry_events TO authenticated;

DROP POLICY IF EXISTS "Participants read candidate inquiry events" ON public.company_candidate_inquiry_events;
CREATE POLICY "Participants read candidate inquiry events"
  ON public.company_candidate_inquiry_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
        FROM public.company_candidate_inquiries i
       WHERE i.id = company_candidate_inquiry_events.inquiry_id
         AND (auth.uid() = i.company_id OR auth.uid() = i.profile_id)
    )
    OR auth.uid() = company_candidate_inquiry_events.company_id
    OR auth.uid() = company_candidate_inquiry_events.profile_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

CREATE OR REPLACE FUNCTION public.enforce_candidate_inquiry_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := auth.uid();
  is_admin BOOLEAN := COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
BEGIN
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

DROP TRIGGER IF EXISTS enforce_candidate_inquiry_transition_trigger
  ON public.company_candidate_inquiries;
CREATE TRIGGER enforce_candidate_inquiry_transition_trigger
  BEFORE INSERT OR UPDATE ON public.company_candidate_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_candidate_inquiry_transition();

DO $$
BEGIN
  PERFORM set_config('app.company_candidate_resolution_migration', '1', true);
  UPDATE public.company_candidate_inquiries
     SET process_status = 'abierto'
   WHERE process_status IS NULL;
END $$;

ALTER TABLE public.company_candidate_inquiries
  ALTER COLUMN process_status SET DEFAULT 'abierto',
  ALTER COLUMN process_status SET NOT NULL;

-- Única entrada para decisiones finales desde el cliente. La fecha y el actor
-- se generan en el trigger dentro de la misma transacción que cambia el proceso.
CREATE OR REPLACE FUNCTION public.resolve_company_candidate_inquiry(
  target_inquiry_id UUID,
  target_process_status TEXT
)
RETURNS TABLE (
  id UUID,
  process_status TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := auth.uid();
  inquiry RECORD;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF target_process_status NOT IN ('contratado', 'no_seleccionado', 'cancelado') THEN
    RAISE EXCEPTION 'Evento de resolución no soportado';
  END IF;

  SELECT i.* INTO inquiry
    FROM public.company_candidate_inquiries i
   WHERE i.id = target_inquiry_id
     AND i.company_id = actor_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La empresa no puede resolver esta selección';
  END IF;
  IF inquiry.process_status NOT IN ('abierto', 'en_evaluacion') THEN
    RAISE EXCEPTION 'candidate_inquiry_process_already_resolved';
  END IF;
  IF target_process_status IN ('contratado', 'no_seleccionado')
     AND inquiry.status <> 'aceptada' THEN
    RAISE EXCEPTION 'candidate_inquiry_requires_accepted_interaction';
  END IF;

  PERFORM set_config('app.company_candidate_resolution', '1', true);

  RETURN QUERY
  UPDATE public.company_candidate_inquiries
     SET process_status = target_process_status,
         status = CASE WHEN target_process_status = 'cancelado' THEN 'cerrada' ELSE status END,
         archived_at = CASE WHEN target_process_status = 'cancelado' THEN clock_timestamp() ELSE archived_at END,
         updated_at = clock_timestamp()
   WHERE company_candidate_inquiries.id = target_inquiry_id
     AND company_candidate_inquiries.company_id = actor_id
     AND company_candidate_inquiries.process_status IN ('abierto', 'en_evaluacion')
  RETURNING company_candidate_inquiries.id,
            company_candidate_inquiries.process_status,
            company_candidate_inquiries.resolved_at,
            company_candidate_inquiries.resolved_by;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'La selección cambió mientras se resolvía';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_company_candidate_inquiry(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_company_candidate_inquiry(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.record_candidate_inquiry_resolution()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.process_status IS DISTINCT FROM OLD.process_status
     AND NEW.process_status IN ('contratado', 'no_seleccionado', 'cancelado') THEN
    INSERT INTO public.company_candidate_inquiry_events (inquiry_id, company_id, profile_id, event_type, actor_id, created_at)
    VALUES (NEW.id, NEW.company_id, NEW.profile_id, NEW.process_status, NEW.resolved_by, COALESCE(NEW.resolved_at, NOW()))
    ON CONFLICT (inquiry_id, event_type) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS record_candidate_inquiry_resolution
  ON public.company_candidate_inquiries;
CREATE TRIGGER record_candidate_inquiry_resolution
  AFTER UPDATE OF process_status ON public.company_candidate_inquiries
  FOR EACH ROW
  EXECUTE FUNCTION public.record_candidate_inquiry_resolution();

REVOKE ALL ON FUNCTION public.enforce_candidate_inquiry_transition() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.record_candidate_inquiry_resolution() FROM PUBLIC, anon, authenticated;

-- Notificación interna, deduplicada y neutral para la persona involucrada.
CREATE OR REPLACE FUNCTION public.notify_company_candidate_resolution(
  target_inquiry_id UUID,
  event_name TEXT,
  operation_marker TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := auth.uid();
  inquiry RECORD;
  notification_title TEXT;
  notification_message TEXT;
BEGIN
  IF actor_id IS NULL OR operation_marker IS NULL THEN
    RAISE EXCEPTION 'Authentication and resolution marker required';
  END IF;
  IF event_name NOT IN ('contratado', 'no_seleccionado', 'cancelado') THEN
    RAISE EXCEPTION 'Evento de resolución no soportado';
  END IF;

  SELECT i.* INTO inquiry
    FROM public.company_candidate_inquiries i
   WHERE i.id = target_inquiry_id;

  IF NOT FOUND OR inquiry.company_id <> actor_id THEN
    RAISE EXCEPTION 'La empresa no puede notificar esta resolución';
  END IF;
  IF inquiry.process_status <> event_name
     OR inquiry.resolved_by IS DISTINCT FROM actor_id
     OR inquiry.resolved_at IS DISTINCT FROM operation_marker THEN
    RAISE EXCEPTION 'El marcador no corresponde a la resolución';
  END IF;

  notification_title := CASE event_name
    WHEN 'contratado' THEN 'La empresa confirmó que continuará con vos'
    WHEN 'no_seleccionado' THEN 'La empresa cerró este proceso de selección'
    ELSE 'La empresa canceló este proceso de selección'
  END;
  notification_message := CASE event_name
    WHEN 'contratado' THEN 'La empresa confirmó que quiere incorporarte. Coordiná los próximos pasos por los canales habituales.'
    WHEN 'no_seleccionado' THEN 'La empresa cerró este proceso sin avanzar con una contratación. Tu perfil sigue disponible para otras oportunidades.'
    ELSE 'La empresa canceló este proceso. Esto no modifica tu perfil ni tus oportunidades con otras empresas.'
  END;

  RETURN public._insert_notification_server(
    inquiry.profile_id,
    actor_id,
    'status',
    notification_title,
    notification_message,
    format('/mis-trabajos?actividad=empresa&seleccion=%s', inquiry.id),
    format('inquiry:%s:resolution:%s:%s', inquiry.id, event_name, extract(epoch FROM inquiry.resolved_at)::TEXT)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.notify_company_candidate_resolution(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.notify_company_candidate_resolution(UUID, TEXT, TIMESTAMPTZ) TO authenticated;
