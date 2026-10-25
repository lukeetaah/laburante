-- Non-destructive guard for profile location.
-- Existing incomplete historical rows remain untouched and can be completed by
-- their owners; new rows, location changes and activations require both fields.
CREATE OR REPLACE FUNCTION public.validate_profile_location_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  IF TG_OP = 'INSERT'
     OR (
       TG_OP = 'UPDATE'
       AND (
         NEW.provincia IS DISTINCT FROM OLD.provincia
         OR NEW.localidad IS DISTINCT FROM OLD.localidad
         OR (
           NEW.status IS DISTINCT FROM OLD.status
           AND NEW.status = 'activo'
         )
       )
     ) THEN
    IF NULLIF(trim(COALESCE(NEW.provincia, '')), '') IS NULL
       OR NULLIF(trim(COALESCE(NEW.localidad, '')), '') IS NULL THEN
      RAISE EXCEPTION 'profile_location_required'
        USING ERRCODE = '23514', DETAIL = 'provincia y localidad son obligatorias';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid = 'public.profiles'::regclass
      AND tgname = 'profiles_require_location_on_write'
  ) THEN
    CREATE TRIGGER profiles_require_location_on_write
    BEFORE INSERT OR UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.validate_profile_location_fields();
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

