-- Company workspace, profile documents and moderation visibility.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'persona' CHECK (account_type IN ('persona', 'empresa'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS resume_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS resume_name TEXT;

CREATE TABLE IF NOT EXISTS public.company_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 120),
  description TEXT,
  status TEXT NOT NULL DEFAULT 'activo' CHECK (status IN ('activo', 'cerrado', 'archivado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.company_saved_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.company_projects(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, profile_id, project_id)
);

ALTER TABLE public.company_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_saved_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read all profiles" ON public.profiles;
CREATE POLICY "Admins read all profiles" ON public.profiles FOR SELECT USING (
  (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
  (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
);

DROP POLICY IF EXISTS "Companies manage own projects" ON public.company_projects;
CREATE POLICY "Companies manage own projects" ON public.company_projects FOR ALL USING (auth.uid() = company_id AND (auth.jwt() -> 'user_metadata' ->> 'account_type') = 'empresa') WITH CHECK (auth.uid() = company_id AND (auth.jwt() -> 'user_metadata' ->> 'account_type') = 'empresa');
DROP POLICY IF EXISTS "Companies manage own saved profiles" ON public.company_saved_profiles;
CREATE POLICY "Companies manage own saved profiles" ON public.company_saved_profiles FOR ALL USING (auth.uid() = company_id AND (auth.jwt() -> 'user_metadata' ->> 'account_type') = 'empresa') WITH CHECK (auth.uid() = company_id AND (auth.jwt() -> 'user_metadata' ->> 'account_type') = 'empresa');

INSERT INTO storage.buckets (id, name, public) VALUES ('profile-assets', 'profile-assets', true) ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS "Public read profile assets" ON storage.objects;
CREATE POLICY "Public read profile assets" ON storage.objects FOR SELECT USING (bucket_id = 'profile-assets');
DROP POLICY IF EXISTS "Users upload own profile assets" ON storage.objects;
CREATE POLICY "Users upload own profile assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'profile-assets' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS "Users update own profile assets" ON storage.objects;
CREATE POLICY "Users update own profile assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'profile-assets' AND owner_id = auth.uid()::text);
DROP POLICY IF EXISTS "Users delete own profile assets" ON storage.objects;
CREATE POLICY "Users delete own profile assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'profile-assets' AND owner_id = auth.uid()::text);
