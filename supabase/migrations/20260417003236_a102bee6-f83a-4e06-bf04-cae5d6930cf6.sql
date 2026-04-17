-- Skills matrix
CREATE TABLE IF NOT EXISTS public.team_member_skills (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.sysde_team_members(id) ON DELETE CASCADE,
  skill_name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'tecnica',
  level SMALLINT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  years_experience NUMERIC DEFAULT 0,
  is_certified BOOLEAN DEFAULT false,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, skill_name)
);

ALTER TABLE public.team_member_skills ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select team_member_skills" ON public.team_member_skills FOR SELECT USING (true);
CREATE POLICY "Auth insert team_member_skills" ON public.team_member_skills FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update team_member_skills" ON public.team_member_skills FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth delete team_member_skills" ON public.team_member_skills FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER trg_team_member_skills_updated BEFORE UPDATE ON public.team_member_skills
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_skills_member ON public.team_member_skills(member_id);
CREATE INDEX idx_skills_name ON public.team_member_skills(skill_name);

-- Onboarding tracking
CREATE TABLE IF NOT EXISTS public.team_onboarding (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.sysde_team_members(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'in_progress',
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expected_end_date DATE,
  completed_date DATE,
  buddy_member_id UUID REFERENCES public.sysde_team_members(id) ON DELETE SET NULL,
  checklist JSONB NOT NULL DEFAULT '[]'::jsonb,
  progress_pct INTEGER NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id)
);

ALTER TABLE public.team_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select team_onboarding" ON public.team_onboarding FOR SELECT USING (true);
CREATE POLICY "Auth insert team_onboarding" ON public.team_onboarding FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update team_onboarding" ON public.team_onboarding FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth delete team_onboarding" ON public.team_onboarding FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER trg_team_onboarding_updated BEFORE UPDATE ON public.team_onboarding
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();