ALTER TABLE public.company_opportunities ADD COLUMN IF NOT EXISTS budget_amount TEXT;
ALTER TABLE public.company_opportunities ADD COLUMN IF NOT EXISTS estimated_time TEXT;
