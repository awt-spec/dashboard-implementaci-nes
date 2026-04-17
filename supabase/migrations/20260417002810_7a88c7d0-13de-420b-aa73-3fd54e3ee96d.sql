CREATE TABLE public.team_member_capacity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.sysde_team_members(id) ON DELETE CASCADE,
  weekly_hours INTEGER NOT NULL DEFAULT 40,
  timezone TEXT DEFAULT 'America/Lima',
  ooo_periods JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_allocation_pct INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id)
);

ALTER TABLE public.team_member_capacity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all select on capacity" ON public.team_member_capacity FOR SELECT USING (true);
CREATE POLICY "Auth insert capacity" ON public.team_member_capacity FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update capacity" ON public.team_member_capacity FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth delete capacity" ON public.team_member_capacity FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE TRIGGER update_capacity_updated_at BEFORE UPDATE ON public.team_member_capacity FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.team_member_certifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.sysde_team_members(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  issuer TEXT DEFAULT '',
  issued_date DATE,
  expires_date DATE,
  credential_url TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.team_member_certifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all select on certs" ON public.team_member_certifications FOR SELECT USING (true);
CREATE POLICY "Auth insert certs" ON public.team_member_certifications FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update certs" ON public.team_member_certifications FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth delete certs" ON public.team_member_certifications FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TABLE public.team_career_paths (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  member_id UUID NOT NULL REFERENCES public.sysde_team_members(id) ON DELETE CASCADE,
  current_role_name TEXT DEFAULT '',
  target_role_name TEXT DEFAULT '',
  skills_gap JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommended_certifications JSONB NOT NULL DEFAULT '[]'::jsonb,
  roadmap JSONB NOT NULL DEFAULT '[]'::jsonb,
  mentoring_suggestions JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_summary TEXT DEFAULT '',
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  model TEXT DEFAULT 'google/gemini-3-flash-preview'
);

ALTER TABLE public.team_career_paths ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all select on career_paths" ON public.team_career_paths FOR SELECT USING (true);
CREATE POLICY "Auth insert career_paths" ON public.team_career_paths FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update career_paths" ON public.team_career_paths FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth delete career_paths" ON public.team_career_paths FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_capacity_member ON public.team_member_capacity(member_id);
CREATE INDEX idx_certs_member ON public.team_member_certifications(member_id);
CREATE INDEX idx_career_member ON public.team_career_paths(member_id);