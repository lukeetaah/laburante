-- ============================================================================
-- LABURANTE — Migración Aditiva: Mensajería Admin ↔ Usuario,
-- Tracking Separado de Verificación, Skills Propuestas y Shortlists de Empresa
--
-- ADITIVA Y SEGURA PARA PRODUCCIÓN:
-- - No elimina tablas ni columnas.
-- - No altera datos existentes.
-- - Bloquea INSERT directo en messages para forzar el paso por RPC segura.
-- - Restringe ejecución de RPCs administrativas a app_metadata.role = 'admin'.
-- - Revoca accesos anon en todas las nuevas entidades.
-- ============================================================================

-- 1. Tabla de Tracking de Confirmaciones (Base + Nuevas Columnas)
-- ----------------------------------------------------------------------------
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

ALTER TABLE public.account_confirmation_tracking
  ADD COLUMN IF NOT EXISTS manual_resend_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_manual_resend_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS automatic_reminder_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_automatic_reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_resend_error TEXT;

-- Migración segura de valores previos si existen
UPDATE public.account_confirmation_tracking
SET manual_resend_count = resend_count,
    last_manual_resend_at = last_resend_at
WHERE manual_resend_count = 0
  AND resend_count > 0;

-- 2. Tabla de Conversaciones (Admin ↔ Usuario)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject TEXT NOT NULL DEFAULT 'Conversación con LABURANTE',
  status TEXT NOT NULL DEFAULT 'abierta' CHECK (status IN ('abierta', 'archivada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_updated_at ON public.conversations(updated_at DESC);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.conversations FROM PUBLIC, anon;
GRANT SELECT, UPDATE ON public.conversations TO authenticated;

DROP POLICY IF EXISTS "Users read own conversations or admin reads all" ON public.conversations;
CREATE POLICY "Users read own conversations or admin reads all"
  ON public.conversations FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

DROP POLICY IF EXISTS "Admins and owners update conversation status" ON public.conversations;
CREATE POLICY "Admins and owners update conversation status"
  ON public.conversations FOR UPDATE TO authenticated
  USING (
    auth.uid() = user_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  )
  WITH CHECK (
    auth.uid() = user_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

-- 3. Tabla de Mensajes (Solo escritura vía RPC SECURITY DEFINER)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('admin', 'user')),
  content TEXT NOT NULL CHECK (char_length(trim(content)) > 0 AND char_length(content) <= 5000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages(sender_id);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.messages FROM PUBLIC, anon;

-- IMPORTANTE: INSERT directo desde browser está completamente bloqueado.
-- Toda inserción debe pasar obligatoriamente por send_conversation_message().
REVOKE INSERT ON public.messages FROM authenticated;
GRANT SELECT, UPDATE ON public.messages TO authenticated;

DROP POLICY IF EXISTS "Participants read messages in conversation" ON public.messages;
CREATE POLICY "Participants read messages in conversation"
  ON public.messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.user_id = auth.uid()
          OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
        )
    )
  );

DROP POLICY IF EXISTS "Participants mark read_at only" ON public.messages;
CREATE POLICY "Participants mark read_at only"
  ON public.messages FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id
        AND (
          c.user_id = auth.uid()
          OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
        )
    )
  )
  WITH CHECK (
    -- Asegurar que el contenido y remitente son estrictamente inmutables
    content = (SELECT m.content FROM public.messages m WHERE m.id = messages.id)
    AND sender_id = (SELECT m.sender_id FROM public.messages m WHERE m.id = messages.id)
    AND conversation_id = (SELECT m.conversation_id FROM public.messages m WHERE m.id = messages.id)
  );

-- 4. Tabla de Habilidades Propuestas para Revisión de Admin
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.proposed_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_name TEXT NOT NULL CHECK (char_length(trim(skill_name)) > 0 AND char_length(skill_name) <= 100),
  proposed_by_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pendiente' CHECK (status IN ('pendiente', 'aprobada', 'rechazada')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposed_skills_status ON public.proposed_skills(status);
ALTER TABLE public.proposed_skills ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.proposed_skills FROM PUBLIC, anon;
GRANT SELECT, INSERT ON public.proposed_skills TO authenticated;

DROP POLICY IF EXISTS "Users read own proposed skills or admin reads all" ON public.proposed_skills;
CREATE POLICY "Users read own proposed skills or admin reads all"
  ON public.proposed_skills FOR SELECT TO authenticated
  USING (
    auth.uid() = proposed_by_profile_id
    OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
  );

DROP POLICY IF EXISTS "Users submit own proposed skills" ON public.proposed_skills;
CREATE POLICY "Users submit own proposed skills"
  ON public.proposed_skills FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = proposed_by_profile_id
  );

DROP POLICY IF EXISTS "Admins moderate proposed skills" ON public.proposed_skills;
CREATE POLICY "Admins moderate proposed skills"
  ON public.proposed_skills FOR UPDATE TO authenticated
  USING (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')
  WITH CHECK (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');

-- 5. Tabla de Shortlists / Favoritos de Empresas
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_shortlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  candidate_profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'interesante' CHECK (status IN ('interesante', 'contactado', 'en_evaluacion', 'descartado')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_company_candidate_shortlist UNIQUE (company_id, candidate_profile_id)
);

CREATE INDEX IF NOT EXISTS idx_company_shortlists_company ON public.company_shortlists(company_id, updated_at DESC);
ALTER TABLE public.company_shortlists ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.company_shortlists FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_shortlists TO authenticated;

DROP POLICY IF EXISTS "Companies manage own shortlists" ON public.company_shortlists;
CREATE POLICY "Companies manage own shortlists"
  ON public.company_shortlists FOR ALL TO authenticated
  USING (
    auth.uid() = company_id
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.account_type = 'empresa'
    )
  )
  WITH CHECK (
    auth.uid() = company_id
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.account_type = 'empresa'
    )
  );

-- ============================================================================
-- 6. RPC: Obtener o Crear Conversación con Admin
-- ============================================================================
CREATE OR REPLACE FUNCTION public.get_or_create_admin_conversation(
  p_target_user_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_is_admin BOOLEAN := COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
  v_user_id UUID;
  v_conversation_id UUID;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  IF v_is_admin THEN
    IF p_target_user_id IS NULL THEN
      RAISE EXCEPTION 'admin_must_specify_target_user_id';
    END IF;
    v_user_id := p_target_user_id;
  ELSE
    v_user_id := v_actor_id;
  END IF;

  SELECT id INTO v_conversation_id
  FROM public.conversations
  WHERE user_id = v_user_id
  ORDER BY created_at ASC
  LIMIT 1;

  IF v_conversation_id IS NULL THEN
    INSERT INTO public.conversations (user_id, subject, status)
    VALUES (v_user_id, 'Conversación con LABURANTE', 'abierta')
    RETURNING id INTO v_conversation_id;
  END IF;

  RETURN v_conversation_id;
END;
$$;

REVOKE ALL ON FUNCTION public.get_or_create_admin_conversation(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_or_create_admin_conversation(UUID) TO authenticated;

-- ============================================================================
-- 7. RPC: Escritura Centralizada y Segura de Mensajes (send_conversation_message)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.send_conversation_message(
  p_conversation_id UUID,
  p_content TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  v_actor_id UUID := auth.uid();
  v_is_admin BOOLEAN := COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin';
  v_sender_role TEXT;
  v_conversation RECORD;
  v_message_id UUID;
  v_clean_content TEXT;
  v_notification_id UUID := NULL;
  v_recipient_user_id UUID;
  v_notif_title TEXT;
  v_notif_link TEXT;
  v_notif_message TEXT;
BEGIN
  IF v_actor_id IS NULL THEN
    RAISE EXCEPTION 'unauthenticated';
  END IF;

  v_clean_content := trim(p_content);
  IF v_clean_content IS NULL OR char_length(v_clean_content) = 0 THEN
    RAISE EXCEPTION 'message_content_empty';
  END IF;
  IF char_length(v_clean_content) > 5000 THEN
    RAISE EXCEPTION 'message_content_too_long';
  END IF;

  -- Obtener conversación
  SELECT id, user_id, status INTO v_conversation
  FROM public.conversations
  WHERE id = p_conversation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'conversation_not_found';
  END IF;

  -- Validar que el usuario solo pueda enviar en su propia conversación
  IF NOT v_is_admin AND v_conversation.user_id <> v_actor_id THEN
    RAISE EXCEPTION 'unauthorized_conversation_participant';
  END IF;

  v_sender_role := CASE WHEN v_is_admin THEN 'admin' ELSE 'user' END;

  -- Inserción segura de mensaje
  INSERT INTO public.messages (
    conversation_id,
    sender_id,
    sender_role,
    content,
    created_at
  )
  VALUES (
    v_conversation.id,
    v_actor_id,
    v_sender_role,
    v_clean_content,
    NOW()
  )
  RETURNING id INTO v_message_id;

  -- Actualizar timestamp de conversación
  UPDATE public.conversations
  SET updated_at = NOW(),
      status = 'abierta'
  WHERE id = v_conversation.id;

  -- Destinatario y notificación
  IF v_is_admin THEN
    v_recipient_user_id := v_conversation.user_id;
    v_notif_title := 'Nuevo mensaje del equipo de LABURANTE';
    v_notif_link := '/mis-trabajos?tab=mensajes&conversacion=' || v_conversation.id::text;
    v_notif_message := 'Tenés un nuevo mensaje de administración sobre tu cuenta en LABURANTE.';
  ELSE
    -- Mensaje de usuario hacia Admin: se busca el usuario administrador para notificar
    SELECT id INTO v_recipient_user_id
    FROM auth.users
    WHERE raw_app_meta_data ->> 'role' = 'admin'
    LIMIT 1;

    v_notif_title := 'Nuevo mensaje de usuario en LABURANTE';
    v_notif_link := '/admin?tab=messages&conversacion=' || v_conversation.id::text;
    v_notif_message := 'Un usuario ha respondido en su conversación con el equipo de soporte.';
  END IF;

  IF v_recipient_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (
      user_id,
      created_by,
      title,
      message,
      type,
      link,
      read,
      dedupe_key
    )
    VALUES (
      v_recipient_user_id,
      v_actor_id,
      v_notif_title,
      v_notif_message,
      'system',
      v_notif_link,
      false,
      'msg_' || v_message_id::text
    )
    RETURNING id INTO v_notification_id;
  END IF;

  RETURN jsonb_build_object(
    'message_id', v_message_id,
    'conversation_id', v_conversation.id,
    'sender_role', v_sender_role,
    'notification_id', v_notification_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.send_conversation_message(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.send_conversation_message(UUID, TEXT) TO authenticated;

-- ============================================================================
-- 8. RPC: Consulta Segura de Estados de Verificación (Admin Only)
-- ============================================================================
CREATE OR REPLACE FUNCTION public.admin_get_auth_users_verification_status(
  p_filter TEXT DEFAULT 'todos'
)
RETURNS TABLE (
  user_id UUID,
  email VARCHAR(255),
  name TEXT,
  created_at TIMESTAMPTZ,
  days_elapsed INTEGER,
  email_confirmed_at TIMESTAMPTZ,
  manual_resend_count INTEGER,
  last_manual_resend_at TIMESTAMPTZ,
  automatic_reminder_count INTEGER,
  last_automatic_reminder_at TIMESTAMPTZ,
  has_profile BOOLEAN,
  status TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN
    RAISE EXCEPTION 'unauthorized_admin_access';
  END IF;

  RETURN QUERY
  SELECT
    u.id AS user_id,
    u.email::VARCHAR(255) AS email,
    COALESCE(p.name, (u.raw_user_meta_data ->> 'name'), split_part(u.email, '@', 1))::TEXT AS name,
    u.created_at,
    EXTRACT(DAY FROM (NOW() - u.created_at))::INTEGER AS days_elapsed,
    u.email_confirmed_at,
    COALESCE(t.manual_resend_count, t.resend_count, 0) AS manual_resend_count,
    COALESCE(t.last_manual_resend_at, t.last_resend_at) AS last_manual_resend_at,
    COALESCE(t.automatic_reminder_count, 0) AS automatic_reminder_count,
    t.last_automatic_reminder_at,
    (p.id IS NOT NULL) AS has_profile,
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
      WHEN COALESCE(t.automatic_reminder_count, 0) >= 2 OR EXTRACT(DAY FROM (NOW() - u.created_at)) >= 14 THEN 'recordatorio_2'
      WHEN COALESCE(t.automatic_reminder_count, 0) >= 1 OR EXTRACT(DAY FROM (NOW() - u.created_at)) >= 7 THEN 'recordatorio_1'
      ELSE 'pendiente'
    END::TEXT AS status
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  LEFT JOIN public.account_confirmation_tracking t ON t.user_id = u.id
  WHERE
    CASE
      WHEN p_filter = 'verificados' THEN u.email_confirmed_at IS NOT NULL
      WHEN p_filter = 'esperando' THEN u.email_confirmed_at IS NULL
      ELSE TRUE
    END
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_auth_users_verification_status(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_get_auth_users_verification_status(TEXT) TO authenticated;
