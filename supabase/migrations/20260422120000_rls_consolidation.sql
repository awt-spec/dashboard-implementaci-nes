-- ============================================================================
-- Consolidación de RLS: cerrar políticas "USING (true)" que quedaron abiertas
-- después de la migración 20260416233818.
--
-- Contexto: la migración inicial (20260309013541) creó "Allow all *" con
-- USING (true) sobre 10 tablas. La 20260416233818 parcheó solo INSERT/UPDATE/
-- DELETE en 6 tablas y dejó SELECT público y 7 tablas sin tocar. Este archivo
-- consolida el cierre.
--
-- Estrategia:
-- - SELECT: requiere usuario autenticado (auth.uid() IS NOT NULL) salvo en las
--   tablas de sharing vía token (shared_presentations y
--   shared_support_presentations), donde mantenemos acceso anónimo pero filtrado
--   por expires_at > now() para que enlaces vencidos dejen de responder desde
--   la base de datos, no desde el cliente.
-- - INSERT/UPDATE/DELETE: requiere usuario autenticado.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Tablas de cliente y operación: SELECT solo autenticado, mutaciones también
-- ---------------------------------------------------------------------------

-- clients: drop SELECT abierto (INSERT/UPDATE/DELETE ya fueron hardenizadas)
DROP POLICY IF EXISTS "Allow all select" ON public.clients;
CREATE POLICY "Authenticated select clients"
  ON public.clients FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- client_financials: 4 policies todavía con USING (true)
DROP POLICY IF EXISTS "Allow all select" ON public.client_financials;
DROP POLICY IF EXISTS "Allow all insert" ON public.client_financials;
DROP POLICY IF EXISTS "Allow all update" ON public.client_financials;
DROP POLICY IF EXISTS "Allow all delete" ON public.client_financials;
CREATE POLICY "Authenticated select client_financials"
  ON public.client_financials FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert client_financials"
  ON public.client_financials FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update client_financials"
  ON public.client_financials FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete client_financials"
  ON public.client_financials FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- phases
DROP POLICY IF EXISTS "Allow all select" ON public.phases;
DROP POLICY IF EXISTS "Allow all insert" ON public.phases;
DROP POLICY IF EXISTS "Allow all update" ON public.phases;
DROP POLICY IF EXISTS "Allow all delete" ON public.phases;
CREATE POLICY "Authenticated select phases"
  ON public.phases FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert phases"
  ON public.phases FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update phases"
  ON public.phases FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete phases"
  ON public.phases FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- deliverables
DROP POLICY IF EXISTS "Allow all select" ON public.deliverables;
DROP POLICY IF EXISTS "Allow all insert" ON public.deliverables;
DROP POLICY IF EXISTS "Allow all update" ON public.deliverables;
DROP POLICY IF EXISTS "Allow all delete" ON public.deliverables;
CREATE POLICY "Authenticated select deliverables"
  ON public.deliverables FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert deliverables"
  ON public.deliverables FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update deliverables"
  ON public.deliverables FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete deliverables"
  ON public.deliverables FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- tasks: SELECT abierto
DROP POLICY IF EXISTS "Allow all select" ON public.tasks;
CREATE POLICY "Authenticated select tasks"
  ON public.tasks FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- action_items
DROP POLICY IF EXISTS "Allow all select" ON public.action_items;
DROP POLICY IF EXISTS "Allow all insert" ON public.action_items;
DROP POLICY IF EXISTS "Allow all update" ON public.action_items;
DROP POLICY IF EXISTS "Allow all delete" ON public.action_items;
CREATE POLICY "Authenticated select action_items"
  ON public.action_items FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert action_items"
  ON public.action_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update action_items"
  ON public.action_items FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete action_items"
  ON public.action_items FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- meeting_minutes: solo SELECT falta
DROP POLICY IF EXISTS "Allow all select" ON public.meeting_minutes;
CREATE POLICY "Authenticated select meeting_minutes"
  ON public.meeting_minutes FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- email_notifications
DROP POLICY IF EXISTS "Allow all select" ON public.email_notifications;
DROP POLICY IF EXISTS "Allow all insert" ON public.email_notifications;
DROP POLICY IF EXISTS "Allow all update" ON public.email_notifications;
DROP POLICY IF EXISTS "Allow all delete" ON public.email_notifications;
CREATE POLICY "Authenticated select email_notifications"
  ON public.email_notifications FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert email_notifications"
  ON public.email_notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update email_notifications"
  ON public.email_notifications FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete email_notifications"
  ON public.email_notifications FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- comments
DROP POLICY IF EXISTS "Allow all select" ON public.comments;
DROP POLICY IF EXISTS "Allow all insert" ON public.comments;
DROP POLICY IF EXISTS "Allow all update" ON public.comments;
DROP POLICY IF EXISTS "Allow all delete" ON public.comments;
CREATE POLICY "Authenticated select comments"
  ON public.comments FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert comments"
  ON public.comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update comments"
  ON public.comments FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete comments"
  ON public.comments FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- risks
DROP POLICY IF EXISTS "Allow all select" ON public.risks;
DROP POLICY IF EXISTS "Allow all insert" ON public.risks;
DROP POLICY IF EXISTS "Allow all update" ON public.risks;
DROP POLICY IF EXISTS "Allow all delete" ON public.risks;
CREATE POLICY "Authenticated select risks"
  ON public.risks FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated insert risks"
  ON public.risks FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update risks"
  ON public.risks FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete risks"
  ON public.risks FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- support_tickets: SELECT abierto
DROP POLICY IF EXISTS "Allow all select on support_tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Allow all select" ON public.support_tickets;
CREATE POLICY "Authenticated select support_tickets"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- support_minutes: SELECT abierto
DROP POLICY IF EXISTS "Allow all select on support_minutes" ON public.support_minutes;
DROP POLICY IF EXISTS "Allow all select" ON public.support_minutes;
CREATE POLICY "Authenticated select support_minutes"
  ON public.support_minutes FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- ---------------------------------------------------------------------------
-- 2. Sharing vía token público: SELECT anónimo pero filtrado por expires_at
--    El frontend ya consultaba por token; ahora la base de datos también
--    rechaza tokens vencidos en lugar de dejar esa validación al cliente.
-- ---------------------------------------------------------------------------

-- shared_presentations
DROP POLICY IF EXISTS "Allow all select on shared_presentations" ON public.shared_presentations;
DROP POLICY IF EXISTS "Allow all select" ON public.shared_presentations;
CREATE POLICY "Public select active shared_presentations"
  ON public.shared_presentations FOR SELECT
  USING (expires_at > now());

-- shared_support_presentations
DROP POLICY IF EXISTS "Allow all select on shared_support_presentations" ON public.shared_support_presentations;
DROP POLICY IF EXISTS "Allow all select" ON public.shared_support_presentations;
CREATE POLICY "Public select active shared_support_presentations"
  ON public.shared_support_presentations FOR SELECT
  USING (expires_at > now());
