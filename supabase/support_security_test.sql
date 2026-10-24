-- Read-only assertions for an isolated Supabase database after
-- migration_support_tickets.sql. This script never inserts, updates or deletes.

DO $$
DECLARE
  rls_enabled BOOLEAN;
BEGIN
  SELECT c.relrowsecurity INTO rls_enabled FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'support_tickets';
  IF COALESCE(rls_enabled, false) IS NOT TRUE THEN RAISE EXCEPTION 'support_tickets must have RLS'; END IF;
  SELECT c.relrowsecurity INTO rls_enabled FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'support_attachments';
  IF COALESCE(rls_enabled, false) IS NOT TRUE THEN RAISE EXCEPTION 'support_attachments must have RLS'; END IF;
  IF has_table_privilege('authenticated', 'public.support_tickets', 'INSERT') THEN RAISE EXCEPTION 'authenticated must not insert tickets directly'; END IF;
  IF has_table_privilege('authenticated', 'public.support_messages', 'INSERT') THEN RAISE EXCEPTION 'authenticated must not insert support messages directly'; END IF;
  IF has_table_privilege('anon', 'public.support_tickets', 'SELECT') THEN RAISE EXCEPTION 'anon must not read tickets'; END IF;
  IF has_function_privilege('anon', 'public.create_support_ticket(text,text)', 'EXECUTE') THEN RAISE EXCEPTION 'anon must not execute ticket creation'; END IF;
  IF NOT has_function_privilege('authenticated', 'public.create_support_ticket(text,text)', 'EXECUTE') THEN RAISE EXCEPTION 'authenticated must create through the RPC'; END IF;
  IF NOT has_function_privilege('authenticated', 'public.admin_reply_support_ticket(uuid,text,boolean)', 'EXECUTE') THEN RAISE EXCEPTION 'authenticated must reach the admin RPC for server-side role checking'; END IF;
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'support attachments owner upload by authorization') THEN RAISE EXCEPTION 'browser INSERT policy must not exist; uploads use the Edge Function'; END IF;
  IF EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'support-attachments' AND public IS TRUE) THEN RAISE EXCEPTION 'support bucket must be private'; END IF;
END;
$$;


