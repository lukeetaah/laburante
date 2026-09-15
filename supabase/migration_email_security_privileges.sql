-- Restrict email-infrastructure privileges after the email notification migrations.
-- Privilege-only, idempotent, and intentionally does not alter data or functions.

REVOKE ALL ON TABLE public.notification_email_deliveries FROM anon;
REVOKE ALL ON TABLE public.notification_email_deliveries FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.notification_email_deliveries TO service_role;

REVOKE ALL ON TABLE public.notification_email_rate_limit FROM anon;
REVOKE ALL ON TABLE public.notification_email_rate_limit FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.notification_email_rate_limit TO service_role;

REVOKE ALL ON TABLE public.notification_preferences FROM anon;
REVOKE ALL ON TABLE public.notification_preferences FROM authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.notification_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.notification_preferences TO service_role;

REVOKE EXECUTE ON FUNCTION public.claim_notification_email_delivery(UUID, UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.claim_notification_email_delivery(UUID, UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION public.claim_notification_email_delivery(UUID, UUID) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.claim_notification_email_delivery(UUID, UUID) TO service_role;

REVOKE EXECUTE ON FUNCTION public.reserve_notification_email_quota(INTEGER, INTEGER) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reserve_notification_email_quota(INTEGER, INTEGER) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reserve_notification_email_quota(INTEGER, INTEGER) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_notification_email_quota(INTEGER, INTEGER) TO service_role;
