-- Secure support controls for changing a user's login email or password.
CREATE OR REPLACE FUNCTION public.admin_get_user_email(target_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') <> 'admin'
     AND COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador puede consultar accesos';
  END IF;
  RETURN (SELECT email FROM auth.users WHERE id = target_user_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_user_credentials(target_user_id UUID, new_email TEXT DEFAULT NULL, new_password TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  IF COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') <> 'admin'
     AND COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador puede actualizar accesos';
  END IF;
  IF target_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'La cuenta no existe';
  END IF;
  IF NULLIF(trim(new_email), '') IS NULL AND NULLIF(new_password, '') IS NULL THEN
    RAISE EXCEPTION 'Ingresá un email o una contraseña';
  END IF;
  IF NULLIF(new_password, '') IS NOT NULL AND char_length(new_password) < 6 THEN
    RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres';
  END IF;

  UPDATE auth.users
  SET email = COALESCE(NULLIF(trim(new_email), ''), email),
      encrypted_password = CASE WHEN NULLIF(new_password, '') IS NULL THEN encrypted_password ELSE crypt(new_password, gen_salt('bf')) END,
      email_confirmed_at = CASE WHEN NULLIF(trim(new_email), '') IS NULL THEN email_confirmed_at ELSE COALESCE(email_confirmed_at, NOW()) END,
      updated_at = NOW()
  WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_user_email(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.admin_update_user_credentials(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_user_email(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_user_credentials(UUID, TEXT, TEXT) TO authenticated;
