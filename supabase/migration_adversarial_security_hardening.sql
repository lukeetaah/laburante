-- LABURANTE — adversarial hardening follow-up
--
-- Apply after migration_public_profile_security_hardening.sql and the other
-- application migrations. This migration changes authorization only: it does
-- not delete rows, objects, users, or buckets.

-- Fail before changing authorization if the schema dependencies are not
-- installed. archived_at belongs to the canonical company inquiry migration;
-- it is not interchangeable with status.
DO $$
BEGIN
  IF to_regclass('public.public_profiles') IS NULL THEN
    RAISE EXCEPTION 'apply migration_public_profile_security_hardening.sql first';
  END IF;

  IF to_regclass('public.company_candidate_inquiries') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'company_candidate_inquiries'
         AND column_name = 'archived_at'
     ) THEN
    RAISE EXCEPTION 'apply migration_company_candidate_inquiries.sql before migration_adversarial_security_hardening.sql';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name IN ('account_type', 'resume_url')
    GROUP BY table_schema, table_name
    HAVING COUNT(*) = 2
  ) THEN
    RAISE EXCEPTION 'apply migration_companies_documents.sql before migration_adversarial_security_hardening.sql';
  END IF;
END;
$$;

-- ================================================================
-- 1. Base profiles: authenticated users may read only themselves;
--    public discovery uses the explicit views from the prior migration.
-- ================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.profiles TO authenticated;
REVOKE SELECT ON public.profiles FROM anon;

DROP POLICY IF EXISTS "Public read active profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Companies discover companies" ON public.profiles;
DROP POLICY IF EXISTS "Owners and admins read profiles" ON public.profiles;
CREATE POLICY "Owners and admins read profiles"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    auth.uid() = id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

-- These are narrow authenticated read models for workflows that need a safe
-- display identity without granting access to the profiles table.
CREATE OR REPLACE VIEW public.authenticated_candidate_profiles AS
SELECT p.id, p.name, p.slug, p.photo_url, p.localidad, p.provincia
FROM public.profiles AS p
WHERE p.status = 'activo'
   OR EXISTS (
      SELECT 1
      FROM public.company_candidate_inquiries AS i
      WHERE i.company_id = auth.uid()
        AND i.profile_id = p.id
   );

CREATE OR REPLACE VIEW public.authenticated_company_profiles AS
SELECT p.id, p.name, p.slug, p.photo_url, p.localidad, p.provincia
FROM public.profiles AS p
WHERE p.account_type = 'empresa'
  AND p.status IN ('activo', 'oculto');

CREATE OR REPLACE VIEW public.authenticated_job_profiles AS
SELECT p.id, p.name, p.slug, p.photo_url, p.localidad, p.provincia
FROM public.profiles AS p
WHERE p.status = 'activo'
   OR EXISTS (
      SELECT 1
      FROM public.job_requests AS j
      WHERE (j.client_id = auth.uid() OR j.profile_id = auth.uid())
        AND (j.client_id = p.id OR j.profile_id = p.id)
   );

REVOKE ALL ON public.authenticated_candidate_profiles FROM PUBLIC;
REVOKE ALL ON public.authenticated_company_profiles FROM PUBLIC;
REVOKE ALL ON public.authenticated_job_profiles FROM PUBLIC;
GRANT SELECT ON public.authenticated_candidate_profiles TO authenticated;
GRANT SELECT ON public.authenticated_company_profiles TO authenticated;
GRANT SELECT ON public.authenticated_job_profiles TO authenticated;
REVOKE ALL ON public.authenticated_candidate_profiles FROM anon;
REVOKE ALL ON public.authenticated_company_profiles FROM anon;
REVOKE ALL ON public.authenticated_job_profiles FROM anon;

-- ================================================================
-- 2. Candidate inquiries: the client can request only pending; only the
--    profile owner can accept/reject. Participant IDs are immutable.
-- ================================================================

CREATE OR REPLACE FUNCTION public.enforce_candidate_inquiry_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, auth
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
CREATE POLICY "Companies create candidate inquiries"
  ON public.company_candidate_inquiries FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = company_id
    AND profile_id <> auth.uid()
    AND status = 'pendiente'
    AND archived_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.account_type = 'empresa'
    )
  );

DROP POLICY IF EXISTS "Participants update candidate inquiries" ON public.company_candidate_inquiries;
CREATE POLICY "Participants update candidate inquiries"
  ON public.company_candidate_inquiries FOR UPDATE TO authenticated
  USING (auth.uid() = company_id OR auth.uid() = profile_id)
  WITH CHECK (auth.uid() = company_id OR auth.uid() = profile_id);

-- ================================================================
-- 3. Job requests: authenticated clients create pending requests and status
--    transitions follow the product flow instead of trusting client input.
-- ================================================================

CREATE OR REPLACE FUNCTION public.enforce_job_request_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, auth
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

  -- The current UI marks a job completed before persisting the professional
  -- outcome, so completion is tied to an already accepted/in-progress job.
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

-- ================================================================
-- 4. Recommendations: authors/owners can edit content, but neither can move
--    the recommendation to another author or target.
-- ================================================================

CREATE OR REPLACE FUNCTION public.protect_recommendation_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, public, auth
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

-- ================================================================
-- 5. Storage: a relationship authorizes only the current resume object, not
--    every file in the profile's folder.
-- ================================================================

DROP POLICY IF EXISTS "Users read authorized legacy profile documents" ON storage.objects;
CREATE POLICY "Users read authorized legacy profile documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'profile-assets'
    AND name ~ '^[0-9a-fA-F-]{36}/resume-[^/]+$'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND split_part(p.resume_url, '/storage/v1/object/public/profile-assets/', 2) = storage.objects.name
    )
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
      OR EXISTS (
        SELECT 1 FROM public.company_candidate_inquiries i
        WHERE i.company_id = auth.uid()
          AND i.profile_id::text = (storage.foldername(name))[1]
          AND i.status = 'aceptada'
          AND i.archived_at IS NULL
      )
      OR EXISTS (
        SELECT 1 FROM public.job_requests j
        WHERE (j.client_id = auth.uid() OR j.profile_id = auth.uid())
          AND j.profile_id::text = (storage.foldername(name))[1]
          AND j.status IN ('presupuestado', 'aceptado', 'en_progreso', 'completado')
      )
    )
  );

DROP POLICY IF EXISTS "Users read authorized profile documents" ON storage.objects;
CREATE POLICY "Users read authorized profile documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'profile-documents'
    AND name ~ '^[0-9a-fA-F-]{36}/resume-[^/]+$'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.resume_url = 'profile-documents:' || storage.objects.name
    )
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
      OR EXISTS (
        SELECT 1 FROM public.company_candidate_inquiries i
        WHERE i.company_id = auth.uid()
          AND i.profile_id::text = (storage.foldername(name))[1]
          AND i.status = 'aceptada'
          AND i.archived_at IS NULL
      )
      OR EXISTS (
        SELECT 1 FROM public.job_requests j
        WHERE (j.client_id = auth.uid() OR j.profile_id = auth.uid())
          AND j.profile_id::text = (storage.foldername(name))[1]
          AND j.status IN ('presupuestado', 'aceptado', 'en_progreso', 'completado')
      )
    )
  );
