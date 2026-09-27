-- LABURANTE — Public profile and private document hardening
--
-- This migration is intentionally additive and reversible at the data level:
-- it does not delete rows or objects. It removes anonymous access to base
-- tables, exposes explicit public-profile views, and makes profile-assets
-- private so legacy CV objects cannot be downloaded anonymously.

-- Fail before any DDL/DML if the application schema dependencies are
-- incomplete. archived_at is the canonical archive flag for inquiries; it
-- must not be replaced by status, which has different semantics.
DO $$
BEGIN
  IF to_regclass('public.company_candidate_inquiries') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'company_candidate_inquiries'
         AND column_name = 'archived_at'
     ) THEN
    RAISE EXCEPTION 'apply migration_company_candidate_inquiries.sql before migration_public_profile_security_hardening.sql';
  END IF;

  IF to_regclass('public.profile_languages') IS NULL THEN
    RAISE EXCEPTION 'apply migration_opportunities_languages.sql before migration_public_profile_security_hardening.sql';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name IN ('account_type', 'resume_url', 'resume_name')
    GROUP BY table_schema, table_name
    HAVING COUNT(*) = 3
  ) THEN
    RAISE EXCEPTION 'apply migration_companies_documents.sql before migration_public_profile_security_hardening.sql';
  END IF;
END;
$$;

-- ================================================================
-- 1. Explicit public read model (column allow-list)
-- ================================================================

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
SELECT r.id, r.to_profile_id, r.from_name, r.text, r.context, r.created_at, r.status,
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

-- Anonymous clients must use the whitelist view, never the base table.
REVOKE SELECT ON public.profiles FROM anon;
REVOKE SELECT ON public.recommendations FROM anon;
REVOKE SELECT ON public.skills, public.services, public.profile_languages, public.contact_methods FROM anon;

-- ================================================================
-- 2. Remove anonymous access to operational/private tables
-- ================================================================

ALTER TABLE public.whatsapp_verification_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;

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
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
CREATE POLICY "Users can insert own verification request"
  ON public.whatsapp_verification_requests FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = profile_id);
CREATE POLICY "Only admins can update verification requests"
  ON public.whatsapp_verification_requests FOR UPDATE TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
REVOKE ALL ON public.whatsapp_verification_requests FROM anon;
GRANT SELECT, INSERT ON public.whatsapp_verification_requests TO authenticated;

DROP POLICY IF EXISTS "Anyone can insert account deletion" ON public.account_deletions;
DROP POLICY IF EXISTS "Admins can view account deletions" ON public.account_deletions;
DROP POLICY IF EXISTS "Users can submit own account deletion" ON public.account_deletions;
CREATE POLICY "Users can submit own account deletion"
  ON public.account_deletions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view account deletions"
  ON public.account_deletions FOR SELECT TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
REVOKE ALL ON public.account_deletions FROM anon;
GRANT INSERT ON public.account_deletions TO authenticated;

-- Reports are write-only for visitors and never readable through anon.
REVOKE SELECT ON public.reports FROM anon;

DROP POLICY IF EXISTS "Anyone can create recommendation" ON public.recommendations;
DROP POLICY IF EXISTS "Authenticated users can create recommendation" ON public.recommendations;
CREATE POLICY "Authenticated users can create recommendation"
  ON public.recommendations FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = from_user_id
    AND auth.uid() <> to_profile_id
  );
REVOKE INSERT ON public.recommendations FROM anon;
GRANT INSERT ON public.recommendations TO authenticated;

-- ================================================================
-- 3. Split new photos and documents; lock the legacy mixed bucket
-- ================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos',
  'profile-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
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
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- The old bucket contains both photos and CVs. Making it private closes the
-- CV bypass without deleting legacy objects. Legacy photos are served through
-- short-lived signed URLs by the frontend compatibility path.
UPDATE storage.buckets
SET public = false
WHERE id = 'profile-assets';

DROP POLICY IF EXISTS "Public read profile assets" ON storage.objects;
DROP POLICY IF EXISTS "Public read legacy profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users read authorized legacy profile documents" ON storage.objects;
CREATE POLICY "Public read legacy profile photos"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'profile-assets'
    AND name ~ '^[0-9a-fA-F-]{36}/photo-[^/]+$'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id::text = split_part(storage.objects.name, '/', 1)
        AND (p.status = 'activo' OR auth.uid()::text = split_part(storage.objects.name, '/', 1))
    )
  );

CREATE POLICY "Users read authorized legacy profile documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'profile-assets'
    AND name ~ '^[0-9a-fA-F-]{36}/resume-[^/]+$'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      OR EXISTS (
        SELECT 1
        FROM public.company_candidate_inquiries i
        WHERE i.company_id = auth.uid()
          AND i.profile_id::text = (storage.foldername(name))[1]
          AND i.status = 'aceptada'
          AND i.archived_at IS NULL
      )
      OR EXISTS (
        SELECT 1
        FROM public.job_requests j
        WHERE (j.client_id = auth.uid() OR j.profile_id = auth.uid())
          AND j.profile_id::text = (storage.foldername(name))[1]
          AND j.status IN ('presupuestado', 'aceptado', 'en_progreso', 'completado')
      )
    )
  );

DROP POLICY IF EXISTS "Users upload own profile assets" ON storage.objects;
DROP POLICY IF EXISTS "Users update own profile assets" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own profile assets" ON storage.objects;
DROP POLICY IF EXISTS "Owners manage legacy profile assets" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete legacy profile assets" ON storage.objects;
CREATE POLICY "Owners manage legacy profile assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-assets' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'profile-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Owners delete legacy profile assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'profile-assets' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "Public read profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users update own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own profile photos" ON storage.objects;
CREATE POLICY "Users upload own profile photos"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-photos' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users update own profile photos"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-photos' AND owner_id = auth.uid()::text)
  WITH CHECK (bucket_id = 'profile-photos' AND owner_id = auth.uid()::text);
CREATE POLICY "Users delete own profile photos"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'profile-photos' AND owner_id = auth.uid()::text);

DROP POLICY IF EXISTS "Users upload own profile documents" ON storage.objects;
DROP POLICY IF EXISTS "Users read authorized profile documents" ON storage.objects;
DROP POLICY IF EXISTS "Users update own profile documents" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own profile documents" ON storage.objects;
CREATE POLICY "Users upload own profile documents"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'profile-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "Users read authorized profile documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'profile-documents'
    AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
      OR EXISTS (
        SELECT 1
        FROM public.company_candidate_inquiries i
        WHERE i.company_id = auth.uid()
          AND i.profile_id::text = (storage.foldername(name))[1]
          AND i.status = 'aceptada'
          AND i.archived_at IS NULL
      )
      OR EXISTS (
        SELECT 1
        FROM public.job_requests j
        WHERE (j.client_id = auth.uid() OR j.profile_id = auth.uid())
          AND j.profile_id::text = (storage.foldername(name))[1]
          AND j.status IN ('presupuestado', 'aceptado', 'en_progreso', 'completado')
      )
    )
  );
CREATE POLICY "Users update own profile documents"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'profile-documents' AND owner_id = auth.uid()::text)
  WITH CHECK (bucket_id = 'profile-documents' AND owner_id = auth.uid()::text);
CREATE POLICY "Users delete own profile documents"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'profile-documents' AND owner_id = auth.uid()::text);

-- ================================================================
-- 4. Authorized, short-lived CV access (never public URL based)
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_profile_resume_access(target_profile_id UUID)
RETURNS TABLE(bucket_id TEXT, object_path TEXT, file_name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, storage, pg_catalog
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
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR EXISTS (
      SELECT 1 FROM public.company_candidate_inquiries i
      WHERE i.company_id = auth.uid()
        AND i.profile_id = target_profile_id
        AND i.status = 'aceptada'
        AND i.archived_at IS NULL
    )
    OR EXISTS (
      SELECT 1 FROM public.job_requests j
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
     OR parsed_path !~ '^[0-9a-fA-F-]{36}/resume-[^/]+$' THEN
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
