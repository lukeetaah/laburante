-- Corrective migration for support notification idempotency.
--
-- notifications.dedupe_key is protected by a partial unique index whose
-- predicate is dedupe_key IS NOT NULL. PostgreSQL therefore cannot infer that
-- index from ON CONFLICT (dedupe_key) alone. The explicit predicate below
-- matches the existing index without changing the notifications table or
-- adding a new uniqueness rule.

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
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  END LOOP;
  RETURN ticket;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_reply_support_ticket(p_ticket_id UUID, p_content TEXT, p_request_capture BOOLEAN DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
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
    ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING;
  END IF;
  RETURN jsonb_build_object('ticket', (SELECT to_jsonb(t) FROM public.support_tickets t WHERE t.id = p_ticket_id), 'message', to_jsonb(message_row), 'upload_request', to_jsonb(request_row));
END;
$$;

-- CREATE OR REPLACE preserves the existing signatures and function ownership.
-- Explicit grants are repeated to make the intended public API self-documenting;
-- no other function or table permission is changed.
REVOKE ALL ON FUNCTION public.create_support_ticket(TEXT, TEXT), public.admin_reply_support_ticket(UUID, TEXT, BOOLEAN) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_support_ticket(TEXT, TEXT), public.admin_reply_support_ticket(UUID, TEXT, BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';

