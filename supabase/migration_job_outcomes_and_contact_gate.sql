-- Results reported independently by the requester and the service provider.
ALTER TABLE public.job_requests ADD COLUMN IF NOT EXISTS client_outcome TEXT;
ALTER TABLE public.job_requests ADD COLUMN IF NOT EXISTS professional_outcome TEXT;
ALTER TABLE public.job_requests ADD COLUMN IF NOT EXISTS outcome_note TEXT;
ALTER TABLE public.job_requests ADD COLUMN IF NOT EXISTS outcome_updated_at TIMESTAMPTZ;

ALTER TABLE public.job_requests DROP CONSTRAINT IF EXISTS job_requests_outcome_check;
ALTER TABLE public.job_requests ADD CONSTRAINT job_requests_outcome_check
  CHECK ((client_outcome IS NULL OR client_outcome IN ('completado', 'en_proceso', 'no_realizado', 'cancelado'))
    AND (professional_outcome IS NULL OR professional_outcome IN ('completado', 'en_proceso', 'no_realizado', 'cancelado')));

-- Keep job records private to the two participants. Contact buttons in the UI
-- are only enabled after a budget exists or the request was accepted.
DROP POLICY IF EXISTS "Anyone can insert job request" ON public.job_requests;
CREATE POLICY "Authenticated or anonymous can insert job request"
  ON public.job_requests FOR INSERT
  WITH CHECK (client_id IS NULL OR auth.uid() = client_id);
