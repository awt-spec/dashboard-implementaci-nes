-- ════════════════════════════════════════════════════════════════════════════
-- Migración: backlogs de implementación de support_tickets → tasks
--
-- Contexto: el bulk import previo (20260430140000) cargó los 2099 work items
-- de los 6 backlogs en `support_tickets`. Pero la vista de cliente (ClientList
-- + ClientDetail.Tareas) lee de `tasks`, así que aparecía vacío. Las dos
-- tablas coexisten por diseño:
--   • `tasks`           → tareas de implementación (proyecto, sprint, owner)
--   • `support_tickets` → casos de soporte (cliente externo, SLA, reopens)
--
-- Este migrate mueve los items de implementación al lado correcto. Mantiene
-- sprint_id, scrum_status, story_points, effort. Mapea estados/prioridades a
-- los CHECK constraints de `tasks`.
--
-- Scope: client_id IN (aurum, apex, dos-pinos, arkfin, amc) +
--        (cmi AND producto = 'Arrendamiento')
-- CMI Factoraje (24 tickets soporte preexistentes) NO se mueve.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. INSERT en tasks (idempotente vía ON CONFLICT en (client_id, original_id)) ───
-- Mapeo de estados support_tickets → tasks:
--   PENDIENTE   → pendiente
--   EN ATENCIÓN → en-progreso
--   VALORACIÓN  → en-progreso
--   APROBADA    → completada
--   CERRADA     → completada
--   ANULADA     → completada (no hay equivalente "cancelada" en tasks)
-- Mapeo de prioridad: lowercase (Media → media, etc.)

-- Asegurar índice único para idempotencia
CREATE UNIQUE INDEX IF NOT EXISTS uq_tasks_client_original
  ON public.tasks(client_id, original_id);

INSERT INTO public.tasks (
  client_id, original_id, title, status, owner, due_date, priority,
  assignees, description, visibility,
  sprint_id, story_points, business_value, effort, backlog_rank, scrum_status
)
SELECT
  t.client_id,
  CAST(t.ticket_id AS INTEGER)                          AS original_id,
  COALESCE(NULLIF(t.asunto, ''), '(sin título)')        AS title,
  CASE t.estado
    WHEN 'PENDIENTE'    THEN 'pendiente'
    WHEN 'EN ATENCIÓN'  THEN 'en-progreso'
    WHEN 'VALORACIÓN'   THEN 'en-progreso'
    WHEN 'APROBADA'     THEN 'completada'
    WHEN 'CERRADA'      THEN 'completada'
    WHEN 'ANULADA'      THEN 'completada'
    ELSE 'pendiente'
  END                                                    AS status,
  COALESCE(NULLIF(t.responsable, ''), '—')              AS owner,
  COALESCE(t.fecha_registro::text, '')                  AS due_date,
  CASE LOWER(COALESCE(t.prioridad, 'media'))
    WHEN 'alta'  THEN 'alta'
    WHEN 'baja'  THEN 'baja'
    ELSE 'media'
  END                                                    AS priority,
  '[]'::jsonb                                            AS assignees,
  t.notas                                                AS description,
  'externa'                                              AS visibility,
  t.sprint_id,
  t.story_points,
  t.business_value,
  t.effort,
  t.backlog_rank,
  COALESCE(t.scrum_status, 'backlog')                    AS scrum_status
FROM public.support_tickets t
WHERE t.fuente = 'devops'
  AND t.ticket_id ~ '^\d+$'   -- solo IDs numéricos (todos los del import lo son)
  AND (
    t.client_id IN ('aurum','apex','dos-pinos','arkfin','amc')
    OR (t.client_id = 'cmi' AND t.producto = 'Arrendamiento')
  )
ON CONFLICT (client_id, original_id) DO NOTHING;

-- ─── 2. DELETE de support_tickets (los implementación ya viven en tasks) ────
-- ON DELETE CASCADE en tablas hijas (support_ticket_subtasks, ticket_reopens,
-- shared_ticket_history, etc.) limpia automáticamente. Estos tickets son
-- brand new del import, sin actividad externa, así que el cascade es no-op.

DELETE FROM public.support_tickets
 WHERE fuente = 'devops'
   AND ticket_id ~ '^\d+$'
   AND (
     client_id IN ('aurum','apex','dos-pinos','arkfin','amc')
     OR (client_id = 'cmi' AND producto = 'Arrendamiento')
   );

-- ─── 3. Reporte ───────────────────────────────────────────────────────────
DO $report$
DECLARE
  v_tasks_total INTEGER;
  v_tasks_impl  INTEGER;
  v_tickets_cmi INTEGER;
  v_tickets_impl INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_tasks_total FROM public.tasks;
  SELECT COUNT(*) INTO v_tasks_impl
    FROM public.tasks
   WHERE client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi');
  SELECT COUNT(*) INTO v_tickets_cmi
    FROM public.support_tickets WHERE client_id = 'cmi';
  SELECT COUNT(*) INTO v_tickets_impl
    FROM public.support_tickets
    WHERE client_id IN ('aurum','apex','dos-pinos','arkfin','amc');

  RAISE NOTICE 'Tasks total: % | de los 6 implementación: %', v_tasks_total, v_tasks_impl;
  RAISE NOTICE 'support_tickets restantes — CMI: % (debe ser ~24 Factoraje), Aurum/Apex/Dos-Pinos/Arkfin/AMC: % (debe ser 0)',
    v_tickets_cmi, v_tickets_impl;
END;
$report$;
