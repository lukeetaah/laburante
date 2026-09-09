-- ==========================================================
-- LABURANTE — Supabase Database Schema & RLS Policies
-- Infraestructura digital de conexión laboral para Argentina
-- ==========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum types
DO $$ BEGIN
    CREATE TYPE profile_status AS ENUM ('activo', 'oculto', 'suspendido', 'eliminado');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE job_disponibilidad AS ENUM ('disponible', 'ocupado', 'no_disponible');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE job_modalidad AS ENUM ('presencial', 'remoto', 'ambas');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE contact_type AS ENUM ('whatsapp', 'telefono', 'email', 'instagram', 'linkedin', 'web', 'portfolio');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE report_reason AS ENUM (
        'datos_falsos',
        'spam',
        'fraude',
        'ofensivo',
        'acoso',
        'suplantacion',
        'datos_sin_autorizacion',
        'otro'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(trim(name)) >= 2),
    slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]+$'),
    photo_url TEXT,
    bio TEXT CHECK (char_length(bio) <= 2000),
    provincia TEXT NOT NULL,
    localidad TEXT NOT NULL,
    zona_trabajo TEXT,
    disponibilidad job_disponibilidad NOT NULL DEFAULT 'disponible',
    modalidad job_modalidad NOT NULL DEFAULT 'presencial',
    status profile_status NOT NULL DEFAULT 'activo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    icon TEXT,
    parent_id UUID REFERENCES public.categories(id) ON DELETE SET NULL
);

-- 3. PROFILE_CATEGORIES (M:N)
CREATE TABLE IF NOT EXISTS public.profile_categories (
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
    PRIMARY KEY (profile_id, category_id)
);

-- 4. SKILLS TABLE
CREATE TABLE IF NOT EXISTS public.skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL CHECK (char_length(trim(name)) > 0)
);

-- 5. SERVICES TABLE
CREATE TABLE IF NOT EXISTS public.services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    precio_orientativo TEXT
);

-- 6. CONTACT METHODS TABLE (Privacy by design with explicit consent)
CREATE TABLE IF NOT EXISTS public.contact_methods (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type contact_type NOT NULL,
    value TEXT NOT NULL,
    is_public BOOLEAN NOT NULL DEFAULT true,
    consent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. RECOMMENDATIONS TABLE
CREATE TABLE IF NOT EXISTS public.recommendations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    from_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    from_name TEXT NOT NULL,
    to_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    text TEXT NOT NULL CHECK (char_length(trim(text)) >= 10),
    context TEXT,
    status TEXT NOT NULL DEFAULT 'visible' CHECK (status IN ('visible', 'oculto', 'reportado')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. REPORTS TABLE
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason report_reason NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'revisado', 'resuelto')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_profiles_slug ON public.profiles(slug);
CREATE INDEX IF NOT EXISTS idx_profiles_provincia ON public.profiles(provincia);
CREATE INDEX IF NOT EXISTS idx_profiles_localidad ON public.profiles(localidad);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);
CREATE INDEX IF NOT EXISTS idx_contact_methods_profile ON public.contact_methods(profile_id);
CREATE INDEX IF NOT EXISTS idx_services_profile ON public.services(profile_id);
CREATE INDEX IF NOT EXISTS idx_skills_profile ON public.skills(profile_id);
CREATE INDEX IF NOT EXISTS idx_reports_profile ON public.reports(profile_id);

-- ==========================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==========================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profile_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Profiles: Public can read active profiles; owners can read/update their own
DROP POLICY IF EXISTS "Public read active profiles" ON public.profiles;
CREATE POLICY "Public read active profiles"
    ON public.profiles FOR SELECT
    USING (status = 'activo' OR auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Categories: Anyone can read categories
DROP POLICY IF EXISTS "Public read categories" ON public.categories;
CREATE POLICY "Public read categories"
    ON public.categories FOR SELECT
    USING (true);

-- Profile Categories: Anyone can read; owners can modify
DROP POLICY IF EXISTS "Public read profile_categories" ON public.profile_categories;
CREATE POLICY "Public read profile_categories"
    ON public.profile_categories FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Owner manage profile_categories" ON public.profile_categories;
CREATE POLICY "Owner manage profile_categories"
    ON public.profile_categories FOR ALL
    USING (auth.uid() = profile_id)
    WITH CHECK (auth.uid() = profile_id);

-- Skills: Anyone can read; owners can modify
DROP POLICY IF EXISTS "Public read skills" ON public.skills;
CREATE POLICY "Public read skills"
    ON public.skills FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Owner manage skills" ON public.skills;
CREATE POLICY "Owner manage skills"
    ON public.skills FOR ALL
    USING (auth.uid() = profile_id)
    WITH CHECK (auth.uid() = profile_id);

-- Services: Anyone can read; owners can modify
DROP POLICY IF EXISTS "Public read services" ON public.services;
CREATE POLICY "Public read services"
    ON public.services FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Owner manage services" ON public.services;
CREATE POLICY "Owner manage services"
    ON public.services FOR ALL
    USING (auth.uid() = profile_id)
    WITH CHECK (auth.uid() = profile_id);

-- Contact Methods: Only public if is_public = true AND profile is active; owner can read and edit all
DROP POLICY IF EXISTS "Public read public contact methods" ON public.contact_methods;
CREATE POLICY "Public read public contact methods"
    ON public.contact_methods FOR SELECT
    USING (
        (is_public = true AND EXISTS (
            SELECT 1 FROM public.profiles p WHERE p.id = contact_methods.profile_id AND p.status = 'activo'
        ))
        OR auth.uid() = profile_id
    );

DROP POLICY IF EXISTS "Owner manage contact methods" ON public.contact_methods;
CREATE POLICY "Owner manage contact methods"
    ON public.contact_methods FOR ALL
    USING (auth.uid() = profile_id)
    WITH CHECK (auth.uid() = profile_id);

-- Recommendations: Anyone can read visible recommendations
DROP POLICY IF EXISTS "Public read visible recommendations" ON public.recommendations;
CREATE POLICY "Public read visible recommendations"
    ON public.recommendations FOR SELECT
    USING (status = 'visible');

DROP POLICY IF EXISTS "Anyone can create recommendation" ON public.recommendations;
CREATE POLICY "Anyone can create recommendation"
    ON public.recommendations FOR INSERT
    WITH CHECK (true);

-- Reports: Anyone can submit a report; read and update only for administrators
DROP POLICY IF EXISTS "Anyone can submit report" ON public.reports;
CREATE POLICY "Anyone can submit report"
    ON public.reports FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can read all reports" ON public.reports;
CREATE POLICY "Admins can read all reports"
    ON public.reports FOR SELECT
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    );

DROP POLICY IF EXISTS "Admins can update reports" ON public.reports;
CREATE POLICY "Admins can update reports"
    ON public.reports FOR UPDATE
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    );

DROP POLICY IF EXISTS "Admins can update any profile" ON public.profiles;
CREATE POLICY "Admins can update any profile"
    ON public.profiles FOR UPDATE
    USING (
        (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' OR
        (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    );

-- Trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==========================================================
-- 9. JOB REQUESTS & BUDGETS TABLE (Pedidos y Presupuestos)
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.job_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    client_name TEXT NOT NULL,
    client_contact TEXT NOT NULL,
    client_location TEXT,
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    urgency TEXT NOT NULL DEFAULT 'esta_semana' CHECK (urgency IN ('urgente', 'esta_semana', 'proximos_dias', 'a_coordinar')),
    preferred_date TEXT,
    photos TEXT[] DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'solicitado' CHECK (status IN ('solicitado', 'presupuestado', 'aceptado', 'en_progreso', 'completado', 'cancelado')),
    budget_amount TEXT,
    budget_details TEXT,
    budget_estimated_time TEXT,
    budget_created_at TIMESTAMPTZ,
    cancel_reason TEXT,
    cancelled_by TEXT CHECK (cancelled_by IN ('cliente', 'profesional')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES FOR JOB REQUESTS
CREATE INDEX IF NOT EXISTS idx_job_requests_profile ON public.job_requests(profile_id);
CREATE INDEX IF NOT EXISTS idx_job_requests_client ON public.job_requests(client_id);
CREATE INDEX IF NOT EXISTS idx_job_requests_status ON public.job_requests(status);

-- RLS FOR JOB REQUESTS
ALTER TABLE public.job_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Clients read own requests" ON public.job_requests;
CREATE POLICY "Clients read own requests"
    ON public.job_requests FOR SELECT
    USING (auth.uid() = client_id);

DROP POLICY IF EXISTS "Pros read requests for their profile" ON public.job_requests;
CREATE POLICY "Pros read requests for their profile"
    ON public.job_requests FOR SELECT
    USING (auth.uid() = profile_id);

DROP POLICY IF EXISTS "Anyone can insert job request" ON public.job_requests;
CREATE POLICY "Anyone can insert job request"
    ON public.job_requests FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Clients and Pros update own job request" ON public.job_requests;
CREATE POLICY "Clients and Pros update own job request"
    ON public.job_requests FOR UPDATE
    USING (auth.uid() = client_id OR auth.uid() = profile_id)
    WITH CHECK (auth.uid() = client_id OR auth.uid() = profile_id);

DROP TRIGGER IF EXISTS set_job_requests_updated_at ON public.job_requests;
CREATE TRIGGER set_job_requests_updated_at
    BEFORE UPDATE ON public.job_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- ==========================================================
-- 10. PROFILES ENHANCEMENTS (WhatsApp verification & notifications)
-- ==========================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_verified_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_whatsapp BOOLEAN NOT NULL DEFAULT true;

-- ==========================================================
-- 11. ACCOUNT DELETIONS TABLE (Registro de bajas con motivos)
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.account_deletions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    user_email TEXT,
    profile_name TEXT NOT NULL,
    profile_slug TEXT NOT NULL,
    reason TEXT NOT NULL,
    explanation TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_account_deletions_created ON public.account_deletions(created_at DESC);

ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert account deletion" ON public.account_deletions;
CREATE POLICY "Anyone can insert account deletion"
    ON public.account_deletions FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view account deletions" ON public.account_deletions;
CREATE POLICY "Admins can view account deletions"
    ON public.account_deletions FOR SELECT
    USING (true);

-- ==========================================================
-- 12. NOTIFICATIONS TABLE (Campanita de avisos y alertas)
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'job' CHECK (type IN ('job', 'budget', 'status', 'review', 'system')),
    link TEXT,
    read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own notifications" ON public.notifications;
CREATE POLICY "Users can read their own notifications"
    ON public.notifications FOR SELECT
    USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
CREATE POLICY "Users can update their own notifications"
    ON public.notifications FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
CREATE POLICY "System can insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (true);

-- ==========================================================
-- 13. WHATSAPP VERIFICATION REQUESTS TABLE (Verificaciones reales)
-- ==========================================================
CREATE TABLE IF NOT EXISTS public.whatsapp_verification_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    profile_name TEXT NOT NULL,
    profile_slug TEXT NOT NULL,
    phone_declared TEXT NOT NULL,
    code TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aprobado', 'rechazado')),
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_verif_profile ON public.whatsapp_verification_requests(profile_id);
CREATE INDEX IF NOT EXISTS idx_wa_verif_status ON public.whatsapp_verification_requests(status);

ALTER TABLE public.whatsapp_verification_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert verification request" ON public.whatsapp_verification_requests;
CREATE POLICY "Anyone can insert verification request"
    ON public.whatsapp_verification_requests FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read verification requests" ON public.whatsapp_verification_requests;
CREATE POLICY "Anyone can read verification requests"
    ON public.whatsapp_verification_requests FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Admins and system can update verification requests" ON public.whatsapp_verification_requests;
CREATE POLICY "Admins and system can update verification requests"
    ON public.whatsapp_verification_requests FOR UPDATE
    USING (true);


