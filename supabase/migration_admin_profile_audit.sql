-- LABURANTE - Auditoría mínima de ediciones administrativas de perfiles
--
-- Registra el actor, el perfil afectado y los nombres de los campos que
-- cambiaron. No copia valores personales ni permite que un usuario común
-- invente, modifique o borre eventos.

CREATE TABLE IF NOT EXISTS public.admin_profile_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL,
  profile_id UUID NOT NULL,
  changed_fields TEXT[] NOT NULL CHECK (cardinality(changed_fields) > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE public.admin_profile_change_log IS
  'Immutable field-level audit entries for administrative profile updates.';

ALTER TABLE public.admin_profile_change_log ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.admin_profile_change_log FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.admin_profile_change_log TO authenticated;

DROP POLICY IF EXISTS admin_profile_change_log_select ON public.admin_profile_change_log;
CREATE POLICY admin_profile_change_log_select
  ON public.admin_profile_change_log
  FOR SELECT
  TO authenticated
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE OR REPLACE FUNCTION public.audit_admin_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  changed_fields TEXT[];
BEGIN
  -- Only a signed-in admin action is auditable here. Service-role jobs and
  -- ordinary user updates do not create a false administrative event.
  IF auth.uid() IS NULL
     OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RETURN NEW;
  END IF;

  changed_fields := array_remove(ARRAY[
    CASE WHEN NEW.name IS DISTINCT FROM OLD.name THEN 'name'::TEXT END,
    CASE WHEN NEW.bio IS DISTINCT FROM OLD.bio THEN 'bio'::TEXT END,
    CASE WHEN NEW.provincia IS DISTINCT FROM OLD.provincia THEN 'provincia'::TEXT END,
    CASE WHEN NEW.localidad IS DISTINCT FROM OLD.localidad THEN 'localidad'::TEXT END,
    CASE WHEN NEW.modalidad IS DISTINCT FROM OLD.modalidad THEN 'modalidad'::TEXT END,
    CASE WHEN NEW.hybrid_presencial_pct IS DISTINCT FROM OLD.hybrid_presencial_pct THEN 'hybrid_presencial_pct'::TEXT END,
    CASE WHEN NEW.hybrid_remoto_pct IS DISTINCT FROM OLD.hybrid_remoto_pct THEN 'hybrid_remoto_pct'::TEXT END,
    CASE WHEN NEW.disponibilidad IS DISTINCT FROM OLD.disponibilidad THEN 'disponibilidad'::TEXT END,
    CASE WHEN NEW.account_type IS DISTINCT FROM OLD.account_type THEN 'account_type'::TEXT END,
    CASE WHEN NEW.status IS DISTINCT FROM OLD.status THEN 'status'::TEXT END,
    CASE WHEN NEW.intent IS DISTINCT FROM OLD.intent THEN 'intent'::TEXT END,
    CASE WHEN NEW.company_plan IS DISTINCT FROM OLD.company_plan THEN 'company_plan'::TEXT END,
    CASE WHEN NEW.whatsapp_verified IS DISTINCT FROM OLD.whatsapp_verified THEN 'whatsapp_verified'::TEXT END,
    CASE WHEN NEW.whatsapp_verified_at IS DISTINCT FROM OLD.whatsapp_verified_at THEN 'whatsapp_verified_at'::TEXT END
  ], NULL);

  IF cardinality(changed_fields) > 0 THEN
    INSERT INTO public.admin_profile_change_log (admin_user_id, profile_id, changed_fields)
    VALUES (auth.uid(), NEW.id, changed_fields);
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.audit_admin_profile_update() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_audit_admin_profile_update ON public.profiles;
CREATE TRIGGER trg_audit_admin_profile_update
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_admin_profile_update();
