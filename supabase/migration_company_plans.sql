-- Plan Empresa persistente y administrable desde el panel de LABURANTE.
-- Aplicar después de migration_companies_documents.sql.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_plan TEXT NOT NULL DEFAULT 'gratis';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_company_plan_check;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_company_plan_check
  CHECK (company_plan IN ('gratis', 'pago'));

-- Migra el valor que ya existía en metadata para no cambiar cuentas activas.
UPDATE public.profiles AS profiles
SET company_plan = CASE
  WHEN profiles.account_type = 'empresa' AND users.raw_user_meta_data ->> 'company_plan' = 'pago' THEN 'pago'
  ELSE 'gratis'
END
FROM auth.users AS users
WHERE users.id = profiles.id;

-- El admin cambia el plan desde una operación controlada, sin exponer el service role.
CREATE OR REPLACE FUNCTION public.admin_set_company_plan(target_user_id UUID, target_plan TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  target_is_company BOOLEAN;
BEGIN
  IF COALESCE(auth.jwt() -> 'user_metadata' ->> 'role', '') <> 'admin'
     AND COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar planes Empresa';
  END IF;

  IF target_plan NOT IN ('gratis', 'pago') THEN
    RAISE EXCEPTION 'Plan Empresa inválido';
  END IF;

  SELECT account_type = 'empresa'
    INTO target_is_company
  FROM public.profiles
  WHERE id = target_user_id;

  IF COALESCE(target_is_company, false) = false THEN
    RAISE EXCEPTION 'La cuenta indicada no es una Empresa';
  END IF;

  UPDATE public.profiles
  SET company_plan = target_plan, updated_at = NOW()
  WHERE id = target_user_id;

  -- Mantiene compatibilidad con sesiones antiguas que todavía leen metadata.
  UPDATE auth.users
  SET raw_user_meta_data = jsonb_set(
    COALESCE(raw_user_meta_data, '{}'::jsonb),
    '{company_plan}',
    to_jsonb(target_plan),
    true
  )
  WHERE id = target_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_set_company_plan(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_company_plan(UUID, TEXT) TO authenticated;

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- El plan se aplica también en la base, no sólo en el botón de la interfaz.
DROP POLICY IF EXISTS "Companies manage own opportunities" ON public.company_opportunities;
DROP POLICY IF EXISTS "Companies read own opportunities" ON public.company_opportunities;
DROP POLICY IF EXISTS "Companies read shared opportunities" ON public.company_opportunities;
DROP POLICY IF EXISTS "Paid companies create opportunities" ON public.company_opportunities;
DROP POLICY IF EXISTS "Paid companies update opportunities" ON public.company_opportunities;
DROP POLICY IF EXISTS "Paid companies delete opportunities" ON public.company_opportunities;

CREATE POLICY "Companies read own opportunities"
  ON public.company_opportunities FOR SELECT
  USING (auth.uid() = source_company_id);

CREATE POLICY "Companies read shared opportunities"
  ON public.company_opportunities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.company_opportunity_shares
      WHERE company_opportunity_shares.opportunity_id = company_opportunities.id
        AND (company_opportunity_shares.recipient_company_id = auth.uid() OR company_opportunity_shares.source_company_id = auth.uid())
    )
  );

CREATE POLICY "Paid companies create opportunities"
  ON public.company_opportunities FOR INSERT
  WITH CHECK (
    auth.uid() = source_company_id
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.account_type = 'empresa'
        AND profiles.company_plan = 'pago'
    )
  );

CREATE POLICY "Paid companies update opportunities"
  ON public.company_opportunities FOR UPDATE
  USING (
    auth.uid() = source_company_id
    AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.company_plan = 'pago')
  )
  WITH CHECK (auth.uid() = source_company_id);

CREATE POLICY "Paid companies delete opportunities"
  ON public.company_opportunities FOR DELETE
  USING (
    auth.uid() = source_company_id
    AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.company_plan = 'pago')
  );

DROP POLICY IF EXISTS "Companies create opportunity shares" ON public.company_opportunity_shares;
CREATE POLICY "Paid companies create opportunity shares"
  ON public.company_opportunity_shares FOR INSERT
  WITH CHECK (
    auth.uid() = source_company_id
    AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = auth.uid() AND profiles.company_plan = 'pago')
  );

-- Sólo portfolio/web se leen públicamente. Los canales de contacto se abren
-- únicamente al dueño, a un cliente con una solicitud respondida o a una
-- Empresa cuya entrevista/contratación fue aceptada.
DROP POLICY IF EXISTS "Public read public contact methods" ON public.contact_methods;
CREATE POLICY "Public read public contact methods"
  ON public.contact_methods FOR SELECT
  USING (
    auth.uid() = profile_id
    OR (
      is_public = true
      AND type IN ('web', 'portfolio')
      AND EXISTS (SELECT 1 FROM public.profiles WHERE profiles.id = contact_methods.profile_id AND profiles.status = 'activo')
    )
    OR (
      is_public = true
      AND EXISTS (
        SELECT 1 FROM public.job_requests
        WHERE job_requests.profile_id = contact_methods.profile_id
          AND job_requests.client_id = auth.uid()
          AND job_requests.status IN ('presupuestado', 'aceptado', 'en_progreso', 'completado')
      )
    )
    OR (
      is_public = true
      AND EXISTS (
        SELECT 1 FROM public.company_candidate_inquiries
        WHERE company_candidate_inquiries.profile_id = contact_methods.profile_id
          AND company_candidate_inquiries.company_id = auth.uid()
          AND company_candidate_inquiries.status = 'aceptada'
      )
    )
  );
