BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.admin_get_user_email(uuid)') IS NULL THEN
    RAISE EXCEPTION 'No se puede endurecer el RPC de email: falta public.admin_get_user_email(uuid)';
  END IF;
  IF to_regprocedure('public.admin_update_user_credentials(uuid,text,text)') IS NULL THEN
    RAISE EXCEPTION 'No se puede endurecer el RPC legado: falta public.admin_update_user_credentials(uuid,text,text)';
  END IF;
END $$;

ALTER FUNCTION public.admin_get_user_email(uuid)
  SET search_path = pg_catalog, auth;

ALTER FUNCTION public.admin_update_user_credentials(uuid, text, text)
  SET search_path = pg_catalog, auth, extensions;

REVOKE ALL ON FUNCTION public.admin_get_user_email(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_user_email(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_update_user_credentials(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_user_credentials(uuid, text, text) TO authenticated;

COMMIT;
