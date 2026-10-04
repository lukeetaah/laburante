-- ============================================================================
-- admin_get_user_emails(uuid[])
-- Devuelve el email de auth.users para una lista de IDs administrativos.
--
-- Propósito: carga batch de emails en el panel Admin sin N+1 queries.
-- La función existente admin_get_user_email(uuid) (singular) queda sin tocar.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.admin_get_user_emails(target_user_ids uuid[])
RETURNS TABLE(profile_id uuid, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador puede consultar accesos';
  END IF;

  RETURN QUERY
    SELECT u.id AS profile_id, u.email::text
    FROM auth.users u
    WHERE u.id = ANY(target_user_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_user_emails(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_user_emails(uuid[]) TO authenticated;
