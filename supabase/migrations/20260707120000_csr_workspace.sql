-- ════════════════════════════════════════════════════════════════════════
-- Workspace del CSR — módulos: pendientes (to-do), obstáculos, y lecturas de
-- hitos y comercial para su cockpit.
-- ════════════════════════════════════════════════════════════════════════

-- ── Pendientes personales (to-do del agente) ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.csr_tasks (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner      uuid NOT NULL DEFAULT auth.uid(),
  title      text NOT NULL,
  notes      text,
  priority   text NOT NULL DEFAULT 'media' CHECK (priority IN ('alta','media','baja')),
  due_date   date,
  done       boolean NOT NULL DEFAULT false,
  ticket_id  uuid REFERENCES public.support_tickets(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_csr_tasks_owner ON public.csr_tasks(owner);
ALTER TABLE public.csr_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own csr tasks" ON public.csr_tasks;
CREATE POLICY "own csr tasks" ON public.csr_tasks FOR ALL
  USING (owner = auth.uid()) WITH CHECK (owner = auth.uid());

-- ── Obstáculos / impedimentos ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.csr_blockers (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  client_id   text,
  ticket_id   uuid REFERENCES public.support_tickets(id) ON DELETE SET NULL,
  severity    text NOT NULL DEFAULT 'media' CHECK (severity IN ('alta','media','baja')),
  status      text NOT NULL DEFAULT 'abierto' CHECK (status IN ('abierto','en_gestion','resuelto')),
  created_by  uuid DEFAULT auth.uid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_csr_blockers_status ON public.csr_blockers(status);
ALTER TABLE public.csr_blockers ENABLE ROW LEVEL SECURITY;

-- Staff de soporte (admin/pm/gerente_soporte/csr) gestiona obstáculos; borrado
-- solo gestión (no csr).
DROP POLICY IF EXISTS "support read blockers" ON public.csr_blockers;
CREATE POLICY "support read blockers" ON public.csr_blockers FOR SELECT
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'pm'::app_role)
      OR has_role(auth.uid(),'gerente_soporte'::app_role) OR public.is_csr_user());
DROP POLICY IF EXISTS "support write blockers" ON public.csr_blockers;
CREATE POLICY "support write blockers" ON public.csr_blockers FOR INSERT
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'pm'::app_role)
      OR has_role(auth.uid(),'gerente_soporte'::app_role) OR public.is_csr_user());
DROP POLICY IF EXISTS "support update blockers" ON public.csr_blockers;
CREATE POLICY "support update blockers" ON public.csr_blockers FOR UPDATE
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'pm'::app_role)
      OR has_role(auth.uid(),'gerente_soporte'::app_role) OR public.is_csr_user())
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'pm'::app_role)
      OR has_role(auth.uid(),'gerente_soporte'::app_role) OR public.is_csr_user());
DROP POLICY IF EXISTS "managers delete blockers" ON public.csr_blockers;
CREATE POLICY "managers delete blockers" ON public.csr_blockers FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'pm'::app_role)
      OR has_role(auth.uid(),'gerente_soporte'::app_role));

-- ── Lecturas para el cockpit del CSR: hitos y comercial ──────────────────
DROP POLICY IF EXISTS "csr read milestones" ON public.contract_milestones;
CREATE POLICY "csr read milestones" ON public.contract_milestones FOR SELECT
  USING (public.is_csr_user());

DROP POLICY IF EXISTS "csr read quotes" ON public.quotes;
CREATE POLICY "csr read quotes" ON public.quotes FOR SELECT
  USING (public.is_csr_user());
