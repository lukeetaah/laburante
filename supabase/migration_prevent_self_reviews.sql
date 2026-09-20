-- ============================================================================
-- MIGRATION: Prevenir auto-reseñas en public.recommendations
-- ============================================================================
-- Asegura a nivel de base de datos que ningún usuario pueda redactar una
-- reseña o recomendación sobre su propio perfil público.

ALTER TABLE public.recommendations
  DROP CONSTRAINT IF EXISTS recommendations_prevent_self_review;

ALTER TABLE public.recommendations
  ADD CONSTRAINT recommendations_prevent_self_review
  CHECK (from_user_id IS NULL OR from_user_id <> to_profile_id);
