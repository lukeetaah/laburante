-- Repair DDL for the already-existing company_candidate_inquiries table.
-- This file intentionally does not create tables, modify rows, or touch RLS.

ALTER TABLE public.company_candidate_inquiries
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS uq_company_candidate_active_process
  ON public.company_candidate_inquiries(company_id, profile_id)
  WHERE status IN ('pendiente', 'aceptada') AND archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_company_candidate_inquiries_archive
  ON public.company_candidate_inquiries(company_id, profile_id, archived_at);
