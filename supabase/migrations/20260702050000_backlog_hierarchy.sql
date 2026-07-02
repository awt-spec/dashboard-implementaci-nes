-- Jerarquía de backlog estilo Azure DevOps: Épica → Feature → HU → Task.
-- Las Épicas (5 canónicas) y las HU ya existen (tasks.epic). Aquí agregamos las
-- Features (agrupador entre épica y HU) y las Tasks hijas de cada HU, en una
-- tabla propia para NO contaminar las consultas existentes sobre `tasks`.

CREATE TABLE IF NOT EXISTS public.backlog_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  item_type text NOT NULL CHECK (item_type IN ('feature', 'task')),
  epic text,                 -- para features: la épica canónica
  parent_hu_id uuid,         -- para tasks: la HU padre (tasks.id)
  title text NOT NULL,
  state text,                -- To Do / Doing / Done
  assigned_to text,
  iteration text,
  effort numeric,
  progress int DEFAULT 0,
  order_index int DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backlog_items_client ON public.backlog_items (client_id);
CREATE INDEX IF NOT EXISTS idx_backlog_items_parent ON public.backlog_items (parent_hu_id);

ALTER TABLE public.backlog_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS backlog_items_read ON public.backlog_items;
CREATE POLICY backlog_items_read ON public.backlog_items FOR SELECT USING (auth.uid() IS NOT NULL);
DROP POLICY IF EXISTS backlog_items_write ON public.backlog_items;
CREATE POLICY backlog_items_write ON public.backlog_items FOR ALL
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- ── Seed de Features: 2 por (cliente, épica con HU) ─────────────────────────
WITH feat(epic, ord, title) AS (
  VALUES
    ('administracion', 1, 'Gestión y planificación'),
    ('administracion', 2, 'Actas y documentación'),
    ('infraestructura', 1, 'Ambientes y despliegue'),
    ('infraestructura', 2, 'Accesos y licencias'),
    ('parametrizacion', 1, 'Configuración de módulos'),
    ('parametrizacion', 2, 'Reglas de negocio'),
    ('capacitaciones', 1, 'Talleres y capacitación'),
    ('capacitaciones', 2, 'Certificación de usuarios'),
    ('desarrollos', 1, 'Personalizaciones'),
    ('desarrollos', 2, 'Integraciones y reportes')
),
client_epics AS (SELECT DISTINCT client_id, epic FROM public.tasks WHERE epic IS NOT NULL)
INSERT INTO public.backlog_items (client_id, item_type, epic, title, order_index)
SELECT ce.client_id, 'feature', ce.epic, feat.title, feat.ord
FROM client_epics ce
JOIN feat ON feat.epic = ce.epic
WHERE NOT EXISTS (
  SELECT 1 FROM public.backlog_items bi
  WHERE bi.client_id = ce.client_id AND bi.item_type = 'feature' AND bi.epic = ce.epic AND bi.title = feat.title
);

-- ── Seed de Tasks hijas: 3 por cada HU activa (no terminada) ────────────────
INSERT INTO public.backlog_items (client_id, item_type, parent_hu_id, title, state, assigned_to, iteration, effort, progress, order_index)
SELECT
  t.client_id, 'task', t.id, x.title,
  CASE WHEN x.ord = 1 THEN 'Doing' ELSE 'To Do' END,
  NULLIF(t.owner, '—'),
  'Sprint ' || (1 + (abs(hashtext(t.id::text)) % 12)),
  GREATEST(1, round(COALESCE(t.story_points, 3) / 3.0)),
  CASE WHEN x.ord = 1 THEN 30 ELSE 0 END,
  x.ord
FROM public.tasks t
CROSS JOIN (VALUES ('Análisis funcional', 1), ('Desarrollo', 2), ('Pruebas QA', 3)) AS x(title, ord)
WHERE NOT (t.status = 'completada' OR t.scrum_status = 'done')
  AND NOT EXISTS (SELECT 1 FROM public.backlog_items bi WHERE bi.parent_hu_id = t.id);
