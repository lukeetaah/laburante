-- Corrective migration for support attachment path validation.
-- The path is still bound to both UUIDs and to the allow-listed extension;
-- [.] expresses the literal dot without depending on string escape settings.

CREATE OR REPLACE FUNCTION public.consume_support_upload(
  p_ticket_id UUID, p_upload_request_id UUID, p_storage_path TEXT,
  p_original_name TEXT, p_mime_type TEXT, p_size_bytes INTEGER
)
RETURNS public.support_attachments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth
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
  IF p_storage_path !~ ('^' || p_ticket_id::text || '/' || p_upload_request_id::text || '[.](png|jpg|webp)$') THEN RAISE EXCEPTION 'Ruta de adjunto inválida'; END IF;
  INSERT INTO public.support_attachments(ticket_id, upload_request_id, user_id, storage_path, original_name, mime_type, size_bytes)
  VALUES (p_ticket_id, p_upload_request_id, actor_id, p_storage_path, left(trim(p_original_name), 255), p_mime_type, p_size_bytes)
  RETURNING * INTO attachment;
  UPDATE public.support_upload_requests SET status = 'usada', used_at = now() WHERE id = p_upload_request_id AND status = 'vigente';
  UPDATE public.support_tickets SET updated_at = now(), last_activity_at = now(), admin_unread = true, status = CASE WHEN status = 'esperando_usuario' THEN 'en_revision' ELSE status END WHERE id = p_ticket_id AND user_id = actor_id;
  RETURN attachment;
END;
$$;

NOTIFY pgrst, 'reload schema';

