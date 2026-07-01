-- Épicas y disparadores de facturación sobre las HU (tabla tasks).
-- Permite mostrar % de avance por épica (administración → infraestructura →
-- parametrización → capacitaciones → desarrollos) calculado del backlog, y el
-- estado de facturación por HU (ej. "HU022 lista para facturar", "HU027 en
-- asignación") para que Eduardo vea los disparadores de facturación.

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS epic text,
  ADD COLUMN IF NOT EXISTS hu_code text,
  ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'sin_estado';

-- Épicas canónicas (nullable mientras se clasifica)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_epic_chk') THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_epic_chk
      CHECK (epic IS NULL OR epic IN ('administracion','infraestructura','parametrizacion','capacitaciones','desarrollos'));
  END IF;
END $$;

-- Estados de facturación por HU
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_billing_status_chk') THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_billing_status_chk
      CHECK (billing_status IN ('sin_estado','en_asignacion','en_desarrollo','lista_para_facturar','facturada'));
  END IF;
END $$;

-- Backfill del código de HU a partir del id original (ej. 22 → HU022)
UPDATE public.tasks
SET hu_code = 'HU' || lpad(original_id::text, 3, '0')
WHERE hu_code IS NULL AND original_id IS NOT NULL;

-- Clasificación heurística de épica por palabras clave del título
UPDATE public.tasks SET epic = 'infraestructura'
WHERE epic IS NULL AND (title ILIKE '%infraestructura%' OR title ILIKE '%despliegue%' OR title ILIKE '%servidor%' OR title ILIKE '%cloud%' OR title ILIKE '%vpn%' OR title ILIKE '%instalaci%' OR title ILIKE '%licencia%');

UPDATE public.tasks SET epic = 'capacitaciones'
WHERE epic IS NULL AND (title ILIKE '%capacita%' OR title ILIKE '%taller%' OR title ILIKE '%certificaci%' OR title ILIKE '%entrenamiento%');

UPDATE public.tasks SET epic = 'desarrollos'
WHERE epic IS NULL AND (title ILIKE '%desarrollo%' OR title ILIKE '%custom%' OR title ILIKE '%integraci%' OR title ILIKE '%reporte%' OR title ILIKE '%interfaz%' OR title ILIKE '% api%');

UPDATE public.tasks SET epic = 'administracion'
WHERE epic IS NULL AND (title ILIKE '%planifica%' OR title ILIKE '%kickoff%' OR title ILIKE '%acta%' OR title ILIKE '%cronograma%' OR title ILIKE '%gesti%' OR title ILIKE '%entendimiento%' OR title ILIKE '%discovery%');

UPDATE public.tasks SET epic = 'parametrizacion'
WHERE epic IS NULL AND (title ILIKE '%parametr%' OR title ILIKE '%configuraci%' OR title ILIKE '%regla%' OR title ILIKE '%producto%' OR title ILIKE '%m_dulo%' OR title ILIKE '%seguridad%' OR title ILIKE '%carga de datos%');

-- Resto → parametrización (el grueso del trabajo de implementación)
UPDATE public.tasks SET epic = 'parametrizacion' WHERE epic IS NULL;

-- Derivar el estado de facturación del avance real de cada HU
UPDATE public.tasks SET billing_status = 'lista_para_facturar'
WHERE billing_status = 'sin_estado' AND (status = 'completada' OR scrum_status = 'done');

UPDATE public.tasks SET billing_status = 'en_desarrollo'
WHERE billing_status = 'sin_estado' AND (status = 'en-progreso' OR scrum_status IN ('in_progress','in_sprint'));

UPDATE public.tasks SET billing_status = 'en_asignacion'
WHERE billing_status = 'sin_estado' AND (status = 'pendiente' OR status = 'bloqueada' OR scrum_status IN ('backlog','ready') OR scrum_status IS NULL);

CREATE INDEX IF NOT EXISTS idx_tasks_client_epic ON public.tasks (client_id, epic);
