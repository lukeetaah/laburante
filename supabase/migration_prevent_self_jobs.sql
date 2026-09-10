-- A user must never be able to create or mutate a request addressed to their own profile.
CREATE OR REPLACE FUNCTION public.prevent_self_job_request()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.client_id IS NOT NULL AND NEW.client_id = NEW.profile_id THEN
    RAISE EXCEPTION 'self_job_request_not_allowed';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_self_job_request_trigger ON public.job_requests;
CREATE TRIGGER prevent_self_job_request_trigger
  BEFORE INSERT OR UPDATE OF client_id, profile_id ON public.job_requests
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_job_request();
