-- ============================================================================
-- RBAC dinámico — fase 3 (batch 3): bridge en tablas de datos de cliente
-- ----------------------------------------------------------------------------
-- Aplica el patrón ADITIVO a las políticas de escritura admin/pm creadas por
-- `harden_rls` (rls_insert_admin_pm / rls_update_admin_pm) en las tablas de
-- datos de cliente cuyo estado final NO fue sobrescrito por migraciones
-- posteriores (confirmado): client_contracts, client_slas, client_team_members,
-- client_dashboard_config, client_rule_overrides.
--
-- INSERT/UPDATE: admin OR pm OR has_permission('cliente.gestionar_datos').
-- DELETE (rls_delete_admin_only) se mantiene admin-only, igual que hoy.
-- Estrictamente más permisivo: no quita acceso a ningún rol de sistema.
-- Idempotente.
-- ============================================================================

INSERT INTO public.permissions (key, module, action) VALUES
  ('cliente.gestionar_datos', 'Clientes', 'Gestionar datos comerciales y de configuración del cliente (contratos, SLAs, contactos, overrides)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key) VALUES
  ('admin', 'cliente.gestionar_datos'),
  ('pm',    'cliente.gestionar_datos')
ON CONFLICT DO NOTHING;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'client_contracts','client_slas','client_team_members',
    'client_dashboard_config','client_rule_overrides'
  ] LOOP
    -- Salta tablas que no existan (defensivo).
    IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename=t) THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP POLICY IF EXISTS "rls_insert_admin_pm" ON public.%I;', t);
    EXECUTE format($f$
      CREATE POLICY "rls_insert_admin_pm" ON public.%I FOR INSERT TO authenticated
      WITH CHECK (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'pm'::public.app_role)
        OR public.has_permission(auth.uid(), 'cliente.gestionar_datos')
      )
    $f$, t);

    EXECUTE format('DROP POLICY IF EXISTS "rls_update_admin_pm" ON public.%I;', t);
    EXECUTE format($f$
      CREATE POLICY "rls_update_admin_pm" ON public.%I FOR UPDATE TO authenticated
      USING (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'pm'::public.app_role)
        OR public.has_permission(auth.uid(), 'cliente.gestionar_datos')
      )
      WITH CHECK (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'pm'::public.app_role)
        OR public.has_permission(auth.uid(), 'cliente.gestionar_datos')
      )
    $f$, t);
  END LOOP;
END $$;
