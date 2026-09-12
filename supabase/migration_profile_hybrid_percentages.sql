-- Optional percentages for hybrid work modality.
-- Existing profiles keep their current modalidad and NULL percentages.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hybrid_presencial_pct SMALLINT,
  ADD COLUMN IF NOT EXISTS hybrid_remoto_pct SMALLINT;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_hybrid_percentages_valid;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_hybrid_percentages_valid CHECK (
    (hybrid_presencial_pct IS NULL AND hybrid_remoto_pct IS NULL)
    OR (
      hybrid_presencial_pct BETWEEN 0 AND 100
      AND hybrid_remoto_pct BETWEEN 0 AND 100
      AND hybrid_presencial_pct + hybrid_remoto_pct = 100
      AND modalidad = 'ambas'
    )
  );
