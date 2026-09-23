-- LABURANTE — Production security hardening (single final migration)
--
-- This file is designed for the current Production state. It does not depend
-- on replaying the historical application migrations. It contains no data
-- UPDATE/DELETE/INSERT operations on public application tables and does not
-- delete Storage objects or Auth users.
--
-- Execute as one PostgreSQL migration transaction. Do not run the historical
-- hardening files in addition to this file.

-- ============================================================================
-- 0. PRE-FLIGHT: fail before changing policies, functions, or Storage
-- ============================================================================

DO $$
DECLARE
  required_table TEXT;
  required_column TEXT;
BEGIN
  FOREACH required_table IN ARRAY ARRAY[
    'public.profiles',
    'public.skills',
    'public.services',
    'public.profile_languages',
    'public.contact_methods',
    'public.recommendations',
    'public.company_projects',
    'public.company_saved_profiles',
    'public.categories',
    'public.company_candidate_inquiries',
    'public.job_requests',
    'public.whatsapp_verification_requests',
    'public.account_deletions',
    'public.notifications',
    'public.reports',
    'storage.objects',
    'storage.buckets'
  ] LOOP
    IF to_regclass(required_table) IS NULL THEN
      RAISE EXCEPTION 'production_security_hardening_missing_table: %', required_table;
    END IF;
  END LOOP;

  IF to_regclass('storage.buckets') IS NULL
     OR NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'profile-assets') THEN
    RAISE EXCEPTION 'production_security_hardening_missing_bucket: profile-assets';
  END IF;

  FOREACH required_column IN ARRAY ARRAY[
    'public.profiles.id',
    'public.profiles.name',
    'public.profiles.slug',
    'public.profiles.photo_url',
    'public.profiles.bio',
    'public.profiles.provincia',
    'public.profiles.localidad',
    'public.profiles.zona_trabajo',
    'public.profiles.disponibilidad',
    'public.profiles.modalidad',
    'public.profiles.status',
    'public.profiles.account_type',
    'public.profiles.hybrid_presencial_pct',
    'public.profiles.hybrid_remoto_pct',
    'public.profiles.intent',
    'public.profiles.resume_url',
    'public.profiles.resume_name',
    'public.profiles.whatsapp_verified',
    'public.profiles.whatsapp_verified_at',
    'public.profiles.company_plan',
    'public.skills.profile_id',
    'public.skills.name',
    'public.services.profile_id',
    'public.services.title',
    'public.services.description',
    'public.services.precio_orientativo',
    'public.profile_languages.profile_id',
    'public.profile_languages.language',
    'public.profile_languages.level',
    'public.profile_languages.is_public',
    'public.contact_methods.profile_id',
    'public.contact_methods.type',
    'public.contact_methods.value',
    'public.contact_methods.is_public',
    'public.recommendations.id',
    'public.recommendations.from_user_id',
    'public.recommendations.to_profile_id',
    'public.recommendations.from_name',
    'public.recommendations.text',
    'public.recommendations.context',
    'public.recommendations.status',
    'public.company_projects.id',
    'public.company_projects.company_id',
    'public.company_saved_profiles.id',
    'public.company_saved_profiles.company_id',
    'public.company_saved_profiles.profile_id',
    'public.categories.id',
    'public.categories.name',
    'public.categories.slug',
    'public.company_candidate_inquiries.id',
    'public.company_candidate_inquiries.company_id',
    'public.company_candidate_inquiries.profile_id',
    'public.company_candidate_inquiries.status',
    'public.job_requests.id',
    'public.job_requests.client_id',
    'public.job_requests.profile_id',
    'public.job_requests.status',
    'public.job_requests.budget_amount',
    'public.job_requests.budget_details',
    'public.job_requests.budget_estimated_time',
    'public.job_requests.budget_created_at',
    'public.whatsapp_verification_requests.profile_id',
    'public.account_deletions.user_id',
    'public.notifications.user_id',
    'storage.objects.bucket_id',
    'storage.objects.name',
    'storage.objects.owner_id'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns c
      WHERE c.table_schema = split_part(required_column, '.', 1)
        AND c.table_name = split_part(required_column, '.', 2)
        AND c.column_name = split_part(required_column, '.', 3)
    ) THEN
      RAISE EXCEPTION 'production_security_hardening_missing_column: %', required_column;
    END IF;
  END LOOP;

  IF to_regprocedure('auth.uid()') IS NULL
     OR to_regprocedure('auth.jwt()') IS NULL
     OR to_regprocedure('storage.foldername(text)') IS NULL THEN
    RAISE EXCEPTION 'production_security_hardening_missing_runtime_function';
  END IF;

  IF to_regtype('public.report_reason') IS NULL THEN
    RAISE EXCEPTION 'production_security_hardening_missing_type: public.report_reason';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgrelid = 'public.profiles'::regclass
      AND tgname = 'profiles_company_plan_approval'
      AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION 'production_security_hardening_missing_trigger: profiles_company_plan_approval';
  END IF;
END;
$$;

-- ============================================================================
-- 1. Complete only the missing company inquiry DDL
-- ============================================================================

ALTER TABLE public.company_candidate_inquiries
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_company_candidate_active_process
  ON public.company_candidate_inquiries(company_id, profile_id)
  WHERE status IN ('pendiente', 'aceptada') AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_company_candidate_inquiries_archive
  ON public.company_candidate_inquiries(company_id, profile_id, archived_at);

-- ============================================================================
-- 2. Explicit public read models
-- ============================================================================

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
  (p.resume_url IS NOT NULL AND NULLIF(trim(p.resume_url), '') IS NOT NULL) AS has_resume
FROM public.profiles AS p
WHERE p.status = 'activo';

CREATE OR REPLACE VIEW public.public_profile_skills AS
SELECT s.profile_id, s.name
FROM public.skills AS s
JOIN public.profiles AS p ON p.id = s.profile_id
WHERE p.status = 'activo';

CREATE OR REPLACE VIEW public.public_profile_services AS
SELECT s.profile_id, s.title, s.description, s.precio_orientativo
FROM public.services AS s
JOIN public.profiles AS p ON p.id = s.profile_id
WHERE p.status = 'activo';

CREATE OR REPLACE VIEW public.public_profile_languages AS
SELECT l.profile_id, l.language, l.level, l.is_public
FROM public.profile_languages AS l
JOIN public.profiles AS p ON p.id = l.profile_id
WHERE p.status = 'activo' AND l.is_public = true;

CREATE OR REPLACE VIEW public.public_profile_contacts AS
SELECT c.profile_id, c.type, c.value, c.is_public
FROM public.contact_methods AS c
JOIN public.profiles AS p ON p.id = c.profile_id
WHERE p.status = 'activo'
  AND c.is_public = true
  AND c.type IN ('web', 'portfolio');

CREATE OR REPLACE VIEW public.public_profile_recommendations AS
SELECT
  r.id,
  r.to_profile_id,
  r.from_name,
  r.text,
  r.context,
  r.created_at,
  r.status,
  (r.from_user_id = auth.uid()) AS is_author
FROM public.recommendations AS r
JOIN public.profiles AS p ON p.id = r.to_profile_id
WHERE p.status = 'activo'
  AND r.status = 'visible'
  AND r.from_user_id IS NOT NULL;

REVOKE ALL ON public.public_profiles FROM PUBLIC;
REVOKE ALL ON public.public_profile_skills FROM PUBLIC;
REVOKE ALL ON public.public_profile_services FROM PUBLIC;
REVOKE ALL ON public.public_profile_languages FROM PUBLIC;
REVOKE ALL ON public.public_profile_contacts FROM PUBLIC;
REVOKE ALL ON public.public_profile_recommendations FROM PUBLIC;
GRANT SELECT ON public.public_profiles TO anon, authenticated;
GRANT SELECT ON public.public_profile_skills TO anon, authenticated;
GRANT SELECT ON public.public_profile_services TO anon, authenticated;
GRANT SELECT ON public.public_profile_languages TO anon, authenticated;
GRANT SELECT ON public.public_profile_contacts TO anon, authenticated;
GRANT SELECT ON public.public_profile_recommendations TO anon, authenticated;

-- ============================================================================
-- 3. Base-table privileges and profile/child-table RLS
-- ============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_languages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.profiles FROM PUBLIC;
REVOKE ALL ON public.profiles FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;

DROP POLICY IF EXISTS "Public read active profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Companies discover companies" ON public.profiles;
DROP POLICY IF EXISTS "Owners and admins read profiles" ON public.profiles;
CREATE POLICY "Admins read all profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = id
    OR COALESCE((SELECT auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin'
  );

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (COALESCE((SELECT auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin')
  WITH CHECK (COALESCE((SELECT auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin');

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) = id)
  WITH CHECK ((SELECT auth.uid()) = id);

CREATE OR REPLACE FUNCTION public.protect_profile_authorization_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE((SELECT auth.jwt()) -> 'app_metadata' ->> 'role', '') <> 'admin'
     AND NEW.account_type IS DISTINCT FROM OLD.account_type THEN
    RAISE EXCEPTION 'profile_account_type_change_not_allowed';
  END IF;

  IF COALESCE((SELECT auth.jwt()) -> 'app_metadata' ->> 'role', '') <> 'admin'
     AND NEW.status IS DISTINCT FROM OLD.status
     AND (
       NEW.status = 'suspendido'
       OR OLD.status IN ('suspendido', 'eliminado')
     ) THEN
    RAISE EXCEPTION 'profile_suspension_change_requires_admin';
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'profile_id_change_not_allowed';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_authorization_fields_trigger
  ON public.profiles;
CREATE TRIGGER protect_profile_authorization_fields_trigger
  BEFORE UPDATE OF id, account_type, status ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_authorization_fields();

-- Production policy replacements verified against pg_policies. The company
-- owner is the row's company_id; account_type is read from the profiles table,
-- not from client-controlled JWT metadata.
ALTER TABLE public.company_projects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_projects FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_projects TO authenticated;

DROP POLICY IF EXISTS "Companies manage own projects" ON public.company_projects;
CREATE POLICY "Companies manage own projects"
  ON public.company_projects FOR ALL TO authenticated
  USING (
    (SELECT auth.uid()) = company_id
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.account_type = 'empresa'
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = company_id
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.account_type = 'empresa'
    )
  );

ALTER TABLE public.company_saved_profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_saved_profiles FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_saved_profiles TO authenticated;

DROP POLICY IF EXISTS "Companies manage own saved profiles" ON public.company_saved_profiles;
CREATE POLICY "Companies manage own saved profiles"
  ON public.company_saved_profiles FOR ALL TO authenticated
  USING (
    (SELECT auth.uid()) = company_id
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.account_type = 'empresa'
    )
  )
  WITH CHECK (
    (SELECT auth.uid()) = company_id
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.account_type = 'empresa'
    )
  );

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.categories FROM PUBLIC;
GRANT SELECT ON public.categories TO anon, authenticated;

DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories"
  ON public.categories FOR ALL TO authenticated
  USING (COALESCE((SELECT auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin')
  WITH CHECK (COALESCE((SELECT auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin');

REVOKE ALL ON public.skills, public.services, public.profile_languages FROM PUBLIC;
REVOKE SELECT ON public.skills, public.services, public.profile_languages FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.skills, public.services, public.profile_languages TO authenticated;

DROP POLICY IF EXISTS "Public read skills" ON public.skills;
DROP POLICY IF EXISTS "Owner manage skills" ON public.skills;
CREATE POLICY "Owners and admins manage skills"
  ON public.skills FOR ALL TO authenticated
  USING (
    auth.uid() = profile_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  )
  WITH CHECK (
    auth.uid() = profile_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

DROP POLICY IF EXISTS "Public read services" ON public.services;
DROP POLICY IF EXISTS "Owner manage services" ON public.services;
CREATE POLICY "Owners and admins manage services"
  ON public.services FOR ALL TO authenticated
  USING (
    auth.uid() = profile_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  )
  WITH CHECK (
    auth.uid() = profile_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

DROP POLICY IF EXISTS "Public read public profile languages" ON public.profile_languages;
DROP POLICY IF EXISTS "Owners manage profile languages" ON public.profile_languages;
CREATE POLICY "Owners and admins manage profile languages"
  ON public.profile_languages FOR ALL TO authenticated
  USING (
    auth.uid() = profile_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  )
  WITH CHECK (
    auth.uid() = profile_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

REVOKE ALL ON public.contact_methods FROM PUBLIC;
REVOKE SELECT ON public.contact_methods FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_methods TO authenticated;

DROP POLICY IF EXISTS "Public read public contact methods" ON public.contact_methods;
CREATE POLICY "Public read public contact methods"
  ON public.contact_methods FOR SELECT TO anon, authenticated
  USING (
    is_public = true
    AND type IN ('web', 'portfolio')
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = contact_methods.profile_id
        AND p.status = 'activo'
    )
  );

DROP POLICY IF EXISTS "Owner manage contact methods" ON public.contact_methods;
CREATE POLICY "Owner manage contact methods"
  ON public.contact_methods FOR ALL TO authenticated
  USING (
    auth.uid() = profile_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  )
  WITH CHECK (
    auth.uid() = profile_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

DROP POLICY IF EXISTS "Authorized participants read contact methods" ON public.contact_methods;
CREATE POLICY "Authorized participants read contact methods"
  ON public.contact_methods FOR SELECT TO authenticated
  USING (
    auth.uid() = profile_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    OR EXISTS (
      SELECT 1
      FROM public.company_candidate_inquiries i
      WHERE i.company_id = auth.uid()
        AND i.profile_id = contact_methods.profile_id
        AND i.status = 'aceptada'
        AND i.archived_at IS NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.job_requests j
      WHERE (j.client_id = auth.uid() OR j.profile_id = auth.uid())
        AND j.profile_id = contact_methods.profile_id
        AND j.status IN ('presupuestado', 'aceptado', 'en_progreso', 'completado')
    )
  );

REVOKE ALL ON public.recommendations FROM PUBLIC;
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.recommendations FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recommendations TO authenticated;

DROP POLICY IF EXISTS "Public read visible recommendations" ON public.recommendations;
CREATE POLICY "Public read visible recommendations"
  ON public.recommendations FOR SELECT TO anon, authenticated
  USING (status = 'visible');

DROP POLICY IF EXISTS "Owners and authors can read recommendations" ON public.recommendations;
DROP POLICY IF EXISTS "Admins can read all recommendations" ON public.recommendations;
CREATE POLICY "Owners, authors and admins read recommendations"
  ON public.recommendations FOR SELECT TO authenticated
  USING (
    auth.uid() = to_profile_id
    OR auth.uid() = from_user_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

DROP POLICY IF EXISTS "Anyone can create recommendation" ON public.recommendations;
DROP POLICY IF EXISTS "Authenticated users can create recommendation" ON public.recommendations;
CREATE POLICY "Authenticated users can create recommendation"
  ON public.recommendations FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = from_user_id
    AND auth.uid() <> to_profile_id
  );

DROP POLICY IF EXISTS "Owners, authors and admins can update recommendations" ON public.recommendations;
DROP POLICY IF EXISTS "Owners and authors can update recommendations" ON public.recommendations;
DROP POLICY IF EXISTS "Admins can update all recommendations" ON public.recommendations;
CREATE POLICY "Owners, authors and admins can update recommendations"
  ON public.recommendations FOR UPDATE TO authenticated
  USING (
    auth.uid() = to_profile_id
    OR auth.uid() = from_user_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  )
  WITH CHECK (
    auth.uid() = to_profile_id
    OR auth.uid() = from_user_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

DROP POLICY IF EXISTS "Authors can delete recommendations" ON public.recommendations;
DROP POLICY IF EXISTS "Authors, owners and admins can delete recommendations" ON public.recommendations;
CREATE POLICY "Authors, owners and admins can delete recommendations"
  ON public.recommendations FOR DELETE TO authenticated
  USING (
    auth.uid() = from_user_id
    OR auth.uid() = to_profile_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

-- ============================================================================
-- 4. Candidate inquiries and job-request state transitions
-- ============================================================================

ALTER TABLE public.company_candidate_inquiries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_candidate_inquiries FROM PUBLIC;
REVOKE ALL ON public.company_candidate_inquiries FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.company_candidate_inquiries TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_candidate_inquiry_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
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
    RETURN NEW;
  END IF;

  IF is_admin THEN
    RETURN NEW;
  END IF;

  IF actor_id IS NULL
     OR (actor_id <> OLD.company_id AND actor_id <> OLD.profile_id) THEN
    RAISE EXCEPTION 'candidate_inquiry_actor_not_allowed';
  END IF;

  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
    RAISE EXCEPTION 'candidate_inquiry_archive_requires_admin';
  END IF;

  IF NEW.company_id IS DISTINCT FROM OLD.company_id
     OR NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
    RAISE EXCEPTION 'candidate_inquiry_participants_immutable';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF actor_id = OLD.company_id AND NEW.status <> 'cerrada' THEN
      RAISE EXCEPTION 'only_profile_owner_can_decide_candidate_inquiry';
    END IF;
    IF actor_id = OLD.profile_id
       AND NEW.status NOT IN ('aceptada', 'rechazada', 'cerrada') THEN
      RAISE EXCEPTION 'invalid_candidate_inquiry_transition';
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

DROP POLICY IF EXISTS "Companies create candidate inquiries" ON public.company_candidate_inquiries;
DROP POLICY IF EXISTS "Participants read candidate inquiries" ON public.company_candidate_inquiries;
DROP POLICY IF EXISTS "Participants update candidate inquiries" ON public.company_candidate_inquiries;
CREATE POLICY "Companies create candidate inquiries"
  ON public.company_candidate_inquiries FOR INSERT TO authenticated
  WITH CHECK (
    (SELECT auth.uid()) = company_id
    AND profile_id <> (SELECT auth.uid())
    AND status = 'pendiente'
    AND archived_at IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = (SELECT auth.uid())
        AND p.account_type = 'empresa'
    )
  );

DROP POLICY IF EXISTS "Admins can read job request analytics" ON public.job_requests;
CREATE POLICY "Admins can read job request analytics"
  ON public.job_requests FOR SELECT TO authenticated
  USING (COALESCE((SELECT auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin');

CREATE POLICY "Participants read candidate inquiries"
  ON public.company_candidate_inquiries FOR SELECT TO authenticated
  USING (auth.uid() = company_id OR auth.uid() = profile_id);

CREATE POLICY "Participants update candidate inquiries"
  ON public.company_candidate_inquiries FOR UPDATE TO authenticated
  USING (auth.uid() = company_id OR auth.uid() = profile_id)
  WITH CHECK (auth.uid() = company_id OR auth.uid() = profile_id);

DROP POLICY IF EXISTS "Admins manage candidate inquiries" ON public.company_candidate_inquiries;
CREATE POLICY "Admins manage candidate inquiries"
  ON public.company_candidate_inquiries FOR ALL TO authenticated
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  WITH CHECK (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

ALTER TABLE public.job_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.job_requests FROM PUBLIC;
REVOKE ALL ON public.job_requests FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.job_requests TO authenticated;

CREATE OR REPLACE FUNCTION public.enforce_job_request_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  actor_id UUID := auth.uid();
  is_admin BOOLEAN := COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF is_admin THEN
      RETURN NEW;
    END IF;
    IF actor_id IS NULL OR NEW.client_id <> actor_id THEN
      RAISE EXCEPTION 'job_request_actor_not_allowed';
    END IF;
    IF NEW.client_id = NEW.profile_id THEN
      RAISE EXCEPTION 'self_job_request_not_allowed';
    END IF;
    NEW.status := 'solicitado';
    NEW.budget_amount := NULL;
    NEW.budget_details := NULL;
    NEW.budget_estimated_time := NULL;
    NEW.budget_created_at := NULL;
    RETURN NEW;
  END IF;

  IF is_admin THEN
    RETURN NEW;
  END IF;

  IF actor_id IS NULL
     OR (actor_id <> OLD.client_id AND actor_id <> OLD.profile_id) THEN
    RAISE EXCEPTION 'job_request_actor_not_allowed';
  END IF;

  IF NEW.archived_at IS DISTINCT FROM OLD.archived_at THEN
    RAISE EXCEPTION 'job_request_archive_requires_admin';
  END IF;

  IF NEW.client_id IS DISTINCT FROM OLD.client_id
     OR NEW.profile_id IS DISTINCT FROM OLD.profile_id THEN
    RAISE EXCEPTION 'job_request_participants_immutable';
  END IF;

  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NEW.status = 'cancelado'
     AND OLD.status NOT IN ('completado', 'cancelado') THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'solicitado'
     AND actor_id = OLD.profile_id
     AND NEW.status = 'presupuestado' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'presupuestado'
     AND actor_id = OLD.client_id
     AND NEW.status = 'aceptado' THEN
    RETURN NEW;
  END IF;

  IF OLD.status = 'aceptado'
     AND (actor_id = OLD.client_id OR actor_id = OLD.profile_id)
     AND NEW.status = 'en_progreso' THEN
    RETURN NEW;
  END IF;

  IF OLD.status IN ('aceptado', 'en_progreso')
     AND (actor_id = OLD.client_id OR actor_id = OLD.profile_id)
     AND NEW.status = 'completado' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'invalid_job_request_transition';
END;
$$;

DROP TRIGGER IF EXISTS enforce_job_request_transition_trigger ON public.job_requests;
CREATE TRIGGER enforce_job_request_transition_trigger
  BEFORE INSERT OR UPDATE ON public.job_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_job_request_transition();

DROP POLICY IF EXISTS "Anyone can insert job request" ON public.job_requests;
DROP POLICY IF EXISTS "Authenticated or anonymous can insert job request" ON public.job_requests;
DROP POLICY IF EXISTS "Authenticated clients can insert job request" ON public.job_requests;
CREATE POLICY "Authenticated clients can insert job request"
  ON public.job_requests FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = client_id
    AND client_id <> profile_id
    AND status = 'solicitado'
  );

DROP POLICY IF EXISTS "Clients read own requests" ON public.job_requests;
DROP POLICY IF EXISTS "Pros read requests for their profile" ON public.job_requests;
CREATE POLICY "Participants read own job requests"
  ON public.job_requests FOR SELECT TO authenticated
  USING (auth.uid() = client_id OR auth.uid() = profile_id);

DROP POLICY IF EXISTS "Clients and Pros update own job request" ON public.job_requests;
CREATE POLICY "Participants update own job requests"
  ON public.job_requests FOR UPDATE TO authenticated
  USING (auth.uid() = client_id OR auth.uid() = profile_id)
  WITH CHECK (auth.uid() = client_id OR auth.uid() = profile_id);

DROP POLICY IF EXISTS "Admins manage job requests" ON public.job_requests;
CREATE POLICY "Admins manage job requests"
  ON public.job_requests FOR ALL TO authenticated
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  WITH CHECK (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

-- ============================================================================
-- 5. Recommendation identity and WhatsApp/account-deletion privacy
-- ============================================================================

CREATE OR REPLACE FUNCTION public.protect_recommendation_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin' THEN
    RETURN NEW;
  END IF;

  IF NEW.from_user_id IS DISTINCT FROM OLD.from_user_id
     OR NEW.to_profile_id IS DISTINCT FROM OLD.to_profile_id THEN
    RAISE EXCEPTION 'recommendation_identity_immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_recommendation_identity_trigger ON public.recommendations;
CREATE TRIGGER protect_recommendation_identity_trigger
  BEFORE UPDATE ON public.recommendations
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_recommendation_identity();

ALTER TABLE public.whatsapp_verification_requests ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.whatsapp_verification_requests FROM PUBLIC;
REVOKE ALL ON public.whatsapp_verification_requests FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_verification_requests TO authenticated;

DROP POLICY IF EXISTS "Anyone can insert verification request" ON public.whatsapp_verification_requests;
DROP POLICY IF EXISTS "Anyone can read verification requests" ON public.whatsapp_verification_requests;
DROP POLICY IF EXISTS "Admins and system can update verification requests" ON public.whatsapp_verification_requests;
DROP POLICY IF EXISTS "Users can insert own verification request" ON public.whatsapp_verification_requests;
DROP POLICY IF EXISTS "Users read own or admins read all verification requests" ON public.whatsapp_verification_requests;
DROP POLICY IF EXISTS "Only admins can update verification requests" ON public.whatsapp_verification_requests;
CREATE POLICY "Users read own or admins read all verification requests"
  ON public.whatsapp_verification_requests FOR SELECT TO authenticated
  USING (
    auth.uid() = profile_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );
CREATE POLICY "Users can insert own verification request"
  ON public.whatsapp_verification_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Only admins can update verification requests"
  ON public.whatsapp_verification_requests FOR UPDATE TO authenticated
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  WITH CHECK (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

CREATE OR REPLACE FUNCTION public.prevent_client_whatsapp_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.whatsapp_verified := false;
    NEW.whatsapp_verified_at := NULL;
  ELSIF NEW.whatsapp_verified IS DISTINCT FROM OLD.whatsapp_verified
     OR NEW.whatsapp_verified_at IS DISTINCT FROM OLD.whatsapp_verified_at THEN
    RAISE EXCEPTION 'whatsapp_verification_requires_admin';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_client_whatsapp_verification_trigger ON public.profiles;
CREATE TRIGGER prevent_client_whatsapp_verification_trigger
  BEFORE INSERT OR UPDATE OF whatsapp_verified, whatsapp_verified_at ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_client_whatsapp_verification();

ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_deletions FROM PUBLIC;
REVOKE ALL ON public.account_deletions FROM anon;
GRANT INSERT, SELECT ON public.account_deletions TO authenticated;

DROP POLICY IF EXISTS "Anyone can insert deletion" ON public.account_deletions;
DROP POLICY IF EXISTS "Anyone can insert account deletion" ON public.account_deletions;
DROP POLICY IF EXISTS "Anyone can read deletions" ON public.account_deletions;
DROP POLICY IF EXISTS "Admins can view account deletions" ON public.account_deletions;
DROP POLICY IF EXISTS "Users can submit own account deletion" ON public.account_deletions;
CREATE POLICY "Users can submit own account deletion"
  ON public.account_deletions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view account deletions"
  ON public.account_deletions FOR SELECT TO authenticated
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

REVOKE ALL ON public.notifications FROM PUBLIC;
REVOKE ALL ON public.notifications FROM anon;
GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
DROP POLICY IF EXISTS "Users can read their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notification state" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can read notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Anyone can update notifications" ON public.notifications;
CREATE POLICY "Users can read their own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notification state"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notifications"
  ON public.notifications FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

-- ============================================================================
-- 6. Storage separation and containment
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos',
  'profile-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-documents',
  'profile-documents',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'text/plain',
    'text/csv',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

UPDATE storage.buckets
SET public = false
WHERE id = 'profile-assets';

-- Storage policies cannot read profiles.resume_url through the caller's RLS
-- context when the caller is an authorized company. This narrowly scoped
-- SECURITY DEFINER helper performs the complete authorization and object-match
-- check before Storage allows a current CV object to be read.
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
  IF auth.uid() IS NULL
     OR target_bucket NOT IN ('profile-assets', 'profile-documents')
     OR target_object_path !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}/resume-[^/]+$' THEN
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

  allowed := auth.uid() = target_profile_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    OR EXISTS (
      SELECT 1
      FROM public.company_candidate_inquiries i
      WHERE i.company_id = auth.uid()
        AND i.profile_id = target_profile_id
        AND i.status = 'aceptada'
        AND i.archived_at IS NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.job_requests j
      WHERE (j.client_id = auth.uid() OR j.profile_id = auth.uid())
        AND j.profile_id = target_profile_id
        AND j.status IN ('presupuestado', 'aceptado', 'en_progreso', 'completado')
    );

  IF NOT allowed THEN
    RETURN false;
  END IF;

  RETURN EXISTS (
    SELECT 1
    FROM storage.objects o
    WHERE o.bucket_id = target_bucket
      AND o.name = target_object_path
  );
END;
$$;

REVOKE ALL ON FUNCTION public.can_read_profile_resume_object(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_read_profile_resume_object(TEXT, TEXT) FROM anon;
REVOKE ALL ON FUNCTION public.can_read_profile_resume_object(TEXT, TEXT) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.can_read_profile_resume_object(TEXT, TEXT) TO authenticated;

DROP POLICY IF EXISTS "Public read profile assets" ON storage.objects;
DROP POLICY IF EXISTS "Public read profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Public read legacy profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users read authorized legacy profile documents" ON storage.objects;
DROP POLICY IF EXISTS "Users read authorized profile documents" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own profile assets" ON storage.objects;
DROP POLICY IF EXISTS "Users update own profile assets" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own profile assets" ON storage.objects;
DROP POLICY IF EXISTS "Owners manage legacy profile assets" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete legacy profile assets" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users update own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own profile documents" ON storage.objects;
DROP POLICY IF EXISTS "Users update own profile documents" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own profile documents" ON storage.objects;

CREATE POLICY "Public read legacy profile photos"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'profile-assets'
    AND name ~ '^[0-9a-fA-F-]{36}/photo-[^/]+$'
  );

CREATE POLICY "Users read authorized legacy profile documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'profile-assets'
    AND name ~ '^[0-9a-fA-F-]{36}/resume-[^/]+$'
    AND public.can_read_profile_resume_object('profile-assets', storage.objects.name)
  );

CREATE POLICY "Users upload own profile photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-photos'
    AND name ~ '^[0-9a-fA-F-]{36}/photo-[^/]+$'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users update own profile photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-photos' AND owner_id = auth.uid()::text)
  WITH CHECK (bucket_id = 'profile-photos' AND owner_id = auth.uid()::text);
CREATE POLICY "Users delete own profile photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'profile-photos' AND owner_id = auth.uid()::text);

CREATE POLICY "Users upload own profile documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'profile-documents'
    AND name ~ '^[0-9a-fA-F-]{36}/resume-[^/]+$'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "Users read authorized profile documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'profile-documents'
    AND name ~ '^[0-9a-fA-F-]{36}/resume-[^/]+$'
    AND public.can_read_profile_resume_object('profile-documents', storage.objects.name)
  );
CREATE POLICY "Users update own profile documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-documents' AND owner_id = auth.uid()::text)
  WITH CHECK (bucket_id = 'profile-documents' AND owner_id = auth.uid()::text);
CREATE POLICY "Users delete own profile documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'profile-documents' AND owner_id = auth.uid()::text);

CREATE POLICY "Owners manage legacy profile assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-assets' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'profile-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owners delete legacy profile assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'profile-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ============================================================================
-- 7. Authorized CV access
-- ============================================================================

-- The RPC returns only the currently persisted object coordinates after the
-- authorization check. The existing frontend immediately exchanges those
-- coordinates for a short-lived signed URL through the Storage API; no public
-- permanent URL is returned by this function.
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
  allowed BOOLEAN := false;
BEGIN
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

  allowed := auth.uid() = target_profile_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
    OR EXISTS (
      SELECT 1
      FROM public.company_candidate_inquiries i
      WHERE i.company_id = auth.uid()
        AND i.profile_id = target_profile_id
        AND i.status = 'aceptada'
        AND i.archived_at IS NULL
    )
    OR EXISTS (
      SELECT 1
      FROM public.job_requests j
      WHERE (j.client_id = auth.uid() OR j.profile_id = auth.uid())
        AND j.profile_id = target_profile_id
        AND j.status IN ('presupuestado', 'aceptado', 'en_progreso', 'completado')
    );

  IF NOT allowed THEN
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
     OR parsed_path !~ '^[0-9a-fA-F-]{36}/resume-[^/]+$'
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

REVOKE ALL ON FUNCTION public.get_profile_resume_access(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_profile_resume_access(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_profile_resume_access(UUID) TO authenticated;

-- ============================================================================
-- 8. Function privileges and resolver paths
-- ============================================================================

DO $$
DECLARE
  signature TEXT;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public._insert_notification_server(uuid,uuid,text,text,text,text,text)',
    'public.create_anonymous_review_notification()',
    'public.enforce_company_plan_approval()',
    'public.claim_notification_email_delivery(uuid,uuid)',
    'public.reserve_notification_email_quota(integer,integer)',
    'public.admin_cleanup_anonymous_reviews(uuid)',
    'public.admin_cleanup_abandoned_accounts(boolean)',
    'public.admin_cleanup_orphan_verifications()',
    'public.admin_delete_account(uuid)',
    'public.admin_delete_recommendation(uuid)',
    'public.admin_get_unconfirmed_registrations()',
    'public.admin_get_user_email(uuid)',
    'public.admin_manage_job_request(uuid,text)',
    'public.admin_moderate_recommendation(uuid,text)',
    'public.admin_set_company_plan(uuid,text)',
    'public.admin_update_user_credentials(uuid,text,text)',
    'public.clear_my_archived_notifications()',
    'public.delete_my_notification(uuid)',
    'public.delete_recommendation(uuid)',
    'public.get_profile_resume_access(uuid)',
    'public.notify_admin_profile_reminder(uuid)',
    'public.notify_admin_whatsapp_verification(uuid)',
    'public.notify_company_candidate_inquiry(uuid,text,timestamptz)',
    'public.notify_company_opportunity_share(uuid,text)',
    'public.notify_job_request(uuid,text,text,timestamptz)',
    'public.notify_profile_whatsapp_verified(uuid)',
    'public.notify_review(uuid)',
    'public.submit_report_for_job(uuid,uuid,public.report_reason,text)'
  ] LOOP
    IF to_regprocedure(signature) IS NOT NULL THEN
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', signature);
    END IF;
  END LOOP;
END;
$$;

DO $$
DECLARE
  signature TEXT;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.claim_notification_email_delivery(uuid,uuid)',
    'public.reserve_notification_email_quota(integer,integer)'
  ] LOOP
    IF to_regprocedure(signature) IS NOT NULL THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', signature);
    END IF;
  END LOOP;
END;
$$;

DO $$
DECLARE
  signature TEXT;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.admin_cleanup_anonymous_reviews(uuid)',
    'public.admin_cleanup_abandoned_accounts(boolean)',
    'public.admin_cleanup_orphan_verifications()',
    'public.admin_delete_account(uuid)',
    'public.admin_delete_recommendation(uuid)',
    'public.admin_get_unconfirmed_registrations()',
    'public.admin_get_user_email(uuid)',
    'public.admin_manage_job_request(uuid,text)',
    'public.admin_moderate_recommendation(uuid,text)',
    'public.admin_set_company_plan(uuid,text)',
    'public.admin_update_user_credentials(uuid,text,text)',
    'public.clear_my_archived_notifications()',
    'public.delete_my_notification(uuid)',
    'public.delete_recommendation(uuid)',
    'public.get_profile_resume_access(uuid)',
    'public.notify_admin_profile_reminder(uuid)',
    'public.notify_admin_whatsapp_verification(uuid)',
    'public.notify_company_candidate_inquiry(uuid,text,timestamptz)',
    'public.notify_company_opportunity_share(uuid,text)',
    'public.notify_job_request(uuid,text,text,timestamptz)',
    'public.notify_profile_whatsapp_verified(uuid)',
    'public.notify_review(uuid)',
    'public.submit_report_for_job(uuid,uuid,public.report_reason,text)'
  ] LOOP
    IF to_regprocedure(signature) IS NOT NULL THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', signature);
    END IF;
  END LOOP;
END;
$$;

-- Historical SECURITY DEFINER functions were inspected separately and are not
-- mass-altered here. Their existing bodies and compatible paths are preserved
-- to avoid breaking notification/admin behavior. New privileged helpers above
-- use SET search_path = '' and schema-qualified object references.

REVOKE ALL ON FUNCTION public.enforce_candidate_inquiry_transition() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.enforce_job_request_transition() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_authorization_fields() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_recommendation_identity() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prevent_client_whatsapp_verification() FROM PUBLIC, anon, authenticated;

-- ============================================================================
-- 9. Final privilege cleanup for the operational tables
-- ============================================================================

REVOKE ALL ON public.reports FROM anon;
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.skills, public.services, public.profile_languages FROM anon;
REVOKE SELECT ON public.contact_methods FROM anon;
REVOKE SELECT ON public.recommendations FROM anon;
REVOKE SELECT ON public.company_candidate_inquiries FROM anon;
REVOKE SELECT ON public.job_requests FROM anon;
REVOKE SELECT ON public.whatsapp_verification_requests FROM anon;
REVOKE SELECT ON public.account_deletions FROM anon;
REVOKE SELECT ON public.notifications FROM anon;

NOTIFY pgrst, 'reload schema';
