-- Intencion declarada durante el registro, sin alterar perfiles existentes.
-- La columna queda nullable para conservar compatibilidad con perfiles historicos.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS intent TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_intent_valid'
  ) THEN
      ALTER TABLE public.profiles
        ADD CONSTRAINT profiles_intent_valid
        CHECK (intent IS NULL OR intent IN ('buscar', 'ofrecer', 'ambas'));
  END IF;
END $$;
