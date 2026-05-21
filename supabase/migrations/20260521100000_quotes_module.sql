-- ============================================================================
-- Quotes module — gap P1 Story Mapping (PORTAL-005 + ERP-085 a 088)
-- Cierra el ciclo comercial: solicitud → cotización → aprobación cliente → ejecución
-- ============================================================================

-- ── Sequence para numeración COT-YYYY-NNNN ──────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS public.quotes_number_seq
  START WITH 1
  INCREMENT BY 1;

-- ── Función que genera quote_number (COT-2026-0001) ─────────────────────────
CREATE OR REPLACE FUNCTION public.generate_quote_number()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  v_year text;
  v_seq bigint;
BEGIN
  v_year := to_char(now(), 'YYYY');
  v_seq := nextval('public.quotes_number_seq');
  RETURN 'COT-' || v_year || '-' || lpad(v_seq::text, 4, '0');
END;
$$;

-- ============================================================================
-- TABLA: quotes
-- ============================================================================
CREATE TABLE public.quotes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_number text NOT NULL UNIQUE DEFAULT public.generate_quote_number(),

  -- Relación al ticket (opcional: una cotización puede ser standalone para un cliente)
  ticket_id uuid REFERENCES public.support_tickets(id) ON DELETE SET NULL,
  client_id text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,

  -- Contenido comercial
  title text NOT NULL,
  description text,
  terms text,
  currency text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','CRC','EUR','MXN','GTQ')),

  -- Totales (subtotal + tax = total)
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  tax_rate numeric(5,2) NOT NULL DEFAULT 0 CHECK (tax_rate >= 0 AND tax_rate <= 100),
  tax_amount numeric(12,2) NOT NULL DEFAULT 0,
  total_amount numeric(12,2) NOT NULL DEFAULT 0,

  -- Workflow
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','sent','approved','rejected','expired','cancelled')),
  valid_until date,

  -- Auditoría / firmas
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  sent_at timestamptz,
  sent_by uuid REFERENCES auth.users(id),

  approved_at timestamptz,
  approved_by uuid REFERENCES auth.users(id),

  rejected_at timestamptz,
  rejected_by uuid REFERENCES auth.users(id),
  rejection_reason text,

  cancelled_at timestamptz,
  cancellation_reason text,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quotes_ticket_id ON public.quotes(ticket_id);
CREATE INDEX idx_quotes_client_id ON public.quotes(client_id);
CREATE INDEX idx_quotes_status ON public.quotes(status);
CREATE INDEX idx_quotes_created_by ON public.quotes(created_by);
CREATE INDEX idx_quotes_created_at ON public.quotes(created_at DESC);

-- Trigger updated_at
CREATE TRIGGER set_quotes_updated_at
  BEFORE UPDATE ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ============================================================================
-- TABLA: quote_items (líneas de cotización)
-- ============================================================================
CREATE TABLE public.quote_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,

  item_type text NOT NULL DEFAULT 'horas'
    CHECK (item_type IN ('horas','servicios','licencias','consultoria','otros')),
  description text NOT NULL,
  quantity numeric(10,2) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  subtotal numeric(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  position int NOT NULL DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quote_items_quote_id ON public.quote_items(quote_id);

-- ============================================================================
-- TABLA: quote_attachments
-- ============================================================================
CREATE TABLE public.quote_attachments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,

  file_name text NOT NULL,
  file_path text NOT NULL, -- path en bucket support-ticket-attachments con prefijo quotes/<quote_id>/
  file_size bigint,
  mime_type text,

  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_quote_attachments_quote_id ON public.quote_attachments(quote_id);

-- ============================================================================
-- TRIGGER: recalcular totales cuando cambian items
-- ============================================================================
CREATE OR REPLACE FUNCTION public.recalculate_quote_totals()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_quote_id uuid;
  v_subtotal numeric(12,2);
  v_tax_rate numeric(5,2);
  v_tax_amount numeric(12,2);
  v_total numeric(12,2);
BEGIN
  v_quote_id := COALESCE(NEW.quote_id, OLD.quote_id);

  SELECT COALESCE(SUM(subtotal), 0) INTO v_subtotal
  FROM public.quote_items
  WHERE quote_id = v_quote_id;

  SELECT tax_rate INTO v_tax_rate
  FROM public.quotes WHERE id = v_quote_id;

  v_tax_amount := round(v_subtotal * (v_tax_rate / 100), 2);
  v_total := v_subtotal + v_tax_amount;

  UPDATE public.quotes
  SET subtotal = v_subtotal,
      tax_amount = v_tax_amount,
      total_amount = v_total,
      updated_at = now()
  WHERE id = v_quote_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER recalc_quote_on_items_change
  AFTER INSERT OR UPDATE OR DELETE ON public.quote_items
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_quote_totals();

-- Recalcular también cuando cambia tax_rate en quotes
CREATE OR REPLACE FUNCTION public.recalculate_quote_on_tax_change()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.tax_rate IS DISTINCT FROM OLD.tax_rate THEN
    NEW.tax_amount := round(NEW.subtotal * (NEW.tax_rate / 100), 2);
    NEW.total_amount := NEW.subtotal + NEW.tax_amount;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER recalc_quote_on_tax_change
  BEFORE UPDATE OF tax_rate ON public.quotes
  FOR EACH ROW
  EXECUTE FUNCTION public.recalculate_quote_on_tax_change();

-- ============================================================================
-- RLS — quotes
-- ============================================================================
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;

-- SELECT: staff ve todas, cliente ve solo las suyas en estados visibles
CREATE POLICY "Staff selects all quotes"
  ON public.quotes FOR SELECT
  USING (public.is_staff_user());

CREATE POLICY "Cliente selects own visible quotes"
  ON public.quotes FOR SELECT
  USING (
    public.has_role(auth.uid(), 'cliente'::app_role)
    AND public.user_can_see_client(client_id)
    AND status IN ('sent','approved','rejected','expired')
  );

-- INSERT: solo staff con permiso crea (admin/pm/gerente_soporte por default; gerente y colaborador via has_role)
CREATE POLICY "Staff inserts quotes"
  ON public.quotes FOR INSERT
  WITH CHECK (
    public.is_staff_user()
    AND created_by = auth.uid()
  );

-- UPDATE staff: edición libre mientras es draft o sent (admin/pm/gerente_soporte)
CREATE POLICY "Staff updates quotes"
  ON public.quotes FOR UPDATE
  USING (
    public.is_staff_user()
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'pm'::app_role)
      OR public.has_role(auth.uid(), 'gerente_soporte'::app_role)
      OR created_by = auth.uid()
    )
  )
  WITH CHECK (public.is_staff_user());

-- UPDATE cliente: solo cambiar status de sent → approved/rejected y poner rejection_reason
CREATE POLICY "Cliente approves or rejects own quote"
  ON public.quotes FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'cliente'::app_role)
    AND public.user_can_see_client(client_id)
    AND status = 'sent'
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'cliente'::app_role)
    AND public.user_can_see_client(client_id)
    AND status IN ('approved','rejected')
  );

-- DELETE: solo admin
CREATE POLICY "Admin deletes quotes"
  ON public.quotes FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============================================================================
-- RLS — quote_items
-- ============================================================================
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff full access quote_items"
  ON public.quote_items FOR ALL
  USING (public.is_staff_user())
  WITH CHECK (public.is_staff_user());

CREATE POLICY "Cliente selects items of visible quotes"
  ON public.quote_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_items.quote_id
        AND public.has_role(auth.uid(), 'cliente'::app_role)
        AND public.user_can_see_client(q.client_id)
        AND q.status IN ('sent','approved','rejected','expired')
    )
  );

-- ============================================================================
-- RLS — quote_attachments
-- ============================================================================
ALTER TABLE public.quote_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff full access quote_attachments"
  ON public.quote_attachments FOR ALL
  USING (public.is_staff_user())
  WITH CHECK (public.is_staff_user());

CREATE POLICY "Cliente selects attachments of visible quotes"
  ON public.quote_attachments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.quotes q
      WHERE q.id = quote_attachments.quote_id
        AND public.has_role(auth.uid(), 'cliente'::app_role)
        AND public.user_can_see_client(q.client_id)
        AND q.status IN ('sent','approved','rejected','expired')
    )
  );

-- ============================================================================
-- View: cotizaciones pendientes de aprobar por cliente (PORTAL-005)
-- ============================================================================
CREATE OR REPLACE VIEW public.quotes_pending_approval AS
SELECT
  q.id,
  q.quote_number,
  q.client_id,
  q.ticket_id,
  q.title,
  q.description,
  q.total_amount,
  q.currency,
  q.valid_until,
  q.sent_at,
  q.created_at,
  c.name AS client_name,
  st.ticket_id AS ticket_code,
  st.asunto AS ticket_subject
FROM public.quotes q
LEFT JOIN public.clients c ON c.id = q.client_id
LEFT JOIN public.support_tickets st ON st.id = q.ticket_id
WHERE q.status = 'sent'
  AND (q.valid_until IS NULL OR q.valid_until >= CURRENT_DATE);

GRANT SELECT ON public.quotes_pending_approval TO authenticated;

-- ============================================================================
-- Comentarios documentales
-- ============================================================================
COMMENT ON TABLE public.quotes IS
  'Cotizaciones de servicio. Cierra el ciclo comercial: solicitud→cotización→aprobación cliente→ejecución. Gap P1 del Story Mapping (PORTAL-005, ERP-085 a 088).';

COMMENT ON COLUMN public.quotes.status IS
  'Workflow: draft (staff edita) → sent (cliente puede aprobar/rechazar) → approved/rejected (terminal) | expired (cuando pasa valid_until) | cancelled (staff la mata)';

COMMENT ON TABLE public.quote_items IS
  'Líneas de cotización. subtotal es computed (quantity * unit_price). El total de la cotización se recalcula automáticamente vía trigger.';
