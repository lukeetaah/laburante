BEGIN;

DO $$
BEGIN
  IF to_regprocedure('public.admin_update_user_credentials(uuid,text,text)') IS NULL THEN
    RAISE EXCEPTION 'No se puede revocar el RPC legado: falta public.admin_update_user_credentials(uuid,text,text)';
  END IF;
END $$;

REVOKE ALL ON FUNCTION public.admin_update_user_credentials(uuid, text, text) FROM PUBLIC, anon, authenticated;

NOTIFY pgrst, 'reload schema';

COMMIT;
