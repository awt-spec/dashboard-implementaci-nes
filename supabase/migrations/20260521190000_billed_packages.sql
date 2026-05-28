-- ============================================================================
-- Paquetes de servicio facturados individualmente — gap Tanda B (ERP-068 a 070)
-- Servicios cobrados APARTE del contrato recurrente: bolsa adicional de horas,
-- un proyecto puntual, licencias extra. Hoy se facturaban fuera del ERP.
-- ============================================================================

CREATE TABLE public.billed_packages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  -- Opcional: asociar a un contrato existente, o standalone
  contract_id  uuid REFERENCES public.client_contracts(id) ON DELETE SET NULL,

  name         text NOT NULL,
  description  text,
  package_type text NOT NULL DEFAULT 'horas'
               CHECK (package_type IN ('horas','servicio','licencia','proyecto','otro')),

  quantity     numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price   numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  total_amount numeric(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  currency     text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','CRC','EUR','MXN','GTQ')),

  -- Workflow de facturación
  status       text NOT NULL DEFAULT 'pendiente'
               CHECK (status IN ('pendiente','facturado','pagado','anulado')),
  invoice_number text,
  billed_date  date,
  paid_date    date,

  notes        text,
  created_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_billed_packages_client ON public.billed_packages(client_id, status);
CREATE INDEX idx_billed_packages_contract ON public.billed_packages(contract_id);

CREATE TRIGGER set_billed_packages_updated_at
  BEFORE UPDATE ON public.billed_packages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.billed_packages ENABLE ROW LEVEL SECURITY;

-- SELECT: staff todo; cliente solo los suyos ya facturados/pagados
CREATE POLICY "Staff selects all billed_packages"
  ON public.billed_packages FOR SELECT
  USING (public.is_staff_user());

CREATE POLICY "Cliente selects own billed_packages"
  ON public.billed_packages FOR SELECT
  USING (
    public.has_role(auth.uid(), 'cliente'::app_role)
    AND public.user_can_see_client(client_id)
    AND status IN ('facturado','pagado')
  );

-- INSERT/UPDATE: admin + pm (gestión comercial/financiera)
CREATE POLICY "Admin or pm inserts billed_packages"
  ON public.billed_packages FOR INSERT
  WITH CHECK (
    (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'pm'::app_role))
    AND created_by = auth.uid()
  );

CREATE POLICY "Admin or pm updates billed_packages"
  ON public.billed_packages FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'pm'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'pm'::app_role));

-- DELETE: solo admin
CREATE POLICY "Admin deletes billed_packages"
  ON public.billed_packages FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

COMMENT ON TABLE public.billed_packages IS
  'Paquetes de servicio facturados aparte del contrato recurrente. Gap Tanda B (ERP-068 a 070).';
COMMENT ON COLUMN public.billed_packages.status IS
  'pendiente (creado, sin facturar) → facturado (emitida factura) → pagado | anulado';
