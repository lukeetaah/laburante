-- LABURANTE — remove anonymous RPC execution from trigger-only functions.
-- These functions are invoked by table triggers and are not application RPCs.
-- Trigger execution is unaffected by revoking the caller's EXECUTE privilege.

BEGIN;

REVOKE EXECUTE ON FUNCTION public.protect_profile_verification_fields() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.protect_verified_whatsapp_contact_method() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.validate_recommendation_update() FROM PUBLIC, anon;

COMMIT;
