-- Soporte administrativo para pedidos y reportes vinculados.
-- Es aditiva: no clasifica, borra ni modifica registros existentes.

ALTER TABLE public.reports
  ADD COLUMN IF NOT EXISTS job_request_id UUID
  REFERENCES public.job_requests(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_reports_job_request
  ON public.reports(job_request_id);

-- Los inserts directos conservan el flujo histórico de reportes de perfiles,
-- pero los vínculos con pedidos solo pueden crearse mediante la RPC validada.
DROP POLICY IF EXISTS "Anyone can submit report" ON public.reports;
CREATE POLICY "Anyone can submit report"
  ON public.reports FOR INSERT
  WITH CHECK (job_request_id IS NULL);

CREATE TABLE IF NOT EXISTS public.admin_job_request_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_request_id UUID NOT NULL REFERENCES public.job_requests(id) ON DELETE CASCADE,
  admin_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('finalized', 'cancelled', 'archived', 'unarchived')),
  previous_status TEXT,
  new_status TEXT,
  previous_archived_at TIMESTAMPTZ,
  new_archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_job_actions_request
  ON public.admin_job_request_actions(job_request_id, created_at DESC);

ALTER TABLE public.admin_job_request_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read job request actions" ON public.admin_job_request_actions;
CREATE POLICY "Admins can read job request actions"
  ON public.admin_job_request_actions FOR SELECT
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

REVOKE ALL ON TABLE public.admin_job_request_actions FROM PUBLIC;
GRANT SELECT ON TABLE public.admin_job_request_actions TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_manage_job_request(
  target_job_request_id UUID,
  requested_action TEXT
)
RETURNS TABLE (
  job_request_id UUID,
  status TEXT,
  archived_at TIMESTAMPTZ,
  action TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  current_job public.job_requests%ROWTYPE;
  next_status TEXT;
  next_archived_at TIMESTAMPTZ;
  previous_status TEXT;
  previous_archived_at TIMESTAMPTZ;
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador puede operar pedidos';
  END IF;

  IF requested_action NOT IN ('finalized', 'cancelled', 'archived', 'unarchived') THEN
    RAISE EXCEPTION 'Acción administrativa no válida';
  END IF;

  SELECT * INTO current_job
  FROM public.job_requests
  WHERE id = target_job_request_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El pedido no existe';
  END IF;

  previous_status := current_job.status;
  previous_archived_at := current_job.archived_at;
  next_status := current_job.status;
  next_archived_at := current_job.archived_at;

  CASE requested_action
    WHEN 'finalized' THEN
      IF current_job.status IN ('completado', 'cancelado') THEN
        RAISE EXCEPTION 'El pedido no puede finalizarse desde su estado actual';
      END IF;
      next_status := 'completado';
    WHEN 'cancelled' THEN
      IF current_job.status IN ('completado', 'cancelado') THEN
        RAISE EXCEPTION 'El pedido no puede cancelarse desde su estado actual';
      END IF;
      next_status := 'cancelado';
    WHEN 'archived' THEN
      IF current_job.archived_at IS NOT NULL THEN
        RAISE EXCEPTION 'El pedido ya está archivado';
      END IF;
      next_archived_at := NOW();
    WHEN 'unarchived' THEN
      IF current_job.archived_at IS NULL THEN
        RAISE EXCEPTION 'El pedido no está archivado';
      END IF;
      next_archived_at := NULL;
  END CASE;

  UPDATE public.job_requests
  SET status = next_status,
      archived_at = next_archived_at
  WHERE id = target_job_request_id;

  INSERT INTO public.admin_job_request_actions (
    job_request_id,
    admin_user_id,
    action,
    previous_status,
    new_status,
    previous_archived_at,
    new_archived_at
  ) VALUES (
    target_job_request_id,
    auth.uid(),
    requested_action,
    previous_status,
    next_status,
    previous_archived_at,
    next_archived_at
  );

  RETURN QUERY SELECT target_job_request_id, next_status, next_archived_at, requested_action;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_manage_job_request(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_manage_job_request(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.submit_report_for_job(
  target_job_request_id UUID,
  target_profile_id UUID,
  report_reason_value public.report_reason,
  report_description TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  new_report_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Necesitás iniciar sesión para reportar un pedido';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.job_requests AS jobs
    WHERE jobs.id = target_job_request_id
      AND (
        (jobs.client_id = auth.uid() AND jobs.profile_id = target_profile_id)
        OR (jobs.profile_id = auth.uid() AND jobs.client_id = target_profile_id)
      )
      AND EXISTS (
        SELECT 1 FROM public.profiles
        WHERE profiles.id = target_profile_id
      )
  ) THEN
    RAISE EXCEPTION 'El pedido no corresponde a la persona reportada';
  END IF;

  INSERT INTO public.reports (
    reporter_id,
    profile_id,
    job_request_id,
    reason,
    description
  ) VALUES (
    auth.uid(),
    target_profile_id,
    target_job_request_id,
    report_reason_value,
    NULLIF(trim(report_description), '')
  )
  RETURNING id INTO new_report_id;

  RETURN new_report_id;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_report_for_job(UUID, UUID, public.report_reason, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_report_for_job(UUID, UUID, public.report_reason, TEXT) TO authenticated;
