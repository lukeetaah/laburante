-- ============================================================================
-- LABURANTE: Flujo Empresa ↔ Persona
-- 1. Soporte para devolución estructurada al rechazar propuesta (rejection_reason, rejection_comment).
-- 2. Protección contra actualizaciones duplicadas e idempotencia en refresco de propuestas.
-- 3. Identidad pública auditada de empresas en public_profiles (status IN ('activo', 'oculto')).
-- 4. Exposición segura de datos de empresa para consultas de candidatos.
--
-- SEGURO Y NO DESTRUCTIVO PARA PRODUCCIÓN
-- ============================================================================

-- 1. Columnas de devolución de rechazo en company_candidate_inquiries
ALTER TABLE public.company_candidate_inquiries
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT,
  ADD COLUMN IF NOT EXISTS rejection_comment TEXT;

-- 2. Actualización de trigger de transición para consultas de selección
CREATE OR REPLACE FUNCTION public.enforce_candidate_inquiry_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, auth
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
    NEW.rejection_reason := NULL;
    NEW.rejection_comment := NULL;
    RETURN NEW;
  END IF;

  IF is_admin THEN
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

  -- Actualización por la empresa (actor_id = OLD.company_id)
  IF actor_id = OLD.company_id THEN
    IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status <> 'cerrada' THEN
      RAISE EXCEPTION 'only_profile_owner_can_decide_candidate_inquiry';
    END IF;

    -- Protección contra actualizaciones vacías / idempotencia de refresco
    IF OLD.status = 'pendiente' AND NEW.status = 'pendiente' THEN
      IF NEW.process_type IS NOT DISTINCT FROM OLD.process_type
         AND COALESCE(NULLIF(TRIM(NEW.message), ''), '') IS NOT DISTINCT FROM COALESCE(NULLIF(TRIM(OLD.message), ''), '')
         AND NEW.archived_at IS NOT DISTINCT FROM OLD.archived_at THEN
        RAISE EXCEPTION 'candidate_inquiry_content_unchanged';
      END IF;
    END IF;
  END IF;

  -- Actualización por la persona (actor_id = OLD.profile_id)
  IF actor_id = OLD.profile_id THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NEW.status NOT IN ('aceptada', 'rechazada', 'cerrada') THEN
        RAISE EXCEPTION 'invalid_candidate_inquiry_transition';
      END IF;
      -- Si no es rechazada, no debe modificar motivos de rechazo
      IF NEW.status <> 'rechazada' THEN
        NEW.rejection_reason := NULL;
        NEW.rejection_comment := NULL;
      END IF;
    END IF;

    -- La persona no puede modificar process_type ni message
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

REVOKE ALL ON FUNCTION public.enforce_candidate_inquiry_transition() FROM PUBLIC, anon, authenticated;

-- 3. Actualización de notify_company_candidate_inquiry para deduplicación idempotente y detalle de rechazo
CREATE OR REPLACE FUNCTION public.notify_company_candidate_inquiry(
  target_inquiry_id UUID,
  event_name TEXT,
  operation_marker TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  actor_id UUID := auth.uid();
  inquiry RECORD;
  recipient_id UUID;
  notification_title TEXT;
  notification_message TEXT;
  notification_link TEXT;
  dedupe_key TEXT;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF operation_marker IS NULL THEN
    RAISE EXCEPTION 'Falta el marcador de la operacion';
  END IF;

  SELECT i.*, p.name AS company_name
    INTO inquiry
    FROM public.company_candidate_inquiries AS i
    LEFT JOIN public.profiles AS p ON p.id = i.company_id
   WHERE i.id = target_inquiry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consulta de empresa inexistente';
  END IF;

  IF event_name IN ('created', 'refreshed') THEN
    IF actor_id <> inquiry.company_id OR inquiry.status <> 'pendiente' THEN
      RAISE EXCEPTION 'La empresa no puede generar este evento';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = actor_id AND account_type = 'empresa'
    ) THEN
      RAISE EXCEPTION 'El actor no es una empresa';
    END IF;

    IF (event_name = 'created' AND inquiry.created_at <> operation_marker)
       OR (event_name = 'refreshed' AND inquiry.updated_at <> operation_marker) THEN
      RAISE EXCEPTION 'El marcador no corresponde a la consulta';
    END IF;

    recipient_id := inquiry.profile_id;
    notification_title := CASE
      WHEN event_name = 'created' AND inquiry.process_type = 'entrevista' THEN 'Una empresa quiere entrevistarte'
      WHEN event_name = 'created' THEN 'Una empresa quiere contratarte'
      ELSE 'Una Empresa actualizó su propuesta'
    END;
    notification_message := CASE
      WHEN event_name = 'created' THEN format(
        '%s %s para conocerte mejor.%s',
        coalesce(inquiry.company_name, 'Una empresa'),
        CASE WHEN inquiry.process_type = 'entrevista'
          THEN 'quiere coordinar una entrevista'
          ELSE 'quiere conversar sobre una contratación directa' END,
        CASE WHEN nullif(trim(coalesce(inquiry.message, '')), '') IS NULL
          THEN '' ELSE format(' Mensaje: %s', left(trim(inquiry.message), 1000)) END
      )
      ELSE format(
        '%s refrescó su propuesta de %s para que puedas revisarla nuevamente.%s',
        coalesce(inquiry.company_name, 'Una empresa'),
        CASE WHEN inquiry.process_type = 'entrevista' THEN 'entrevista' ELSE 'contratación' END,
        CASE WHEN nullif(trim(coalesce(inquiry.message, '')), '') IS NULL
          THEN '' ELSE format(' Mensaje: %s', left(trim(inquiry.message), 1000)) END
      )
    END;
    notification_link := format('/mis-trabajos?actividad=empresa&seleccion=%s', inquiry.id);
    
    -- Deduplicación basada en contenido para evitar emails duplicados
    dedupe_key := CASE
      WHEN event_name = 'created' THEN format(
        'inquiry:%s:created:%s',
        inquiry.id,
        extract(epoch FROM inquiry.created_at)::TEXT
      )
      ELSE format(
        'inquiry:%s:refreshed:%s:%s',
        inquiry.id,
        inquiry.process_type,
        md5(coalesce(nullif(trim(inquiry.message), ''), ''))
      )
    END;

  ELSIF event_name = 'responded' THEN
    IF actor_id <> inquiry.profile_id
       OR inquiry.status NOT IN ('aceptada', 'rechazada') THEN
      RAISE EXCEPTION 'Respuesta de consulta invalida';
    END IF;

    IF inquiry.updated_at <> operation_marker THEN
      RAISE EXCEPTION 'El marcador no corresponde a la respuesta';
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM public.profiles
       WHERE id = inquiry.company_id
         AND account_type = 'empresa'
    ) THEN
      RAISE EXCEPTION 'El destinatario no es una empresa';
    END IF;

    recipient_id := inquiry.company_id;
    notification_title := CASE inquiry.status
      WHEN 'aceptada' THEN 'Aceptaron tu propuesta'
      ELSE 'No avanzarán con tu propuesta'
    END;
    notification_message := CASE inquiry.status
      WHEN 'aceptada' THEN 'La persona aceptó conversar. Podés coordinar la entrevista y completar tu proceso interno de proveedor.'
      ELSE format(
        'La persona respondió que no avanzará con esta propuesta por ahora.%s',
        CASE WHEN inquiry.rejection_reason IS NOT NULL
          THEN format(' Motivo: %s%s',
            inquiry.rejection_reason,
            CASE WHEN nullif(trim(coalesce(inquiry.rejection_comment, '')), '') IS NOT NULL
              THEN format(' — Comentario: %s', left(trim(inquiry.rejection_comment), 300))
              ELSE '' END
          )
          ELSE '' END
      )
    END;
    notification_link := format('/empresa?seleccion=%s', inquiry.id);
    dedupe_key := format(
      'inquiry:%s:responded:%s:%s',
      inquiry.id,
      inquiry.status,
      extract(epoch FROM inquiry.updated_at)::TEXT
    );
  ELSE
    RAISE EXCEPTION 'Evento de consulta no soportado';
  END IF;

  RETURN public._insert_notification_server(
    recipient_id, actor_id, 'job', notification_title,
    notification_message, notification_link, dedupe_key
  );
END;
$$;

REVOKE ALL ON FUNCTION public.notify_company_candidate_inquiry(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_company_candidate_inquiry(UUID, TEXT, TIMESTAMPTZ) TO authenticated;

-- 4. Extender public_profiles para incluir perfiles públicos de empresas
-- Permite que los candidatos consulten la identidad pública de la empresa que los contactó
-- sin exponer emails privados, metadatos internos ni columnas sensibles.
CREATE OR REPLACE VIEW public.public_profiles AS
SELECT
  p.id,
  p.name,
  p.slug,
  p.photo_url,
  p.bio,
  p.provincia,
  p.localidad,
  p.zona_trabajo,
  p.disponibilidad,
  p.modalidad,
  p.account_type,
  p.hybrid_presencial_pct,
  p.hybrid_remoto_pct,
  p.intent,
  (p.resume_url IS NOT NULL AND NULLIF(trim(p.resume_url), '') IS NOT NULL) AS has_resume,
  p.whatsapp_verified,
  p.status
FROM public.profiles AS p
WHERE (p.account_type <> 'empresa' AND p.status = 'activo')
   OR (p.account_type = 'empresa' AND p.status IN ('activo', 'oculto'));

REVOKE ALL ON public.public_profiles FROM PUBLIC;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 5. Extender contactos públicos para enlaces institucionales de empresas ('web', 'portfolio')
CREATE OR REPLACE VIEW public.public_profile_contacts AS
SELECT c.profile_id, c.type, c.value, c.is_public
FROM public.contact_methods AS c
JOIN public.profiles AS p ON p.id = c.profile_id
WHERE ((p.account_type <> 'empresa' AND p.status = 'activo')
    OR (p.account_type = 'empresa' AND p.status IN ('activo', 'oculto')))
  AND c.is_public = true
  AND c.type IN ('web', 'portfolio');

REVOKE ALL ON public.public_profile_contacts FROM PUBLIC;
GRANT SELECT ON public.public_profile_contacts TO anon, authenticated;

-- 6. Vista autenticada de perfiles de empresa para consultas de selección
CREATE OR REPLACE VIEW public.authenticated_company_profiles AS
SELECT p.id, p.name, p.slug, p.photo_url, p.localidad, p.provincia, p.bio, p.whatsapp_verified
FROM public.profiles AS p
WHERE p.account_type = 'empresa'
  AND p.status IN ('activo', 'oculto');

REVOKE ALL ON public.authenticated_company_profiles FROM PUBLIC, anon;
GRANT SELECT ON public.authenticated_company_profiles TO authenticated;
