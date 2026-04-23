-- ─────────────────────────────────────────────────────────────────────
-- Rol "cliente" — Parte 2/2: policies que referencian el literal 'cliente'
--
-- Requiere que 20260423130000_cliente_role.sql ya haya sido committeada,
-- porque el valor 'cliente' del enum app_role sólo puede usarse desde
-- una transacción posterior al ADD VALUE.
-- ─────────────────────────────────────────────────────────────────────

-- support_tickets: SELECT + INSERT para cliente
DROP POLICY IF EXISTS "Cliente selects own client tickets" ON public.support_tickets;
CREATE POLICY "Cliente selects own client tickets"
  ON public.support_tickets
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'cliente')
    AND client_id = public.get_cliente_client_id(auth.uid())
  );

DROP POLICY IF EXISTS "Cliente editors insert tickets" ON public.support_tickets;
CREATE POLICY "Cliente editors insert tickets"
  ON public.support_tickets
  FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'cliente')
    AND public.has_cliente_permission(auth.uid(), client_id, 'editor')
  );

-- shared_support_presentations: cliente ve minutas de su empresa
DROP POLICY IF EXISTS "Cliente selects own client minutas" ON public.shared_support_presentations;
CREATE POLICY "Cliente selects own client minutas"
  ON public.shared_support_presentations
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'cliente')
    AND client_id = public.get_cliente_client_id(auth.uid())
  );

-- support_minutes_feedback: cliente lee y comenta
DROP POLICY IF EXISTS "Cliente selects own feedback" ON public.support_minutes_feedback;
CREATE POLICY "Cliente selects own feedback"
  ON public.support_minutes_feedback
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'cliente')
    AND client_id = public.get_cliente_client_id(auth.uid())
  );

DROP POLICY IF EXISTS "Cliente inserts own feedback" ON public.support_minutes_feedback;
CREATE POLICY "Cliente inserts own feedback"
  ON public.support_minutes_feedback
  FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'cliente')
    AND client_id = public.get_cliente_client_id(auth.uid())
  );

-- work_time_entries: cliente ve horas de su empresa
DROP POLICY IF EXISTS "Cliente selects own client hours" ON public.work_time_entries;
CREATE POLICY "Cliente selects own client hours"
  ON public.work_time_entries
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'cliente')
    AND client_id = public.get_cliente_client_id(auth.uid())
  );

-- support_ticket_notes: cliente ve sólo notas externas de sus tickets
DROP POLICY IF EXISTS "Cliente selects external notes" ON public.support_ticket_notes;
CREATE POLICY "Cliente selects external notes"
  ON public.support_ticket_notes
  FOR SELECT
  USING (
    public.has_role(auth.uid(), 'cliente')
    AND visibility = 'externa'
    AND ticket_id IN (
      SELECT id FROM public.support_tickets
      WHERE client_id = public.get_cliente_client_id(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Cliente editors insert external notes" ON public.support_ticket_notes;
CREATE POLICY "Cliente editors insert external notes"
  ON public.support_ticket_notes
  FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'cliente')
    AND visibility = 'externa'
    AND public.has_cliente_permission(
      auth.uid(),
      (SELECT client_id FROM public.support_tickets WHERE id = support_ticket_notes.ticket_id),
      'editor'
    )
  );
