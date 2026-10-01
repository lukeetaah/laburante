"""Run with python3 against an empty, disposable PostgreSQL database.

Uses psql's PGHOST/PGPORT/PGDATABASE/PGUSER environment variables. The connection
must be able to create roles. All fixtures and assertions are rolled back.
Tests the production migration's actual trigger, grants and RLS policies.
"""
from pathlib import Path
import re
import subprocess

supabase = Path(__file__).resolve().parents[1]
schema = (supabase / "schema.sql").read_text()
migration = (supabase / "migration_production_security_hardening.sql").read_text()
table = re.search(
    r"CREATE TABLE IF NOT EXISTS public\.job_requests \(.*?\n\);", schema, re.S
).group()
start = migration.index("ALTER TABLE public.job_requests ENABLE ROW LEVEL SECURITY;")
controls = migration[start:migration.index("\n-- =", start)]

fixture = """
BEGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA auth;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
  SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb
$$;
GRANT USAGE ON SCHEMA auth, public TO authenticated;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE public.profiles (id uuid PRIMARY KEY);
INSERT INTO auth.users VALUES ('00000000-0000-0000-0000-000000000001');
INSERT INTO public.profiles VALUES ('00000000-0000-0000-0000-000000000002');
"""

assertions = """
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
INSERT INTO public.job_requests (
  id, client_id, profile_id, client_name, client_contact, title, description,
  status, budget_amount, budget_details, budget_estimated_time, budget_created_at
) VALUES (
  '00000000-0000-0000-0000-000000000010',
  auth.uid(), '00000000-0000-0000-0000-000000000002',
  'Test client', 'synthetic', 'Test job', 'Synthetic fixture',
  'presupuestado', 'forged', 'forged', 'forged', now()
);
DO $$ BEGIN
  ASSERT (SELECT status = 'solicitado' AND budget_amount IS NULL
    AND budget_details IS NULL AND budget_estimated_time IS NULL
    AND budget_created_at IS NULL FROM public.job_requests), 'insert must clear quotes';
END $$;

-- Client cannot create, replace or clear any quote field, either alone or
-- alongside an otherwise valid acceptance/cancellation transition.
DO $$
DECLARE
  field text;
  mode text;
  next_status text;
  replacement text;
  denied boolean;
  checks integer := 0;
BEGIN
  FOREACH mode IN ARRAY ARRAY['create', 'replace', 'clear'] LOOP
    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
    UPDATE public.job_requests SET status = 'presupuestado',
      budget_amount = CASE WHEN mode = 'create' THEN NULL ELSE '100' END,
      budget_details = CASE WHEN mode = 'create' THEN NULL ELSE 'Original quote' END,
      budget_estimated_time = CASE WHEN mode = 'create' THEN NULL ELSE '2 days' END,
      budget_created_at = CASE WHEN mode = 'create' THEN NULL ELSE '2026-01-01'::timestamptz END;
    ASSERT FOUND, 'professional can issue and revise quote';
    PERFORM set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
    FOREACH field IN ARRAY ARRAY['budget_amount', 'budget_details', 'budget_estimated_time', 'budget_created_at'] LOOP
      FOREACH next_status IN ARRAY ARRAY['presupuestado', 'aceptado', 'cancelado'] LOOP
        replacement := CASE WHEN mode = 'clear' THEN 'NULL'
          WHEN field = 'budget_created_at' THEN quote_literal('2026-02-01')
          ELSE quote_literal('altered by client') END;
        denied := false;
        BEGIN
          EXECUTE format('UPDATE public.job_requests SET %I = %s, status = %L', field, replacement, next_status);
        EXCEPTION WHEN raise_exception THEN
          IF SQLERRM <> 'job_request_budget_requires_professional' THEN RAISE; END IF;
          denied := true;
        END;
        ASSERT denied, format('client quote mutation allowed: %s / %s / %s', field, mode, next_status);
        checks := checks + 1;
      END LOOP;
    END LOOP;
  END LOOP;
  RAISE NOTICE '% unauthorized quote mutations rejected', checks;
END $$;

-- No-op quote writes and normal client acceptance remain allowed.
UPDATE public.job_requests SET budget_amount = budget_amount,
  budget_details = budget_details, budget_estimated_time = budget_estimated_time,
  budget_created_at = budget_created_at;
UPDATE public.job_requests SET status = 'aceptado';
DO $$ BEGIN
  ASSERT (SELECT status = 'aceptado' FROM public.job_requests), 'client acceptance';
END $$;
UPDATE public.job_requests SET status = 'en_progreso';
UPDATE public.job_requests SET status = 'completado';
DO $$ BEGIN
  ASSERT (SELECT status = 'completado' FROM public.job_requests), 'normal status flow';
END $$;

-- Nonparticipants and missing identities cannot update the row through RLS.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
DO $$ BEGIN
  UPDATE public.job_requests SET budget_amount = 'outsider';
  ASSERT NOT FOUND, 'nonparticipant denied by RLS';
END $$;
SELECT set_config('request.jwt.claim.sub', '', true);
DO $$ BEGIN
  UPDATE public.job_requests SET budget_amount = 'unauthenticated';
  ASSERT NOT FOUND, 'missing identity denied by RLS';
END $$;

-- Preserve the migration's explicit administrator override.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
SELECT set_config('request.jwt.claims', '{"app_metadata":{"role":"admin"}}', true);
UPDATE public.job_requests SET budget_amount = 'admin correction', archived_at = now();
DO $$ BEGIN
  ASSERT (SELECT budget_amount = 'admin correction' AND archived_at IS NOT NULL
    FROM public.job_requests), 'administrator override';
END $$;
ROLLBACK;
"""
subprocess.run(
    ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-v", "VERBOSITY=terse"],
    input=fixture + table + controls + assertions,
    text=True,
    check=True,
)
print("Budget ownership regression checks passed")
