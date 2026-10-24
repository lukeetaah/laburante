-- Non-destructive recovery for migration_support_tickets.sql.
-- Use only to stop new support writes while preserving every ticket, message,
-- authorization and attachment. It does not DROP objects or delete data.
REVOKE EXECUTE ON FUNCTION public.create_support_ticket(TEXT, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_my_support_ticket_read(UUID) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.consume_support_upload(UUID, UUID, TEXT, TEXT, TEXT, INTEGER) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_update_support_ticket(UUID, TEXT, TEXT, TEXT) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.admin_reply_support_ticket(UUID, TEXT, BOOLEAN) FROM authenticated;
REVOKE SELECT ON TABLE public.support_tickets, public.support_messages, public.support_upload_requests, public.support_attachments FROM authenticated;
NOTIFY pgrst, 'reload schema';

