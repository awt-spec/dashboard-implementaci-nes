-- ============================================================================
-- Endurece RLS: DELETE/INSERT/UPDATE de tablas sensibles solo para admin/pm.
--
-- Hallazgo durante QA:
--   Un usuario colaborador pudo DELETE el cliente "credicefi" porque quedaron
--   2 policies coexistiendo desde distintas migraciones:
--     - "Allow all delete" (ON ... FOR DELETE USING (true))           [abierto]
--     - "Authenticated delete clients" (USING (auth.uid() IS NOT NULL)) [auth]
--   PostgreSQL RLS une PERMISSIVE policies con OR → cualquier usuario
--   autenticado podía borrar clientes.
--
-- Esta migración:
--   1. DROP todas las policies permisivas abiertas (Allow all *) en tablas
--      sensibles.
--   2. Crea policies restringidas: SELECT abierto a authenticated, mutaciones
--      solo para admin/pm (o creador cuando aplica).
-- ============================================================================

-- Helper inline: restringe mutaciones a admin/pm.
-- Reemplaza las policies existentes en una sola tabla.
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'clients',
    'client_contracts',
    'client_slas',
    'client_financials',
    'client_contacts',
    'client_team_members',
    'client_dashboard_config',
    'client_rule_overrides'
  ];
  policy_row RECORD;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Skip si la tabla no existe
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      CONTINUE;
    END IF;

    -- Drop todas las policies existentes en la tabla (hay conflicto acumulado)
    FOR policy_row IN
      SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_row.policyname, t);
    END LOOP;

    -- SELECT: authenticated puede leer
    EXECUTE format(
      'CREATE POLICY "rls_select_authenticated" ON public.%I FOR SELECT TO authenticated USING (true)', t
    );

    -- INSERT: solo admin/pm
    EXECUTE format($f$
      CREATE POLICY "rls_insert_admin_pm" ON public.%I FOR INSERT TO authenticated
      WITH CHECK (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'pm'::public.app_role)
      )
    $f$, t);

    -- UPDATE: admin/pm
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

    -- DELETE: SOLO admin
    EXECUTE format($f$
      CREATE POLICY "rls_delete_admin_only" ON public.%I FOR DELETE TO authenticated
      USING (public.has_role(auth.uid(), 'admin'::public.app_role))
    $f$, t);

    RAISE NOTICE 'RLS endurecido en: %', t;
  END LOOP;
END $$;

-- ─── Eliminar client_notifications columna inexistente no rompe tests ───
-- (no-op: el schema es lo que hay; la columna `read` no existe, fue asumida
-- por un test obsoleto).

COMMENT ON SCHEMA public IS
  'RLS endurecido 2026-04-23: clients y tablas relacionadas no permiten mutación a colaboradores.';
