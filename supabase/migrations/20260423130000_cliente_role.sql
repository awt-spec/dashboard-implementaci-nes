-- ─────────────────────────────────────────────────────────────────────
-- Rol "cliente" — Parte 1/2: enum + tabla + helpers
--
-- Postgres requiere que un valor nuevo de enum (ALTER TYPE ADD VALUE)
-- se commitee antes de usarse en policies. Las policies que referencian
-- 'cliente' como literal de app_role van en la migración 20260423130001.
-- ─────────────────────────────────────────────────────────────────────

-- 1. Agregar valor al enum app_role
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cliente';

-- 2. Permiso dentro del rol cliente
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'cliente_permission') THEN
    CREATE TYPE public.cliente_permission AS ENUM ('viewer', 'editor', 'admin');
  END IF;
END $$;

-- 3. Tabla de asignación cliente ↔ empresa
CREATE TABLE IF NOT EXISTS public.cliente_company_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id text NOT NULL,
  permission_level public.cliente_permission NOT NULL DEFAULT 'viewer',
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE (user_id, client_id)
);

ALTER TABLE public.cliente_company_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Cliente views own assignment" ON public.cliente_company_assignments;
CREATE POLICY "Cliente views own assignment"
  ON public.cliente_company_assignments
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage cliente assignments" ON public.cliente_company_assignments;
CREATE POLICY "Admins manage cliente assignments"
  ON public.cliente_company_assignments
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pm'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pm'));

CREATE INDEX IF NOT EXISTS idx_cliente_assign_user ON public.cliente_company_assignments(user_id);
CREATE INDEX IF NOT EXISTS idx_cliente_assign_client ON public.cliente_company_assignments(client_id);

-- 4. Helper: cliente asignado a un usuario (SECURITY DEFINER para evitar recursión RLS)
CREATE OR REPLACE FUNCTION public.get_cliente_client_id(_user_id uuid)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT client_id FROM public.cliente_company_assignments
  WHERE user_id = _user_id
  ORDER BY created_at DESC
  LIMIT 1;
$$;

-- 5. Helper: verifica permiso mínimo
CREATE OR REPLACE FUNCTION public.has_cliente_permission(
  _user_id uuid,
  _client_id text,
  _min_level public.cliente_permission
)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.cliente_company_assignments
    WHERE user_id = _user_id
      AND client_id = _client_id
      AND CASE _min_level
        WHEN 'viewer' THEN permission_level IN ('viewer', 'editor', 'admin')
        WHEN 'editor' THEN permission_level IN ('editor', 'admin')
        WHEN 'admin'  THEN permission_level = 'admin'
      END
  );
$$;

-- Documentación
COMMENT ON TABLE public.cliente_company_assignments IS
  'Asignación de usuarios con rol "cliente" a empresas. permission_level controla qué pueden hacer dentro de su empresa.';
COMMENT ON TYPE public.cliente_permission IS
  'viewer: sólo lectura; editor: puede crear tickets y notas externas; admin: puede gestionar otros usuarios del cliente.';
