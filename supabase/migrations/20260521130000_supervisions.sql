-- ============================================================================
-- Supervisiones formales — gap P4 Story Mapping (ERP-020 a 025)
-- Permite declarar "Pedro supervisa a Juan" o "Pedro supervisa al equipo soporte"
-- fuera del organigrama implícito de roles.
--
-- NO es lo mismo que gerente_client_assignments (gerente↔cliente).
-- Acá modelamos persona↔persona y persona↔equipo (department text).
-- ============================================================================

CREATE TYPE public.supervision_scope AS ENUM ('general','tickets','tasks','quality','time');

-- ── Supervisión de persona ─────────────────────────────────────────────────
CREATE TABLE public.user_supervisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  supervised_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope              public.supervision_scope NOT NULL DEFAULT 'general',
  started_at         date NOT NULL DEFAULT CURRENT_DATE,
  ended_at           date,
  is_active          boolean NOT NULL DEFAULT true,
  notes              text,
  created_by         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_supervision_no_self CHECK (supervisor_id != supervised_user_id),
  CONSTRAINT user_supervision_unique_active
    UNIQUE (supervisor_id, supervised_user_id, scope, started_at)
);

CREATE INDEX idx_user_supervisions_supervisor ON public.user_supervisions(supervisor_id, is_active);
CREATE INDEX idx_user_supervisions_supervised ON public.user_supervisions(supervised_user_id, is_active);

CREATE TRIGGER set_user_supervisions_updated_at
  BEFORE UPDATE ON public.user_supervisions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Supervisión de equipo (department text por ahora; cuando haya tabla teams, migrar) ─────
CREATE TABLE public.team_supervisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supervisor_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  team_department text NOT NULL,
  scope           public.supervision_scope NOT NULL DEFAULT 'general',
  started_at      date NOT NULL DEFAULT CURRENT_DATE,
  ended_at        date,
  is_active       boolean NOT NULL DEFAULT true,
  notes           text,
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT team_supervision_unique_active
    UNIQUE (supervisor_id, team_department, scope, started_at)
);

CREATE INDEX idx_team_supervisions_supervisor ON public.team_supervisions(supervisor_id, is_active);
CREATE INDEX idx_team_supervisions_department ON public.team_supervisions(team_department, is_active);

CREATE TRIGGER set_team_supervisions_updated_at
  BEFORE UPDATE ON public.team_supervisions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- Helpers SECURITY DEFINER para consumir desde RLS/UI
-- ============================================================================

-- ¿user_a supervisa directamente a user_b?
CREATE OR REPLACE FUNCTION public.is_user_supervisor_of(
  _supervisor_id uuid,
  _supervised_user_id uuid
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_supervisions
    WHERE supervisor_id = _supervisor_id
      AND supervised_user_id = _supervised_user_id
      AND is_active = true
      AND (ended_at IS NULL OR ended_at >= CURRENT_DATE)
  );
$$;

-- ¿user_a supervisa al department dept?
CREATE OR REPLACE FUNCTION public.is_team_supervisor_of(
  _supervisor_id uuid,
  _dept text
)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_supervisions
    WHERE supervisor_id = _supervisor_id
      AND team_department = _dept
      AND is_active = true
      AND (ended_at IS NULL OR ended_at >= CURRENT_DATE)
  );
$$;

-- Lista de supervisores activos de un usuario (combina supervisión directa + por department)
-- Útil para "¿quiénes me supervisan?" en perfil del colaborador
CREATE OR REPLACE FUNCTION public.get_supervisors_of_user(_user_id uuid)
RETURNS TABLE (
  supervisor_id uuid,
  source text,         -- 'direct' | 'team:<dept>'
  scope public.supervision_scope,
  started_at date
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  -- Supervisión directa persona↔persona
  SELECT us.supervisor_id,
         'direct'::text AS source,
         us.scope,
         us.started_at
  FROM public.user_supervisions us
  WHERE us.supervised_user_id = _user_id
    AND us.is_active = true
    AND (us.ended_at IS NULL OR us.ended_at >= CURRENT_DATE)

  UNION

  -- Supervisión por department del usuario
  SELECT ts.supervisor_id,
         ('team:' || ts.team_department)::text AS source,
         ts.scope,
         ts.started_at
  FROM public.team_supervisions ts
  JOIN public.profiles p ON p.user_id = _user_id
  JOIN public.sysde_team_members stm ON LOWER(TRIM(stm.email)) = LOWER(TRIM(p.email))
  WHERE stm.department = ts.team_department
    AND ts.is_active = true
    AND (ts.ended_at IS NULL OR ts.ended_at >= CURRENT_DATE);
$$;

GRANT EXECUTE ON FUNCTION public.is_user_supervisor_of(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_team_supervisor_of(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_supervisors_of_user(uuid) TO authenticated;

-- ============================================================================
-- RLS
-- ============================================================================

ALTER TABLE public.user_supervisions ENABLE ROW LEVEL SECURITY;

-- SELECT: staff ve todo; cada user ve donde es supervisor o supervisado
CREATE POLICY "Staff sees all user_supervisions"
  ON public.user_supervisions FOR SELECT
  USING (public.is_staff_user());

CREATE POLICY "User sees own user_supervisions"
  ON public.user_supervisions FOR SELECT
  USING (auth.uid() = supervisor_id OR auth.uid() = supervised_user_id);

-- INSERT / UPDATE / DELETE: solo admin
CREATE POLICY "Admin manages user_supervisions"
  ON public.user_supervisions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

ALTER TABLE public.team_supervisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff sees all team_supervisions"
  ON public.team_supervisions FOR SELECT
  USING (public.is_staff_user());

CREATE POLICY "User sees own team_supervisions"
  ON public.team_supervisions FOR SELECT
  USING (auth.uid() = supervisor_id);

CREATE POLICY "Admin manages team_supervisions"
  ON public.team_supervisions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.user_supervisions IS
  'Supervisión formal persona↔persona. Independiente del organigrama por rol. Gap P4 Story Mapping (ERP-020 a 022).';
COMMENT ON TABLE public.team_supervisions IS
  'Supervisión formal persona↔equipo (department text). Cuando exista tabla teams formal, migrar a FK. Gap P4 (ERP-023 a 025).';
COMMENT ON COLUMN public.user_supervisions.scope IS
  'general (todo) | tickets (solo soporte) | tasks (solo tareas) | quality (QA) | time (registro horas)';
COMMENT ON FUNCTION public.get_supervisors_of_user(uuid) IS
  'Devuelve todos los supervisores activos de un usuario, combinando supervisión directa + por department del sysde_team_members vinculado por email.';
