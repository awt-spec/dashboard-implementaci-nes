-- ============================================================================
-- Equipos SVA + días no laborables — gap Tanda C.1 (ERP-048 a 051)
-- "Equipo de servicios de valor agregado" como entidad propia (distinta de
-- los departments del directorio). Cada equipo tiene su calendario de días
-- no laborables, que el cálculo de SLA debe respetar a futuro.
-- ============================================================================

CREATE TABLE public.sva_teams (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  description   text,
  lead_user_id  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  color         text NOT NULL DEFAULT '#C8200F',
  is_active     boolean NOT NULL DEFAULT true,
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name)
);

CREATE INDEX idx_sva_teams_active ON public.sva_teams(is_active);

CREATE TRIGGER set_sva_teams_updated_at
  BEFORE UPDATE ON public.sva_teams
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Días no laborables por equipo (feriados, vacaciones colectivas) ─────────
CREATE TABLE public.sva_team_holidays (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sva_team_id  uuid NOT NULL REFERENCES public.sva_teams(id) ON DELETE CASCADE,
  holiday_date date NOT NULL,
  description  text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (sva_team_id, holiday_date)
);

CREATE INDEX idx_sva_team_holidays_team ON public.sva_team_holidays(sva_team_id, holiday_date);

-- ── Miembros del equipo SVA (N:M con profiles/auth) ─────────────────────────
CREATE TABLE public.sva_team_members (
  sva_team_id  uuid NOT NULL REFERENCES public.sva_teams(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (sva_team_id, user_id)
);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.sva_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sva_team_holidays ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sva_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff reads sva_teams" ON public.sva_teams FOR SELECT USING (public.is_staff_user());
CREATE POLICY "Admin or pm manages sva_teams" ON public.sva_teams FOR ALL
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'pm'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'pm'::app_role));

CREATE POLICY "Staff reads sva_team_holidays" ON public.sva_team_holidays FOR SELECT USING (public.is_staff_user());
CREATE POLICY "Admin or pm manages sva_team_holidays" ON public.sva_team_holidays FOR ALL
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'pm'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'pm'::app_role));

CREATE POLICY "Staff reads sva_team_members" ON public.sva_team_members FOR SELECT USING (public.is_staff_user());
CREATE POLICY "Admin or pm manages sva_team_members" ON public.sva_team_members FOR ALL
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'pm'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'pm'::app_role));

COMMENT ON TABLE public.sva_teams IS
  'Equipos de servicios de valor agregado (Customer Success). Gap Tanda C.1 (ERP-048 a 050).';
COMMENT ON TABLE public.sva_team_holidays IS
  'Días no laborables por equipo SVA. El cálculo de SLA debe respetarlos. Gap ERP-051.';
