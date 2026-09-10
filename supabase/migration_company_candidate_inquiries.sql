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
