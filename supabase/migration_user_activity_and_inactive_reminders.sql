-- LABURANTE - Actividad real y recordatorios de usuarios inactivos
--
-- Aplicar después de migration_notifications_base.sql,
-- migration_email_notifications.sql y migration_production_hardening_v4.sql.
-- No usa last_sign_in_at: la actividad se registra desde la aplicación cuando
-- una persona autenticada abre LABURANTE, como máximo una vez cada 24 horas.

DO $$
BEGIN
  IF to_regclass('public.notifications') IS NULL
     OR to_regclass('public.notification_preferences') IS NULL
     OR to_regprocedure('public._insert_system_notification_internal(uuid,text,text,text,text)') IS NULL THEN
    RAISE EXCEPTION
      'Aplicá primero las migraciones de notifications, email_notifications y production_hardening_v4';
  END IF;
END;
$$;

CREATE TABLE IF NOT EXISTS public.user_activity (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  last_activity_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_activity_last_activity
  ON public.user_activity(last_activity_at);

ALTER TABLE public.user_activity ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.user_activity FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.user_activity TO service_role;
GRANT INSERT, UPDATE ON TABLE public.user_activity TO service_role;

-- La persona no puede enviar el user_id ni una fecha: ambos se derivan del JWT
-- y del reloj de la base. El límite de 24 horas también se impone en backend.
CREATE OR REPLACE FUNCTION public.touch_my_activity()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_touched BOOLEAN := FALSE;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated_activity';
  END IF;

  INSERT INTO public.user_activity (user_id, last_activity_at, created_at, updated_at)
  VALUES (v_user_id, NOW(), NOW(), NOW())
  ON CONFLICT (user_id) DO UPDATE
    SET last_activity_at = NOW(),
        updated_at = NOW()
    WHERE public.user_activity.last_activity_at <= NOW() - INTERVAL '24 hours'
  RETURNING TRUE INTO v_touched;

  RETURN COALESCE(v_touched, FALSE);
END;
$$;

REVOKE ALL ON FUNCTION public.touch_my_activity() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.touch_my_activity() TO authenticated;

CREATE TABLE IF NOT EXISTS public.inactive_user_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  activity_snapshot TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'skipped', 'failed')),
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_inactive_user_reminders_notification
  ON public.inactive_user_reminders(notification_id);
CREATE INDEX IF NOT EXISTS idx_inactive_user_reminders_user_created
  ON public.inactive_user_reminders(user_id, created_at DESC);

ALTER TABLE public.inactive_user_reminders ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.inactive_user_reminders FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.inactive_user_reminders TO service_role;

-- Reclama candidatos de forma segura frente a dos ejecuciones simultáneas.
-- Los perfiles incompletos quedan fuera: los procesa el flujo existente de
-- profile_completion_reminders y no reciben dos recordatorios distintos.
CREATE OR REPLACE FUNCTION public.process_inactive_user_reminders_batch(p_limit INTEGER DEFAULT 25)
RETURNS TABLE (
  reminder_id UUID,
  user_id UUID,
  notification_id UUID,
  email TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_rec RECORD;
  v_notification_id UUID;
  v_reminder_id UUID;
BEGIN
  IF p_limit IS NULL OR p_limit < 1 OR p_limit > 100 THEN
    RAISE EXCEPTION 'invalid_inactive_reminder_limit';
  END IF;

  FOR v_rec IN
    SELECT
      ua.user_id,
      ua.last_activity_at,
      u.email::TEXT AS email,
      p.slug
    FROM public.user_activity ua
    JOIN auth.users u ON u.id = ua.user_id
    JOIN public.profiles p ON p.id = ua.user_id
    LEFT JOIN public.notification_preferences np ON np.user_id = ua.user_id
    WHERE p.status = 'activo'
      AND u.email_confirmed_at IS NOT NULL
      AND COALESCE(u.raw_app_meta_data ->> 'role', '') <> 'admin'
      AND COALESCE(np.email_notifications_enabled, TRUE) = TRUE
      AND ua.last_activity_at <= NOW() - INTERVAL '30 days'
      -- Perfil completo: el lote específico de perfiles incompletos ya cubre
      -- los casos que necesitan completar datos antes de ser compartidos.
      AND trim(COALESCE(p.name, '')) <> ''
      AND trim(COALESCE(p.provincia, '')) <> ''
      AND trim(COALESCE(p.localidad, '')) <> ''
      AND EXISTS (
        SELECT 1 FROM public.contact_methods c
        WHERE c.profile_id = p.id AND trim(COALESCE(c.value, '')) <> ''
      )
      AND (
        p.intent = 'buscar'
        OR EXISTS (SELECT 1 FROM public.skills s WHERE s.profile_id = p.id)
        OR EXISTS (SELECT 1 FROM public.services s WHERE s.profile_id = p.id)
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.inactive_user_reminders r
        WHERE r.user_id = ua.user_id
          AND r.created_at > NOW() - INTERVAL '90 days'
          AND (
            r.status IN ('sent', 'skipped')
            OR (r.status = 'queued' AND r.created_at > NOW() - INTERVAL '15 minutes')
          )
      )
    ORDER BY ua.last_activity_at ASC
    LIMIT p_limit
    FOR UPDATE OF ua SKIP LOCKED
  LOOP
    v_notification_id := public._insert_system_notification_internal(
      v_rec.user_id,
      '¿Querés volver a activar tu perfil?',
      'Revisá tus servicios y datos, y compartí tu perfil desde LABURANTE para que puedan encontrarte nuevamente.',
      format('/p/%s', v_rec.slug),
      format('inactive_profile_%s_%s', v_rec.user_id, to_char(NOW(), 'YYYY_MM_DD_HH24_MI'))
    );

    INSERT INTO public.inactive_user_reminders (
      user_id,
      notification_id,
      activity_snapshot,
      status
    )
    VALUES (
      v_rec.user_id,
      v_notification_id,
      v_rec.last_activity_at,
      'queued'
    )
    RETURNING id INTO v_reminder_id;

    reminder_id := v_reminder_id;
    user_id := v_rec.user_id;
    notification_id := v_notification_id;
    email := v_rec.email;
    RETURN NEXT;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.process_inactive_user_reminders_batch(INTEGER) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.process_inactive_user_reminders_batch(INTEGER) TO service_role;
