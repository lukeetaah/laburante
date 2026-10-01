"""Run with `python3 supabase/tests/test_job_outcome_ownership.py`.

Requires psql and PG* variables pointing to an empty disposable PostgreSQL
database, using a role that can create roles/extensions. Each case rolls back.
Loads the actual production job trigger/policies and schema outcome constraints;
only Supabase auth helpers and referenced identity tables are fixture substitutes.
"""

import json
from pathlib import Path
import subprocess
import unittest


SUPABASE = Path(__file__).resolve().parents[1]
CLIENT = "00000000-0000-0000-0000-000000000001"
PRO = "00000000-0000-0000-0000-000000000002"
OUTSIDER = "00000000-0000-0000-0000-000000000003"
JOB = "00000000-0000-0000-0000-000000000004"


def section(filename, start, end):
    return SUPABASE.joinpath(filename).read_text().split(start, 1)[1].split(end, 1)[0]


TABLE = "CREATE TABLE IF NOT EXISTS public.job_requests (" + section(
    "schema.sql", "CREATE TABLE IF NOT EXISTS public.job_requests (", "-- INDEXES FOR JOB REQUESTS"
)
OUTCOMES = SUPABASE.joinpath("migration_job_outcomes_and_contact_gate.sql").read_text().split(
    "-- Keep job records private", 1
)[0]
CONTROLS = "ALTER TABLE public.job_requests ENABLE ROW LEVEL SECURITY;" + section(
    "migration_production_security_hardening.sql",
    "ALTER TABLE public.job_requests ENABLE ROW LEVEL SECURITY;",
    "-- 5. Recommendation identity",
)
FIXTURE = f"""
BEGIN;
CREATE ROLE authenticated NOLOGIN;
CREATE ROLE anon NOLOGIN;
CREATE SCHEMA auth;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS
  $$ SELECT current_setting('request.jwt.claims', true)::jsonb $$;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
  $$ SELECT (auth.jwt()->>'sub')::uuid $$;
GRANT USAGE ON SCHEMA auth, public TO authenticated, anon;
CREATE TABLE auth.users (id uuid PRIMARY KEY);
CREATE TABLE public.profiles (id uuid PRIMARY KEY);
INSERT INTO auth.users VALUES ('{CLIENT}'), ('{PRO}');
INSERT INTO public.profiles VALUES ('{PRO}');
{TABLE}
{OUTCOMES}
INSERT INTO public.job_requests
  (id, client_id, profile_id, client_name, client_contact, title, description, status)
VALUES ('{JOB}', '{CLIENT}', '{PRO}', 'Client', 'Synthetic', 'Job', 'Test', 'en_progreso');
{CONTROLS}
"""


def actor(user_id, admin=False):
    claims = json.dumps({"sub": user_id, "app_metadata": {"role": "admin" if admin else "user"}})
    return f"SET LOCAL ROLE authenticated; SET LOCAL request.jwt.claims = '{claims}';"


def update(assignments):
    return f"UPDATE public.job_requests SET {assignments} WHERE id = '{JOB}';"


def reject(statement, message):
    return f"""
DO $$ BEGIN
  BEGIN
    {statement}
    RAISE EXCEPTION 'expected rejection: {message}';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> '{message}' THEN RAISE; END IF;
  END;
END $$;
"""


def assert_job(condition):
    return f"""
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.job_requests WHERE id = '{JOB}' AND ({condition})) THEN
    RAISE EXCEPTION 'unexpected persisted job';
  END IF;
END $$;
"""


class OutcomeOwnership(unittest.TestCase):
    def run_sql(self, sql):
        result = subprocess.run(
            ["psql", "-X", "-v", "ON_ERROR_STOP=1", "-q"],
            input=FIXTURE + sql + "\nROLLBACK;\n", text=True, capture_output=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)

    def test_cannot_write_peer_outcome(self):
        for user_id, column, message in (
            (CLIENT, "professional_outcome", "job_request_professional_outcome_requires_professional"),
            (PRO, "client_outcome", "job_request_client_outcome_requires_client"),
        ):
            for old, new in (("NULL", "'completado'"), ("'completado'", "'cancelado'"), ("'completado'", "NULL")):
                for status in ("en_progreso", "completado", "cancelado"):
                    with self.subTest(actor=user_id, column=column, old=old, new=new, status=status):
                        self.run_sql(
                            actor(OUTSIDER, admin=True) + update(f"{column} = {old}")
                            + actor(user_id)
                            + reject(update(f"{column} = {new}, status = '{status}'"), message)
                            + assert_job(f"{column} IS NOT DISTINCT FROM {old} AND status = 'en_progreso'")
                        )

    def test_can_write_own_outcome(self):
        for user_id, own, peer in ((CLIENT, "client_outcome", "professional_outcome"), (PRO, "professional_outcome", "client_outcome")):
            with self.subTest(actor=user_id):
                self.run_sql(
                    actor(OUTSIDER, admin=True) + update(f"{peer} = 'no_realizado'")
                    + actor(user_id)
                    + update("status = 'completado'")
                    + update(f"{own} = 'completado', {peer} = 'no_realizado', outcome_note = 'Test', outcome_updated_at = now()")
                    + assert_job(f"{own} = 'completado' AND {peer} = 'no_realizado' AND outcome_note = 'Test'")
                    + update(f"{own} = 'cancelado'") + assert_job(f"{own} = 'cancelado'")
                    + update(f"{own} = NULL") + assert_job(f"{own} IS NULL")
                )

    def test_cannot_change_both_answers(self):
        for user_id, message in (
            (CLIENT, "job_request_professional_outcome_requires_professional"),
            (PRO, "job_request_client_outcome_requires_client"),
        ):
            with self.subTest(actor=user_id):
                self.run_sql(actor(user_id) + reject(
                    update("client_outcome = 'completado', professional_outcome = 'completado'"), message
                ) + assert_job("client_outcome IS NULL AND professional_outcome IS NULL"))

    def test_deleted_client_answer_is_not_owned_by_professional(self):
        self.run_sql(actor(OUTSIDER, admin=True) + update("client_id = NULL") + actor(PRO)
                     + reject(update("client_outcome = 'completado'"), "job_request_client_outcome_requires_client"))

    def test_create_job(self):
        insert = f"""INSERT INTO public.job_requests
          (client_id, profile_id, client_name, client_contact, title, description, professional_outcome)
          VALUES ('{CLIENT}', '{PRO}', 'Client', 'Synthetic', 'New', 'Test', {{outcome}});"""
        self.run_sql(actor(CLIENT) + insert.format(outcome="NULL")
                     + reject(insert.format(outcome="'completado'"), "job_request_professional_outcome_requires_professional"))

    def test_admin_override(self):
        self.run_sql(actor(OUTSIDER, admin=True)
                     + update("client_outcome = 'completado', professional_outcome = 'cancelado', archived_at = now()")
                     + assert_job("client_outcome = 'completado' AND professional_outcome = 'cancelado' AND archived_at IS NOT NULL"))

    def test_nonparticipants_cannot_update(self):
        for user_id in (OUTSIDER, None):
            with self.subTest(actor=user_id):
                self.run_sql(actor(user_id) + update("client_outcome = 'completado', professional_outcome = 'completado'")
                             + actor(CLIENT) + assert_job("client_outcome IS NULL AND professional_outcome IS NULL"))

    def test_existing_controls(self):
        self.run_sql(actor(CLIENT)
                     + reject(update(f"client_id = '{PRO}'"), "job_request_participants_immutable")
                     + reject(update("archived_at = now()"), "job_request_archive_requires_admin")
                     + reject(update("status = 'presupuestado'"), "invalid_job_request_transition"))


if __name__ == "__main__":
    unittest.main()
