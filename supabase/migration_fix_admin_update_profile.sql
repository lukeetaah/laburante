-- ============================================================
-- LABURANTE — Corrección de admin_update_profile
-- Bug corregido: COALESCE(v_keys, ARRAY[...]::text[]) insertado
--   en columna changed_fields jsonb → se usa to_jsonb() explícito.
--
-- IMPORTANTE: ejecutar SOLO después de confirmar el diagnóstico
-- complementario (diagnostico_admin_update_profile.sql).
-- Esta migración NO modifica la firma, permisos, ni search_path.
-- ============================================================

CREATE OR REPLACE FUNCTION public.admin_update_profile(
  target_profile_id uuid,
  profile_patch jsonb,
  skills_patch jsonb DEFAULT NULL::jsonb,
  services_patch jsonb DEFAULT NULL::jsonb,
  contact_methods_patch jsonb DEFAULT NULL::jsonb,
  languages_patch jsonb DEFAULT NULL::jsonb,
  edit_reason text DEFAULT NULL::text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_admin_id uuid := auth.uid();
  v_is_admin boolean;
  v_old_profile jsonb;
  v_new_profile jsonb;
  v_item jsonb;
  v_existing_ids uuid[];
  v_patch_ids uuid[];
  v_keys text[];
  v_key text;
BEGIN
  -- 1. Validación estricta de autorización administrativa (extracción JSONB segura)
  v_is_admin := (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'admin_only' USING ERRCODE = '42501';
  END IF;

  IF target_profile_id IS NULL THEN
    RAISE EXCEPTION 'invalid_target_profile';
  END IF;

  IF edit_reason IS NULL OR LENGTH(TRIM(edit_reason)) < 3 THEN
    RAISE EXCEPTION 'invalid_edit_reason';
  END IF;

  -- 2. Snapshot antes de la modificación para auditoría
  SELECT to_jsonb(p) INTO v_old_profile
  FROM public.profiles p
  WHERE p.id = target_profile_id;

  IF v_old_profile IS NULL THEN
    RAISE EXCEPTION 'invalid_target_profile';
  END IF;

  -- 3. Actualizar campos escalares permitidos del perfil
  IF profile_patch IS NOT NULL AND profile_patch <> '{}'::jsonb THEN
    SELECT array_agg(k) INTO v_keys FROM jsonb_object_keys(profile_patch) AS k;

    FOREACH v_key IN ARRAY v_keys LOOP
      IF v_key NOT IN (
        'name', 'bio', 'provincia', 'localidad', 'zona_trabajo',
        'modalidad', 'hybrid_presencial_pct', 'hybrid_remoto_pct',
        'disponibilidad', 'intent', 'status', 'account_type'
      ) THEN
        RAISE EXCEPTION 'unauthorized_field_update: %', v_key;
      END IF;
    END LOOP;

    UPDATE public.profiles
    SET
      name                = CASE WHEN profile_patch ? 'name'                THEN profile_patch->>'name'                                             ELSE name                END,
      bio                 = CASE WHEN profile_patch ? 'bio'                 THEN profile_patch->>'bio'                                              ELSE bio                 END,
      provincia           = CASE WHEN profile_patch ? 'provincia'           THEN profile_patch->>'provincia'                                        ELSE provincia           END,
      localidad           = CASE WHEN profile_patch ? 'localidad'           THEN profile_patch->>'localidad'                                        ELSE localidad           END,
      zona_trabajo        = CASE WHEN profile_patch ? 'zona_trabajo'        THEN profile_patch->>'zona_trabajo'                                     ELSE zona_trabajo        END,
      modalidad           = CASE WHEN profile_patch ? 'modalidad'           THEN (profile_patch->>'modalidad')::public.job_modalidad                ELSE modalidad           END,
      hybrid_presencial_pct = CASE WHEN profile_patch ? 'hybrid_presencial_pct' THEN (profile_patch->>'hybrid_presencial_pct')::smallint           ELSE hybrid_presencial_pct END,
      hybrid_remoto_pct   = CASE WHEN profile_patch ? 'hybrid_remoto_pct'   THEN (profile_patch->>'hybrid_remoto_pct')::smallint                   ELSE hybrid_remoto_pct   END,
      disponibilidad      = CASE WHEN profile_patch ? 'disponibilidad'      THEN (profile_patch->>'disponibilidad')::public.job_disponibilidad      ELSE disponibilidad      END,
      intent              = CASE WHEN profile_patch ? 'intent'              THEN profile_patch->>'intent'                                           ELSE intent              END,
      updated_at          = NOW()
    WHERE id = target_profile_id;
  END IF;

  -- 4. Actualizar HABILIDADES (skills) y sincronizar eliminaciones
  IF skills_patch IS NOT NULL THEN
    v_patch_ids := ARRAY[]::uuid[];
    FOR v_item IN SELECT * FROM jsonb_array_elements(skills_patch) LOOP
      IF (v_item ? 'id') AND (v_item->>'id') IS NOT NULL AND (v_item->>'id') <> '' THEN
        UPDATE public.skills
        SET name = TRIM(v_item->>'name')
        WHERE id = (v_item->>'id')::uuid AND profile_id = target_profile_id;
        v_patch_ids := array_append(v_patch_ids, (v_item->>'id')::uuid);
      ELSE
        INSERT INTO public.skills (profile_id, name)
        VALUES (target_profile_id, TRIM(v_item->>'name'))
        RETURNING id INTO v_existing_ids[1];
        v_patch_ids := array_append(v_patch_ids, v_existing_ids[1]);
      END IF;
    END LOOP;
    DELETE FROM public.skills
    WHERE profile_id = target_profile_id
      AND NOT (id = ANY(v_patch_ids));
  END IF;

  -- 5. Actualizar SERVICIOS (services) y sincronizar eliminaciones
  IF services_patch IS NOT NULL THEN
    v_patch_ids := ARRAY[]::uuid[];
    FOR v_item IN SELECT * FROM jsonb_array_elements(services_patch) LOOP
      IF (v_item ? 'id') AND (v_item->>'id') IS NOT NULL AND (v_item->>'id') <> '' THEN
        UPDATE public.services
        SET
          title               = TRIM(v_item->>'title'),
          description         = NULLIF(TRIM(v_item->>'description'), ''),
          precio_orientativo  = NULLIF(TRIM(v_item->>'precio_orientativo'), '')
        WHERE id = (v_item->>'id')::uuid AND profile_id = target_profile_id;
        v_patch_ids := array_append(v_patch_ids, (v_item->>'id')::uuid);
      ELSE
        INSERT INTO public.services (profile_id, title, description, precio_orientativo)
        VALUES (
          target_profile_id,
          TRIM(v_item->>'title'),
          NULLIF(TRIM(v_item->>'description'), ''),
          NULLIF(TRIM(v_item->>'precio_orientativo'), '')
        )
        RETURNING id INTO v_existing_ids[1];
        v_patch_ids := array_append(v_patch_ids, v_existing_ids[1]);
      END IF;
    END LOOP;
    DELETE FROM public.services
    WHERE profile_id = target_profile_id
      AND NOT (id = ANY(v_patch_ids));
  END IF;

  -- 6. Actualizar MEDIOS DE CONTACTO (contact_methods) y sincronizar eliminaciones
  IF contact_methods_patch IS NOT NULL THEN
    v_patch_ids := ARRAY[]::uuid[];
    FOR v_item IN SELECT * FROM jsonb_array_elements(contact_methods_patch) LOOP
      IF (v_item ? 'id') AND (v_item->>'id') IS NOT NULL AND (v_item->>'id') <> '' THEN
        UPDATE public.contact_methods
        SET
          type      = (v_item->>'type')::public.contact_type,
          value     = TRIM(v_item->>'value'),
          is_public = COALESCE((v_item->>'is_public')::boolean, true)
        WHERE id = (v_item->>'id')::uuid AND profile_id = target_profile_id;
        v_patch_ids := array_append(v_patch_ids, (v_item->>'id')::uuid);
      ELSE
        INSERT INTO public.contact_methods (profile_id, type, value, is_public)
        VALUES (
          target_profile_id,
          (v_item->>'type')::public.contact_type,
          TRIM(v_item->>'value'),
          COALESCE((v_item->>'is_public')::boolean, true)
        )
        RETURNING id INTO v_existing_ids[1];
        v_patch_ids := array_append(v_patch_ids, v_existing_ids[1]);
      END IF;
    END LOOP;
    DELETE FROM public.contact_methods
    WHERE profile_id = target_profile_id
      AND NOT (id = ANY(v_patch_ids));
  END IF;

  -- 7. Actualizar IDIOMAS (profile_languages)
  IF languages_patch IS NOT NULL THEN
    DELETE FROM public.profile_languages WHERE profile_id = target_profile_id;
    FOR v_item IN SELECT * FROM jsonb_array_elements(languages_patch) LOOP
      IF TRIM(v_item->>'language') <> '' THEN
        INSERT INTO public.profile_languages (profile_id, language, level, is_public)
        VALUES (
          target_profile_id,
          TRIM(v_item->>'language'),
          COALESCE(v_item->>'level', 'intermedio'),
          COALESCE((v_item->>'is_public')::boolean, true)
        );
      END IF;
    END LOOP;
  END IF;

  -- 8. Snapshot posterior para registrar auditoría completa
  SELECT to_jsonb(p) INTO v_new_profile
  FROM public.profiles p
  WHERE p.id = target_profile_id;

  -- 9. Inserción del evento de auditoría en public.admin_audit_events
  --    FIX: v_keys es text[] → se convierte a jsonb con to_jsonb() antes de insertar.
  INSERT INTO public.admin_audit_events (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    result,
    reason,
    changed_fields,
    changes
  ) VALUES (
    v_admin_id,
    'admin_profile_edit',
    'profile',
    target_profile_id,
    'success',
    TRIM(edit_reason),
    to_jsonb(COALESCE(v_keys, ARRAY['relations_update']::text[])),  -- FIX: text[] → jsonb
    jsonb_build_object(
      'before',            v_old_profile,
      'after',             v_new_profile,
      'profile_patch',     profile_patch,
      'skills_updated',    (skills_patch IS NOT NULL),
      'services_updated',  (services_patch IS NOT NULL),
      'contacts_updated',  (contact_methods_patch IS NOT NULL),
      'languages_updated', (languages_patch IS NOT NULL)
    )
  );

  RETURN jsonb_build_object('success', true, 'profile_id', target_profile_id);
END;
$$;

-- Preservar permisos existentes (no modificar)
REVOKE ALL ON FUNCTION public.admin_update_profile(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_profile(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, text)
  TO authenticated;

NOTIFY pgrst, 'reload schema';
