-- ============================================================================
-- Catálogo de tipos de tarea — gap Tanda A.1 (ERP-026, 027, 028)
-- Las tareas no tenían "tipo" categorizado (solo priority/status). Se agrega
-- un catálogo administrable + columna opcional en tasks. Patrón idéntico al
-- catálogo de motivos de reapertura (P3).
-- ============================================================================

CREATE TABLE public.task_types (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text,
  color       text NOT NULL DEFAULT '#6366f1',  -- hex para el badge
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_task_types_active_sort ON public.task_types(is_active, sort_order);

CREATE TRIGGER set_task_types_updated_at
  BEFORE UPDATE ON public.task_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Seed con tipos comunes de la operación SVA ──────────────────────────────
INSERT INTO public.task_types (code, name, description, color, sort_order, is_system) VALUES
  ('desarrollo',    'Desarrollo',     'Programación / cambios de código',           '#6366f1', 10, true),
  ('configuracion', 'Configuración',  'Parametrización / setup de módulos',         '#0ea5e9', 20, true),
  ('soporte',       'Soporte',        'Atención de incidencias / consultas',        '#10b981', 30, true),
  ('reunion',       'Reunión',        'Calls / kickoffs / seguimiento con cliente', '#f59e0b', 40, true),
  ('documentacion', 'Documentación',  'Manuales / minutas / entregables escritos',  '#8b5cf6', 50, true),
  ('testing',       'Testing / QA',   'Pruebas / validación de entregables',        '#ec4899', 60, true),
  ('capacitacion',  'Capacitación',   'Training a usuarios del cliente',            '#14b8a6', 70, true),
  ('otro',          'Otro',           'Sin clasificar',                             '#888880', 90, true);

-- ── Columna opcional en tasks ───────────────────────────────────────────────
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS task_type_id uuid REFERENCES public.task_types(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_task_type ON public.tasks(task_type_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.task_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated reads task_types"
  ON public.task_types FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin manages task_types"
  ON public.task_types FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ── Protección: tipos del sistema no se eliminan, solo se desactivan ────────
CREATE OR REPLACE FUNCTION public.prevent_system_task_type_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_system = true THEN
    RAISE EXCEPTION 'No se puede eliminar el tipo de tarea del sistema "%". Desactivalo con is_active=false.', OLD.code;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER prevent_system_task_type_delete
  BEFORE DELETE ON public.task_types
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_system_task_type_delete();

COMMENT ON TABLE public.task_types IS
  'Catálogo de tipos de tarea administrable. Gap Tanda A.1 (ERP-026 a 028).';
