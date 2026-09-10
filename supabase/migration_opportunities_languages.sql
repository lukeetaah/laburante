-- Professional language levels and company opportunity routing.
CREATE TABLE IF NOT EXISTS public.profile_languages (
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  language TEXT NOT NULL CHECK (char_length(trim(language)) BETWEEN 2 AND 40),
  level TEXT NOT NULL CHECK (level IN ('basico', 'intermedio', 'avanzado', 'bilingue')),
  is_public BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (profile_id, language)
);
ALTER TABLE public.profile_languages DROP CONSTRAINT IF EXISTS profile_languages_level_check;
ALTER TABLE public.profile_languages ADD CONSTRAINT profile_languages_level_check CHECK (level IN ('basico', 'intermedio', 'avanzado', 'bilingue', 'nativo'));
ALTER TABLE public.profile_languages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read public profile languages" ON public.profile_languages;
CREATE POLICY "Public read public profile languages" ON public.profile_languages FOR SELECT
  USING (is_public = true OR auth.uid() = profile_id);
DROP POLICY IF EXISTS "Owners manage profile languages" ON public.profile_languages;
CREATE POLICY "Owners manage profile languages" ON public.profile_languages FOR ALL
  USING (auth.uid() = profile_id) WITH CHECK (auth.uid() = profile_id);

CREATE TABLE IF NOT EXISTS public.company_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_company_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 3 AND 160),
  description TEXT NOT NULL CHECK (char_length(trim(description)) BETWEEN 10 AND 4000),
  provincia TEXT,
  localidad TEXT,
  origin_platform TEXT,
  origin_note TEXT,
  status TEXT NOT NULL DEFAULT 'abierta' CHECK (status IN ('abierta', 'pausada', 'cerrada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS public.company_opportunity_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id UUID NOT NULL REFERENCES public.company_opportunities(id) ON DELETE CASCADE,
  source_company_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_company_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  match_reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'nueva' CHECK (status IN ('nueva', 'vista', 'interesada', 'descartada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(opportunity_id, recipient_company_id)
);
ALTER TABLE public.company_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_opportunity_shares ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Companies manage own opportunities" ON public.company_opportunities;
CREATE POLICY "Companies manage own opportunities" ON public.company_opportunities FOR ALL
  USING (auth.uid() = source_company_id) WITH CHECK (auth.uid() = source_company_id);
DROP POLICY IF EXISTS "Companies discover companies" ON public.profiles;
CREATE POLICY "Companies discover companies" ON public.profiles FOR SELECT
  USING (account_type = 'empresa' AND auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS "Companies read opportunity shares" ON public.company_opportunity_shares;
CREATE POLICY "Companies read opportunity shares" ON public.company_opportunity_shares FOR SELECT
  USING (auth.uid() = recipient_company_id OR auth.uid() = source_company_id);
DROP POLICY IF EXISTS "Companies create opportunity shares" ON public.company_opportunity_shares;
CREATE POLICY "Companies create opportunity shares" ON public.company_opportunity_shares FOR INSERT
  WITH CHECK (auth.uid() = source_company_id);
DROP POLICY IF EXISTS "Recipients update opportunity shares" ON public.company_opportunity_shares;
CREATE POLICY "Recipients update opportunity shares" ON public.company_opportunity_shares FOR UPDATE
  USING (auth.uid() = recipient_company_id) WITH CHECK (auth.uid() = recipient_company_id);
