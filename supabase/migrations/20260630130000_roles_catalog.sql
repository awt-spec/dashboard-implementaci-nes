-- ============================================================================
-- Catálogo de roles gestionable — primer paso del refactor de roles (ERP-013/015)
-- ----------------------------------------------------------------------------
-- Hasta ahora los roles eran ÚNICAMENTE valores del enum public.app_role, sin
-- forma de crearlos/editarlos desde la app. Este catálogo convierte los roles
-- en una entidad gestionable:
--   • Los 7 roles de sistema (= valores del enum) se siembran como is_system=true
--     y quedan protegidos (no se borran ni se les cambia key/scope).
--   • Se pueden crear/editar/eliminar roles PERSONALIZADOS (is_system=false).
--
-- Alcance: este catálogo cubre la GESTIÓN de definiciones de rol (ERP-013/015).
-- La APLICACIÓN de permisos en RLS sigue basada en el enum app_role + has_role
-- para los roles de sistema (sin cambios, cero riesgo). Conectar la aplicación
-- de permisos para roles personalizados (RBAC dinámico) es la fase siguiente.
-- Idempotente.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.roles (
  key         text PRIMARY KEY,
  label       text NOT NULL,
  description text,
  scope       text NOT NULL DEFAULT 'interno' CHECK (scope IN ('interno','externo')),
  is_system   boolean NOT NULL DEFAULT false,
  is_active   boolean NOT NULL DEFAULT true,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated read roles" ON public.roles;
CREATE POLICY "Authenticated read roles"
  ON public.roles FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admin manage roles" ON public.roles;
CREATE POLICY "Admin manage roles"
  ON public.roles FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Protección de roles de sistema: no se eliminan ni se les cambia key/scope/is_system.
CREATE OR REPLACE FUNCTION public.protect_system_roles()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system THEN
      RAISE EXCEPTION 'No se puede eliminar un rol de sistema (%).', OLD.key;
    END IF;
    RETURN OLD;
  END IF;
  -- UPDATE
  IF OLD.is_system THEN
    IF NEW.key <> OLD.key OR NEW.scope <> OLD.scope OR NEW.is_system <> OLD.is_system THEN
      RAISE EXCEPTION 'No se pueden modificar key/scope/is_system de un rol de sistema (%).', OLD.key;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_system_roles ON public.roles;
CREATE TRIGGER trg_protect_system_roles
  BEFORE UPDATE OR DELETE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_system_roles();

DROP TRIGGER IF EXISTS set_roles_updated_at ON public.roles;
CREATE TRIGGER set_roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Semilla de roles de sistema (coinciden con los valores del enum app_role).
INSERT INTO public.roles (key, label, description, scope, is_system) VALUES
  ('admin',           'Administrador',          'Acceso total: usuarios, RBAC, configuración del sistema e IA.',          'interno', true),
  ('ceo',             'CEO / Ejecutivo',        'Vista ejecutiva integral y dashboards. Sin administración de sistema.',  'interno', true),
  ('pm',              'Project Manager',        'Gestiona clientes, sprints, equipo y backlog.',                          'interno', true),
  ('gerente_soporte', 'Gerente de Soporte',     'Gestiona la operación de soporte: bandeja, asignaciones y SLA.',         'interno', true),
  ('colaborador',     'Colaborador SYSDE',      'Consultor/desarrollador: tareas, tiempos y casos asignados.',            'interno', true),
  ('gerente',         'Gerente (lado cliente)', 'Gerente del cliente: ve sus clientes asignados en modo lectura.',        'externo', true),
  ('cliente',         'Cliente (Portal)',       'Usuario externo del Portal. Nivel fino por permission_level.',           'externo', true)
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE public.roles IS
  'Catálogo gestionable de roles. Los is_system=true reflejan el enum app_role (protegidos). Los is_system=false son roles personalizados creados desde la app. ERP-013/015.';
