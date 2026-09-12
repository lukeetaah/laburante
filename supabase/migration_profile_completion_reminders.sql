ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS profile_completion_reminder_sent_at TIMESTAMPTZ;
