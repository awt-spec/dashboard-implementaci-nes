-- Hitos de facturación derivados del contrato (S2-01 + S2-02): la IA extrae del
-- contrato los hitos facturables (1, 2, 3…), cada uno con su cláusula y la
-- condición que lo dispara. Una persona confirma el cumplimiento para activarlos.
-- IA propone (status='propuesto'); humano confirma (confirmado → cumplido → facturado).

CREATE TABLE IF NOT EXISTS public.contract_milestones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id uuid NOT NULL,
  client_id text,
  numero int,
  descripcion text NOT NULL,
  condicion text,               -- qué lo dispara (ej. "cierre de parametrización con acta")
  clausula_referencia text,     -- cláusula del contrato que lo origina
  porcentaje numeric,           -- % del contrato/hito (ej. 70, 30)
  monto numeric,
  horas numeric,
  moneda text,
  status text NOT NULL DEFAULT 'propuesto'
    CHECK (status IN ('propuesto', 'confirmado', 'cumplido', 'facturado', 'descartado')),
  source text NOT NULL DEFAULT 'ia',   -- ia | manual
  confirmed_by text,
  confirmed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_contract_milestones_contract ON public.contract_milestones (contract_id);
CREATE INDEX IF NOT EXISTS idx_contract_milestones_client ON public.contract_milestones (client_id);

ALTER TABLE public.contract_milestones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read contract_milestones" ON public.contract_milestones;
CREATE POLICY "Read contract_milestones" ON public.contract_milestones
  FOR SELECT USING (is_staff_user() OR user_can_see_client(client_id));

DROP POLICY IF EXISTS "Admin pm manage contract_milestones" ON public.contract_milestones;
CREATE POLICY "Admin pm manage contract_milestones" ON public.contract_milestones
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pm'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pm'::app_role));
