-- LABURANTE: email transaccional opcional para notificaciones existentes.
-- Aditiva y no destructiva. Aplicar manualmente después de revisar.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS created_by UUID
  REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

-- migration_notifications_base.sql crea estos indices junto con la tabla.
-- Se conservan las columnas IF NOT EXISTS para compatibilidad con una base
-- que hubiera recibido solamente la tabla anterior.

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_notifications_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users read own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users read own notification preferences"
  ON public.notification_preferences FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users insert own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users insert own notification preferences"
  ON public.notification_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users update own notification preferences" ON public.notification_preferences;
CREATE POLICY "Users update own notification preferences"
  ON public.notification_preferences FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON TABLE public.notification_preferences FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE public.notification_preferences TO authenticated;

CREATE TABLE IF NOT EXISTS public.notification_email_deliveries (
  notification_id UUID PRIMARY KEY REFERENCES public.notifications(id) ON DELETE CASCADE,
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('processing', 'sent', 'skipped', 'failed')),
  resend_id TEXT,
  error_code TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notification_email_deliveries_sent_at
  ON public.notification_email_deliveries(sent_at);

ALTER TABLE public.notification_email_deliveries ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.notification_email_deliveries FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.claim_notification_email_delivery(
  notification_id_value UUID,
  recipient_user_id_value UUID
)
RETURNS TABLE (claimed BOOLEAN, status TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  current_status TEXT;
BEGIN
  INSERT INTO public.notification_email_deliveries (
    notification_id,
    recipient_user_id,
    status,
    error_code,
    resend_id,
    sent_at,
    updated_at
  )
  VALUES (
    notification_id_value,
    recipient_user_id_value,
    'processing',
    NULL,
    NULL,
    NULL,
    NOW()
  )
  ON CONFLICT (notification_id) DO UPDATE
    SET status = 'processing',
        recipient_user_id = EXCLUDED.recipient_user_id,
        error_code = NULL,
        resend_id = NULL,
        sent_at = NULL,
        updated_at = NOW()
  WHERE public.notification_email_deliveries.status = 'failed'
     OR (
       public.notification_email_deliveries.status = 'processing'
       AND public.notification_email_deliveries.updated_at < NOW() - INTERVAL '15 minutes'
     )
  RETURNING public.notification_email_deliveries.status INTO current_status;

  IF FOUND THEN
    RETURN QUERY SELECT TRUE, current_status;
    RETURN;
  END IF;

  SELECT delivery.status
    INTO current_status
    FROM public.notification_email_deliveries AS delivery
   WHERE delivery.notification_id = notification_id_value;

  RETURN QUERY SELECT FALSE, current_status;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_notification_email_delivery(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.claim_notification_email_delivery(UUID, UUID) TO service_role;

CREATE TABLE IF NOT EXISTS public.notification_email_rate_limit (
  id BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (id = TRUE),
  daily_window_start DATE NOT NULL DEFAULT CURRENT_DATE,
  daily_sent_count INTEGER NOT NULL DEFAULT 0 CHECK (daily_sent_count >= 0),
  monthly_window_start DATE NOT NULL DEFAULT DATE_TRUNC('month', CURRENT_DATE)::DATE,
  monthly_sent_count INTEGER NOT NULL DEFAULT 0 CHECK (monthly_sent_count >= 0)
);

INSERT INTO public.notification_email_rate_limit (id)
VALUES (TRUE)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.notification_email_rate_limit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.notification_email_rate_limit FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.reserve_notification_email_quota(
  daily_limit_value INTEGER,
  monthly_limit_value INTEGER
)
RETURNS TABLE (allowed BOOLEAN, reason TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  current_day DATE := CURRENT_DATE;
  current_month DATE := DATE_TRUNC('month', CURRENT_DATE)::DATE;
  current_daily_count INTEGER;
  current_monthly_count INTEGER;
BEGIN
  IF daily_limit_value <= 0 OR monthly_limit_value <= 0 THEN
    RETURN QUERY SELECT FALSE, 'invalid_limit'::TEXT;
    RETURN;
  END IF;

  SELECT daily_sent_count, monthly_sent_count
    INTO current_daily_count, current_monthly_count
    FROM public.notification_email_rate_limit
   WHERE id = TRUE
   FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO public.notification_email_rate_limit (id)
    VALUES (TRUE)
    ON CONFLICT (id) DO NOTHING;

    SELECT daily_sent_count, monthly_sent_count
      INTO current_daily_count, current_monthly_count
      FROM public.notification_email_rate_limit
     WHERE id = TRUE
     FOR UPDATE;
  END IF;

  UPDATE public.notification_email_rate_limit
     SET daily_window_start = CASE WHEN daily_window_start = current_day THEN daily_window_start ELSE current_day END,
         daily_sent_count = CASE WHEN daily_window_start = current_day THEN daily_sent_count ELSE 0 END,
         monthly_window_start = CASE WHEN monthly_window_start = current_month THEN monthly_window_start ELSE current_month END,
         monthly_sent_count = CASE WHEN monthly_window_start = current_month THEN monthly_sent_count ELSE 0 END
   WHERE id = TRUE;

  SELECT daily_sent_count, monthly_sent_count
    INTO current_daily_count, current_monthly_count
    FROM public.notification_email_rate_limit
   WHERE id = TRUE;

  IF current_monthly_count >= monthly_limit_value THEN
    RETURN QUERY SELECT FALSE, 'monthly_limit'::TEXT;
    RETURN;
  END IF;

  IF current_daily_count >= daily_limit_value THEN
    RETURN QUERY SELECT FALSE, 'daily_limit'::TEXT;
    RETURN;
  END IF;

  UPDATE public.notification_email_rate_limit
     SET daily_sent_count = daily_sent_count + 1,
         monthly_sent_count = monthly_sent_count + 1
   WHERE id = TRUE;

  RETURN QUERY SELECT TRUE, NULL::TEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_notification_email_quota(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_notification_email_quota(INTEGER, INTEGER) TO service_role;
