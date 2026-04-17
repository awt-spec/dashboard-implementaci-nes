-- Sprint dailies (standup diario)
CREATE TABLE public.sprint_dailies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id uuid NOT NULL,
  member_name text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  yesterday text DEFAULT '',
  today text DEFAULT '',
  blockers text DEFAULT '',
  mood smallint DEFAULT 3 CHECK (mood BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(sprint_id, member_name, date)
);
CREATE INDEX idx_sprint_dailies_sprint ON public.sprint_dailies(sprint_id, date DESC);

ALTER TABLE public.sprint_dailies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all select on sprint_dailies" ON public.sprint_dailies FOR SELECT USING (true);
CREATE POLICY "Auth insert sprint_dailies" ON public.sprint_dailies FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update sprint_dailies" ON public.sprint_dailies FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth delete sprint_dailies" ON public.sprint_dailies FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER trg_sprint_dailies_updated BEFORE UPDATE ON public.sprint_dailies FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Sprint retrospectives
CREATE TABLE public.sprint_retrospectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id uuid NOT NULL UNIQUE,
  what_went_well jsonb NOT NULL DEFAULT '[]'::jsonb,
  what_to_improve jsonb NOT NULL DEFAULT '[]'::jsonb,
  action_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  team_mood numeric DEFAULT 3,
  facilitator text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sprint_retrospectives ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all select on sprint_retrospectives" ON public.sprint_retrospectives FOR SELECT USING (true);
CREATE POLICY "Auth insert sprint_retrospectives" ON public.sprint_retrospectives FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update sprint_retrospectives" ON public.sprint_retrospectives FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth delete sprint_retrospectives" ON public.sprint_retrospectives FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE TRIGGER trg_sprint_retros_updated BEFORE UPDATE ON public.sprint_retrospectives FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Sprint reviews
CREATE TABLE public.sprint_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sprint_id uuid NOT NULL UNIQUE,
  demo_notes text DEFAULT '',
  completed_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  carry_over jsonb NOT NULL DEFAULT '[]'::jsonb,
  stakeholder_feedback text DEFAULT '',
  velocity_planned integer DEFAULT 0,
  velocity_completed integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.sprint_reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all select on sprint_reviews" ON public.sprint_reviews FOR SELECT USING (true);
CREATE POLICY "Auth insert sprint_reviews" ON public.sprint_reviews FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update sprint_reviews" ON public.sprint_reviews FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth delete sprint_reviews" ON public.sprint_reviews FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE TRIGGER trg_sprint_reviews_updated BEFORE UPDATE ON public.sprint_reviews FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Extend support_sprints with ceremony tracking
ALTER TABLE public.support_sprints
  ADD COLUMN IF NOT EXISTS ceremony_dates jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS notes text DEFAULT '';