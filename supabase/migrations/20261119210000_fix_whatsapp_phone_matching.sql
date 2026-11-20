-- LABURANTE: Corrección de normalización telefónica y resolución de whatsapp_phone_mismatch
-- Migración correctiva para aplicar sobre bases de datos donde ya se ejecutó 20261119150000.
--
-- 1. Redefine public.normalize_whatsapp_phone con soporte robusto para variaciones de prefijos argentinos:
--    - Elimina prefijo internacional (+54, 549, 54).
--    - Elimina prefijo interurbano (0).
--    - Elimina prefijo móvil local (15) tras código de área de 2, 3 o 4 dígitos.
-- 2. Actualiza public.admin_approve_whatsapp_verification:
--    - Si el perfil no tiene aún método de contacto WhatsApp (ej: solicitud durante registro),
--      crea la fila en contact_methods en lugar de arrojar whatsapp_phone_mismatch.
--    - Si ya existe un método de contacto WhatsApp, compara usando normalización canónica
--      y tolerancia de 10 dígitos nacionales (right(..., 10)), evitando falsos rechazos por formatos equivalentes.
--    - Permite que múltiples perfiles compartan el mismo número telefónico sin conflictos.

BEGIN;

-- 1. Normalización telefónica inteligente para números argentinos e internacionales
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

-- 2. Función RPC administrativa actualizada con tolerancia de formato e inserción si no existe contacto
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

REVOKE ALL ON FUNCTION public.admin_approve_whatsapp_verification(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_approve_whatsapp_verification(UUID, TEXT)
  TO authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
