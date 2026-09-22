-- Migración: Restricción de solicitud única pendiente de WhatsApp y endurecimiento de RLS
-- Idempotente, no destructiva, preserva historial existente.

-- 1. Deduplicación preventiva de solicitudes en estado 'pendiente' (si existieran duplicados simultáneos):
-- Se conserva la más reciente y las más antiguas se actualizan a 'rechazado' para no perder historial de auditoría.
UPDATE public.whatsapp_verification_requests
SET status = 'rechazado'
WHERE status = 'pendiente'
  AND id NOT IN (
    SELECT DISTINCT ON (profile_id) id
    FROM public.whatsapp_verification_requests
    WHERE status = 'pendiente'
    ORDER BY profile_id, created_at DESC
  );

-- 2. Índice único parcial: un perfil solo puede tener UNA solicitud en estado 'pendiente' a la vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_pending_wa_request
ON public.whatsapp_verification_requests (profile_id)
WHERE status = 'pendiente';

-- 3. Endurecimiento de Row Level Security (RLS)
ALTER TABLE public.whatsapp_verification_requests ENABLE ROW LEVEL SECURITY;

-- Limpieza de políticas antiguas permisivas
DROP POLICY IF EXISTS "Anyone can insert verification request" ON public.whatsapp_verification_requests;
DROP POLICY IF EXISTS "Anyone can read verification requests" ON public.whatsapp_verification_requests;
DROP POLICY IF EXISTS "Admins and system can update verification requests" ON public.whatsapp_verification_requests;
DROP POLICY IF EXISTS "Users can insert own verification request" ON public.whatsapp_verification_requests;
DROP POLICY IF EXISTS "Users read own or admins read all verification requests" ON public.whatsapp_verification_requests;
DROP POLICY IF EXISTS "Only admins can update verification requests" ON public.whatsapp_verification_requests;

-- Nuevas políticas estrictas
-- Lectura: Solo el dueño del perfil o un administrador pueden ver la solicitud
CREATE POLICY "Users read own or admins read all verification requests"
  ON public.whatsapp_verification_requests FOR SELECT
  USING (
    auth.uid() = profile_id
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Inserción: Solo el usuario autenticado para su propio perfil
CREATE POLICY "Users can insert own verification request"
  ON public.whatsapp_verification_requests FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND auth.uid() = profile_id
  );

-- Modificación/Resolución: Solo administradores
CREATE POLICY "Only admins can update verification requests"
  ON public.whatsapp_verification_requests FOR UPDATE
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  )
  WITH CHECK (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
