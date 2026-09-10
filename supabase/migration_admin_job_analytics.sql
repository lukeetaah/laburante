-- Allow the administrator dashboard to read operational aggregates from job requests.
DROP POLICY IF EXISTS "Admins can read job request analytics" ON public.job_requests;
CREATE POLICY "Admins can read job request analytics"
  ON public.job_requests FOR SELECT
  USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
    OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );
