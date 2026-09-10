-- Flujo separado para selección Empresa: no usa presupuestos de servicios.
CREATE TABLE IF NOT EXISTS public.company_candidate_inquiries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  process_type TEXT NOT NULL DEFAULT 'entrevista' CHECK (process_type IN ('entrevista', 'contratacion')),
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aceptada', 'rechazada', 'cerrada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_company_candidate_inquiries_profile ON public.company_candidate_inquiries(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_company_candidate_inquiries_company ON public.company_candidate_inquiries(company_id, status);

ALTER TABLE public.company_candidate_inquiries ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.company_candidate_inquiries ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

-- Conserva el historial, pero evita duplicar procesos activos para la misma persona.
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY company_id, profile_id ORDER BY created_at DESC) AS row_number
  FROM public.company_candidate_inquiries
  WHERE status IN ('pendiente', 'aceptada') AND archived_at IS NULL
)
UPDATE public.company_candidate_inquiries AS inquiries
SET archived_at = NOW(), updated_at = NOW()
FROM ranked
WHERE inquiries.id = ranked.id AND ranked.row_number > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_company_candidate_active_process
  ON public.company_candidate_inquiries(company_id, profile_id)
  WHERE status IN ('pendiente', 'aceptada') AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_company_candidate_inquiries_archive ON public.company_candidate_inquiries(company_id, profile_id, archived_at);

DROP POLICY IF EXISTS "Companies create candidate inquiries" ON public.company_candidate_inquiries;
CREATE POLICY "Companies create candidate inquiries" ON public.company_candidate_inquiries FOR INSERT
  WITH CHECK (auth.uid() = company_id AND (auth.jwt() -> 'user_metadata' ->> 'account_type') = 'empresa');

DROP POLICY IF EXISTS "Participants read candidate inquiries" ON public.company_candidate_inquiries;
CREATE POLICY "Participants read candidate inquiries" ON public.company_candidate_inquiries FOR SELECT
  USING (auth.uid() = company_id OR auth.uid() = profile_id);

DROP POLICY IF EXISTS "Participants update candidate inquiries" ON public.company_candidate_inquiries;
CREATE POLICY "Participants update candidate inquiries" ON public.company_candidate_inquiries FOR UPDATE
  USING (auth.uid() = company_id OR auth.uid() = profile_id)
  WITH CHECK (auth.uid() = company_id OR auth.uid() = profile_id);
