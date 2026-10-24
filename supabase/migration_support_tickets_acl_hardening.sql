-- Corrective, additive ACL migration for support_tickets.
-- The original support migration granted SELECT after revoking PUBLIC/anon,
-- but did not explicitly revoke inherited table privileges from authenticated.
-- This restores the intended browser surface without changing any rows.
REVOKE ALL ON TABLE public.support_tickets, public.support_messages, public.support_upload_requests, public.support_attachments FROM authenticated;
GRANT SELECT ON TABLE public.support_tickets, public.support_messages, public.support_upload_requests, public.support_attachments TO authenticated;
REVOKE ALL ON SEQUENCE public.support_case_number_seq FROM PUBLIC, anon, authenticated;
NOTIFY pgrst, 'reload schema';

