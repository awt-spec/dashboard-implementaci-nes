-- ============================================================================
-- RBAC dinámico — fase 2 del refactor de roles
-- ----------------------------------------------------------------------------
-- Construye el modelo de permisos para que los roles (de sistema y
-- personalizados) tengan permisos GESTIONABLES y consultables:
--   • permissions       — catálogo de permisos (módulo + acción).
--   • role_permissions  — qué permisos otorga cada rol (rol → permiso).
--   • user_custom_roles — asignación de roles personalizados a usuarios
--                          (los roles de sistema siguen en user_roles/enum).
--   • has_permission()  — ¿el usuario tiene el permiso vía algún rol?
--   • get_my_permissions() — permisos efectivos del usuario actual (para la UI).
--
-- Se siembra role_permissions desde la matriz que la app tenía hardcodeada
-- (admin/pm/gerente). El enforcement existente en RLS (enum app_role +
-- has_role) NO se modifica: este modelo es aditivo y habilita el gating por
-- permiso en el front + queda disponible para migrar políticas RLS de forma
-- incremental. Idempotente.
-- ============================================================================

-- ── Catálogo de permisos ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.permissions (
  key         text PRIMARY KEY,
  module      text NOT NULL,
  action      text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ── Permisos por rol ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_key       text NOT NULL REFERENCES public.roles(key) ON DELETE CASCADE,
  permission_key text NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (role_key, permission_key)
);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON public.role_permissions(role_key);

-- ── Roles personalizados asignados a usuarios ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_custom_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_key    text NOT NULL REFERENCES public.roles(key) ON DELETE CASCADE,
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role_key)
);
CREATE INDEX IF NOT EXISTS idx_user_custom_roles_user ON public.user_custom_roles(user_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_custom_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read permissions" ON public.permissions;
CREATE POLICY "Authenticated read permissions"
  ON public.permissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin manage permissions" ON public.permissions;
CREATE POLICY "Admin manage permissions"
  ON public.permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Authenticated read role_permissions" ON public.role_permissions;
CREATE POLICY "Authenticated read role_permissions"
  ON public.role_permissions FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "Admin manage role_permissions" ON public.role_permissions;
CREATE POLICY "Admin manage role_permissions"
  ON public.role_permissions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Staff read user_custom_roles" ON public.user_custom_roles;
CREATE POLICY "Staff read user_custom_roles"
  ON public.user_custom_roles FOR SELECT TO authenticated
  USING (public.is_staff_user() OR auth.uid() = user_id);
DROP POLICY IF EXISTS "Admin manage user_custom_roles" ON public.user_custom_roles;
CREATE POLICY "Admin manage user_custom_roles"
  ON public.user_custom_roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ── Funciones ───────────────────────────────────────────────────────────────
-- ¿El usuario tiene el permiso vía algún rol (sistema o personalizado)?
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission_key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.role_permissions rp
    WHERE rp.permission_key = _permission_key
      AND (
        rp.role_key IN (SELECT role::text FROM public.user_roles WHERE user_id = _user_id)
        OR rp.role_key IN (SELECT role_key FROM public.user_custom_roles WHERE user_id = _user_id)
      )
  );
$$;

-- Permisos efectivos del usuario actual (para gating en el front).
CREATE OR REPLACE FUNCTION public.get_my_permissions()
RETURNS TABLE (permission_key text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT rp.permission_key
  FROM public.role_permissions rp
  WHERE rp.role_key IN (SELECT role::text FROM public.user_roles WHERE user_id = auth.uid())
     OR rp.role_key IN (SELECT role_key FROM public.user_custom_roles WHERE user_id = auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.has_permission(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_permissions() TO authenticated;

-- ── Semilla del catálogo de permisos (= matriz que estaba hardcodeada) ──────
INSERT INTO public.permissions (key, module, action) VALUES
  ('usuarios.ver_todos',                'Usuarios',      'Ver todos los usuarios'),
  ('usuarios.crear',                    'Usuarios',      'Crear usuarios'),
  ('usuarios.eliminar',                 'Usuarios',      'Eliminar usuarios'),
  ('usuarios.cambiar_roles',            'Usuarios',      'Cambiar roles'),
  ('usuarios.reset_password',           'Usuarios',      'Resetear contraseñas'),
  ('clientes.ver_todos',                'Clientes',      'Ver todos los clientes'),
  ('clientes.ver_asignados',            'Clientes',      'Ver clientes asignados'),
  ('clientes.crear',                    'Clientes',      'Crear clientes'),
  ('clientes.editar',                   'Clientes',      'Editar clientes'),
  ('tareas.ver_internas',               'Tareas',        'Ver tareas internas'),
  ('tareas.ver_externas',               'Tareas',        'Ver tareas externas'),
  ('tareas.crear_editar',               'Tareas',        'Crear/editar tareas'),
  ('presentaciones.ver',                'Presentaciones','Ver presentaciones'),
  ('presentaciones.editar',             'Presentaciones','Editar presentaciones'),
  ('presentaciones.compartir',          'Presentaciones','Compartir presentaciones'),
  ('presentaciones.feedback',           'Presentaciones','Dar feedback'),
  ('minutas.crear',                     'Minutas',       'Crear minutas'),
  ('minutas.ver',                       'Minutas',       'Ver minutas visibles'),
  ('minutas.editar',                    'Minutas',       'Editar minutas'),
  ('soporte.ver_dashboard',             'Soporte',       'Ver dashboard soporte'),
  ('soporte.gestionar_tickets',         'Soporte',       'Gestionar tickets'),
  ('soporte.clasificacion_ia',          'Soporte',       'Clasificación IA'),
  ('equipo.ver',                        'Equipo SYSDE',  'Ver equipo'),
  ('equipo.gestionar',                  'Equipo SYSDE',  'Gestionar miembros'),
  ('dashboard.ver_kpis',                'Dashboard',     'Ver KPIs'),
  ('dashboard.generar_reportes',        'Dashboard',     'Generar reportes'),
  ('dashboard.graficos_personalizados', 'Dashboard',     'Gráficos personalizados')
ON CONFLICT (key) DO NOTHING;

-- ── Semilla de permisos por rol (admin/pm/gerente, según la matriz original) ─
-- admin: todos menos "Dar feedback" (que en la matriz era exclusivo de gerente).
INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'admin', key FROM public.permissions WHERE key <> 'presentaciones.feedback'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'pm', key FROM public.permissions WHERE key IN (
  'clientes.ver_todos','clientes.ver_asignados','clientes.crear','clientes.editar',
  'tareas.ver_internas','tareas.ver_externas','tareas.crear_editar',
  'presentaciones.ver','presentaciones.editar','presentaciones.compartir',
  'minutas.crear','minutas.ver','minutas.editar',
  'soporte.ver_dashboard','soporte.gestionar_tickets','soporte.clasificacion_ia',
  'equipo.ver',
  'dashboard.ver_kpis','dashboard.generar_reportes','dashboard.graficos_personalizados'
) ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key)
SELECT 'gerente', key FROM public.permissions WHERE key IN (
  'clientes.ver_asignados','tareas.ver_externas','presentaciones.ver','presentaciones.feedback',
  'minutas.ver','dashboard.ver_kpis','dashboard.graficos_personalizados'
) ON CONFLICT DO NOTHING;

COMMENT ON TABLE public.permissions IS 'Catálogo de permisos (módulo + acción). RBAC fase 2.';
COMMENT ON TABLE public.role_permissions IS 'Permisos otorgados por cada rol (sistema o personalizado). RBAC fase 2.';
COMMENT ON TABLE public.user_custom_roles IS 'Asignación de roles personalizados a usuarios. Los roles de sistema viven en user_roles (enum). RBAC fase 2.';
COMMENT ON FUNCTION public.has_permission(uuid, text) IS 'True si el usuario tiene el permiso vía cualquier rol (user_roles enum + user_custom_roles).';
