-- ════════════════════════════════════════════════════════════════════════════
-- RLS STRICT — Cierra las policies USING(true) en tablas con datos sensibles.
--
-- Auditoría 2026-05-03 detectó que la migración seed inicial
-- (20260309013541) creó policies "Allow all select USING(true)" en tablas
-- legacy. Esto significa que un user con rol 'cliente' (8 cuentas live en
-- producción) que abra DevTools puede leer TODOS los rows de tablas con
-- datos sensibles (financials, emails, minutas privadas, etc.).
--
-- Esta migración:
--   1. DROP las policies permisivas USING(true)
--   2. CREATE policies por rol/scope:
--      • staff (admin/pm/ceo/gerente_soporte/colaborador) → SELECT todo
--      • gerente → solo su cliente asignado (gerente_client_assignments)
--      • cliente → solo su empresa (cliente_company_assignments)
--   3. Tablas con datos confidenciales (financials, emails, ai_usage_logs)
--      → admin/pm/ceo SOLO (sin cliente ni colaborador)
--   4. INSERT/UPDATE/DELETE restringidos por nivel de rol
--
-- Reusa helpers existentes:
--   • public.has_role(uid, role)
--   • public.is_cliente_user(), is_ceo_user(), is_gerente_soporte_user()
--   • public.get_cliente_client_id(uid)
-- ════════════════════════════════════════════════════════════════════════════

-- Helper compuesto que ya tenemos referenciado pero no centralizado.
-- "staff" = cualquier rol interno de SYSDE (no cliente).
CREATE OR REPLACE FUNCTION public.is_staff_user(_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin','pm','ceo','gerente','gerente_soporte','colaborador')
  );
$$;

COMMENT ON FUNCTION public.is_staff_user(uuid) IS
  'Devuelve true si el user tiene cualquier rol interno SYSDE (no cliente).';

-- Helper: ¿el user puede ver el cliente X? (admin/pm/ceo todos, gerente_soporte
-- todos, gerente solo su asignado, colaborador todos, cliente solo su empresa).
CREATE OR REPLACE FUNCTION public.user_can_see_client(_client_id text, _user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    -- Staff sin restricción (excepto gerente)
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id
        AND role IN ('admin','pm','ceo','gerente_soporte','colaborador')
    )
    -- Gerente solo si está asignado a este cliente
    OR EXISTS (
      SELECT 1 FROM public.gerente_client_assignments
      WHERE user_id = _user_id AND client_id = _client_id
    )
    -- Cliente solo si está asignado a esta empresa
    OR EXISTS (
      SELECT 1 FROM public.cliente_company_assignments
      WHERE user_id = _user_id AND client_id = _client_id
    );
$$;

COMMENT ON FUNCTION public.user_can_see_client(text, uuid) IS
  'Encapsula la lógica de visibilidad por cliente para todas las tablas scoped.';

-- ════════════════════════════════════════════════════════════════════════════
-- IDEMPOTENCIA: DROP de TODAS las policies que vamos a crear (por nombre).
-- Algunas pueden ya existir de migraciones previas con el mismo título.
-- ════════════════════════════════════════════════════════════════════════════
DO $idempotent$
DECLARE
  pol RECORD;
  policies_to_drop TEXT[] := ARRAY[
    -- clients
    'Scoped select clients', 'Admin/PM insert clients', 'Admin/PM update clients', 'Admin delete clients',
    -- client_financials
    'Admin/PM/CEO read financials', 'Admin/PM write financials', 'Admin/PM update financials', 'Admin delete financials',
    -- client_contacts
    'Scoped select client_contacts', 'Staff insert client_contacts', 'Staff update client_contacts', 'Admin/PM delete client_contacts',
    -- meeting_minutes
    'Scoped select meeting_minutes', 'Staff insert meeting_minutes', 'Staff update meeting_minutes', 'Admin/PM delete meeting_minutes',
    -- email_notifications
    'Admin/PM/CEO read email_notifications', 'Admin/PM write email_notifications', 'Admin/PM update email_notifications', 'Admin delete email_notifications',
    -- comments
    'Staff read comments', 'Staff insert comments', 'Staff update comments', 'Admin delete comments',
    -- tasks
    'Scoped select tasks', 'Staff insert tasks', 'Staff update tasks', 'Admin/PM delete tasks',
    -- phases
    'Scoped select phases', 'Staff insert phases', 'Staff update phases', 'Admin/PM delete phases',
    -- deliverables
    'Scoped select deliverables', 'Staff insert deliverables', 'Staff update deliverables', 'Admin/PM delete deliverables',
    -- risks
    'Staff read risks', 'Staff insert risks', 'Staff update risks', 'Admin/PM delete risks',
    -- action_items
    'Scoped select action_items', 'Staff insert action_items', 'Staff update action_items', 'Admin/PM delete action_items',
    -- client_notifications
    'Scoped select client_notifications', 'Staff insert client_notifications', 'Staff update client_notifications', 'Admin delete client_notifications',
    -- ai_usage_logs
    'Admin/CEO read ai_usage_logs', 'Admin insert ai_usage_logs', 'Admin update ai_usage_logs', 'Admin delete ai_usage_logs',
    -- task_*
    'Scoped select task_history', 'Staff write task_history',
    'Scoped select task_subtasks', 'Staff insert task_subtasks', 'Staff update task_subtasks', 'Staff delete task_subtasks',
    'Scoped select task_attachments', 'Staff insert task_attachments', 'Staff update task_attachments', 'Staff delete task_attachments',
    'Staff full access task_dependencies', 'Staff full access task_tags'
  ];
  table_names TEXT[] := ARRAY[
    'clients','client_financials','client_contacts','meeting_minutes','email_notifications',
    'comments','tasks','phases','deliverables','risks','action_items','client_notifications',
    'ai_usage_logs','task_history','task_subtasks','task_attachments','task_dependencies','task_tags'
  ];
  t TEXT;
  p TEXT;
BEGIN
  FOREACH t IN ARRAY table_names LOOP
    FOREACH p IN ARRAY policies_to_drop LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', p, t);
    END LOOP;
  END LOOP;
END;
$idempotent$;

-- ════════════════════════════════════════════════════════════════════════════
-- TABLA: clients
-- SELECT: staff todo · gerente su asignado · cliente su empresa
-- INSERT/UPDATE/DELETE: admin/pm
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Allow all select" ON public.clients;
DROP POLICY IF EXISTS "Allow all insert" ON public.clients;
DROP POLICY IF EXISTS "Allow all update" ON public.clients;
DROP POLICY IF EXISTS "Allow all delete" ON public.clients;

CREATE POLICY "Scoped select clients" ON public.clients
  FOR SELECT TO authenticated
  USING (public.user_can_see_client(id));

CREATE POLICY "Admin/PM insert clients" ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pm'));

CREATE POLICY "Admin/PM update clients" ON public.clients
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pm'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pm'));

CREATE POLICY "Admin delete clients" ON public.clients
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ════════════════════════════════════════════════════════════════════════════
-- TABLA: client_financials  ── CRÍTICA — admin/pm/ceo ONLY
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Allow all select" ON public.client_financials;
DROP POLICY IF EXISTS "Allow all insert" ON public.client_financials;
DROP POLICY IF EXISTS "Allow all update" ON public.client_financials;
DROP POLICY IF EXISTS "Allow all delete" ON public.client_financials;

CREATE POLICY "Admin/PM/CEO read financials" ON public.client_financials
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'pm')
    OR public.has_role(auth.uid(), 'ceo')
  );

CREATE POLICY "Admin/PM write financials" ON public.client_financials
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pm'));

CREATE POLICY "Admin/PM update financials" ON public.client_financials
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pm'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pm'));

CREATE POLICY "Admin delete financials" ON public.client_financials
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ════════════════════════════════════════════════════════════════════════════
-- TABLA: client_contacts
-- SELECT: scoped al cliente · INSERT/UPDATE: staff · DELETE: admin/pm
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Allow all select on client_contacts" ON public.client_contacts;
DROP POLICY IF EXISTS "Allow all insert on client_contacts" ON public.client_contacts;
DROP POLICY IF EXISTS "Allow all update on client_contacts" ON public.client_contacts;
DROP POLICY IF EXISTS "Allow all delete on client_contacts" ON public.client_contacts;

CREATE POLICY "Scoped select client_contacts" ON public.client_contacts
  FOR SELECT TO authenticated
  USING (public.user_can_see_client(client_id));

CREATE POLICY "Staff insert client_contacts" ON public.client_contacts
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_user());

CREATE POLICY "Staff update client_contacts" ON public.client_contacts
  FOR UPDATE TO authenticated
  USING (public.is_staff_user())
  WITH CHECK (public.is_staff_user());

CREATE POLICY "Admin/PM delete client_contacts" ON public.client_contacts
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pm'));

-- ════════════════════════════════════════════════════════════════════════════
-- TABLA: meeting_minutes
-- SELECT: staff todo · cliente solo si visible_to_client=true Y client_id matchea
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Allow all select" ON public.meeting_minutes;
DROP POLICY IF EXISTS "Allow all insert" ON public.meeting_minutes;
DROP POLICY IF EXISTS "Allow all update" ON public.meeting_minutes;
DROP POLICY IF EXISTS "Allow all delete" ON public.meeting_minutes;

CREATE POLICY "Scoped select meeting_minutes" ON public.meeting_minutes
  FOR SELECT TO authenticated
  USING (
    -- Staff lee todo
    public.is_staff_user()
    -- Cliente lee solo si la minuta es visible_to_client Y de su empresa
    OR (
      public.is_cliente_user()
      AND visible_to_client = true
      AND client_id = public.get_cliente_client_id(auth.uid())
    )
  );

CREATE POLICY "Staff insert meeting_minutes" ON public.meeting_minutes
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_user());

CREATE POLICY "Staff update meeting_minutes" ON public.meeting_minutes
  FOR UPDATE TO authenticated
  USING (public.is_staff_user())
  WITH CHECK (public.is_staff_user());

CREATE POLICY "Admin/PM delete meeting_minutes" ON public.meeting_minutes
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pm'));

-- ════════════════════════════════════════════════════════════════════════════
-- TABLA: email_notifications  ── admin/pm/ceo SOLO (no cliente)
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Allow all select" ON public.email_notifications;
DROP POLICY IF EXISTS "Allow all insert" ON public.email_notifications;
DROP POLICY IF EXISTS "Allow all update" ON public.email_notifications;
DROP POLICY IF EXISTS "Allow all delete" ON public.email_notifications;

CREATE POLICY "Admin/PM/CEO read email_notifications" ON public.email_notifications
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'pm')
    OR public.has_role(auth.uid(), 'ceo')
  );

CREATE POLICY "Admin/PM write email_notifications" ON public.email_notifications
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pm'));

CREATE POLICY "Admin/PM update email_notifications" ON public.email_notifications
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pm'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pm'));

CREATE POLICY "Admin delete email_notifications" ON public.email_notifications
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ════════════════════════════════════════════════════════════════════════════
-- TABLA: comments  ── solo staff (comentarios internos)
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Allow all select" ON public.comments;
DROP POLICY IF EXISTS "Allow all insert" ON public.comments;
DROP POLICY IF EXISTS "Allow all update" ON public.comments;
DROP POLICY IF EXISTS "Allow all delete" ON public.comments;

CREATE POLICY "Staff read comments" ON public.comments
  FOR SELECT TO authenticated
  USING (public.is_staff_user());

CREATE POLICY "Staff insert comments" ON public.comments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_user());

CREATE POLICY "Staff update comments" ON public.comments
  FOR UPDATE TO authenticated
  USING (public.is_staff_user())
  WITH CHECK (public.is_staff_user());

CREATE POLICY "Admin delete comments" ON public.comments
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ════════════════════════════════════════════════════════════════════════════
-- TABLA: tasks  ── staff todo · cliente solo su client_id Y visibility='externa'
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Allow all select" ON public.tasks;
DROP POLICY IF EXISTS "Allow all insert" ON public.tasks;
DROP POLICY IF EXISTS "Allow all update" ON public.tasks;
DROP POLICY IF EXISTS "Allow all delete" ON public.tasks;

CREATE POLICY "Scoped select tasks" ON public.tasks
  FOR SELECT TO authenticated
  USING (
    public.is_staff_user()
    OR (
      public.is_cliente_user()
      AND client_id = public.get_cliente_client_id(auth.uid())
      AND visibility = 'externa'
    )
  );

CREATE POLICY "Staff insert tasks" ON public.tasks
  FOR INSERT TO authenticated
  WITH CHECK (public.is_staff_user());

CREATE POLICY "Staff update tasks" ON public.tasks
  FOR UPDATE TO authenticated
  USING (public.is_staff_user())
  WITH CHECK (public.is_staff_user());

CREATE POLICY "Admin/PM delete tasks" ON public.tasks
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pm'));

-- ════════════════════════════════════════════════════════════════════════════
-- TABLA: phases  ── scope por cliente
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Allow all select" ON public.phases;
DROP POLICY IF EXISTS "Allow all insert" ON public.phases;
DROP POLICY IF EXISTS "Allow all update" ON public.phases;
DROP POLICY IF EXISTS "Allow all delete" ON public.phases;

CREATE POLICY "Scoped select phases" ON public.phases
  FOR SELECT TO authenticated
  USING (public.user_can_see_client(client_id));

CREATE POLICY "Staff insert phases" ON public.phases
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());

CREATE POLICY "Staff update phases" ON public.phases
  FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

CREATE POLICY "Admin/PM delete phases" ON public.phases
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pm'));

-- ════════════════════════════════════════════════════════════════════════════
-- TABLA: deliverables  ── scope por cliente
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Allow all select" ON public.deliverables;
DROP POLICY IF EXISTS "Allow all insert" ON public.deliverables;
DROP POLICY IF EXISTS "Allow all update" ON public.deliverables;
DROP POLICY IF EXISTS "Allow all delete" ON public.deliverables;

CREATE POLICY "Scoped select deliverables" ON public.deliverables
  FOR SELECT TO authenticated
  USING (public.user_can_see_client(client_id));

CREATE POLICY "Staff insert deliverables" ON public.deliverables
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());

CREATE POLICY "Staff update deliverables" ON public.deliverables
  FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

CREATE POLICY "Admin/PM delete deliverables" ON public.deliverables
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pm'));

-- ════════════════════════════════════════════════════════════════════════════
-- TABLA: risks  ── solo staff (riesgos son info interna)
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Allow all select" ON public.risks;
DROP POLICY IF EXISTS "Allow all insert" ON public.risks;
DROP POLICY IF EXISTS "Allow all update" ON public.risks;
DROP POLICY IF EXISTS "Allow all delete" ON public.risks;

CREATE POLICY "Staff read risks" ON public.risks
  FOR SELECT TO authenticated USING (public.is_staff_user());

CREATE POLICY "Staff insert risks" ON public.risks
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());

CREATE POLICY "Staff update risks" ON public.risks
  FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

CREATE POLICY "Admin/PM delete risks" ON public.risks
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pm'));

-- ════════════════════════════════════════════════════════════════════════════
-- TABLA: action_items  ── scope por cliente
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Allow all select" ON public.action_items;
DROP POLICY IF EXISTS "Allow all insert" ON public.action_items;
DROP POLICY IF EXISTS "Allow all update" ON public.action_items;
DROP POLICY IF EXISTS "Allow all delete" ON public.action_items;

CREATE POLICY "Scoped select action_items" ON public.action_items
  FOR SELECT TO authenticated
  USING (public.user_can_see_client(client_id));

CREATE POLICY "Staff insert action_items" ON public.action_items
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());

CREATE POLICY "Staff update action_items" ON public.action_items
  FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

CREATE POLICY "Admin/PM delete action_items" ON public.action_items
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pm'));

-- ════════════════════════════════════════════════════════════════════════════
-- TABLA: client_notifications  ── scope por cliente (cliente ve sus notifs)
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Allow all select on client_notifications" ON public.client_notifications;
DROP POLICY IF EXISTS "Allow all insert on client_notifications" ON public.client_notifications;
DROP POLICY IF EXISTS "Allow all update on client_notifications" ON public.client_notifications;
DROP POLICY IF EXISTS "Allow all delete on client_notifications" ON public.client_notifications;

CREATE POLICY "Scoped select client_notifications" ON public.client_notifications
  FOR SELECT TO authenticated
  USING (public.user_can_see_client(client_id));

CREATE POLICY "Staff insert client_notifications" ON public.client_notifications
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());

CREATE POLICY "Staff update client_notifications" ON public.client_notifications
  FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());

CREATE POLICY "Admin delete client_notifications" ON public.client_notifications
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ════════════════════════════════════════════════════════════════════════════
-- TABLA: ai_usage_logs  ── audit trail — admin/ceo SOLO
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Allow all select on ai_usage_logs" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "Allow all insert on ai_usage_logs" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "Allow all update on ai_usage_logs" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "Allow all delete on ai_usage_logs" ON public.ai_usage_logs;

CREATE POLICY "Admin/CEO read ai_usage_logs" ON public.ai_usage_logs
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'ceo')
  );

-- INSERT lo hacen las edge functions con SECURITY DEFINER. Bloqueamos
-- INSERT directo desde el cliente — solo admin para casos manuales.
CREATE POLICY "Admin insert ai_usage_logs" ON public.ai_usage_logs
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- UPDATE/DELETE no tienen sentido en logs de auditoría — solo admin como excepción
CREATE POLICY "Admin update ai_usage_logs" ON public.ai_usage_logs
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin delete ai_usage_logs" ON public.ai_usage_logs
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- ════════════════════════════════════════════════════════════════════════════
-- TABLAS task_* (history/subtasks/attachments/dependencies/tags)
-- Scope: ver el subtask/history/attachment si puedo ver el task padre.
-- ════════════════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Allow all select on task_history" ON public.task_history;
DROP POLICY IF EXISTS "Allow all insert on task_history" ON public.task_history;
DROP POLICY IF EXISTS "Allow all update on task_history" ON public.task_history;
DROP POLICY IF EXISTS "Allow all delete on task_history" ON public.task_history;

CREATE POLICY "Scoped select task_history" ON public.task_history
  FOR SELECT TO authenticated
  USING (
    public.is_staff_user()
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_history.task_id
        AND t.client_id = public.get_cliente_client_id(auth.uid())
        AND t.visibility = 'externa'
        AND public.is_cliente_user()
    )
  );

CREATE POLICY "Staff write task_history" ON public.task_history
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());

-- task_subtasks
DROP POLICY IF EXISTS "Allow all select on task_subtasks" ON public.task_subtasks;
DROP POLICY IF EXISTS "Allow all insert on task_subtasks" ON public.task_subtasks;
DROP POLICY IF EXISTS "Allow all update on task_subtasks" ON public.task_subtasks;
DROP POLICY IF EXISTS "Allow all delete on task_subtasks" ON public.task_subtasks;

CREATE POLICY "Scoped select task_subtasks" ON public.task_subtasks
  FOR SELECT TO authenticated
  USING (
    public.is_staff_user()
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_subtasks.task_id
        AND t.client_id = public.get_cliente_client_id(auth.uid())
        AND t.visibility = 'externa'
        AND public.is_cliente_user()
    )
  );

CREATE POLICY "Staff insert task_subtasks" ON public.task_subtasks
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "Staff update task_subtasks" ON public.task_subtasks
  FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "Staff delete task_subtasks" ON public.task_subtasks
  FOR DELETE TO authenticated USING (public.is_staff_user());

-- task_attachments
DROP POLICY IF EXISTS "Allow all select on task_attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Allow all insert on task_attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Allow all update on task_attachments" ON public.task_attachments;
DROP POLICY IF EXISTS "Allow all delete on task_attachments" ON public.task_attachments;

CREATE POLICY "Scoped select task_attachments" ON public.task_attachments
  FOR SELECT TO authenticated
  USING (
    public.is_staff_user()
    OR EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_attachments.task_id
        AND t.client_id = public.get_cliente_client_id(auth.uid())
        AND t.visibility = 'externa'
        AND public.is_cliente_user()
    )
  );

CREATE POLICY "Staff insert task_attachments" ON public.task_attachments
  FOR INSERT TO authenticated WITH CHECK (public.is_staff_user());
CREATE POLICY "Staff update task_attachments" ON public.task_attachments
  FOR UPDATE TO authenticated USING (public.is_staff_user()) WITH CHECK (public.is_staff_user());
CREATE POLICY "Staff delete task_attachments" ON public.task_attachments
  FOR DELETE TO authenticated USING (public.is_staff_user());

-- task_dependencies
DROP POLICY IF EXISTS "Allow all select on task_dependencies" ON public.task_dependencies;
DROP POLICY IF EXISTS "Allow all insert on task_dependencies" ON public.task_dependencies;
DROP POLICY IF EXISTS "Allow all update on task_dependencies" ON public.task_dependencies;
DROP POLICY IF EXISTS "Allow all delete on task_dependencies" ON public.task_dependencies;

CREATE POLICY "Staff full access task_dependencies" ON public.task_dependencies
  FOR ALL TO authenticated
  USING (public.is_staff_user())
  WITH CHECK (public.is_staff_user());

-- task_tags
DROP POLICY IF EXISTS "Allow all select on task_tags" ON public.task_tags;
DROP POLICY IF EXISTS "Allow all insert on task_tags" ON public.task_tags;
DROP POLICY IF EXISTS "Allow all update on task_tags" ON public.task_tags;
DROP POLICY IF EXISTS "Allow all delete on task_tags" ON public.task_tags;

CREATE POLICY "Staff full access task_tags" ON public.task_tags
  FOR ALL TO authenticated
  USING (public.is_staff_user())
  WITH CHECK (public.is_staff_user());

-- ════════════════════════════════════════════════════════════════════════════
-- REPORTE
-- ════════════════════════════════════════════════════════════════════════════
DO $report$
DECLARE
  v_open_policies INT;
  v_strict_policies INT;
BEGIN
  -- Cuenta policies con USING(true) restantes (informativo)
  SELECT COUNT(*) INTO v_open_policies
    FROM pg_policies
   WHERE schemaname = 'public'
     AND qual ILIKE '%true%'
     AND qual NOT ILIKE '%has_role%'
     AND qual NOT ILIKE '%is_%user%'
     AND qual NOT ILIKE '%user_can_see%'
     AND qual NOT ILIKE '%cliente_company_assignments%'
     AND qual NOT ILIKE '%gerente_client_assignments%'
     AND tablename NOT IN ('shared_presentations','presentation_data','presentation_feedback','support_minutes_feedback','shared_support_presentations','shared_ticket_history');

  SELECT COUNT(*) INTO v_strict_policies
    FROM pg_policies
   WHERE schemaname = 'public'
     AND (qual ILIKE '%has_role%' OR qual ILIKE '%is_%user%' OR qual ILIKE '%user_can_see%');

  RAISE NOTICE 'RLS hardening aplicado:';
  RAISE NOTICE '  Policies strict (con role check): %', v_strict_policies;
  RAISE NOTICE '  Policies USING(true) restantes (probablemente legítimas — share tokens, etc.): %', v_open_policies;
END;
$report$;
