-- Reseñas: llegan pendientes y solo se publican tras revisión del titular.
ALTER TABLE public.recommendations DROP CONSTRAINT IF EXISTS recommendations_status_check;
ALTER TABLE public.recommendations
  ALTER COLUMN status SET DEFAULT 'pendiente';
ALTER TABLE public.recommendations
  ADD CONSTRAINT recommendations_status_check CHECK (status IN ('pendiente', 'visible', 'oculto', 'reportado'));

DROP POLICY IF EXISTS "Public read visible recommendations" ON public.recommendations;
CREATE POLICY "Public read visible recommendations"
  ON public.recommendations FOR SELECT
  USING (status = 'visible');

DROP POLICY IF EXISTS "Owners and authors can read recommendations" ON public.recommendations;
CREATE POLICY "Owners and authors can read recommendations"
  ON public.recommendations FOR SELECT
  USING (auth.uid() = to_profile_id OR auth.uid() = from_user_id);

DROP POLICY IF EXISTS "Owners and authors can update recommendations" ON public.recommendations;
CREATE POLICY "Owners and authors can update recommendations"
  ON public.recommendations FOR UPDATE
  USING (auth.uid() = to_profile_id OR auth.uid() = from_user_id)
  WITH CHECK (auth.uid() = to_profile_id OR auth.uid() = from_user_id);

DROP POLICY IF EXISTS "Authors can delete recommendations" ON public.recommendations;
CREATE POLICY "Authors can delete recommendations"
  ON public.recommendations FOR DELETE
  USING (auth.uid() = from_user_id);
