-- ============================================================================
-- LABURANTE: Fix visibilidad de whatsapp_verified en public_profiles
--
-- Problema: La vista public_profiles no incluye whatsapp_verified.
-- Cuando fetchProfileBySlug carga el perfil del owner desde public_profiles,
-- el campo whatsapp_verified es undefined → Boolean(undefined) = false →
-- ProfileCompletionCard muestra el banner aunque el perfil ya esté verificado.
--
-- Este fix agrega whatsapp_verified a la vista public_profiles.
-- El campo es información pública (el sello aparece en búsquedas).
-- El trigger prevent_client_whatsapp_verification_trigger sigue en pie:
-- solo admins pueden cambiar este campo vía adminApproveWhatsAppVerification.
-- ============================================================================

BEGIN;

DO $$
BEGIN
  -- Si otra migración ya agregó la columna, no se reemplaza ni se reordena
  -- la vista existente.
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'public_profiles'
      AND column_name = 'whatsapp_verified'
  ) THEN
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'public_profiles'
        AND column_name IN ('has_resume', 'status')
      GROUP BY table_schema, table_name
      HAVING COUNT(*) = 2
    ) THEN
      RAISE EXCEPTION
        'public_profiles tiene una definición distinta; inspeccioná sus columnas antes de continuar';
    END IF;

    -- Las columnas existentes conservan exactamente su orden. La nueva queda
    -- al final, que es la única extensión permitida por CREATE OR REPLACE VIEW.
    EXECUTE $view$
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
        p.status,
        p.whatsapp_verified
      FROM public.profiles AS p
      WHERE (p.account_type <> 'empresa' AND p.status = 'activo')
         OR (p.account_type = 'empresa' AND p.status IN ('activo', 'oculto'))
    $view$;
  END IF;
END $$;

REVOKE ALL ON public.public_profiles FROM PUBLIC;
GRANT SELECT ON public.public_profiles TO anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
