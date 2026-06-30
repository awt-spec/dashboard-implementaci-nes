-- ============================================================================
-- RBAC dinámico — fase 3 (incremental): bridge en RLS de tablas de catálogo
-- ----------------------------------------------------------------------------
-- Migra las políticas de escritura de las tablas de CONFIGURACIÓN/CATÁLOGO de
-- `has_role(admin) OR has_role(pm)` al patrón ADITIVO:
--     has_role(admin) OR has_role(pm) OR has_permission('config.catalogos')
--
-- Es estrictamente más permisivo: los roles de sistema admin/pm mantienen EXACTO
-- su acceso (además se les concede el permiso 'config.catalogos' para reflejar el
-- estado actual), y los roles PERSONALIZADOS que tengan ese permiso pasan a poder
-- gestionar estos catálogos también a nivel de base de datos. Nunca quita acceso.
--
-- Este es el patrón a replicar tabla por tabla para las demás políticas. No se
-- tocan las tablas operativas (clients/tasks/…), cuya RLS hoy es
-- `auth.uid() IS NOT NULL` con control de rol en la capa de aplicación.
-- Idempotente.
-- ============================================================================

-- 1. Nuevo permiso + concesión a los roles de sistema que ya tenían el acceso.
INSERT INTO public.permissions (key, module, action) VALUES
  ('config.catalogos', 'Configuración', 'Gestionar catálogos (productos, SVA, plantillas, categorías)')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key) VALUES
  ('admin', 'config.catalogos'),
  ('pm',    'config.catalogos')
ON CONFLICT DO NOTHING;

-- 2. Redefinir las políticas "Admin or pm manages <t>" con el bridge aditivo.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'products','product_modules','product_versions','version_modules',
    'sva_teams','sva_team_holidays','sva_team_members',
    'policy_templates','policy_template_packages',
    'client_categories'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Admin or pm manages %1$s" ON public.%1$s;', t);
    EXECUTE format($f$CREATE POLICY "Admin or pm manages %1$s" ON public.%1$s FOR ALL
      USING (
        public.has_role(auth.uid(),'admin'::app_role)
        OR public.has_role(auth.uid(),'pm'::app_role)
        OR public.has_permission(auth.uid(),'config.catalogos')
      )
      WITH CHECK (
        public.has_role(auth.uid(),'admin'::app_role)
        OR public.has_role(auth.uid(),'pm'::app_role)
        OR public.has_permission(auth.uid(),'config.catalogos')
      );$f$, t);
  END LOOP;
END $$;

COMMENT ON POLICY "Admin or pm manages products" ON public.products IS
  'Bridge RBAC fase 3: admin/pm (enum) OR has_permission(config.catalogos) para roles personalizados.';
