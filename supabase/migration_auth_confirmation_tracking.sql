-- Migración: Seguimiento de confirmaciones de cuenta y registros pendientes
-- Idempotente, aditiva y con funciones SECURITY DEFINER con verificación estricta de rol admin.

CREATE TABLE IF NOT EXISTS public.account_confirmation_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  initial_sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resend_count INTEGER NOT NULL DEFAULT 0,
  last_resend_at TIMESTAMPTZ,
  reminder_1_sent_at TIMESTAMPTZ,
  reminder_2_sent_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'recordatorio_1', 'recordatorio_2', 'confirmado', 'limpieza_programada', 'eliminado_por_abandono', 'excluido_actividad')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tracking_user_id ON public.account_confirmation_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_tracking_status ON public.account_confirmation_tracking(status);
CREATE INDEX IF NOT EXISTS idx_tracking_email ON public.account_confirmation_tracking(email);

ALTER TABLE public.account_confirmation_tracking ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own tracking" ON public.account_confirmation_tracking;
CREATE POLICY "Users read own tracking"
  ON public.account_confirmation_tracking FOR SELECT
  USING (auth.uid() = user_id OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins manage tracking" ON public.account_confirmation_tracking;
CREATE POLICY "Admins manage tracking"
  ON public.account_confirmation_tracking FOR ALL
  USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Función para consultar en tiempo real las cuentas no confirmadas desde el panel de administración
CREATE OR REPLACE FUNCTION public.admin_get_unconfirmed_registrations()
RETURNS TABLE (
  user_id UUID,
  email VARCHAR(255),
  name TEXT,
  created_at TIMESTAMPTZ,
  days_elapsed INTEGER,
  email_confirmed_at TIMESTAMPTZ,
  confirmation_sent_at TIMESTAMPTZ,
  resend_count INTEGER,
  last_resend_at TIMESTAMPTZ,
  reminder_1_sent_at TIMESTAMPTZ,
  reminder_2_sent_at TIMESTAMPTZ,
  status TEXT,
  has_activity BOOLEAN,
  activity_details TEXT,
  scheduled_cleanup_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'Solo administradores pueden consultar registros pendientes';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::VARCHAR(255) AS email,
    COALESCE(p.name, (u.raw_user_meta_data ->> 'name'), split_part(u.email, '@', 1))::TEXT AS name,
    u.created_at,
    EXTRACT(DAY FROM (NOW() - u.created_at))::INTEGER AS days_elapsed,
    u.email_confirmed_at,
    u.confirmation_sent_at,
    COALESCE(t.resend_count, 0) AS resend_count,
    t.last_resend_at,
    t.reminder_1_sent_at,
    t.reminder_2_sent_at,
    CASE
      WHEN u.email_confirmed_at IS NOT NULL THEN 'confirmado'
      WHEN EXTRACT(DAY FROM (NOW() - u.created_at)) >= 21 AND (
        EXISTS (SELECT 1 FROM public.recommendations r WHERE r.from_user_id = u.id OR r.to_profile_id = u.id)
        OR EXISTS (SELECT 1 FROM public.job_requests j WHERE j.client_id = u.id OR j.profile_id = u.id)
        OR EXISTS (SELECT 1 FROM public.reports rep WHERE rep.reporter_id = u.id OR rep.profile_id = u.id)
        OR EXISTS (SELECT 1 FROM public.whatsapp_verification_requests w WHERE w.profile_id = u.id AND w.status = 'aprobado')
        OR COALESCE(u.raw_app_meta_data ->> 'role', '') = 'admin'
      ) THEN 'excluido_actividad'
      WHEN EXTRACT(DAY FROM (NOW() - u.created_at)) >= 21 THEN 'limpieza_programada'
      WHEN t.reminder_2_sent_at IS NOT NULL OR EXTRACT(DAY FROM (NOW() - u.created_at)) >= 14 THEN 'recordatorio_2'
      WHEN t.reminder_1_sent_at IS NOT NULL OR EXTRACT(DAY FROM (NOW() - u.created_at)) >= 7 THEN 'recordatorio_1'
      ELSE 'pendiente'
    END::TEXT AS status,
    (
      EXISTS (SELECT 1 FROM public.recommendations r WHERE r.from_user_id = u.id OR r.to_profile_id = u.id)
      OR EXISTS (SELECT 1 FROM public.job_requests j WHERE j.client_id = u.id OR j.profile_id = u.id)
      OR EXISTS (SELECT 1 FROM public.reports rep WHERE rep.reporter_id = u.id OR rep.profile_id = u.id)
      OR EXISTS (SELECT 1 FROM public.whatsapp_verification_requests w WHERE w.profile_id = u.id AND w.status = 'aprobado')
      OR COALESCE(u.raw_app_meta_data ->> 'role', '') = 'admin'
    ) AS has_activity,
    CASE
      WHEN COALESCE(u.raw_app_meta_data ->> 'role', '') = 'admin' THEN 'Rol Administrador'
      WHEN EXISTS (SELECT 1 FROM public.whatsapp_verification_requests w WHERE w.profile_id = u.id AND w.status = 'aprobado') THEN 'WhatsApp verificado'
      WHEN EXISTS (SELECT 1 FROM public.job_requests j WHERE j.client_id = u.id OR j.profile_id = u.id) THEN 'Pedidos o solicitudes registradas'
      WHEN EXISTS (SELECT 1 FROM public.recommendations r WHERE r.from_user_id = u.id OR r.to_profile_id = u.id) THEN 'Reseñas emitidas o recibidas'
      ELSE 'Sin actividad detectada'
    END::TEXT AS activity_details,
    (u.created_at + INTERVAL '21 days') AS scheduled_cleanup_at
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.account_confirmation_tracking t ON t.user_id = u.id
  WHERE u.email_confirmed_at IS NULL
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_unconfirmed_registrations() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_unconfirmed_registrations() TO authenticated;

-- Función de revisión o limpieza segura de registros abandonados (solo en modo dry_run en esta etapa)
CREATE OR REPLACE FUNCTION public.admin_cleanup_abandoned_accounts(dry_run BOOLEAN DEFAULT true)
RETURNS TABLE (
  user_id UUID,
  email VARCHAR(255),
  name TEXT,
  days_elapsed INTEGER,
  reason TEXT,
  action_taken TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  rec RECORD;
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador puede ejecutar la revisión de cuentas abandonadas';
  END IF;

  FOR rec IN
    SELECT
      u.id,
      u.email::VARCHAR(255) as email,
      COALESCE(p.name, (u.raw_user_meta_data ->> 'name'), split_part(u.email, '@', 1))::TEXT AS name,
      EXTRACT(DAY FROM (NOW() - u.created_at))::INTEGER AS days_elapsed
    FROM auth.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE u.email_confirmed_at IS NULL
      AND u.created_at <= (NOW() - INTERVAL '21 days')
      AND NOT (
        EXISTS (SELECT 1 FROM public.recommendations r WHERE r.from_user_id = u.id OR r.to_profile_id = u.id)
        OR EXISTS (SELECT 1 FROM public.job_requests j WHERE j.client_id = u.id OR j.profile_id = u.id)
        OR EXISTS (SELECT 1 FROM public.reports rep WHERE rep.reporter_id = u.id OR rep.profile_id = u.id)
        OR EXISTS (SELECT 1 FROM public.whatsapp_verification_requests w WHERE w.profile_id = u.id AND w.status = 'aprobado')
        OR COALESCE(u.raw_app_meta_data ->> 'role', '') = 'admin'
      )
  LOOP
    user_id := rec.id;
    email := rec.email;
    name := rec.name;
    days_elapsed := rec.days_elapsed;
    reason := 'registro_abandonado_sin_confirmar';

    IF dry_run THEN
      action_taken := 'SIMULACION_NO_ELIMINADO (dry_run activo)';
      RETURN NEXT;
    ELSE
      -- Preservación absoluta: no borramos usuarios reales hasta autorización final
      action_taken := 'SIMULACION_PREVENTIVA (eliminación real bloqueada en esta etapa)';
      RETURN NEXT;
    END IF;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_cleanup_abandoned_accounts(BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_cleanup_abandoned_accounts(BOOLEAN) TO authenticated;
