-- ==============================================================================
-- LABURANTE — Migración: Tarjeta Digital de Contacto Personal y Código QR Permanente
-- Fecha: 2026-11-24
-- Descripción:
-- 1. Tabla public.profile_cards con RLS estricta y privilegios mínimos por columna.
-- 2. card_key permanente, inmutable y generado exclusivamente en PostgreSQL.
-- 3. Funciones con SET search_path = '' y referencias totalmente calificadas.
-- 4. get_public_digital_card: búsqueda canónica por card_key, fallback por slug,
--    validación de estado activo y proyección estricta por consentimiento.
-- 5. request_digital_card_email: serialización por usuario (FOR UPDATE), validación de
--    perfil activo, email verificado, rate limit y deduplicación.
-- ==============================================================================

-- 1. Función auxiliar para generar card_key permanente y compacto (10 caracteres)
CREATE OR REPLACE FUNCTION public.generate_digital_card_key()
RETURNS TEXT
LANGUAGE sql
VOLATILE
SET search_path = ''
AS $$
  SELECT pg_catalog.lower(
    pg_catalog.substr(
      pg_catalog.translate(
        pg_catalog.encode(
          pg_catalog.sha256((pg_catalog.gen_random_uuid()::text || pg_catalog.clock_timestamp()::text)::bytea),
          'base64'
        ),
        '/+=',
        ''
      ),
      1,
      10
    )
  );
$$;

REVOKE ALL ON FUNCTION public.generate_digital_card_key() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_digital_card_key() TO authenticated;

-- 2. Tabla de tarjetas digitales
CREATE TABLE IF NOT EXISTS public.profile_cards (
    profile_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    card_key TEXT NOT NULL UNIQUE DEFAULT public.generate_digital_card_key(),
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT pg_catalog.now()
);

-- Limpieza de índices redundantes (PRIMARY KEY y UNIQUE ya crean índices únicos)
DROP INDEX IF EXISTS public.idx_profile_cards_card_key;
DROP INDEX IF EXISTS public.idx_profile_cards_profile_id;

-- RLS y privilegios mínimos por columna
ALTER TABLE public.profile_cards ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.profile_cards FROM PUBLIC;
REVOKE ALL ON public.profile_cards FROM anon;
REVOKE ALL ON public.profile_cards FROM authenticated;

GRANT SELECT ON public.profile_cards TO authenticated;
GRANT INSERT (profile_id, config) ON public.profile_cards TO authenticated;
GRANT UPDATE (config) ON public.profile_cards TO authenticated;

-- Solo usuarios autenticados pueden ver su propia configuración
DROP POLICY IF EXISTS "Users can read own digital card config" ON public.profile_cards;
CREATE POLICY "Users can read own digital card config"
    ON public.profile_cards FOR SELECT
    TO authenticated
    USING (auth.uid() = profile_id);

-- Solo usuarios autenticados pueden insertar su propia tarjeta
DROP POLICY IF EXISTS "Users can insert own digital card config" ON public.profile_cards;
CREATE POLICY "Users can insert own digital card config"
    ON public.profile_cards FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = profile_id);

-- Solo usuarios autenticados pueden actualizar su propia tarjeta
DROP POLICY IF EXISTS "Users can update own digital card config" ON public.profile_cards;
CREATE POLICY "Users can update own digital card config"
    ON public.profile_cards FOR UPDATE
    TO authenticated
    USING (auth.uid() = profile_id)
    WITH CHECK (auth.uid() = profile_id);

-- Trigger para updated_at e inmutabilidad de card_key (sin SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.set_profile_cards_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
    IF OLD.card_key IS DISTINCT FROM NEW.card_key THEN
        RAISE EXCEPTION 'card_key is immutable';
    END IF;
    NEW.updated_at := pg_catalog.now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_profile_cards_updated_at ON public.profile_cards;
CREATE TRIGGER trigger_profile_cards_updated_at
    BEFORE UPDATE ON public.profile_cards
    FOR EACH ROW
    EXECUTE FUNCTION public.set_profile_cards_updated_at();

-- 3. RPC pública y segura para obtener la tarjeta digital
-- Prioriza card_key canónico; si no existe coincidencia, intenta compatibilidad por slug.
-- Solo expone los campos activados explícitamente y únicamente si el perfil está activo.
CREATE OR REPLACE FUNCTION public.get_public_digital_card(p_identifier TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_profile RECORD;
    v_config JSONB;
    v_result JSONB;
    v_contacts JSONB := '[]'::jsonb;
    v_services JSONB := '[]'::jsonb;
    v_skills JSONB := '[]'::jsonb;
    v_languages JSONB := '[]'::jsonb;
    v_clean_identifier TEXT;
BEGIN
    IF p_identifier IS NULL OR pg_catalog.btrim(p_identifier) = '' THEN
        RETURN NULL;
    END IF;

    v_clean_identifier := pg_catalog.lower(pg_catalog.btrim(p_identifier));
    IF pg_catalog.length(v_clean_identifier) > 120 THEN
        RETURN NULL;
    END IF;

    -- 1. Búsqueda exacta prioritaria por identificador permanente canónico (card_key)
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
        p.hybrid_presencial_pct,
        p.hybrid_remoto_pct,
        p.status,
        p.whatsapp_verified,
        pc.card_key,
        pc.config
    INTO v_profile
    FROM public.profile_cards pc
    JOIN public.profiles p ON p.id = pc.profile_id
    WHERE pc.card_key = v_clean_identifier
    LIMIT 1;

    -- 2. Segunda búsqueda independiente para compatibilidad con slugs
    IF v_profile.id IS NULL THEN
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
            p.hybrid_presencial_pct,
            p.hybrid_remoto_pct,
            p.status,
            p.whatsapp_verified,
            pc.card_key,
            pc.config
        INTO v_profile
        FROM public.profiles p
        JOIN public.profile_cards pc ON pc.profile_id = p.id
        WHERE pg_catalog.lower(p.slug) = v_clean_identifier
        LIMIT 1;
    END IF;

    -- Si no existe o el perfil no está activo, no divulgar ningún dato
    IF v_profile.id IS NULL OR v_profile.status IS DISTINCT FROM 'activo' THEN
        RETURN NULL;
    END IF;

    v_config := COALESCE(v_profile.config, '{}'::jsonb);

    -- Contactos autorizados explícitamente
    SELECT COALESCE(
        pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
            'type', c.type,
            'value', c.value
        )),
        '[]'::jsonb
    )
    INTO v_contacts
    FROM public.contact_methods c
    WHERE c.profile_id = v_profile.id
      AND (
          (c.type = 'whatsapp' AND v_config->'show_whatsapp' = 'true'::jsonb)
          OR (c.type = 'telefono' AND v_config->'show_phone' = 'true'::jsonb)
          OR (c.type = 'email' AND v_config->'show_email' = 'true'::jsonb)
          OR (c.type = 'web' AND v_config->'show_web' = 'true'::jsonb)
          OR (c.type = 'instagram' AND v_config->'show_instagram' = 'true'::jsonb)
          OR (c.type = 'linkedin' AND v_config->'show_linkedin' = 'true'::jsonb)
          OR (c.type = 'portfolio' AND v_config->'show_portfolio' = 'true'::jsonb)
      );

    -- Habilidades autorizadas explícitamente
    IF v_config->'show_skills' = 'true'::jsonb THEN
        SELECT COALESCE(pg_catalog.jsonb_agg(s.name), '[]'::jsonb)
        INTO v_skills
        FROM public.skills s
        WHERE s.profile_id = v_profile.id;
    END IF;

    -- Servicios autorizados explícitamente
    IF v_config->'show_services' = 'true'::jsonb THEN
        SELECT COALESCE(
            pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                'title', s.title,
                'description', s.description,
                'precio_orientativo', s.precio_orientativo
            )),
            '[]'::jsonb
        )
        INTO v_services
        FROM public.services s
        WHERE s.profile_id = v_profile.id;
    END IF;

    -- Idiomas autorizados explícitamente
    IF v_config->'show_languages' = 'true'::jsonb THEN
        SELECT COALESCE(
            pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
                'language', l.language,
                'level', l.level
            )),
            '[]'::jsonb
        )
        INTO v_languages
        FROM public.profile_languages l
        WHERE l.profile_id = v_profile.id;
    END IF;

    -- Construir objeto final de retorno con datos estrictamente permitidos
    v_result := pg_catalog.jsonb_build_object(
        'card_key', v_profile.card_key,
        'slug', v_profile.slug,
        'name', v_profile.name,
        'photo_url', CASE WHEN v_config->'show_photo' = 'true'::jsonb THEN v_profile.photo_url ELSE NULL END,
        'bio', CASE WHEN v_config->'show_bio' = 'true'::jsonb THEN v_profile.bio ELSE NULL END,
        'provincia', CASE WHEN v_config->'show_location' = 'true'::jsonb THEN v_profile.provincia ELSE NULL END,
        'localidad', CASE WHEN v_config->'show_location' = 'true'::jsonb THEN v_profile.localidad ELSE NULL END,
        'zona_trabajo', CASE WHEN v_config->'show_zona_trabajo' = 'true'::jsonb THEN v_profile.zona_trabajo ELSE NULL END,
        'disponibilidad', CASE WHEN v_config->'show_availability' = 'true'::jsonb THEN v_profile.disponibilidad ELSE NULL END,
        'modalidad', CASE WHEN v_config->'show_modality' = 'true'::jsonb THEN v_profile.modalidad ELSE NULL END,
        'hybrid_presencial_pct', CASE WHEN v_config->'show_modality' = 'true'::jsonb THEN v_profile.hybrid_presencial_pct ELSE NULL END,
        'hybrid_remoto_pct', CASE WHEN v_config->'show_modality' = 'true'::jsonb THEN v_profile.hybrid_remoto_pct ELSE NULL END,
        'whatsapp_verified', CASE WHEN v_config->'show_verified_badge' = 'true'::jsonb THEN COALESCE(v_profile.whatsapp_verified, false) ELSE false END,
        'skills', v_skills,
        'services', v_services,
        'languages', v_languages,
        'contacts', v_contacts,
        'headline', CASE WHEN v_config->'show_headline' = 'true'::jsonb AND pg_catalog.jsonb_typeof(v_config->'custom_headline') = 'string' THEN v_config->>'custom_headline' ELSE NULL END
    );

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_digital_card(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_digital_card(TEXT) TO anon, authenticated;

-- 4. RPC segura para que el usuario autenticado solicite el envío de su tarjeta por correo
-- Serializa solicitudes concurrentes por usuario (FOR UPDATE), exige perfil activo,
-- tarjeta registrada, email confirmado, construye la URL en servidor y aplica rate limit + deduplicación.
DROP FUNCTION IF EXISTS public.request_digital_card_email(TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.request_digital_card_email()
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_uid UUID := auth.uid();
    v_user_email TEXT;
    v_email_confirmed_at TIMESTAMPTZ;
    v_profile_name TEXT;
    v_profile_status TEXT;
    v_card_key TEXT;
    v_final_url TEXT;
    v_recent_count INTEGER;
    v_daily_count INTEGER;
    v_dedupe_key TEXT;
    v_notif_id UUID;
BEGIN
    IF v_uid IS NULL THEN
        RAISE EXCEPTION 'Debés iniciar sesión para recibir tu tarjeta por correo.';
    END IF;

    SELECT u.email, u.email_confirmed_at
    INTO v_user_email, v_email_confirmed_at
    FROM auth.users u
    WHERE u.id = v_uid;

    IF v_user_email IS NULL OR v_email_confirmed_at IS NULL THEN
        RAISE EXCEPTION 'Necesitás tener tu correo electrónico verificado para recibir tu tarjeta por email.';
    END IF;

    -- Serializar solicitudes simultáneas del mismo usuario bloqueando su fila en public.profiles
    SELECT p.name, p.status
    INTO v_profile_name, v_profile_status
    FROM public.profiles p
    WHERE p.id = v_uid
    FOR UPDATE;

    IF v_profile_status IS NULL THEN
        RAISE EXCEPTION 'Primero necesitás completar tu perfil en LABURANTE.';
    END IF;

    IF v_profile_status IS DISTINCT FROM 'activo' THEN
        RAISE EXCEPTION 'Tu perfil debe estar activo para enviar tu tarjeta digital pública por correo.';
    END IF;

    SELECT pc.card_key
    INTO v_card_key
    FROM public.profile_cards pc
    WHERE pc.profile_id = v_uid
    LIMIT 1;

    IF v_card_key IS NULL THEN
        RAISE EXCEPTION 'Primero guardá tu tarjeta para poder enviarla por correo.';
    END IF;

    -- Rate limit: máximo 1 envío cada 2 minutos y máximo 5 envíos cada 24 horas
    SELECT pg_catalog.count(*)
    INTO v_recent_count
    FROM public.notifications n
    WHERE n.user_id = v_uid
      AND n.link = '/tarjeta/' || v_card_key
      AND n.created_at > pg_catalog.now() - INTERVAL '2 minutes';

    IF v_recent_count > 0 THEN
        RAISE EXCEPTION 'Ya enviamos tu tarjeta recientemente. Esperá unos minutos antes de volver a solicitarla.';
    END IF;

    SELECT pg_catalog.count(*)
    INTO v_daily_count
    FROM public.notifications n
    WHERE n.user_id = v_uid
      AND n.link = '/tarjeta/' || v_card_key
      AND n.created_at > pg_catalog.now() - INTERVAL '24 hours';

    IF v_daily_count >= 5 THEN
        RAISE EXCEPTION 'Alcanzaste el límite diario de envíos de tu tarjeta por correo.';
    END IF;

    v_final_url := 'https://laburante.ar/tarjeta/' || v_card_key;
    v_dedupe_key := 'digital_card_email:' || v_uid::text || ':' || pg_catalog.to_char(pg_catalog.date_trunc('minute', pg_catalog.now()), 'YYYYMMDDHH24MI');

    INSERT INTO public.notifications (
        user_id,
        created_by,
        dedupe_key,
        title,
        message,
        type,
        link,
        read
    ) VALUES (
        v_uid,
        v_uid,
        v_dedupe_key,
        'Tu tarjeta digital LABURANTE y código QR',
        pg_catalog.format(
            'Hola %s, acá tenés el enlace permanente a tu tarjeta digital de LABURANTE: %s. Tu código QR y tarjeta están listos para compartir o imprimir.',
            COALESCE(v_profile_name, 'Laburante'),
            v_final_url
        ),
        'system',
        '/tarjeta/' || v_card_key,
        false
    )
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL
    DO NOTHING
    RETURNING id INTO v_notif_id;

    IF v_notif_id IS NULL THEN
        RAISE EXCEPTION 'Ya procesamos este envío hace instantes. Revisá tu casilla de correo.';
    END IF;

    RETURN v_notif_id;
END;
$$;

REVOKE ALL ON FUNCTION public.request_digital_card_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.request_digital_card_email() TO authenticated;
