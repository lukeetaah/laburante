-- Corrección de seguridad para instalaciones que permitieron elegir Pago al registrarse.
-- Aplicar después de migration_company_plans.sql.
-- Esto deja todos los planes en Gratis una sola vez; Admin puede reactivar los aprobados.

UPDATE public.profiles
SET company_plan = 'gratis', updated_at = NOW()
WHERE account_type = 'empresa' AND company_plan = 'pago';

UPDATE auth.users AS users
SET raw_user_meta_data = jsonb_set(
  COALESCE(users.raw_user_meta_data, '{}'::jsonb),
  '{company_plan}',
  '"gratis"'::jsonb,
  true
)
FROM public.profiles AS profiles
WHERE profiles.id = users.id
  AND profiles.account_type = 'empresa';

CREATE OR REPLACE FUNCTION public.enforce_company_plan_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  is_admin BOOLEAN := (
    COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') = 'admin'
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );
BEGIN
  IF NOT is_admin THEN
    IF TG_OP = 'INSERT' THEN
      NEW.company_plan := 'gratis';
    ELSIF NEW.company_plan IS DISTINCT FROM OLD.company_plan THEN
      NEW.company_plan := OLD.company_plan;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_company_plan_approval ON public.profiles;
CREATE TRIGGER profiles_company_plan_approval
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_company_plan_approval();

REVOKE ALL ON FUNCTION public.enforce_company_plan_approval() FROM PUBLIC;
