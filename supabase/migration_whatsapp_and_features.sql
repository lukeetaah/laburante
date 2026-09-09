-- ==========================================================
-- LABURANTE: MIGRACIÓN DE VERIFICACIONES DE WHATSAPP, NOTIFICACIONES Y BAJAS
-- Ejecutar este bloque completo en Supabase SQL Editor:
-- https://supabase.com/dashboard/project/gmctzgrzwagtsnfkdbte/sql
-- ==========================================================

-- 1. Asegurar columnas en la tabla profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS whatsapp_verified_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_whatsapp BOOLEAN DEFAULT FALSE;

-- 2. Tabla de solicitudes de verificación de WhatsApp (persistente y visible para admin en cualquier sesión)
CREATE TABLE IF NOT EXISTS public.whatsapp_verification_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID NOT NULL,
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

-- 3. Tabla de registro de bajas voluntarias de cuentas
CREATE TABLE IF NOT EXISTS public.account_deletions (
    id TEXT PRIMARY KEY,
    user_id UUID,
    user_email TEXT,
    profile_name TEXT NOT NULL,
    profile_slug TEXT NOT NULL,
    reason TEXT NOT NULL,
    explanation TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.account_deletions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can insert deletion" ON public.account_deletions;
CREATE POLICY "Anyone can insert deletion"
    ON public.account_deletions FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can read deletions" ON public.account_deletions;
CREATE POLICY "Anyone can read deletions"
    ON public.account_deletions FOR SELECT
    USING (true);

-- 4. Tabla de notificaciones in-app
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'system',
    link TEXT,
    read BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read notifications" ON public.notifications;
CREATE POLICY "Anyone can read notifications"
    ON public.notifications FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Anyone can insert notifications" ON public.notifications;
CREATE POLICY "Anyone can insert notifications"
    ON public.notifications FOR INSERT
    WITH CHECK (true);

DROP POLICY IF EXISTS "Anyone can update notifications" ON public.notifications;
CREATE POLICY "Anyone can update notifications"
    ON public.notifications FOR UPDATE
    USING (true);
