-- ============================================================================
-- RLS hardening PHASE 2: extiende el hardening de 20260423100000 a más tablas.
--
-- Tablas que aún tenían policies "Allow all" coexistiendo con las de
-- authenticated → un colaborador podía mutar/borrar. Audit post-QA detectó:
--   phases, deliverables, tasks, action_items, meeting_minutes,
--   email_notifications, comments, risks,
--   shared_presentations, presentation_feedback,
--   task_history, task_subtasks.
--
-- Reglas uniformes:
--   - SELECT → authenticated
--   - INSERT/UPDATE → admin/pm
--   - DELETE → solo admin
-- Excepciones:
--   - shared_presentations/presentation_feedback tienen lectura pública por
--     token (mantenemos SELECT to public) porque las usa la página
--     /shared/:token sin auth.
-- ============================================================================

DO $$
DECLARE
  t TEXT;
  -- Tablas internas: admin/pm mutan, admin borra
  internal_tables TEXT[] := ARRAY[
    'phases', 'deliverables', 'tasks', 'action_items', 'meeting_minutes',
    'email_notifications', 'comments', 'risks', 'task_history', 'task_subtasks'
  ];
  policy_row RECORD;
BEGIN
  FOREACH t IN ARRAY internal_tables LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      CONTINUE;
    END IF;

    FOR policy_row IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_row.policyname, t);
    END LOOP;

    EXECUTE format('CREATE POLICY "rls_select_authenticated" ON public.%I FOR SELECT TO authenticated USING (true)', t);
    EXECUTE format($f$
      CREATE POLICY "rls_insert_admin_pm" ON public.%I FOR INSERT TO authenticated
      WITH CHECK (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'pm'::public.app_role)
      )
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "rls_update_admin_pm" ON public.%I FOR UPDATE TO authenticated
      USING (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'pm'::public.app_role)
      )
      WITH CHECK (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'pm'::public.app_role)
      )
    $f$, t);
    EXECUTE format($f$
      CREATE POLICY "rls_delete_admin_only" ON public.%I FOR DELETE TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::public.app_role))
    $f$, t);

    RAISE NOTICE 'Phase2 RLS endurecido en: %', t;
  END LOOP;
END $$;

-- ─── shared_presentations / presentation_feedback ───
-- Públicas por token: SELECT to public, INSERT/UPDATE/DELETE restringido.
DO $$
DECLARE
  t TEXT;
  public_share_tables TEXT[] := ARRAY['shared_presentations', 'presentation_feedback'];
  policy_row RECORD;
BEGIN
  FOREACH t IN ARRAY public_share_tables LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      CONTINUE;
    END IF;

    FOR policy_row IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_row.policyname, t);
    END LOOP;

    -- SELECT público para que la página /shared/:token funcione sin login
    EXECUTE format('CREATE POLICY "rls_select_public" ON public.%I FOR SELECT TO public USING (true)', t);
    -- INSERT: presentation_feedback lo insertan anónimos; shared_presentations solo admin/pm
    IF t = 'presentation_feedback' THEN
      EXECUTE format('CREATE POLICY "rls_insert_public" ON public.%I FOR INSERT TO public WITH CHECK (true)', t);
    ELSE
      EXECUTE format($f$
        CREATE POLICY "rls_insert_admin_pm" ON public.%I FOR INSERT TO authenticated
        WITH CHECK (
          public.has_role(auth.uid(), 'admin'::public.app_role)
          OR public.has_role(auth.uid(), 'pm'::public.app_role)
        )
      $f$, t);
    END IF;
    EXECUTE format($f$
      CREATE POLICY "rls_delete_admin_only" ON public.%I FOR DELETE TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::public.app_role))
    $f$, t);

    RAISE NOTICE 'Phase2 RLS (public share) endurecido en: %', t;
  END LOOP;
END $$;
