-- Security hardening kept separate from the product feature migration.
-- The function is used by existing triggers and does not need caller search_path.
ALTER FUNCTION public.handle_updated_at()
  SET search_path = pg_catalog;

