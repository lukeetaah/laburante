-- ============================================================================
-- LABURANTE: Protección anti-scraping en tarjeta digital pública
-- Oculta contactos y enlaces en get_public_digital_card() para usuarios anónimos
-- (auth.uid() IS NULL), manteniendo visible la información profesional pública.
-- ============================================================================

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
    v_is_authenticated BOOLEAN := (auth.uid() IS NOT NULL);
    v_has_contacts BOOLEAN := false;
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

    -- Solo informar si existen contactos/enlaces habilitados (sin exponer valores)
    SELECT EXISTS (
        SELECT 1
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
          )
    ) INTO v_has_contacts;

    -- Anti-scraping: contactos y enlaces solo para usuarios autenticados
    IF v_is_authenticated THEN
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
    END IF;

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
        'contacts_locked', NOT v_is_authenticated,
        'has_contacts', v_has_contacts,
        'headline', CASE WHEN v_config->'show_headline' = 'true'::jsonb AND pg_catalog.jsonb_typeof(v_config->'custom_headline') = 'string' THEN v_config->>'custom_headline' ELSE NULL END
    );

    RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_public_digital_card(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_digital_card(TEXT) TO anon, authenticated;
