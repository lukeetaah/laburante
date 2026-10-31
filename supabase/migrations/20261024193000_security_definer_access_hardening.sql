-- Narrow the exposed SECURITY DEFINER surface without changing product flows.
-- All changes are idempotent and do not modify application data.

-- This RPC performs an administrative cleanup and must not be callable by a
-- merely authenticated user.
CREATE OR REPLACE FUNCTION public.admin_cleanup_anonymous_reviews(
  target_profile_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador puede realizar esta limpieza';
  END IF;

  IF target_profile_id IS NOT NULL THEN
    DELETE FROM public.recommendations
     WHERE to_profile_id = target_profile_id
       AND from_user_id IS NULL;
  ELSE
    DELETE FROM public.recommendations
     WHERE from_user_id IS NULL;
  END IF;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Authorization must come only from trusted app_metadata, never editable
-- raw_user_meta_data.
CREATE OR REPLACE FUNCTION public.admin_get_user_email(target_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador puede consultar accesos';
  END IF;
  RETURN (SELECT email FROM auth.users WHERE id = target_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_company_plan(target_user_id UUID, target_plan TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  target_is_company BOOLEAN;
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar planes Empresa';
  END IF;
  IF target_plan IS NULL OR target_plan NOT IN ('gratis', 'pago') THEN
    RAISE EXCEPTION 'Plan Empresa inválido';
  END IF;
  SELECT account_type = 'empresa' INTO target_is_company
  FROM public.profiles WHERE id = target_user_id;
  IF COALESCE(target_is_company, false) = false THEN
    RAISE EXCEPTION 'La cuenta indicada no es una Empresa';
  END IF;
  UPDATE public.profiles
     SET company_plan = target_plan, updated_at = NOW()
   WHERE id = target_user_id;
  UPDATE auth.users
     SET raw_user_meta_data = jsonb_set(
       COALESCE(raw_user_meta_data, '{}'::jsonb),
       '{company_plan}', to_jsonb(target_plan), true
     )
   WHERE id = target_user_id;
END;
$$;

-- The browser now uses the server-side Auth Admin API Edge Function instead of
-- mutating auth.users through a SECURITY DEFINER RPC. Keep the old signature as
-- a fail-closed compatibility stub so stale clients cannot change credentials.
CREATE OR REPLACE FUNCTION public.admin_update_user_credentials(
  target_user_id UUID,
  new_email TEXT DEFAULT NULL,
  new_password TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, extensions
AS $$
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador puede actualizar accesos';
  END IF;
  RAISE EXCEPTION 'credential_update_requires_server_auth_admin_api';
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_user_credentials(UUID, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;

-- Trigger entry points are not application RPCs.
REVOKE EXECUTE ON FUNCTION public.protect_profile_verification_fields() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_verified_whatsapp_contact_method() FROM PUBLIC, anon, authenticated;

-- These tables are service-role-only. Explicit deny policies document and
-- enforce that anon/authenticated cannot use them through the Data API while
-- preserving service_role and postgres maintenance paths.
DO $$
DECLARE
  table_name TEXT;
  policy_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'inactive_user_reminders',
    'notification_email_deliveries',
    'notification_email_rate_limit',
    'profile_completion_reminders',
    'user_activity'
  ] LOOP
    policy_name := 'Deny client access to ' || table_name;
    IF NOT EXISTS (
      SELECT 1
      FROM pg_policy pol
      JOIN pg_class rel ON rel.oid = pol.polrelid
      JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
      WHERE pol.polname = policy_name
        AND nsp.nspname = 'public'
        AND rel.relname = table_name
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL TO anon, authenticated USING (false) WITH CHECK (false)',
        policy_name, table_name
      );
    END IF;
  END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
