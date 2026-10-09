-- ============================================================================
-- LABURANTE - MIGRACIÓN DE HARDENING V5 (PRODUCCIÓN)
-- ============================================================================
-- Contenido:
-- 1. Protección estricta a nivel base de datos del WhatsApp verificado en contact_methods.
-- 2. Protección estricta a nivel base de datos de los campos whatsapp_verified en profiles.
-- 3. Corrección del destino de la notificación administrativa notify_admin_whatsapp_verification.
-- 4. Backfill idempotente de notificaciones históricas que apuntaban erróneamente a '/admin'.
--
-- REGLAS OBLIGATORIAS:
-- - NO DROP TABLE.
-- - NO DELETE de perfiles ni usuarios.
-- - Operaciones 100% idempotentes y compatibles con la base en producción.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. TRIGGER: Proteger WhatsApp verificado en contact_methods
-- ----------------------------------------------------------------------------
-- Impide que usuarios comunes o sincronizaciones de frontend eliminen o alteren
-- el método de contacto WhatsApp cuando el perfil ya se encuentra certificado
-- como verificado por administración o verificación telefónica.
-- Solo un administrador autenticado puede realizar dicha modificación.

CREATE OR REPLACE FUNCTION public.protect_verified_whatsapp_contact_method()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_is_admin BOOLEAN;
  v_is_verified BOOLEAN;
  v_target_profile_id UUID;
BEGIN
  -- Determinar si el actor autenticado tiene rol de administrador
  v_is_admin := (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
  IF v_is_admin THEN
    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  v_target_profile_id := COALESCE(OLD.profile_id, NEW.profile_id);

  -- Comprobar si el perfil dueño tiene certificación de WhatsApp activa
  SELECT COALESCE(whatsapp_verified, false)
    INTO v_is_verified
  FROM public.profiles
  WHERE id = v_target_profile_id;

  IF v_is_verified IS TRUE THEN
    IF TG_OP = 'DELETE' AND OLD.type = 'whatsapp' THEN
      RAISE EXCEPTION 'No podés eliminar un método de contacto WhatsApp verificado. Contactá a soporte para actualizarlo.';
    ELSIF TG_OP = 'UPDATE' AND OLD.type = 'whatsapp' THEN
      -- Prohibir cambiar el tipo de contacto o modificar el número telefónico ya certificado
      IF NEW.type <> 'whatsapp' OR NEW.value <> OLD.value THEN
        RAISE EXCEPTION 'No podés modificar el número de WhatsApp verificado. Contactá a soporte para actualizarlo.';
      END IF;
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_verified_whatsapp_contact_method ON public.contact_methods;
CREATE TRIGGER trg_protect_verified_whatsapp_contact_method
  BEFORE UPDATE OR DELETE ON public.contact_methods
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_verified_whatsapp_contact_method();

-- ----------------------------------------------------------------------------
-- 2. TRIGGER: Proteger campos de verificación en public.profiles
-- ----------------------------------------------------------------------------
-- Asegura que usuarios no administradores no puedan auto-adjudicarse el sello
-- verificado ni quitarlo inadvertidamente durante actualizaciones de perfil.

CREATE OR REPLACE FUNCTION public.protect_profile_verification_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  v_is_admin BOOLEAN;
BEGIN
  v_is_admin := (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

  IF NOT v_is_admin THEN
    -- Si el perfil ya estaba verificado, preservar el estado verificado intacto
    IF OLD.whatsapp_verified IS TRUE AND (NEW.whatsapp_verified IS NOT TRUE OR NEW.whatsapp_verified IS NULL) THEN
      NEW.whatsapp_verified := OLD.whatsapp_verified;
      NEW.whatsapp_verified_at := OLD.whatsapp_verified_at;
    END IF;

    -- Si el perfil no estaba verificado, impedir que un UPDATE directo desde el cliente lo marque como verificado
    IF (OLD.whatsapp_verified IS NOT TRUE OR OLD.whatsapp_verified IS NULL) AND NEW.whatsapp_verified IS TRUE THEN
      NEW.whatsapp_verified := false;
      NEW.whatsapp_verified_at := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_verification_fields ON public.profiles;
CREATE TRIGGER trg_protect_profile_verification_fields
  BEFORE UPDATE OF whatsapp_verified, whatsapp_verified_at ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_verification_fields();

-- ----------------------------------------------------------------------------
-- 3. FUNCIÓN: notify_admin_whatsapp_verification corregida
-- ----------------------------------------------------------------------------
-- El enlace de destino ahora redirige al perfil público/propio del destinatario
-- ('/p/<slug>' o '/crear-perfil' si aún no tuviera slug configurado), evitando
-- que usuarios sin permisos de administrador sean dirigidos a '/admin' y sufran 403.

CREATE OR REPLACE FUNCTION public.notify_admin_whatsapp_verification(
  target_request_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
DECLARE
  actor_id UUID := auth.uid();
  request_row RECORD;
  profile_slug TEXT;
  dest_link TEXT;
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador puede crear esta notificacion';
  END IF;

  SELECT r.*
    INTO request_row
    FROM public.whatsapp_verification_requests r
   WHERE r.id = target_request_id
     AND r.status = 'aprobado';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud de WhatsApp aprobada inexistente';
  END IF;

  -- Obtener el slug del perfil destinatario
  SELECT slug INTO profile_slug
  FROM public.profiles
  WHERE id = request_row.profile_id;

  IF profile_slug IS NOT NULL AND profile_slug <> '' THEN
    dest_link := '/p/' || profile_slug;
  ELSE
    dest_link := '/crear-perfil';
  END IF;

  RETURN public._insert_notification_server(
    request_row.profile_id,
    actor_id,
    'system',
    '¡WhatsApp Verificado por Administración!',
    format(
      'El administrador certificó tu número %s. Tu perfil ahora cuenta con el sello oficial verificado.',
      request_row.phone_declared
    ),
    dest_link,
    format('admin:whatsapp-verification:%s', request_row.id)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.notify_admin_whatsapp_verification(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_admin_whatsapp_verification(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.notify_admin_whatsapp_verification(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 4. BACKFILL IDEMPOTENTE: Corregir notificaciones históricas
-- ----------------------------------------------------------------------------
-- Notificaciones previas que apuntaban a '/admin' para usuarios comunes ahora
-- apuntan a su perfil correspondiente (/p/<slug>) o /crear-perfil.

UPDATE public.notifications n
SET link = CASE
  WHEN p.slug IS NOT NULL AND p.slug <> '' THEN '/p/' || p.slug
  ELSE '/crear-perfil'
END
FROM public.profiles p
WHERE n.user_id = p.id
  AND n.link = '/admin'
  AND (
    n.type = 'system'
    OR n.dedupe_key LIKE 'admin:whatsapp-verification:%'
    OR n.title ILIKE '%WhatsApp Verificado%'
  );

-- ============================================================================
-- FIN MIGRACIÓN V5
-- ============================================================================
