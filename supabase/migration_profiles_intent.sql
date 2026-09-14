-- Intencion declarada durante el registro.
-- La columna queda nullable para conservar perfiles historicos ambiguos.
-- Esta migracion debe ejecutarse desde el SQL Editor de Supabase.

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

-- Backfill conservador e idempotente:
-- solo copia una declaracion exacta ya existente en auth.users metadata.
-- No clasifica por status, skills, servicios, completitud ni fechas.
UPDATE public.profiles AS p
SET intent = u.raw_user_meta_data ->> 'intent'
FROM auth.users AS u
WHERE p.id = u.id
  AND p.intent IS NULL
  AND u.raw_user_meta_data ->> 'intent' IN ('buscar', 'ofrecer', 'ambas');
