-- LABURANTE: tabla base y creacion server-side de notificaciones.
-- Aplicar despues de las migraciones que crean las tablas de negocio usadas
-- por las RPC y antes de migration_email_notifications.sql.

DO $$
BEGIN
  IF to_regclass('auth.users') IS NULL THEN
    RAISE EXCEPTION 'Falta auth.users';
  END IF;

  IF to_regprocedure('gen_random_uuid()') IS NULL THEN
    RAISE EXCEPTION 'Falta gen_random_uuid()';
  END IF;

  IF to_regclass('public.job_requests') IS NULL
     OR to_regclass('public.company_candidate_inquiries') IS NULL
     OR to_regclass('public.company_opportunities') IS NULL
     OR to_regclass('public.company_opportunity_shares') IS NULL
     OR to_regclass('public.recommendations') IS NULL
     OR to_regclass('public.whatsapp_verification_requests') IS NULL
     OR to_regclass('public.profiles') IS NULL THEN
    RAISE EXCEPTION 'Faltan tablas de negocio requeridas por las RPC de notifications';
  END IF;

  IF NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'company_opportunities'
       AND column_name = 'budget_amount'
  ) OR NOT EXISTS (
    SELECT 1
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'profiles'
       AND column_name = 'profile_completion_reminder_sent_at'
  ) THEN
    RAISE EXCEPTION 'Faltan columnas requeridas por las RPC de notifications';
  END IF;

END;
$$;

DO $$
BEGIN
  IF to_regclass('public.notifications') IS NULL THEN
    CREATE TABLE public.notifications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL CONSTRAINT notifications_user_id_auth_fkey REFERENCES auth.users(id) ON DELETE CASCADE,
        created_by UUID CONSTRAINT notifications_created_by_auth_fkey REFERENCES auth.users(id) ON DELETE SET NULL,
        dedupe_key TEXT,
        title TEXT NOT NULL CONSTRAINT notifications_title_length_check CHECK (char_length(trim(title)) BETWEEN 1 AND 180),
        message TEXT NOT NULL CONSTRAINT notifications_message_length_check CHECK (char_length(trim(message)) BETWEEN 1 AND 4000),
        type TEXT NOT NULL DEFAULT 'job' CONSTRAINT notifications_type_check CHECK (type IN ('job', 'budget', 'status', 'review', 'system')),
        link TEXT,
        read BOOLEAN NOT NULL DEFAULT false,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  ELSE
    ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS created_by UUID;
    ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS dedupe_key TEXT;
    ALTER TABLE public.notifications ALTER COLUMN type SET DEFAULT 'job';
    ALTER TABLE public.notifications ALTER COLUMN read SET DEFAULT false;
    ALTER TABLE public.notifications ALTER COLUMN created_at SET DEFAULT NOW();
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.notifications'::regclass
       AND conname = 'notifications_user_id_auth_fkey'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_user_id_auth_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.notifications'::regclass
       AND conname = 'notifications_created_by_auth_fkey'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_created_by_auth_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.notifications'::regclass
       AND conname = 'notifications_title_length_check'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_title_length_check
      CHECK (char_length(trim(title)) BETWEEN 1 AND 180) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.notifications'::regclass
       AND conname = 'notifications_message_length_check'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_message_length_check
      CHECK (char_length(trim(message)) BETWEEN 1 AND 4000) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.notifications'::regclass
       AND conname = 'notifications_type_check'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_type_check
      CHECK (type IN ('job', 'budget', 'status', 'review', 'system')) NOT VALID;
  END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_by ON public.notifications(created_by);
CREATE UNIQUE INDEX IF NOT EXISTS idx_notifications_dedupe_key
  ON public.notifications(dedupe_key)
  WHERE dedupe_key IS NOT NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  policy_record RECORD;
BEGIN
  FOR policy_record IN
    SELECT policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename = 'notifications'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.notifications', policy_record.policyname);
  END LOOP;
END;
$$;

REVOKE ALL ON TABLE public.notifications FROM PUBLIC;
REVOKE ALL ON TABLE public.notifications FROM anon;
REVOKE ALL ON TABLE public.notifications FROM authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE (read) ON public.notifications TO authenticated;

CREATE POLICY "Users can read their own notifications"
    ON public.notifications FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification state"
    ON public.notifications FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public._insert_notification_server(
  target_user_id UUID,
  actor_user_id UUID,
  notification_type TEXT,
  notification_title TEXT,
  notification_message TEXT,
  notification_link TEXT,
  notification_dedupe_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  notification_id UUID;
BEGIN
  IF actor_user_id IS NULL OR actor_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Actor de notification invalido';
  END IF;

  IF target_user_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM auth.users WHERE id = target_user_id
  ) THEN
    RAISE EXCEPTION 'Destinatario de notification invalido';
  END IF;

  IF notification_type NOT IN ('job', 'budget', 'status', 'review', 'system') THEN
    RAISE EXCEPTION 'Tipo de notification invalido';
  END IF;

  INSERT INTO public.notifications (
    user_id, created_by, dedupe_key, title, message, type, link
  )
  VALUES (
    target_user_id,
    actor_user_id,
    notification_dedupe_key,
    notification_title,
    notification_message,
    notification_type,
    notification_link
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO notification_id;

  IF notification_id IS NULL THEN
    SELECT id
      INTO notification_id
      FROM public.notifications
     WHERE dedupe_key = notification_dedupe_key;
  END IF;

  RETURN notification_id;
END;
$$;

REVOKE ALL ON FUNCTION public._insert_notification_server(
  UUID, UUID, TEXT, TEXT, TEXT, TEXT, TEXT
) FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.notify_job_request(
  target_job_request_id UUID,
  event_name TEXT,
  recipient_role TEXT DEFAULT NULL,
  operation_marker TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  actor_id UUID := auth.uid();
  job RECORD;
  recipient_id UUID;
  notification_type TEXT;
  notification_title TEXT;
  notification_message TEXT;
  notification_link TEXT;
  dedupe_key TEXT;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF operation_marker IS NULL THEN
    RAISE EXCEPTION 'Falta el marcador de la operacion';
  END IF;

  SELECT j.*, p.name AS professional_name
    INTO job
    FROM public.job_requests AS j
    LEFT JOIN public.profiles AS p ON p.id = j.profile_id
   WHERE j.id = target_job_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pedido inexistente';
  END IF;

  IF event_name = 'created' THEN
    IF actor_id <> job.client_id THEN
      RAISE EXCEPTION 'Solo el cliente puede notificar la creacion del pedido';
    END IF;

    IF job.status <> 'solicitado' THEN
      RAISE EXCEPTION 'El pedido no esta en estado de creacion';
    END IF;

    IF job.created_at <> operation_marker THEN
      RAISE EXCEPTION 'El marcador no corresponde a la creacion del pedido';
    END IF;

    IF recipient_role = 'client' THEN
      recipient_id := job.client_id;
      notification_title := 'Solicitud registrada';
      notification_message := format(
        'Tu pedido “%s” quedó guardado. Vas a recibir un aviso cuando %s lo revise o responda.',
        job.title,
        coalesce(job.professional_name, 'el profesional')
      );
      notification_link := format('/mis-trabajos?tab=cliente&pedido=%s', job.id);
    ELSIF recipient_role = 'professional' THEN
      recipient_id := job.profile_id;
      notification_title := 'Nuevo pedido de presupuesto';
      notification_message := format(
        '%s necesita ayuda con: %s. Revisá el pedido y decidí si querés enviar un presupuesto.',
        job.client_name,
        job.title
      );
      notification_link := format('/mis-trabajos?tab=profesional&pedido=%s', job.id);
    ELSE
      RAISE EXCEPTION 'Rol de destinatario invalido';
    END IF;

    notification_type := 'job';
    dedupe_key := format(
      'job:%s:created:%s:%s',
      job.id,
      recipient_role,
      extract(epoch FROM operation_marker)::TEXT
    );

  ELSIF event_name = 'budget' THEN
    IF actor_id <> job.profile_id OR job.client_id IS NULL THEN
      RAISE EXCEPTION 'Solo el profesional puede notificar un presupuesto';
    END IF;

    IF nullif(trim(coalesce(job.budget_amount, '')), '') IS NULL
       OR job.budget_created_at IS NULL
       OR job.budget_created_at <> operation_marker
       OR job.status NOT IN ('presupuestado', 'aceptado', 'en_progreso', 'completado') THEN
      RAISE EXCEPTION 'El pedido no tiene un presupuesto valido';
    END IF;

    recipient_id := job.client_id;
    notification_type := 'budget';
    notification_title := 'Recibiste un presupuesto';
    notification_message := format(
      'Ya podés revisar el presupuesto para “%s” y decidir cómo seguir.',
      job.title
    );
    notification_link := format('/mis-trabajos?tab=cliente&pedido=%s', job.id);
    dedupe_key := format(
      'job:%s:budget:%s',
      job.id,
      extract(epoch FROM job.budget_created_at)::TEXT
    );

  ELSIF event_name = 'status' THEN
    IF actor_id <> job.client_id AND actor_id <> job.profile_id THEN
      RAISE EXCEPTION 'El actor no participa del pedido';
    END IF;

    IF job.status NOT IN ('presupuestado', 'aceptado', 'en_progreso', 'completado') THEN
      RAISE EXCEPTION 'El estado no genera una notificacion';
    END IF;

    IF job.updated_at <> operation_marker THEN
      RAISE EXCEPTION 'El marcador no corresponde al cambio de estado';
    END IF;

    recipient_id := CASE
      WHEN actor_id = job.client_id THEN job.profile_id
      ELSE job.client_id
    END;
    notification_type := CASE WHEN job.status = 'aceptado' THEN 'budget' ELSE 'status' END;
    notification_title := CASE
      WHEN job.status = 'aceptado' THEN 'Presupuesto aceptado'
      ELSE 'Actualización de tu solicitud'
    END;
    notification_message := CASE job.status
      WHEN 'presupuestado' THEN format('La solicitud “%s” recibió un presupuesto.', job.title)
      WHEN 'aceptado' THEN 'Aceptaron tu presupuesto. Ya pueden coordinar el trabajo.'
      WHEN 'en_progreso' THEN 'El trabajo pasó a estado en progreso.'
      WHEN 'completado' THEN 'El trabajo fue marcado como completado. Revisá el resultado y dejá tu devolución.'
    END;
    notification_link := format(
      '/mis-trabajos?tab=%s&pedido=%s',
      CASE WHEN actor_id = job.client_id THEN 'profesional' ELSE 'cliente' END,
      job.id
    );
    dedupe_key := format(
      'job:%s:status:%s:%s',
      job.id,
      job.status,
      extract(epoch FROM operation_marker)::TEXT
    );

  ELSIF event_name = 'cancelled' THEN
    IF actor_id <> job.client_id AND actor_id <> job.profile_id THEN
      RAISE EXCEPTION 'El actor no participa del pedido';
    END IF;

    IF job.status <> 'cancelado' THEN
      RAISE EXCEPTION 'El pedido no esta cancelado';
    END IF;

    IF job.updated_at <> operation_marker THEN
      RAISE EXCEPTION 'El marcador no corresponde a la cancelacion';
    END IF;

    IF job.cancelled_by <> (
      CASE
        WHEN actor_id = job.client_id THEN 'cliente'
        ELSE 'profesional'
      END
    ) THEN
      RAISE EXCEPTION 'El actor no coincide con quien cancelo el pedido';
    END IF;

    recipient_id := CASE
      WHEN actor_id = job.client_id THEN job.profile_id
      ELSE job.client_id
    END;
    notification_type := 'status';
    notification_title := 'Solicitud cancelada';
    notification_message := format(
      'La solicitud “%s” fue cancelada. Motivo: %s.',
      job.title,
      coalesce(nullif(trim(job.cancel_reason), ''), 'sin detalle')
    );
    notification_link := format(
      '/mis-trabajos?tab=%s&pedido=%s',
      CASE WHEN actor_id = job.client_id THEN 'profesional' ELSE 'cliente' END,
      job.id
    );
    dedupe_key := format(
      'job:%s:cancelled:%s',
      job.id,
      extract(epoch FROM operation_marker)::TEXT
    );
  ELSE
    RAISE EXCEPTION 'Evento de pedido no soportado';
  END IF;

  RETURN public._insert_notification_server(
    recipient_id, actor_id, notification_type, notification_title,
    notification_message, notification_link, dedupe_key
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_company_candidate_inquiry(
  target_inquiry_id UUID,
  event_name TEXT,
  operation_marker TIMESTAMPTZ DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  actor_id UUID := auth.uid();
  inquiry RECORD;
  recipient_id UUID;
  notification_title TEXT;
  notification_message TEXT;
  notification_link TEXT;
  dedupe_key TEXT;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF operation_marker IS NULL THEN
    RAISE EXCEPTION 'Falta el marcador de la operacion';
  END IF;

  SELECT i.*, p.name AS company_name
    INTO inquiry
    FROM public.company_candidate_inquiries AS i
    LEFT JOIN public.profiles AS p ON p.id = i.company_id
   WHERE i.id = target_inquiry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consulta de empresa inexistente';
  END IF;

  IF event_name IN ('created', 'refreshed') THEN
    IF actor_id <> inquiry.company_id OR inquiry.status <> 'pendiente' THEN
      RAISE EXCEPTION 'La empresa no puede generar este evento';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = actor_id AND account_type = 'empresa'
    ) THEN
      RAISE EXCEPTION 'El actor no es una empresa';
    END IF;

    IF (event_name = 'created' AND inquiry.created_at <> operation_marker)
       OR (event_name = 'refreshed' AND inquiry.updated_at <> operation_marker) THEN
      RAISE EXCEPTION 'El marcador no corresponde a la consulta';
    END IF;

    recipient_id := inquiry.profile_id;
    notification_title := CASE
      WHEN event_name = 'created' AND inquiry.process_type = 'entrevista' THEN 'Una empresa quiere entrevistarte'
      WHEN event_name = 'created' THEN 'Una empresa quiere contratarte'
      ELSE 'Una Empresa actualizó su propuesta'
    END;
    notification_message := CASE
      WHEN event_name = 'created' THEN format(
        '%s %s para conocerte mejor.%s',
        coalesce(inquiry.company_name, 'Una empresa'),
        CASE WHEN inquiry.process_type = 'entrevista'
          THEN 'quiere coordinar una entrevista'
          ELSE 'quiere conversar sobre una contratación directa' END,
        CASE WHEN nullif(trim(coalesce(inquiry.message, '')), '') IS NULL
          THEN '' ELSE format(' Mensaje: %s', left(trim(inquiry.message), 1000)) END
      )
      ELSE format(
        '%s refrescó su propuesta de %s para que puedas revisarla nuevamente.%s',
        coalesce(inquiry.company_name, 'Una empresa'),
        CASE WHEN inquiry.process_type = 'entrevista' THEN 'entrevista' ELSE 'contratación' END,
        CASE WHEN nullif(trim(coalesce(inquiry.message, '')), '') IS NULL
          THEN '' ELSE format(' Mensaje: %s', left(trim(inquiry.message), 1000)) END
      )
    END;
    notification_link := format('/mis-trabajos?actividad=empresa&seleccion=%s', inquiry.id);
    dedupe_key := format(
      'inquiry:%s:%s:%s',
      inquiry.id,
      event_name,
      CASE WHEN event_name = 'created'
        THEN extract(epoch FROM inquiry.created_at)::TEXT
        ELSE extract(epoch FROM inquiry.updated_at)::TEXT END
    );

  ELSIF event_name = 'responded' THEN
    IF actor_id <> inquiry.profile_id
       OR inquiry.status NOT IN ('aceptada', 'rechazada') THEN
      RAISE EXCEPTION 'Respuesta de consulta invalida';
    END IF;

    IF inquiry.updated_at <> operation_marker THEN
      RAISE EXCEPTION 'El marcador no corresponde a la respuesta';
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM public.profiles
       WHERE id = inquiry.company_id
         AND account_type = 'empresa'
    ) THEN
      RAISE EXCEPTION 'El destinatario no es una empresa';
    END IF;

    recipient_id := inquiry.company_id;
    notification_title := CASE inquiry.status
      WHEN 'aceptada' THEN 'Aceptaron tu propuesta'
      ELSE 'No avanzarán con tu propuesta'
    END;
    notification_message := CASE inquiry.status
      WHEN 'aceptada' THEN 'La persona aceptó conversar. Podés coordinar la entrevista y completar tu proceso interno de proveedor.'
      ELSE 'La persona rechazó esta propuesta por ahora.'
    END;
    notification_link := format('/empresa?seleccion=%s', inquiry.id);
    dedupe_key := format(
      'inquiry:%s:responded:%s:%s',
      inquiry.id,
      inquiry.status,
      extract(epoch FROM inquiry.updated_at)::TEXT
    );
  ELSE
    RAISE EXCEPTION 'Evento de consulta no soportado';
  END IF;

  RETURN public._insert_notification_server(
    recipient_id, actor_id, 'job', notification_title,
    notification_message, notification_link, dedupe_key
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_company_opportunity_share(
  target_share_id UUID,
  event_name TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  actor_id UUID := auth.uid();
  share RECORD;
  recipient_id UUID;
  notification_title TEXT;
  notification_message TEXT;
  notification_link TEXT;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT s.*, o.title AS opportunity_title, o.budget_amount,
         o.source_company_id AS opportunity_source_company_id
    INTO share
    FROM public.company_opportunity_shares AS s
    JOIN public.company_opportunities AS o ON o.id = s.opportunity_id
   WHERE s.id = target_share_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Share de oportunidad inexistente';
  END IF;

  IF event_name = 'published' THEN
    IF actor_id <> share.source_company_id
       OR share.source_company_id <> share.opportunity_source_company_id
       OR share.status <> 'nueva' THEN
      RAISE EXCEPTION 'Publicador o estado de share invalido';
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM public.profiles
       WHERE id = share.source_company_id
         AND account_type = 'empresa'
    ) OR NOT EXISTS (
      SELECT 1
        FROM public.profiles
       WHERE id = share.recipient_company_id
         AND account_type = 'empresa'
    ) THEN
      RAISE EXCEPTION 'El share no vincula dos empresas';
    END IF;

    recipient_id := share.recipient_company_id;
    notification_title := 'Nueva oportunidad en tu red';
    notification_message := format(
      '%s fue derivada a tu empresa porque puede ser relevante para tu zona o actividad.%s',
      share.opportunity_title,
      CASE WHEN nullif(trim(coalesce(share.budget_amount, '')), '') IS NULL
        THEN '' ELSE format(' Presupuesto informado: %s.', share.budget_amount) END
    );
    notification_link := format('/empresa?oportunidad-compartida=%s', share.id);

  ELSIF event_name IN ('interesada', 'descartada') THEN
    IF actor_id <> share.recipient_company_id
       OR share.source_company_id <> share.opportunity_source_company_id
       OR share.status <> event_name THEN
      RAISE EXCEPTION 'Respuesta de oportunidad invalida';
    END IF;

    IF NOT EXISTS (
      SELECT 1
        FROM public.profiles
       WHERE id = share.source_company_id
         AND account_type = 'empresa'
    ) OR NOT EXISTS (
      SELECT 1
        FROM public.profiles
       WHERE id = share.recipient_company_id
         AND account_type = 'empresa'
    ) THEN
      RAISE EXCEPTION 'El share no vincula dos empresas';
    END IF;

    recipient_id := share.source_company_id;
    notification_title := CASE event_name
      WHEN 'interesada' THEN 'Una empresa mostró interés'
      ELSE 'Una empresa descartó tu oportunidad'
    END;
    notification_message := CASE event_name
      WHEN 'interesada' THEN format('La empresa recibió “%s” y quiere evaluarla.', share.opportunity_title)
      ELSE format('La empresa no avanzó con “%s”. La red puede seguir encontrando empresas similares.', share.opportunity_title)
    END;
    notification_link := format('/empresa?oportunidad=%s', share.opportunity_id);
  ELSE
    RAISE EXCEPTION 'Evento de oportunidad no soportado';
  END IF;

  RETURN public._insert_notification_server(
    recipient_id,
    actor_id,
    CASE WHEN event_name = 'published' THEN 'job' ELSE 'status' END,
    notification_title,
    notification_message,
    notification_link,
    format('share:%s:%s', share.id, event_name)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_review(
  target_recommendation_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  actor_id UUID := auth.uid();
  review RECORD;
BEGIN
  IF actor_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT r.*, p.slug
    INTO review
    FROM public.recommendations AS r
    JOIN public.profiles AS p ON p.id = r.to_profile_id
   WHERE r.id = target_recommendation_id;

  IF NOT FOUND OR review.from_user_id IS NULL OR review.from_user_id <> actor_id THEN
    RAISE EXCEPTION 'El autor de la reseña no esta autorizado';
  END IF;

  IF review.status <> 'pendiente' THEN
    RAISE EXCEPTION 'La reseña no esta pendiente';
  END IF;

  RETURN public._insert_notification_server(
    review.to_profile_id,
    actor_id,
    'review',
    'Tenés una reseña para revisar',
    format(
      '%s dejó una reseña sobre tu trabajo. Revisala antes de decidir si querés publicarla.',
      review.from_name
    ),
    format('/p/%s#resenas', review.slug),
    format('review:%s', review.id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_profile_whatsapp_verified(
  target_profile_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  actor_id UUID := auth.uid();
  profile RECORD;
BEGIN
  IF actor_id IS NULL OR actor_id <> target_profile_id THEN
    RAISE EXCEPTION 'Solo el titular puede crear esta notification';
  END IF;

  SELECT id, slug
    INTO profile
    FROM public.profiles
   WHERE id = target_profile_id AND whatsapp_verified = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'WhatsApp no esta verificado';
  END IF;

  RETURN public._insert_notification_server(
    profile.id,
    actor_id,
    'system',
    '¡WhatsApp Verificado con éxito!',
    'Tu número fue certificado con éxito. Tu perfil ahora cuenta con el sello oficial.',
    format('/p/%s', profile.slug),
    format('profile:%s:whatsapp-verified', profile.id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_admin_profile_reminder(
  target_profile_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  actor_id UUID := auth.uid();
  profile RECORD;
  completed_checks INTEGER;
  completion_percent INTEGER;
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador puede crear esta notification';
  END IF;

  SELECT
    p.*,
    EXISTS (SELECT 1 FROM public.skills s WHERE s.profile_id = p.id) AS has_skills,
    EXISTS (SELECT 1 FROM public.services s WHERE s.profile_id = p.id) AS has_services,
    EXISTS (SELECT 1 FROM public.contact_methods c WHERE c.profile_id = p.id) AS has_contacts
  INTO profile
  FROM public.profiles p
  WHERE p.id = target_profile_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Perfil inexistente';
  END IF;

  completed_checks :=
    (CASE WHEN nullif(trim(profile.name), '') IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN nullif(trim(profile.bio), '') IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN nullif(trim(profile.provincia), '') IS NOT NULL
                AND nullif(trim(profile.localidad), '') IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN profile.modalidad IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN profile.disponibilidad IS NOT NULL THEN 1 ELSE 0 END) +
    (CASE WHEN profile.has_skills OR profile.has_services THEN 1 ELSE 0 END) +
    (CASE WHEN profile.has_contacts THEN 1 ELSE 0 END) +
    (CASE WHEN profile.photo_url IS NOT NULL OR profile.resume_url IS NOT NULL THEN 1 ELSE 0 END);

  completion_percent := round((completed_checks::NUMERIC / 8) * 100)::INTEGER;

  IF completion_percent >= 70 OR profile.profile_completion_reminder_sent_at IS NOT NULL THEN
    RETURN NULL;
  END IF;

  RETURN public._insert_notification_server(
    profile.id,
    actor_id,
    'system',
    'Completá tu perfil y hacé que te encuentren',
    format(
      'Tu perfil está completo en un %s%%. Sumá qué sabés hacer, una breve presentación y un medio de contacto para aparecer mejor en las búsquedas y recibir oportunidades más acordes a vos.',
      completion_percent
    ),
    '/crear-perfil',
    format('admin:profile-reminder:%s', profile.id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_admin_whatsapp_verification(
  target_request_id UUID
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  actor_id UUID := auth.uid();
  request_row RECORD;
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'Solo un administrador puede crear esta notification';
  END IF;

  SELECT r.*
    INTO request_row
    FROM public.whatsapp_verification_requests r
   WHERE r.id = target_request_id
     AND r.status = 'aprobado';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Solicitud de WhatsApp aprobada inexistente';
  END IF;

  RETURN public._insert_notification_server(
    request_row.profile_id,
    actor_id,
    'system',
    '¡WhatsApp Verificado por Administración!',
    format(
      'El administrador certificó tu número %s. Tu perfil ahora cuenta con el sello oficial verificado.',
      request_row.phone_declared
    ),
    '/admin',
    format('admin:whatsapp-verification:%s', request_row.id)
  );
END;
$$;

-- Las reseñas anonimas siguen generando una notification in-app mediante un
-- trigger. No se expone una RPC anonima que pudiera aceptar un review_id ajeno.
CREATE OR REPLACE FUNCTION public.create_anonymous_review_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
DECLARE
  target_slug TEXT;
BEGIN
  IF NEW.from_user_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT slug INTO target_slug
    FROM public.profiles
   WHERE id = NEW.to_profile_id;

  IF target_slug IS NULL THEN
    RETURN NEW;
  END IF;

  BEGIN
    INSERT INTO public.notifications (
      user_id, created_by, dedupe_key, title, message, type, link
    )
    VALUES (
      NEW.to_profile_id,
      NULL,
      format('review:%s', NEW.id),
      'Tenés una reseña para revisar',
      format(
        '%s dejó una reseña sobre tu trabajo. Revisala antes de decidir si querés publicarla.',
        NEW.from_name
      ),
      'review',
      format('/p/%s#resenas', target_slug)
    )
    ON CONFLICT DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'No se pudo crear la notification de la reseña %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS create_anonymous_review_notification
  ON public.recommendations;

CREATE TRIGGER create_anonymous_review_notification
  AFTER INSERT ON public.recommendations
  FOR EACH ROW
  EXECUTE FUNCTION public.create_anonymous_review_notification();

REVOKE ALL ON FUNCTION public.notify_job_request(UUID, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_company_candidate_inquiry(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_company_opportunity_share(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_review(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_profile_whatsapp_verified(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_admin_profile_reminder(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.notify_admin_whatsapp_verification(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_anonymous_review_notification() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.notify_job_request(UUID, TEXT, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_company_candidate_inquiry(UUID, TEXT, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_company_opportunity_share(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_review(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_profile_whatsapp_verified(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_admin_profile_reminder(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.notify_admin_whatsapp_verification(UUID) TO authenticated;
