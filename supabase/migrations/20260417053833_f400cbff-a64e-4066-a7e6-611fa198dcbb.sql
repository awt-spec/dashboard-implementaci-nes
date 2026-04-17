-- ============ GAMIFICATION ============
CREATE TABLE public.team_kudos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_member_id UUID NOT NULL REFERENCES public.sysde_team_members(id) ON DELETE CASCADE,
  to_member_id UUID NOT NULL REFERENCES public.sysde_team_members(id) ON DELETE CASCADE,
  category TEXT NOT NULL DEFAULT 'teamwork',
  message TEXT NOT NULL,
  emoji TEXT DEFAULT '👏',
  is_public BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.team_kudos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all select kudos" ON public.team_kudos FOR SELECT USING (true);
CREATE POLICY "auth insert kudos" ON public.team_kudos FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "auth delete kudos" ON public.team_kudos FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TABLE public.team_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT DEFAULT '🏆',
  color TEXT DEFAULT 'amber',
  category TEXT DEFAULT 'achievement',
  criteria JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.team_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all select badges" ON public.team_badges FOR SELECT USING (true);
CREATE POLICY "auth manage badges" ON public.team_badges FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TABLE public.team_member_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.sysde_team_members(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.team_badges(id) ON DELETE CASCADE,
  awarded_by TEXT,
  reason TEXT,
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, badge_id)
);
ALTER TABLE public.team_member_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all select mbadges" ON public.team_member_badges FOR SELECT USING (true);
CREATE POLICY "auth manage mbadges" ON public.team_member_badges FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- Seed default badges
INSERT INTO public.team_badges (code, name, description, icon, color, category) VALUES
  ('velocity_hero','Velocity Hero','Top performer en sprint','🚀','emerald','performance'),
  ('mentor','Mentor','Apoya y forma a otros','🧑‍🏫','blue','culture'),
  ('innovation','Innovador','Propone ideas disruptivas','💡','amber','culture'),
  ('quality','Calidad','Cero defectos en entregas','✨','violet','quality'),
  ('teamplayer','Team Player','Excelente colaboración','🤝','rose','culture'),
  ('cert_master','Certified Master','3+ certificaciones','🎓','indigo','learning');

-- ============ TIME-OFF ============
CREATE TABLE public.team_time_off (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.sysde_team_members(id) ON DELETE CASCADE,
  type TEXT NOT NULL DEFAULT 'vacation',
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.team_time_off ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all select timeoff" ON public.team_time_off FOR SELECT USING (true);
CREATE POLICY "auth manage timeoff" ON public.team_time_off FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TRIGGER trg_time_off_updated BEFORE UPDATE ON public.team_time_off FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============ LEARNING ============
CREATE TABLE public.learning_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  provider TEXT,
  url TEXT,
  description TEXT,
  related_skills TEXT[] DEFAULT '{}',
  level TEXT DEFAULT 'intermediate',
  duration_hours NUMERIC DEFAULT 0,
  cost NUMERIC DEFAULT 0,
  currency TEXT DEFAULT 'USD',
  is_internal BOOLEAN DEFAULT false,
  category TEXT DEFAULT 'technical',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.learning_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all select courses" ON public.learning_courses FOR SELECT USING (true);
CREATE POLICY "auth manage courses" ON public.learning_courses FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE TRIGGER trg_courses_updated BEFORE UPDATE ON public.learning_courses FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.learning_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES public.sysde_team_members(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES public.learning_courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'enrolled',
  progress_pct INTEGER NOT NULL DEFAULT 0,
  started_at DATE,
  completed_at DATE,
  hours_logged NUMERIC NOT NULL DEFAULT 0,
  rating INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (member_id, course_id)
);
ALTER TABLE public.learning_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all select enrollments" ON public.learning_enrollments FOR SELECT USING (true);
CREATE POLICY "auth manage enrollments" ON public.learning_enrollments FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE TRIGGER trg_enrollments_updated BEFORE UPDATE ON public.learning_enrollments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Mentor AI conversations
CREATE TABLE public.mentor_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID REFERENCES public.sysde_team_members(id) ON DELETE CASCADE,
  topic TEXT,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.mentor_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "all select mentor" ON public.mentor_conversations FOR SELECT USING (true);
CREATE POLICY "auth manage mentor" ON public.mentor_conversations FOR ALL TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE TRIGGER trg_mentor_updated BEFORE UPDATE ON public.mentor_conversations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Indexes
CREATE INDEX idx_kudos_to ON public.team_kudos(to_member_id);
CREATE INDEX idx_kudos_created ON public.team_kudos(created_at DESC);
CREATE INDEX idx_timeoff_member ON public.team_time_off(member_id);
CREATE INDEX idx_timeoff_dates ON public.team_time_off(start_date, end_date);
CREATE INDEX idx_enrollments_member ON public.learning_enrollments(member_id);
CREATE INDEX idx_courses_skills ON public.learning_courses USING GIN(related_skills);