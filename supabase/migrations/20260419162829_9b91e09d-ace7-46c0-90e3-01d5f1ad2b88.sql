ALTER TABLE public.sysde_team_members
  ADD COLUMN IF NOT EXISTS employment_type text NOT NULL DEFAULT 'salaried',
  ADD COLUMN IF NOT EXISTS hourly_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rate_currency text NOT NULL DEFAULT 'USD';

COMMENT ON COLUMN public.sysde_team_members.employment_type IS 'hourly | salaried';