-- Extend work_time_entries with richer fields
ALTER TABLE public.work_time_entries
  ADD COLUMN IF NOT EXISTS description text DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_billable boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_manual boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS work_date date;

-- Backfill work_date for existing rows
UPDATE public.work_time_entries
  SET work_date = (started_at AT TIME ZONE 'UTC')::date
  WHERE work_date IS NULL;

-- Approval status constraint
DO $$ BEGIN
  ALTER TABLE public.work_time_entries
    ADD CONSTRAINT work_time_entries_approval_status_check
    CHECK (approval_status IN ('pending','approved','rejected'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_wte_work_date ON public.work_time_entries(work_date);
CREATE INDEX IF NOT EXISTS idx_wte_client ON public.work_time_entries(client_id);

-- Allow admin/pm to UPDATE entries (for approval workflow)
DO $$ BEGIN
  CREATE POLICY "Admins/PM can update time entries"
    ON public.work_time_entries
    FOR UPDATE
    USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pm'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- time_tracking_goals
CREATE TABLE IF NOT EXISTS public.time_tracking_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  weekly_target_hours numeric NOT NULL DEFAULT 40,
  billable_target_pct numeric NOT NULL DEFAULT 80,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.time_tracking_goals ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Users view own goals"
    ON public.time_tracking_goals FOR SELECT
    USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pm'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users upsert own goals"
    ON public.time_tracking_goals FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users update own goals"
    ON public.time_tracking_goals FOR UPDATE
    USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins delete goals"
    ON public.time_tracking_goals FOR DELETE
    USING (has_role(auth.uid(), 'admin'::app_role));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TRIGGER trg_time_tracking_goals_updated_at
  BEFORE UPDATE ON public.time_tracking_goals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();