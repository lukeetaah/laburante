-- LABURANTE: Migración de soporte para referencias amigables de WhatsApp, control de expiración y anti-deadlock
-- Archivo local para revisión y prevalidación. NO ejecutar en producción directamente.
--
-- Idempotente, no destructivo, 100% retrocompatible con solicitudes históricas:
-- 1. Añade columna expires_at a whatsapp_verification_requests si no existe.
-- 2. Índice único parcial normalizado (upper(code)) para el estándar estricto 'LB-[2-9A-HJ-NP-Z]{8}'.
-- 3. Trigger BEFORE INSERT fidedigno con reloj del servidor (clock_timestamp) que impide manipulación de vigencia.
-- 4. Adaptación mínima y segura de triggers de protección de perfiles y métodos de contacto (laburante.allow_whatsapp_reset).
-- 5. RPC administrativa admin_approve_whatsapp_verification con orden de bloqueos anti-deadlock:
--    (1) profiles -> (2) whatsapp_verification_requests -> (3) contact_methods.
--    - Mantiene firma exacta (UUID, TEXT) y RETURNS TABLE (approved_profile_id UUID, approved_phone TEXT, normalized_phone TEXT).
--    - Exige rol 'admin' exclusivamente vía auth.jwt() -> 'app_metadata' ->> 'role'.
--    - Validación defensiva de teléfono contra NULL, vacíos y excepciones de normalización.
--    - Compatibilidad dual: histórico ('LAB-XXXXXX') y moderno ('LB-XXXXXXXX').
--    - Bloqueo contra solicitudes LB- sin expires_at (no confiables).
--    - Integridad estricta ante cambios de número: rechaza si el número actual del perfil no coincide.
-- 6. RPC atómica user_update_verified_whatsapp para que el usuario autenticado cambie su número con orden anti-deadlock:
--    (1) profiles -> (2) whatsapp_verification_requests -> (3) contact_methods.
-- 7. RPC user_expire_pending_whatsapp_request para resolver la expiración bajo RLS restrictiva.

BEGIN;

-- 1. Añadir columna expires_at de forma aditiva (nullable, sin backfill para preservar históricas)
ALTER TABLE public.whatsapp_verification_requests
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Índice para optimizar consultas de solicitudes pendientes vigentes
CREATE INDEX IF NOT EXISTS idx_wa_verif_expires
  ON public.whatsapp_verification_requests (expires_at)
  WHERE status = 'pendiente';

-- Recreación limpia del índice único parcial para referencias modernas (LB-XXXXXXXX):
CREATE UNIQUE INDEX IF NOT EXISTS idx_wa_verif_unique_lb_code
  ON public.whatsapp_verification_requests (upper(code))
  WHERE code ~* '^LB-[2-9A-HJ-NP-Z]{8}$';

-- 2. Trigger BEFORE INSERT para asignar automáticamente 48 horas de vigencia fidedigna:
CREATE OR REPLACE FUNCTION public.trg_whatsapp_verification_set_expiration()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Forzar marcas temporales del servidor para impedir created_at manipulados
  NEW.created_at := clock_timestamp();
  NEW.expires_at := NEW.created_at + INTERVAL '48 hours';
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_whatsapp_verification_expiration
  ON public.whatsapp_verification_requests;

CREATE TRIGGER trg_set_whatsapp_verification_expiration
  BEFORE INSERT ON public.whatsapp_verification_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_whatsapp_verification_set_expiration();

-- 3. Adaptación de triggers de integridad para admitir reseteo transaccional autorizado por el propio usuario
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
  v_is_admin := (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
  -- Permite la invalidación de la verificación únicamente si se invoca dentro de la RPC autorizada para su propio perfil
  v_is_trusted_reset := (current_setting('laburante.allow_whatsapp_reset', true) = 'true' AND auth.uid() = OLD.id);

  IF NOT v_is_admin THEN
    -- Si el perfil ya estaba verificado y NO se trata de un reseteo legítimo del propio usuario vía RPC:
    IF NOT v_is_trusted_reset AND OLD.whatsapp_verified IS TRUE AND (NEW.whatsapp_verified IS NOT TRUE OR NEW.whatsapp_verified IS NULL) THEN
      NEW.whatsapp_verified := OLD.whatsapp_verified;
      NEW.whatsapp_verified_at := OLD.whatsapp_verified_at;
    END IF;

    -- Si el perfil no estaba verificado, impedir bajo cualquier circunstancia que un usuario no admin lo marque como verificado
    IF (OLD.whatsapp_verified IS NOT TRUE OR OLD.whatsapp_verified IS NULL) AND NEW.whatsapp_verified IS TRUE THEN
      NEW.whatsapp_verified := false;
      NEW.whatsapp_verified_at := NULL;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

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
  v_is_admin := (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
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

-- 4. Normalización telefónica inteligente para números argentinos e internacionales
CREATE OR REPLACE FUNCTION public.normalize_whatsapp_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
STRICT
SET search_path = pg_catalog
AS $$
DECLARE
  v_digits TEXT;
BEGIN
  v_digits := regexp_replace(trim(p_phone), '[^0-9]', '', 'g');

  -- Si comienza con código de país Argentina (549 o 54):
  IF v_digits ~ '^549[0-9]{10}$' THEN
    v_digits := substring(v_digits from 4);
  ELSIF v_digits ~ '^54[0-9]{10}$' THEN
    v_digits := substring(v_digits from 3);
  END IF;

  -- Si comienza con 0 (prefijo interurbano nacional, ej: 011, 0351, 0341):
  IF v_digits ~ '^0[0-9]{10,}$' THEN
    v_digits := substring(v_digits from 2);
  END IF;

  -- Si tiene prefijo móvil 15 luego del código de área:
  -- Área de 2 dígitos (AMBA 11): 11 15 xxxxxxxx
  IF v_digits ~ '^1115[0-9]{8}$' THEN
    v_digits := '11' || substring(v_digits from 5);
  -- Áreas de 3 dígitos (ej: 351, 341, 261, 221, etc.):
  ELSIF v_digits ~ '^[0-9]{3}15[0-9]{7}$' THEN
    v_digits := substring(v_digits from 1 for 3) || substring(v_digits from 6);
  -- Áreas de 4 dígitos (ej: 2944, 2202, etc.):
  ELSIF v_digits ~ '^[0-9]{4}15[0-9]{6}$' THEN
    v_digits := substring(v_digits from 1 for 4) || substring(v_digits from 7);
  END IF;

  RETURN v_digits;
END;
$$;

REVOKE ALL ON FUNCTION public.normalize_whatsapp_phone(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_whatsapp_phone(TEXT) TO authenticated;

-- 5. Función RPC administrativa actualizada (ORDEN DE BLOQUEOS ANTI-DEADLOCK: profiles -> requests -> contacts):
CREATE OR REPLACE FUNCTION public.admin_approve_whatsapp_verification(
  p_request_id UUID,
  p_code TEXT
)
RETURNS TABLE (
  approved_profile_id UUID,
  approved_phone TEXT,
  normalized_phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth
AS $$
DECLARE
  v_target_profile_id UUID;
  v_profile_id UUID;
  v_request RECORD;
  v_contact_id UUID;
  v_contact_count INTEGER := 0;
  v_contact RECORD;
  v_current_contact_phone TEXT;
  v_phone TEXT;
  v_normalized_phone TEXT;
  v_normalized_current_phone TEXT;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  -- Autorización administrativa estricta
  IF auth.uid() IS NULL
     OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'whatsapp_admin_only';
  END IF;

  -- 1. Lectura previa sin bloqueo para identificar el perfil destino
  SELECT r.profile_id
    INTO v_target_profile_id
  FROM public.whatsapp_verification_requests AS r
  WHERE r.id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'whatsapp_request_not_found';
  END IF;

  -- 2. BLOQUEO NIVEL 1: Perfil (FOR UPDATE)
  SELECT p.id
    INTO v_profile_id
  FROM public.profiles AS p
  WHERE p.id = v_target_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'whatsapp_profile_not_found';
  END IF;

  -- 3. BLOQUEO NIVEL 2: Solicitud (FOR UPDATE)
  SELECT r.id, r.profile_id, r.phone_declared, r.code, r.status, r.expires_at, r.created_at
    INTO v_request
  FROM public.whatsapp_verification_requests AS r
  WHERE r.id = p_request_id
  FOR UPDATE;

  -- Comprobar invariante post-bloqueo: la solicitud no fue reasignada concurrentemente
  IF v_request.profile_id <> v_profile_id THEN
    RAISE EXCEPTION 'whatsapp_request_profile_mismatch';
  END IF;

  IF v_request.status <> 'pendiente' THEN
    RAISE EXCEPTION 'whatsapp_request_already_resolved';
  END IF;

  -- Comprobación de vigencia segura:
  -- (a) Solicitudes con expires_at definido:
  IF v_request.expires_at IS NOT NULL AND v_request.expires_at < v_now THEN
    RAISE EXCEPTION 'whatsapp_request_expired';
  END IF;

  -- (b) Solicitudes modernas LB- que carecen de expires_at (no confiables):
  IF v_request.expires_at IS NULL AND v_request.code ~* '^LB-[2-9A-HJ-NP-Z]{8}$' THEN
    RAISE EXCEPTION 'whatsapp_request_untrusted_legacy_lb';
  END IF;

  -- (c) Las solicitudes históricas 'LAB-XXXXXX' con expires_at IS NULL permanecen válidas.

  -- Validación de formato de código:
  IF v_request.code IS NULL
     OR (v_request.code !~* '^LAB-[0-9]{6}$' AND v_request.code !~* '^LB-[2-9A-HJ-NP-Z]{8}$')
     OR upper(trim(COALESCE(p_code, ''))) <> upper(trim(v_request.code)) THEN
    RAISE EXCEPTION 'whatsapp_code_invalid';
  END IF;

  -- Validación y normalización defensiva de teléfono
  v_phone := trim(COALESCE(v_request.phone_declared, ''));
  IF v_phone = '' THEN
    RAISE EXCEPTION 'whatsapp_phone_invalid';
  END IF;

  BEGIN
    v_normalized_phone := public.normalize_whatsapp_phone(v_phone);
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'whatsapp_phone_invalid';
  END;

  IF v_normalized_phone IS NULL
     OR trim(v_normalized_phone) = ''
     OR v_normalized_phone !~ '^[0-9]{8,15}$' THEN
    RAISE EXCEPTION 'whatsapp_phone_invalid';
  END IF;

  -- 4. BLOQUEO NIVEL 3: Métodos de contacto WhatsApp del perfil (FOR UPDATE)
  FOR v_contact IN
    SELECT c.id, c.value
    FROM public.contact_methods AS c
    WHERE c.profile_id = v_profile_id
      AND c.type = 'whatsapp'
    ORDER BY c.consent_at DESC NULLS LAST, c.id DESC
    FOR UPDATE
  LOOP
    v_contact_count := v_contact_count + 1;
    IF v_contact_count = 1 THEN
      v_contact_id := v_contact.id;
      v_current_contact_phone := v_contact.value;
    END IF;
  END LOOP;

  IF v_contact_count > 1 THEN
    RAISE EXCEPTION 'whatsapp_multiple_contacts';
  END IF;

  IF v_contact_id IS NULL THEN
    -- Si el perfil aún no tiene fila de contacto WhatsApp en la base de datos (por ejemplo, si
    -- inició la verificación durante el registro previo a guardar el perfil), se crea
    -- el método de contacto verificado de forma segura para este perfil:
    INSERT INTO public.contact_methods (
      profile_id,
      type,
      value,
      is_public,
      consent_at
    )
    VALUES (
      v_profile_id,
      'whatsapp',
      v_phone,
      false,
      v_now
    );
  ELSE
    -- Si ya existe un método de contacto de WhatsApp para este perfil, comprobar que el usuario
    -- no haya modificado su número a uno diferente que invalide esta solicitud:
    BEGIN
      v_normalized_current_phone := public.normalize_whatsapp_phone(trim(COALESCE(v_current_contact_phone, '')));
    EXCEPTION WHEN OTHERS THEN
      v_normalized_current_phone := NULL;
    END;

    -- Comprobación nulo-segura y tolerante a formatos equivalentes (comparación canónica o de 10 dígitos nacionales):
    IF v_normalized_current_phone IS NULL
       OR (
         v_normalized_current_phone <> v_normalized_phone
         AND right(v_normalized_current_phone, 10) <> right(v_normalized_phone, 10)
       ) THEN
      RAISE EXCEPTION 'whatsapp_phone_mismatch';
    END IF;

    -- Sincronizar formato exacto declarado
    UPDATE public.contact_methods
       SET value = v_phone
     WHERE id = v_contact_id
       AND profile_id = v_profile_id
       AND type = 'whatsapp';
  END IF;

  -- Actualizar verificación en el perfil
  UPDATE public.profiles
     SET whatsapp_verified = true,
         whatsapp_verified_at = v_now
   WHERE id = v_profile_id;

  -- Marcar solicitud como aprobada
  UPDATE public.whatsapp_verification_requests
     SET status = 'aprobado',
         reviewed_at = v_now
   WHERE id = v_request.id
     AND profile_id = v_profile_id
     AND status = 'pendiente';

  approved_profile_id := v_profile_id;
  approved_phone := v_phone;
  normalized_phone := v_normalized_phone;
  RETURN NEXT;
END;
$$;

-- 5. RPC atómica user_update_verified_whatsapp (ORDEN DE BLOQUEOS ANTI-DEADLOCK: profiles -> requests -> contacts):
CREATE OR REPLACE FUNCTION public.user_update_verified_whatsapp(
  p_new_phone TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_profile_id UUID;
  v_cleaned_phone TEXT;
  v_normalized_phone TEXT;
  v_contact_id UUID;
  v_contact_count INTEGER := 0;
  v_contact RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  v_cleaned_phone := trim(COALESCE(p_new_phone, ''));
  IF v_cleaned_phone = '' THEN
    RAISE EXCEPTION 'phone_required';
  END IF;

  BEGIN
    v_normalized_phone := public.normalize_whatsapp_phone(v_cleaned_phone);
  EXCEPTION WHEN OTHERS THEN
    v_normalized_phone := NULL;
  END;

  IF v_normalized_phone IS NULL OR v_normalized_phone !~ '^[0-9]{8,15}$' THEN
    RAISE EXCEPTION 'phone_invalid';
  END IF;

  -- 1. BLOQUEO NIVEL 1: Perfil (FOR UPDATE)
  SELECT p.id
    INTO v_profile_id
  FROM public.profiles AS p
  WHERE p.id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'profile_not_found';
  END IF;

  -- 2. BLOQUEO NIVEL 2: Solicitudes pendientes asociadas a este perfil (FOR UPDATE)
  PERFORM 1
  FROM public.whatsapp_verification_requests AS r
  WHERE r.profile_id = v_user_id
    AND r.status = 'pendiente'
  FOR UPDATE;

  -- 3. BLOQUEO NIVEL 3: Métodos de contacto WhatsApp del perfil (FOR UPDATE)
  FOR v_contact IN
    SELECT c.id, c.value
    FROM public.contact_methods AS c
    WHERE c.profile_id = v_user_id
      AND c.type = 'whatsapp'
    ORDER BY c.consent_at DESC NULLS LAST, c.id DESC
    FOR UPDATE
  LOOP
    v_contact_count := v_contact_count + 1;
    IF v_contact_count = 1 THEN
      v_contact_id := v_contact.id;
    END IF;
  END LOOP;

  IF v_contact_count > 1 THEN
    RAISE EXCEPTION 'whatsapp_multiple_contacts';
  END IF;

  -- Habilitar explícitamente el reseteo transaccional seguro para los triggers
  PERFORM set_config('laburante.allow_whatsapp_reset', 'true', true);

  -- 4. Invalidar certificación de WhatsApp en profiles
  UPDATE public.profiles
     SET whatsapp_verified = false,
         whatsapp_verified_at = NULL,
         updated_at = v_now
   WHERE id = v_user_id;

  -- 5. Actualizar o insertar el método de contacto WhatsApp
  IF v_contact_id IS NOT NULL THEN
    UPDATE public.contact_methods
       SET value = v_cleaned_phone,
           consent_at = v_now
     WHERE id = v_contact_id
       AND profile_id = v_user_id;
  ELSE
    INSERT INTO public.contact_methods (profile_id, type, value, is_public, consent_at)
    VALUES (v_user_id, 'whatsapp', v_cleaned_phone, false, v_now);
  END IF;

  -- 6. Rechazar solicitudes de verificación pendientes del número anterior
  UPDATE public.whatsapp_verification_requests
     SET status = 'rechazado',
         reviewed_at = v_now
   WHERE profile_id = v_user_id
     AND status = 'pendiente';

  RETURN true;
END;
$$;

-- 6. RPC user_expire_pending_whatsapp_request para resolver la expiración bajo RLS restrictiva
CREATE OR REPLACE FUNCTION public.user_expire_pending_whatsapp_request(
  p_request_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_req RECORD;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'auth_required';
  END IF;

  SELECT id, profile_id, status, expires_at, created_at, code
    INTO v_req
  FROM public.whatsapp_verification_requests
  WHERE id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'request_not_found';
  END IF;

  -- Solo el dueño de la solicitud puede invocar su expiración/cancelación
  IF v_req.profile_id <> v_user_id THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF v_req.status <> 'pendiente' THEN
    RETURN true;
  END IF;

  -- Comprobar si venció (o si es LB no confiable sin expires_at)
  IF (v_req.expires_at IS NOT NULL AND v_req.expires_at < v_now)
     OR (v_req.expires_at IS NULL AND v_req.code ~* '^LB-[2-9A-HJ-NP-Z]{8}$') THEN
    UPDATE public.whatsapp_verification_requests
       SET status = 'rechazado',
           reviewed_at = v_now
     WHERE id = p_request_id;
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

-- Permisos sobre las RPCs de aplicación
REVOKE ALL ON FUNCTION public.admin_approve_whatsapp_verification(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_whatsapp_verification(UUID, TEXT)
  TO authenticated;

REVOKE ALL ON FUNCTION public.user_update_verified_whatsapp(TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_update_verified_whatsapp(TEXT)
  TO authenticated;

REVOKE ALL ON FUNCTION public.user_expire_pending_whatsapp_request(UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.user_expire_pending_whatsapp_request(UUID)
  TO authenticated;

-- Revocar permisos de ejecución directa sobre funciones trigger (no son RPCs de aplicación)
REVOKE EXECUTE ON FUNCTION public.protect_profile_verification_fields()
  FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.protect_verified_whatsapp_contact_method()
  FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
