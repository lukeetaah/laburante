-- Un pedido de presupuesto debe tener una cuenta responsable para poder
-- seguirlo y notificar a ambas partes.
DROP POLICY IF EXISTS "Anyone can insert job request" ON public.job_requests;
DROP POLICY IF EXISTS "Authenticated clients can insert job request" ON public.job_requests;
CREATE POLICY "Authenticated clients can insert job request"
  ON public.job_requests FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = client_id);

-- La campanita intenta actualizarse en tiempo real; si la publicación ya
-- contiene la tabla, el bloque es idempotente.
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
