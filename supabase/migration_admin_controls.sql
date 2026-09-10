-- Protected administrator controls for profile editing and full account removal.
CREATE OR REPLACE FUNCTION public.admin_delete_account(target_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') <> 'admin'
     AND COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador puede eliminar cuentas';
  END IF;

  IF target_user_id IS NULL OR target_user_id = auth.uid() THEN
    RAISE EXCEPTION 'No se puede eliminar la cuenta administradora activa';
  END IF;

  IF to_regclass('public.whatsapp_verification_requests') IS NOT NULL THEN
    DELETE FROM public.whatsapp_verification_requests WHERE profile_id = target_user_id;
  END IF;
  IF to_regclass('public.company_opportunity_shares') IS NOT NULL THEN
    DELETE FROM public.company_opportunity_shares WHERE source_company_id = target_user_id OR recipient_company_id = target_user_id;
  END IF;
  IF to_regclass('public.company_opportunities') IS NOT NULL THEN
    DELETE FROM public.company_opportunities WHERE source_company_id = target_user_id;
  END IF;
  IF to_regclass('public.company_saved_profiles') IS NOT NULL THEN
    DELETE FROM public.company_saved_profiles WHERE company_id = target_user_id;
  END IF;
  IF to_regclass('public.company_projects') IS NOT NULL THEN
    DELETE FROM public.company_projects WHERE company_id = target_user_id;
  END IF;
  DELETE FROM public.profiles WHERE id = target_user_id;
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_delete_account(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_delete_account(UUID) TO authenticated;

DROP POLICY IF EXISTS "Admins can manage categories" ON public.categories;
CREATE POLICY "Admins can manage categories"
  ON public.categories FOR ALL
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
