-- LABURANTE — Support tickets, server-authorized replies and private attachments
-- Additive migration. It does not remove policies or mutate existing user data.
-- Apply only after reviewing the target project and validating the RPC contract.

CREATE SEQUENCE IF NOT EXISTS public.support_case_number_seq;

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number TEXT NOT NULL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  title TEXT NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 160),
  initial_message TEXT NOT NULL CHECK (char_length(trim(initial_message)) BETWEEN 1 AND 5000),
  status TEXT NOT NULL DEFAULT 'nuevo' CHECK (status IN ('nuevo', 'en_revision', 'esperando_usuario', 'resuelto', 'cancelado', 'suspendido')),
  category TEXT NOT NULL DEFAULT 'sin_clasificar' CHECK (category IN ('acceso', 'perfil', 'pagos', 'seguridad', 'contenido', 'empresa', 'otro', 'sin_clasificar')),
  priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('normal', 'alta')),
  admin_unread BOOLEAN NOT NULL DEFAULT true,
  user_unread BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS support_one_active_ticket_per_user
  ON public.support_tickets(user_id)
  WHERE status IN ('nuevo', 'en_revision', 'esperando_usuario') AND user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS support_tickets_user_activity_idx ON public.support_tickets(user_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS support_tickets_inbox_idx ON public.support_tickets(status, admin_unread, last_activity_at DESC);

CREATE TABLE IF NOT EXISTS public.support_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  author_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_role TEXT NOT NULL DEFAULT 'admin' CHECK (author_role = 'admin'),
  content TEXT NOT NULL CHECK (char_length(trim(content)) BETWEEN 1 AND 5000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS support_messages_ticket_idx ON public.support_messages(ticket_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.support_upload_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'vigente' CHECK (status IN ('vigente', 'usada', 'vencida', 'cancelada')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS support_upload_requests_ticket_idx ON public.support_upload_requests(ticket_id, status, expires_at);

CREATE TABLE IF NOT EXISTS public.support_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  upload_request_id UUID NOT NULL UNIQUE REFERENCES public.support_upload_requests(id) ON DELETE RESTRICT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  storage_path TEXT NOT NULL UNIQUE,
  original_name TEXT NOT NULL CHECK (char_length(trim(original_name)) BETWEEN 1 AND 255),
  mime_type TEXT NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
  size_bytes INTEGER NOT NULL CHECK (size_bytes BETWEEN 1 AND 5242880),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS support_attachments_ticket_idx ON public.support_attachments(ticket_id, created_at ASC);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_upload_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.support_attachments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.support_tickets, public.support_messages, public.support_upload_requests, public.support_attachments FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.support_tickets, public.support_messages, public.support_upload_requests, public.support_attachments TO authenticated;
REVOKE ALL ON SEQUENCE public.support_case_number_seq FROM PUBLIC, anon, authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'support_tickets' AND policyname = 'support tickets owner or admin read') THEN
    CREATE POLICY "support tickets owner or admin read" ON public.support_tickets FOR SELECT TO authenticated
      USING (user_id = auth.uid() OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'support_messages' AND policyname = 'support messages owner or admin read') THEN
    CREATE POLICY "support messages owner or admin read" ON public.support_messages FOR SELECT TO authenticated
      USING (EXISTS (SELECT 1 FROM public.support_tickets t WHERE t.id = ticket_id AND (t.user_id = auth.uid() OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin')));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'support_upload_requests' AND policyname = 'support upload requests owner or admin read') THEN
    CREATE POLICY "support upload requests owner or admin read" ON public.support_upload_requests FOR SELECT TO authenticated
      USING (user_id = auth.uid() OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'support_attachments' AND policyname = 'support attachments owner or admin read') THEN
    CREATE POLICY "support attachments owner or admin read" ON public.support_attachments FOR SELECT TO authenticated
      USING (user_id = auth.uid() OR COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_support_ticket(p_title TEXT, p_initial_message TEXT)
RETURNS public.support_tickets
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  actor_id UUID := auth.uid();
  ticket public.support_tickets;
  admin_user RECORD;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'Se requiere una sesión activa'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(actor_id::text, 0));
  IF char_length(trim(COALESCE(p_title, ''))) NOT BETWEEN 1 AND 160 THEN RAISE EXCEPTION 'Título inválido'; END IF;
  IF char_length(trim(COALESCE(p_initial_message, ''))) NOT BETWEEN 1 AND 5000 THEN RAISE EXCEPTION 'Mensaje inválido'; END IF;
  IF EXISTS (SELECT 1 FROM public.support_tickets WHERE user_id = actor_id AND status IN ('nuevo', 'en_revision', 'esperando_usuario')) THEN
    RAISE EXCEPTION 'Ya tenés un caso de soporte activo';
  END IF;
  IF (SELECT count(*) FROM public.support_tickets WHERE user_id = actor_id AND created_at >= now() - interval '24 hours') >= 3 THEN
    RAISE EXCEPTION 'Alcanzaste el límite de tres casos de soporte en 24 horas';
  END IF;
  INSERT INTO public.support_tickets(case_number, user_id, title, initial_message)
  VALUES ('SOP-' || to_char(now(), 'YYYY') || '-' || lpad(nextval('public.support_case_number_seq')::text, 6, '0'), actor_id, trim(p_title), trim(p_initial_message))
  RETURNING * INTO ticket;
  FOR admin_user IN SELECT id FROM auth.users WHERE raw_app_meta_data ->> 'role' = 'admin' LOOP
    INSERT INTO public.notifications(user_id, created_by, dedupe_key, title, message, type, link, read)
    VALUES (admin_user.id, actor_id, 'support:new:' || ticket.id::text || ':' || admin_user.id::text, 'Nuevo caso de soporte', ticket.case_number || ' · ' || ticket.title, 'system', '/admin?tab=support&caso=' || ticket.id::text, false)
    ON CONFLICT (dedupe_key) DO NOTHING;
  END LOOP;
  RETURN ticket;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_my_support_ticket_read(p_ticket_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auth
AS $$
BEGIN
  UPDATE public.support_tickets SET user_unread = false
   WHERE id = p_ticket_id AND user_id = auth.uid();
END;
$$;

CREATE OR REPLACE FUNCTION public.consume_support_upload(
  p_ticket_id UUID, p_upload_request_id UUID, p_storage_path TEXT,
  p_original_name TEXT, p_mime_type TEXT, p_size_bytes INTEGER
)
RETURNS public.support_attachments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  actor_id UUID := auth.uid();
  request_row public.support_upload_requests;
  attachment public.support_attachments;
BEGIN
  IF actor_id IS NULL THEN RAISE EXCEPTION 'Se requiere una sesión activa'; END IF;
  SELECT r.* INTO request_row FROM public.support_upload_requests r
   WHERE r.id = p_upload_request_id AND r.ticket_id = p_ticket_id AND r.user_id = actor_id FOR UPDATE;
  IF NOT FOUND OR request_row.status <> 'vigente' OR request_row.expires_at <= now() THEN RAISE EXCEPTION 'La autorización de carga no es válida'; END IF;
  IF p_mime_type NOT IN ('image/png', 'image/jpeg', 'image/webp') OR p_size_bytes NOT BETWEEN 1 AND 5242880 THEN RAISE EXCEPTION 'Adjunto inválido'; END IF;
  IF p_storage_path !~ ('^' || p_ticket_id::text || '/' || p_upload_request_id::text || '\.(png|jpg|webp)$') THEN RAISE EXCEPTION 'Ruta de adjunto inválida'; END IF;
  INSERT INTO public.support_attachments(ticket_id, upload_request_id, user_id, storage_path, original_name, mime_type, size_bytes)
  VALUES (p_ticket_id, p_upload_request_id, actor_id, p_storage_path, left(trim(p_original_name), 255), p_mime_type, p_size_bytes)
  RETURNING * INTO attachment;
  UPDATE public.support_upload_requests SET status = 'usada', used_at = now() WHERE id = p_upload_request_id AND status = 'vigente';
  UPDATE public.support_tickets SET updated_at = now(), last_activity_at = now(), admin_unread = true, status = CASE WHEN status = 'esperando_usuario' THEN 'en_revision' ELSE status END WHERE id = p_ticket_id AND user_id = actor_id;
  RETURN attachment;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_support_ticket(p_ticket_id UUID, p_status TEXT DEFAULT NULL, p_category TEXT DEFAULT NULL, p_priority TEXT DEFAULT NULL)
RETURNS public.support_tickets
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auth
AS $$
DECLARE ticket public.support_tickets;
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN RAISE EXCEPTION 'Solo un administrador puede actualizar casos'; END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('nuevo', 'en_revision', 'esperando_usuario', 'resuelto', 'cancelado', 'suspendido') THEN RAISE EXCEPTION 'Estado inválido'; END IF;
  IF p_category IS NOT NULL AND p_category NOT IN ('acceso', 'perfil', 'pagos', 'seguridad', 'contenido', 'empresa', 'otro', 'sin_clasificar') THEN RAISE EXCEPTION 'Clasificación inválida'; END IF;
  IF p_priority IS NOT NULL AND p_priority NOT IN ('normal', 'alta') THEN RAISE EXCEPTION 'Prioridad inválida'; END IF;
  UPDATE public.support_tickets SET status = COALESCE(p_status, status), category = COALESCE(p_category, category), priority = COALESCE(p_priority, priority), updated_at = now(), last_activity_at = now(), admin_unread = false WHERE id = p_ticket_id RETURNING * INTO ticket;
  IF NOT FOUND THEN RAISE EXCEPTION 'Caso inexistente'; END IF;
  RETURN ticket;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reply_support_ticket(p_ticket_id UUID, p_content TEXT, p_request_capture BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, public, auth
AS $$
DECLARE
  actor_id UUID := auth.uid(); ticket public.support_tickets; message_row public.support_messages; request_row public.support_upload_requests;
BEGIN
  IF COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'admin' THEN RAISE EXCEPTION 'Solo un administrador puede responder casos'; END IF;
  IF char_length(trim(COALESCE(p_content, ''))) NOT BETWEEN 1 AND 5000 THEN RAISE EXCEPTION 'Respuesta inválida'; END IF;
  SELECT * INTO ticket FROM public.support_tickets WHERE id = p_ticket_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Caso inexistente'; END IF;
  INSERT INTO public.support_messages(ticket_id, author_id, content) VALUES (p_ticket_id, actor_id, trim(p_content)) RETURNING * INTO message_row;
  IF p_request_capture AND ticket.user_id IS NOT NULL THEN
    INSERT INTO public.support_upload_requests(ticket_id, user_id, requested_by, expires_at) VALUES (ticket.id, ticket.user_id, actor_id, now() + interval '7 days') RETURNING * INTO request_row;
  END IF;
  UPDATE public.support_tickets SET status = CASE WHEN status IN ('resuelto', 'cancelado', 'suspendido') THEN 'en_revision' ELSE status END, updated_at = now(), last_activity_at = now(), admin_unread = false, user_unread = true WHERE id = p_ticket_id;
  IF ticket.user_id IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, created_by, dedupe_key, title, message, type, link, read)
    VALUES (ticket.user_id, actor_id, 'support:reply:' || message_row.id::text, 'Respuesta de soporte', ticket.case_number || ' tiene una respuesta nueva.', 'system', '/soporte?caso=' || ticket.id::text, false)
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;
  RETURN jsonb_build_object('ticket', (SELECT to_jsonb(t) FROM public.support_tickets t WHERE t.id = p_ticket_id), 'message', to_jsonb(message_row), 'upload_request', to_jsonb(request_row));
END;
$$;

REVOKE ALL ON FUNCTION public.create_support_ticket(TEXT, TEXT), public.mark_my_support_ticket_read(UUID), public.consume_support_upload(UUID, UUID, TEXT, TEXT, TEXT, INTEGER), public.admin_update_support_ticket(UUID, TEXT, TEXT, TEXT), public.admin_reply_support_ticket(UUID, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_support_ticket(TEXT, TEXT), public.mark_my_support_ticket_read(UUID), public.consume_support_upload(UUID, UUID, TEXT, TEXT, TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_support_ticket(UUID, TEXT, TEXT, TEXT), public.admin_reply_support_ticket(UUID, TEXT, BOOLEAN) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'support-attachments') THEN
    INSERT INTO storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('support-attachments', 'support-attachments', false, 5242880, ARRAY['image/png', 'image/jpeg', 'image/webp']);
  ELSE
    UPDATE storage.buckets SET public = false, file_size_limit = 5242880, allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp'] WHERE id = 'support-attachments';
  END IF;
END;
$$;

DO $$
BEGIN
  -- No se concede INSERT al navegador: la Edge Function inspecciona los bytes
  -- y usa service_role para subir al bucket privado. Esto evita que metadata
  -- falsificada eluda la validación de contenido.
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'support attachments owner or admin read') THEN
    CREATE POLICY "support attachments owner or admin read" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'support-attachments' AND (COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin' OR EXISTS (SELECT 1 FROM public.support_attachments a WHERE a.storage_path = name AND a.user_id = auth.uid())));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'support attachments owner orphan cleanup') THEN
    CREATE POLICY "support attachments owner orphan cleanup" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'support-attachments' AND EXISTS (SELECT 1 FROM public.support_upload_requests r WHERE r.id = split_part(name, '/', 2)::uuid AND r.user_id = auth.uid() AND r.status = 'vigente' AND NOT EXISTS (SELECT 1 FROM public.support_attachments a WHERE a.storage_path = name)));
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

