-- Consistencia del rol colaborador: restringe el borrado de entidades core del
-- proyecto y de soporte a roles de gestión (excluye colaborador). Estas tablas
-- solo tenían "Staff delete …" (cualquier staff), así que se reemplaza por
-- "Managers delete …" para que admin/pm (y gerente / gerente_soporte según
-- corresponda) conserven el borrado y el colaborador no.

-- ── Entidades core del proyecto: admin / pm / gerente ──────────────────────
DROP POLICY IF EXISTS "Staff delete deliverables" ON public.deliverables;
DROP POLICY IF EXISTS "Managers delete deliverables" ON public.deliverables;
CREATE POLICY "Managers delete deliverables" ON public.deliverables FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'pm'::app_role) OR has_role(auth.uid(),'gerente'::app_role));

DROP POLICY IF EXISTS "Staff delete phases" ON public.phases;
DROP POLICY IF EXISTS "Managers delete phases" ON public.phases;
CREATE POLICY "Managers delete phases" ON public.phases FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'pm'::app_role) OR has_role(auth.uid(),'gerente'::app_role));

DROP POLICY IF EXISTS "Staff delete risks" ON public.risks;
DROP POLICY IF EXISTS "Managers delete risks" ON public.risks;
CREATE POLICY "Managers delete risks" ON public.risks FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'pm'::app_role) OR has_role(auth.uid(),'gerente'::app_role));

DROP POLICY IF EXISTS "Staff delete meeting_minutes" ON public.meeting_minutes;
DROP POLICY IF EXISTS "Managers delete meeting_minutes" ON public.meeting_minutes;
CREATE POLICY "Managers delete meeting_minutes" ON public.meeting_minutes FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'pm'::app_role) OR has_role(auth.uid(),'gerente'::app_role));

DROP POLICY IF EXISTS "Staff delete action_items" ON public.action_items;
DROP POLICY IF EXISTS "Managers delete action_items" ON public.action_items;
CREATE POLICY "Managers delete action_items" ON public.action_items FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'pm'::app_role) OR has_role(auth.uid(),'gerente'::app_role));

-- ── Entidades de soporte: admin / pm / gerente_soporte ─────────────────────
DROP POLICY IF EXISTS "Staff delete support_minutes" ON public.support_minutes;
DROP POLICY IF EXISTS "Managers delete support_minutes" ON public.support_minutes;
CREATE POLICY "Managers delete support_minutes" ON public.support_minutes FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'pm'::app_role) OR has_role(auth.uid(),'gerente_soporte'::app_role));

DROP POLICY IF EXISTS "Staff delete support_ticket_notes" ON public.support_ticket_notes;
DROP POLICY IF EXISTS "Managers delete support_ticket_notes" ON public.support_ticket_notes;
CREATE POLICY "Managers delete support_ticket_notes" ON public.support_ticket_notes FOR DELETE
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'pm'::app_role) OR has_role(auth.uid(),'gerente_soporte'::app_role));
