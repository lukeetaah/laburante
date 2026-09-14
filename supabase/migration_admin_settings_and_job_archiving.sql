-- Configuracion operativa editable por Admin y archivado reversible de pedidos.
-- Migracion aditiva: no borra datos, no cambia estados existentes y no modifica RLS previa de job_requests.

CREATE TABLE IF NOT EXISTS public.admin_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  is_public BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read public admin settings" ON public.admin_settings;
CREATE POLICY "Public read public admin settings"
  ON public.admin_settings FOR SELECT
  USING (is_public = true);

DROP POLICY IF EXISTS "Admins manage admin settings" ON public.admin_settings;
CREATE POLICY "Admins manage admin settings"
  ON public.admin_settings FOR ALL
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Keep existing administrative policies on the same trusted claim. This does
-- not touch job_requests RLS or grant any new client-side role.
DROP POLICY IF EXISTS "Admins can read all reports" ON public.reports;
CREATE POLICY "Admins can read all reports"
  ON public.reports FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
CREATE POLICY "Admins can update reports"
  ON public.reports FOR UPDATE
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE OR REPLACE FUNCTION public.enforce_company_plan_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  is_admin BOOLEAN := (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
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

INSERT INTO public.admin_settings (key, value, description, is_public)
VALUES (
  'official_whatsapp',
  '5491178202409',
  'Numero oficial usado para verificaciones y contacto administrativo por WhatsApp.',
  true
)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.job_requests ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_job_requests_archived ON public.job_requests(client_id, profile_id, archived_at);
