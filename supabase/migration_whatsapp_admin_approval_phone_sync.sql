-- LABURANTE - Aprobación administrativa atómica de WhatsApp
--
-- Corrige el caso en que el número declarado en una solicitud pendiente
-- difiere del contacto antiguo del perfil. La solicitud es la fuente de
-- verdad para la aprobación: el perfil asociado y el teléfono se derivan
-- desde ella, no desde valores enviados por el cliente.
--
-- No elimina solicitudes ni contactos. Conserva el historial de estados,
-- privacidad y consentimiento del contacto existente. Permite formatos
-- equivalentes al comparar teléfonos (solo se quitan separadores; no se
-- eliminan prefijos nacionales o internacionales).

BEGIN;

CREATE OR REPLACE FUNCTION public.normalize_whatsapp_phone(p_phone TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
STRICT
SET search_path = pg_catalog
AS $$
  SELECT regexp_replace(trim(p_phone), '[^0-9]', '', 'g');
$$;

REVOKE ALL ON FUNCTION public.normalize_whatsapp_phone(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.normalize_whatsapp_phone(TEXT) TO authenticated;

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
  v_request RECORD;
  v_profile_id UUID;
  v_contact_id UUID;
  v_contact_count INTEGER := 0;
  v_contact RECORD;
  v_phone TEXT;
  v_normalized_phone TEXT;
  v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF auth.uid() IS NULL
     OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'whatsapp_admin_only';
  END IF;

  SELECT r.id, r.profile_id, r.phone_declared, r.code, r.status
    INTO v_request
  FROM public.whatsapp_verification_requests AS r
  WHERE r.id = p_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'whatsapp_request_not_found';
  END IF;

  IF v_request.status <> 'pendiente' THEN
    RAISE EXCEPTION 'whatsapp_request_already_resolved';
  END IF;

  IF v_request.code IS NULL
     OR v_request.code !~ '^LAB-[0-9]{6}$'
     OR upper(trim(COALESCE(p_code, ''))) <> upper(trim(v_request.code)) THEN
    RAISE EXCEPTION 'whatsapp_code_invalid';
  END IF;

  v_phone := trim(COALESCE(v_request.phone_declared, ''));
  v_normalized_phone := public.normalize_whatsapp_phone(v_phone);

  IF v_normalized_phone !~ '^[0-9]{8,15}$' THEN
    RAISE EXCEPTION 'whatsapp_phone_invalid';
  END IF;

  -- Bloquea el perfil y comprueba que la solicitud no apunte a un registro
  -- inexistente o ajeno. El perfil se deriva de la solicitud, no del cliente.
  SELECT p.id
    INTO v_profile_id
  FROM public.profiles AS p
  WHERE p.id = v_request.profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'whatsapp_profile_not_found';
  END IF;

  -- Se conserva la fila existente para no perder relaciones ni historial,
  -- privacidad ni consentimiento. La verificación no convierte el WhatsApp
  -- en público ni renueva consent_at por sí sola.
  -- Bloqueamos todas las filas WhatsApp y rechazamos el caso ambiguo: el
  -- índice histórico evita duplicar el mismo número normalizado, pero no
  -- impide que existan dos números distintos para un mismo perfil.
  FOR v_contact IN
    SELECT c.id
    FROM public.contact_methods AS c
    WHERE c.profile_id = v_profile_id
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

  IF v_contact_id IS NULL THEN
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
    UPDATE public.contact_methods
       SET value = v_phone
     WHERE id = v_contact_id
       AND profile_id = v_profile_id
       AND type = 'whatsapp';
  END IF;

  UPDATE public.profiles
     SET whatsapp_verified = true,
         whatsapp_verified_at = v_now
   WHERE id = v_profile_id;

  UPDATE public.whatsapp_verification_requests
     SET status = 'aprobado',
         reviewed_at = v_now
   WHERE id = v_request.id
     AND profile_id = v_profile_id
     AND status = 'pendiente';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'whatsapp_request_resolution_conflict';
  END IF;

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
