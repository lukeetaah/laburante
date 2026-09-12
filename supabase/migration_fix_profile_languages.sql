-- Keep the language level validation aligned with the profile editor.
ALTER TABLE public.profile_languages
  DROP CONSTRAINT IF EXISTS profile_languages_level_check;

ALTER TABLE public.profile_languages
  ADD CONSTRAINT profile_languages_level_check
  CHECK (level IN ('basico', 'intermedio', 'avanzado', 'bilingue', 'nativo'));
