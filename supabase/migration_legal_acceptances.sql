-- Migración: Evidencia persistente de aceptación legal y declaración de mayoría de edad (18+)
-- Fecha: Octubre 2026
-- Descripción:
--   Crea la tabla public.legal_acceptances para registrar la evidencia inmutable
--   de aceptación de Términos y Condiciones y declaración de mayoría de edad (18+),
--   con timestamps de servidor (NOW()) y políticas RLS protegidas.

CREATE TABLE IF NOT EXISTS public.legal_acceptances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  terms_version text NOT NULL,
  is_of_legal_age boolean NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT legal_acceptances_user_version_key UNIQUE (user_id, terms_version),
  CONSTRAINT legal_acceptances_must_be_of_legal_age CHECK (is_of_legal_age = true)
);

-- Índices de consulta rápida
CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user_version 
  ON public.legal_acceptances(user_id, terms_version);

CREATE INDEX IF NOT EXISTS idx_legal_acceptances_user_accepted_at 
  ON public.legal_acceptances(user_id, accepted_at DESC);

-- Habilitar Row Level Security (RLS)
ALTER TABLE public.legal_acceptances ENABLE ROW LEVEL SECURITY;

-- Políticas RLS (Idempotentes):
-- 1. El usuario autenticado puede leer sus propias aceptaciones
DROP POLICY IF EXISTS "Users can read own legal acceptances" ON public.legal_acceptances;
CREATE POLICY "Users can read own legal acceptances"
  ON public.legal_acceptances
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. El usuario autenticado puede registrar su aceptación para sí mismo
DROP POLICY IF EXISTS "Users can insert own legal acceptances" ON public.legal_acceptances;
CREATE POLICY "Users can insert own legal acceptances"
  ON public.legal_acceptances
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id 
    AND is_of_legal_age = true
  );

-- 3. Protección inmutable: No se permite UPDATE ni DELETE a usuarios ordinarios
-- (No se definen políticas de UPDATE/DELETE para authenticated, garantizando inmutabilidad)

-- 4. Administradores pueden auditar aceptaciones
DROP POLICY IF EXISTS "Admins can view all legal acceptances" ON public.legal_acceptances;
CREATE POLICY "Admins can view all legal acceptances"
  ON public.legal_acceptances
  FOR SELECT
  TO authenticated
  USING (
    COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

-- Comentario explicativo en la tabla
COMMENT ON TABLE public.legal_acceptances IS 
  'Evidencia inmutable de aceptación de Términos y Condiciones y declaración de mayoría de edad (18+), sin almacenar fecha de nacimiento ni DNI.';
