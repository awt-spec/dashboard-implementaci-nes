-- ════════════════════════════════════════════════════════════════════════════
-- DROP de policies legacy "rls_select_authenticated" con qual=true.
--
-- Detección 2026-05-03: la migración previa 20260503140000 añadió policies
-- strict, pero quedaba en producción una policy llamada
-- "rls_select_authenticated" con USING(true) que abría el SELECT a cualquier
-- usuario autenticado (incluyendo cliente).
--
-- Como las policies en PostgreSQL son OR-acumulativas, la policy abierta
-- ganaba sobre las strict → cliente seguía leyendo todos los clients y
-- client_financials.
--
-- Este migration dropea SISTEMÁTICAMENTE las 4 policies legacy
-- (rls_select_authenticated, rls_insert_authenticated, rls_update_authenticated,
-- rls_delete_authenticated) de TODAS las tablas donde existan.
-- Las strict del migration anterior toman control sin obstáculo.
-- ════════════════════════════════════════════════════════════════════════════

DO $cleanup$
DECLARE
  r RECORD;
  policy_names TEXT[] := ARRAY[
    'rls_select_authenticated',
    'rls_insert_authenticated',
    'rls_update_authenticated',
    'rls_delete_authenticated'
  ];
  p TEXT;
  dropped INT := 0;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
      FROM pg_policies
     WHERE schemaname = 'public'
       AND policyname = ANY(policy_names)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
    dropped := dropped + 1;
    RAISE NOTICE 'Dropped: %.% [%]', r.tablename, r.policyname, r.schemaname;
  END LOOP;
  RAISE NOTICE 'Total policies abiertas dropeadas: %', dropped;
END;
$cleanup$;

-- ════════════════════════════════════════════════════════════════════════════
-- Verificar que ya no quedan policies USING(true) en tablas críticas
-- ════════════════════════════════════════════════════════════════════════════
DO $verify$
DECLARE
  r RECORD;
  cnt INT := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Policies con qual=true en tablas críticas (deberían ser 0) ===';
  FOR r IN
    SELECT tablename, policyname, cmd, qual
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN (
         'clients', 'client_financials', 'client_contacts', 'meeting_minutes',
         'email_notifications', 'comments', 'tasks', 'phases', 'deliverables',
         'risks', 'action_items', 'client_notifications', 'ai_usage_logs',
         'task_history', 'task_subtasks', 'task_attachments', 'task_dependencies',
         'task_tags'
       )
       AND qual = 'true'
  LOOP
    cnt := cnt + 1;
    RAISE WARNING 'AÚN ABIERTA: %.% [% → %]', r.tablename, r.policyname, r.cmd, r.qual;
  END LOOP;
  IF cnt = 0 THEN
    RAISE NOTICE '  ✅ Sin policies abiertas (qual=true) en tablas críticas';
  END IF;
END;
$verify$;
