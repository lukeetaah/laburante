-- ============================================================================
-- LABURANTE: Migración de Producción - Correcciones y Hardening
-- 1. CVs accesibles para usuarios autenticados (storage & RPC).
-- 2. Anti-abuso y prevención de fraude en reseñas (trigger & validaciones).
-- 3. Entrevistas: Entidad y flujo base (tabla public.interviews con RLS).
-- 4. Mensajería Admin: Relación explícita conversations -> profiles.
--
-- SEGURO Y NO DESTRUCTIVO PARA PRODUCCIÓN
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. CVs para usuarios autenticados
-- ----------------------------------------------------------------------------

-- Actualizamos can_read_profile_resume_object para que cualquier usuario
-- autenticado pueda leer el CV si el perfil lo tiene registrado y activo.
-- Anon sigue estrictamente bloqueado.
CREATE OR REPLACE FUNCTION public.can_read_profile_resume_object(
  target_bucket TEXT,
  target_object_path TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_profile_id UUID;
  expected_resume_url TEXT;
  allowed BOOLEAN := false;
BEGIN
  -- Requisito estricto: Debe estar autenticado (anon = false)
  IF auth.uid() IS NULL THEN
    RETURN false;
  END IF;

  IF target_bucket NOT IN ('profile-documents', 'profile-assets') THEN
    RETURN false;
  END IF;

  IF target_object_path IS NULL OR target_object_path !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/resume-[^/]+$' THEN
    RETURN false;
  END IF;

  target_profile_id := (storage.foldername(target_object_path))[1]::UUID;

  SELECT p.resume_url
    INTO expected_resume_url
  FROM public.profiles p
  WHERE p.id = target_profile_id;

  IF expected_resume_url IS NULL THEN
    RETURN false;
  END IF;

  IF target_bucket = 'profile-documents' THEN
    allowed := expected_resume_url = 'profile-documents:' || target_object_path;
  ELSE
    allowed := split_part(expected_resume_url, '/storage/v1/object/public/profile-assets/', 2)
      = target_object_path;
  END IF;

  IF NOT allowed THEN
    RETURN false;
  END IF;

  -- Cualquier usuario autenticado puede acceder a los CVs cargados válidos
  RETURN EXISTS (
    SELECT 1
    FROM storage.objects o
    WHERE o.bucket_id = target_bucket
      AND o.name = target_object_path
  );
END;
$$;

REVOKE ALL ON FUNCTION public.can_read_profile_resume_object(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_read_profile_resume_object(TEXT, TEXT) TO authenticated;

-- Actualizamos get_profile_resume_access para devolver las coordenadas de acceso
-- a cualquier usuario autenticado si el perfil tiene CV cargado.
CREATE OR REPLACE FUNCTION public.get_profile_resume_access(target_profile_id UUID)
RETURNS TABLE(bucket_id TEXT, object_path TEXT, file_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  resume_value TEXT;
  resume_label TEXT;
  parsed_path TEXT;
  parsed_bucket TEXT;
BEGIN
  -- Anon bloqueado
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'authentication_required';
  END IF;

  SELECT p.resume_url, p.resume_name
    INTO resume_value, resume_label
  FROM public.profiles p
  WHERE p.id = target_profile_id;

  IF resume_value IS NULL OR NULLIF(trim(resume_value), '') IS NULL THEN
    RETURN;
  END IF;

  IF resume_value LIKE 'profile-documents:%' THEN
    parsed_bucket := 'profile-documents';
    parsed_path := substring(resume_value FROM char_length('profile-documents:') + 1);
  ELSIF resume_value LIKE 'https://%/storage/v1/object/public/profile-assets/%' THEN
    parsed_bucket := 'profile-assets';
    parsed_path := substring(resume_value FROM '/storage/v1/object/public/profile-assets/' || '(.*)$');
  ELSE
    RETURN;
  END IF;

  IF parsed_path IS NULL
     OR (storage.foldername(parsed_path))[1] <> target_profile_id::text
     OR parsed_path !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/resume-[^/]+$'
     OR NOT EXISTS (
       SELECT 1
       FROM storage.objects o
       WHERE o.bucket_id = parsed_bucket
         AND o.name = parsed_path
     ) THEN
    RETURN;
  END IF;

  bucket_id := parsed_bucket;
  object_path := parsed_path;
  file_name := NULLIF(resume_label, '');
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.get_profile_resume_access(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_profile_resume_access(UUID) TO authenticated;

-- ----------------------------------------------------------------------------
-- 2. Anti-abuso y prevención de fraude en reseñas (recommendations)
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.validate_recommendation_anti_fraud()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_is_admin BOOLEAN := COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
  v_email_confirmed_at TIMESTAMPTZ;
  v_user_created_at TIMESTAMPTZ;
  v_recent_same_profile_count INTEGER;
  v_recent_user_reviews_count INTEGER;
  v_duplicate_content_count INTEGER;
  v_has_interaction BOOLEAN := false;
BEGIN
  -- 1. Validación de autenticación
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated_review';
  END IF;

  -- Solo admin puede saltar validaciones de fraude
  IF v_is_admin THEN
    RETURN NEW;
  END IF;

  -- 2. Bloqueo de auto-reseña y autor coherente
  IF NEW.from_user_id IS DISTINCT FROM v_actor_id THEN
    RAISE EXCEPTION 'invalid_reviewer_identity';
  END IF;

  IF NEW.from_user_id = NEW.to_profile_id THEN
    RAISE EXCEPTION 'self_review_not_allowed';
  END IF;

  -- 3. Advisory lock para prevenir race conditions simultáneas del mismo usuario
  PERFORM pg_advisory_xact_lock(hashtext('review_' || v_actor_id::text));

  -- 4. Verificar que el usuario tenga email confirmado en auth.users
  SELECT email_confirmed_at, created_at
    INTO v_email_confirmed_at, v_user_created_at
  FROM auth.users
  WHERE id = v_actor_id;

  IF v_email_confirmed_at IS NULL THEN
    RAISE EXCEPTION 'email_confirmation_required_for_reviews';
  END IF;

  -- Antigüedad mínima de 5 minutos desde el registro para evitar bots instantáneos
  IF v_user_created_at > (NOW() - INTERVAL '5 minutes') THEN
    RAISE EXCEPTION 'account_too_new_for_reviews';
  END IF;

  -- 5. Anti-duplicados: Un usuario no puede tener más de una reseña activa/pendiente al mismo perfil
  SELECT COUNT(*)
    INTO v_recent_same_profile_count
  FROM public.recommendations r
  WHERE r.from_user_id = NEW.from_user_id
    AND r.to_profile_id = NEW.to_profile_id
    AND r.status IN ('pendiente', 'visible');

  IF v_recent_same_profile_count > 0 THEN
    RAISE EXCEPTION 'already_reviewed_profile';
  END IF;

  -- 6. Rate Limiting: Máximo 3 reseñas por hora y 5 por día por usuario
  SELECT COUNT(*)
    INTO v_recent_user_reviews_count
  FROM public.recommendations r
  WHERE r.from_user_id = NEW.from_user_id
    AND r.created_at > (NOW() - INTERVAL '1 hour');

  IF v_recent_user_reviews_count >= 3 THEN
    RAISE EXCEPTION 'review_rate_limit_hourly_exceeded';
  END IF;

  -- 7. Anti-spam de contenido duplicado (mismo texto repetido)
  SELECT COUNT(*)
    INTO v_duplicate_content_count
  FROM public.recommendations r
  WHERE r.from_user_id = NEW.from_user_id
    AND md5(trim(lower(r.text))) = md5(trim(lower(NEW.text)))
    AND r.created_at > (NOW() - INTERVAL '7 days');

  IF v_duplicate_content_count > 0 THEN
    RAISE EXCEPTION 'duplicate_review_content';
  END IF;

  -- Toda nueva reseña ingresa como pendiente para moderación salvo admin
  NEW.status := 'pendiente';
  NEW.created_at := NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_recommendation_anti_fraud_trigger ON public.recommendations;
CREATE TRIGGER validate_recommendation_anti_fraud_trigger
  BEFORE INSERT ON public.recommendations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_recommendation_anti_fraud();

REVOKE ALL ON FUNCTION public.validate_recommendation_anti_fraud() FROM PUBLIC, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 3. Entrevistas: Entidad y flujo base (public.interviews)
-- ----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.interviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id UUID REFERENCES public.company_candidate_inquiries(id) ON DELETE CASCADE,
  job_request_id UUID REFERENCES public.job_requests(id) ON DELETE CASCADE,
  host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  candidate_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'propuesta' CHECK (status IN ('propuesta', 'confirmada', 'realizada', 'cancelada')),
  modality TEXT NOT NULL DEFAULT 'virtual' CHECK (modality IN ('virtual', 'presencial', 'telefonica')),
  scheduled_at TIMESTAMPTZ,
  location_or_link TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_interviews_host_id ON public.interviews(host_id);
CREATE INDEX IF NOT EXISTS idx_interviews_candidate_id ON public.interviews(candidate_id);
CREATE INDEX IF NOT EXISTS idx_interviews_inquiry_id ON public.interviews(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_interviews_scheduled_at ON public.interviews(scheduled_at);

ALTER TABLE public.interviews ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.interviews FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.interviews TO authenticated;

DROP POLICY IF EXISTS "Participants and admins read interviews" ON public.interviews;
CREATE POLICY "Participants and admins read interviews"
  ON public.interviews FOR SELECT TO authenticated
  USING (
    auth.uid() = host_id
    OR auth.uid() = candidate_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

DROP POLICY IF EXISTS "Host can create interviews" ON public.interviews;
CREATE POLICY "Host can create interviews"
  ON public.interviews FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = host_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

DROP POLICY IF EXISTS "Participants and admins update interviews" ON public.interviews;
CREATE POLICY "Participants and admins update interviews"
  ON public.interviews FOR UPDATE TO authenticated
  USING (
    auth.uid() = host_id
    OR auth.uid() = candidate_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  )
  WITH CHECK (
    auth.uid() = host_id
    OR auth.uid() = candidate_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

DROP POLICY IF EXISTS "Host and admins delete interviews" ON public.interviews;
CREATE POLICY "Host and admins delete interviews"
  ON public.interviews FOR DELETE TO authenticated
  USING (
    auth.uid() = host_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

-- ----------------------------------------------------------------------------
-- 4. Mensajería Admin: Nota sobre integridad relacional conversations → profiles
-- ----------------------------------------------------------------------------
-- No se agrega FK de conversations.user_id a public.profiles porque no todos
-- los auth.users tienen un profile (usuarios sin perfil completo pueden tener
-- conversaciones activas). El join se resuelve en frontend usando el array de
-- profiles ya cargado por Admin.tsx, y en el RPC directamente via auth.users.
-- La constraint original conversations.user_id → auth.users(id) es correcta y suficiente.
