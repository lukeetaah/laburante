BEGIN;

CREATE OR REPLACE FUNCTION public.admin_get_last_sign_in_at(target_user_ids uuid[])
RETURNS TABLE(user_id uuid, last_sign_in_at timestamptz)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, auth
AS $$
  SELECT u.id, u.last_sign_in_at
  FROM auth.users AS u
  WHERE u.id = ANY(target_user_ids);
$$;

REVOKE ALL ON FUNCTION public.admin_get_last_sign_in_at(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_last_sign_in_at(uuid[]) TO service_role;

COMMIT;
