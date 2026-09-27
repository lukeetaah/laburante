-- LABURANTE — surgical Supabase Advisor hardening
--
-- Apply this migration after the existing application migrations and after
-- migration_public_profile_security_hardening.sql plus
-- migration_adversarial_security_hardening.sql.
-- This migration does not delete data, users, or Storage objects.

-- Fail before changing privileges or policies if the application schema is
-- incomplete. archived_at belongs to migration_company_candidate_inquiries;
-- it must not be replaced by a status predicate with different semantics.
DO $$
BEGIN
  IF to_regclass('public.account_deletions') IS NULL
     OR to_regclass('public.whatsapp_verification_requests') IS NULL THEN
    RAISE EXCEPTION 'apply migration_whatsapp_and_features.sql before migration_supabase_advisor_security_hardening.sql';
  END IF;

  IF to_regclass('public.company_candidate_inquiries') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'company_candidate_inquiries'
         AND column_name = 'archived_at'
     ) THEN
    RAISE EXCEPTION 'apply migration_company_candidate_inquiries.sql before migration_supabase_advisor_security_hardening.sql';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'profiles'
      AND column_name IN ('account_type', 'resume_url', 'resume_name', 'whatsapp_verified', 'whatsapp_verified_at')
    GROUP BY table_schema, table_name
    HAVING COUNT(*) = 5
  ) THEN
    RAISE EXCEPTION 'apply profile/document/WhatsApp schema migrations before migration_supabase_advisor_security_hardening.sql';
  END IF;
END;
$$;

-- ================================================================
-- 1. Remove legacy permissive policies left by historical migrations
-- ================================================================

ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_verification_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert deletion" ON public.account_deletions;
DROP POLICY IF EXISTS "Anyone can read deletions" ON public.account_deletions;
DROP POLICY IF EXISTS "Anyone can insert account deletion" ON public.account_deletions;
DROP POLICY IF EXISTS "Admins can view account deletions" ON public.account_deletions;
DROP POLICY IF EXISTS "Users can submit own account deletion" ON public.account_deletions;

CREATE POLICY "Users can submit own account deletion"
  ON public.account_deletions FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "Admins can view account deletions"
  ON public.account_deletions FOR SELECT TO authenticated
  USING (COALESCE((SELECT auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin');

REVOKE ALL ON public.account_deletions FROM PUBLIC;
REVOKE ALL ON public.account_deletions FROM anon;
GRANT INSERT, SELECT ON public.account_deletions TO authenticated;

DROP POLICY IF EXISTS "Anyone can insert verification request" ON public.whatsapp_verification_requests;
DROP POLICY IF EXISTS "Anyone can read verification requests" ON public.whatsapp_verification_requests;
DROP POLICY IF EXISTS "Admins and system can update verification requests" ON public.whatsapp_verification_requests;
DROP POLICY IF EXISTS "Users can insert own verification request" ON public.whatsapp_verification_requests;
DROP POLICY IF EXISTS "Users read own or admins read all verification requests" ON public.whatsapp_verification_requests;
DROP POLICY IF EXISTS "Only admins can update verification requests" ON public.whatsapp_verification_requests;

CREATE POLICY "Users read own or admins read all verification requests"
  ON public.whatsapp_verification_requests FOR SELECT TO authenticated
  USING (
    (SELECT auth.uid()) = profile_id
    OR COALESCE((SELECT auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin'
  );

CREATE POLICY "Users can insert own verification request"
  ON public.whatsapp_verification_requests FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) = profile_id);

CREATE POLICY "Only admins can update verification requests"
  ON public.whatsapp_verification_requests FOR UPDATE TO authenticated
  USING (COALESCE((SELECT auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin')
  WITH CHECK (COALESCE((SELECT auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin');

REVOKE ALL ON public.whatsapp_verification_requests FROM PUBLIC;
REVOKE ALL ON public.whatsapp_verification_requests FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.whatsapp_verification_requests TO authenticated;

-- A client must never be able to self-approve the WhatsApp badge by updating
-- profiles directly. Administration remains the only writer of these fields.
CREATE OR REPLACE FUNCTION public.prevent_client_whatsapp_verification()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = pg_catalog, auth
AS $$
BEGIN
  IF COALESCE((SELECT auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin' THEN
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

-- No RLS policy in the repository uses user_metadata for authorization.
-- user_metadata remains UI/profile input only; privileged checks use the
-- immutable app_metadata role claim or database ownership/relationship data.

-- ================================================================
-- 2. Legacy Storage containment
-- ================================================================

UPDATE storage.buckets
SET public = false
WHERE id = 'profile-assets';

DROP POLICY IF EXISTS "Public read profile assets" ON storage.objects;
DROP POLICY IF EXISTS "Public read legacy profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users upload own profile assets" ON storage.objects;
DROP POLICY IF EXISTS "Users update own profile assets" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own profile assets" ON storage.objects;
CREATE POLICY "Public read legacy profile photos"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (
    bucket_id = 'profile-assets'
    AND name ~ '^[0-9a-fA-F-]{36}/photo-[^/]+$'
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id::text = split_part(storage.objects.name, '/', 1)
        AND (
          p.status = 'activo'
          OR (SELECT auth.uid())::text = split_part(storage.objects.name, '/', 1)
        )
    )
  );

DROP POLICY IF EXISTS "Users read authorized legacy profile documents" ON storage.objects;
CREATE POLICY "Users read authorized legacy profile documents"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'profile-assets'
    AND name ~ '^[0-9a-fA-F-]{36}/resume-[^/]+$'
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND split_part(p.resume_url, '/storage/v1/object/public/profile-assets/', 2) = storage.objects.name
    )
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR COALESCE((SELECT auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin'
      OR EXISTS (
        SELECT 1
        FROM public.company_candidate_inquiries AS i
        WHERE i.company_id = (SELECT auth.uid())
          AND i.profile_id::text = (storage.foldername(name))[1]
          AND i.status = 'aceptada'
          AND i.archived_at IS NULL
      )
      OR EXISTS (
        SELECT 1
        FROM public.job_requests AS j
        WHERE (j.client_id = (SELECT auth.uid()) OR j.profile_id = (SELECT auth.uid()))
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
      SELECT 1
      FROM public.profiles AS p
      WHERE p.id::text = (storage.foldername(name))[1]
        AND p.resume_url = 'profile-documents:' || storage.objects.name
    )
    AND (
      (storage.foldername(name))[1] = (SELECT auth.uid())::text
      OR COALESCE((SELECT auth.jwt()) -> 'app_metadata' ->> 'role', '') = 'admin'
      OR EXISTS (
        SELECT 1
        FROM public.company_candidate_inquiries AS i
        WHERE i.company_id = (SELECT auth.uid())
          AND i.profile_id::text = (storage.foldername(name))[1]
          AND i.status = 'aceptada'
          AND i.archived_at IS NULL
      )
      OR EXISTS (
        SELECT 1
        FROM public.job_requests AS j
        WHERE (j.client_id = (SELECT auth.uid()) OR j.profile_id = (SELECT auth.uid()))
          AND j.profile_id::text = (storage.foldername(name))[1]
          AND j.status IN ('presupuestado', 'aceptado', 'en_progreso', 'completado')
      )
    )
  );

-- ================================================================
-- 3. Function ACLs: internal functions are not client-callable; public RPCs
--    are callable only as authenticated and retain their own authorization.
-- ================================================================

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
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', signature);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', signature);
      EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', signature);
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

-- ================================================================
-- 4. Harden resolver paths without changing function bodies.
-- ================================================================

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
      EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, auth, storage, extensions, public', signature);
    END IF;
  END LOOP;
END;
$$;

-- Internal trigger functions need no client-visible schema objects.
DO $$
DECLARE
  signature TEXT;
BEGIN
  FOREACH signature IN ARRAY ARRAY[
    'public.create_anonymous_review_notification()',
    'public.enforce_company_plan_approval()',
    'public.enforce_candidate_inquiry_transition()',
    'public.enforce_job_request_transition()',
    'public.protect_recommendation_identity()'
  ] LOOP
    IF to_regprocedure(signature) IS NOT NULL THEN
      EXECUTE format('ALTER FUNCTION %s SET search_path = pg_catalog, auth', signature);
    END IF;
  END LOOP;
END;
$$;

-- Leaked Password Protection is an Auth dashboard/configuration setting, not
-- a SQL migration. Enable it separately in staging after the Auth smoke test.
