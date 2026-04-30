-- ════════════════════════════════════════════════════════════════════════════
-- Implementación backlogs — clasificación visibility + cierre sprints viejos
--
-- Feedback COO María Fernanda (30/04):
--   1. Clasificar tasks entre internas / externas
--   2. Solo el ÚLTIMO sprint de cada cliente debe verse activo. Los anteriores
--      → tareas "completada" + sprint "completado". Items sin sprint (folder
--      raíz del team) quedan en su estado actual (backlog vivo a priorizar).
--   3. Conectar con la parte de scrum (ya existe sprint_id/scrum_status —
--      este migration solo ajusta valores).
--
-- Heurística visibility (basada en `description` que tiene "DevOps {Type}"):
--   • DevOps Task                 → interna  (sub-paso de implementación)
--   • DevOps Product Backlog Item → externa  (user story, cliente la pidió)
--   • DevOps Bug                  → externa  (cliente reportó)
--
-- Scope: solo tasks de los 6 backlogs (description LIKE 'DevOps %').
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. CLASIFICAR visibility ────────────────────────────────────────────
UPDATE public.tasks
   SET visibility = 'interna'
 WHERE description LIKE 'DevOps Task %'
   AND client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi');

UPDATE public.tasks
   SET visibility = 'externa'
 WHERE (description LIKE 'DevOps Product Backlog Item %'
     OR description LIKE 'DevOps Bug %')
   AND client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi');

-- ─── 2. CERRAR items de sprints VIEJOS (no el último de cada cliente) ────
-- Para cada cliente, encontrar max(sprint_number). Items en sprints con
-- número < max → cerrar. Items en el último o sin sprint (root) → no tocar.
DO $close_old$
DECLARE
  v_client     TEXT;
  v_max_num    INTEGER;
  v_max_id     UUID;
  v_closed_t   INTEGER;
  v_closed_s   INTEGER;
BEGIN
  FOR v_client IN
    SELECT DISTINCT client_id
      FROM public.support_sprints
     WHERE client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi')
  LOOP
    -- Máximo número de sprint de este cliente
    SELECT MAX(CASE WHEN name ~ '\d+' THEN substring(name from '(\d+)')::int ELSE 0 END)
      INTO v_max_num
      FROM public.support_sprints
     WHERE client_id = v_client;

    -- Cerrar tasks de sprints anteriores al máximo
    UPDATE public.tasks t
       SET status = 'completada',
           scrum_status = 'done',
           updated_at = NOW()
      FROM public.support_sprints s
     WHERE t.sprint_id = s.id
       AND s.client_id = v_client
       AND t.client_id = v_client
       AND s.name ~ '\d+'
       AND substring(s.name from '(\d+)')::int < v_max_num;
    GET DIAGNOSTICS v_closed_t = ROW_COUNT;

    -- Cerrar los sprints viejos también (status del sprint = completado)
    UPDATE public.support_sprints
       SET status = 'completado',
           updated_at = NOW()
     WHERE client_id = v_client
       AND name ~ '\d+'
       AND substring(name from '(\d+)')::int < v_max_num;
    GET DIAGNOSTICS v_closed_s = ROW_COUNT;

    RAISE NOTICE 'Cliente %: max sprint=%, % tasks cerradas en sprints viejos, % sprints marcados completado',
      v_client, v_max_num, v_closed_t, v_closed_s;
  END LOOP;
END;
$close_old$;

-- ─── 3. Marcar el último sprint de cada cliente como ACTIVO ──────────────
-- Si el sprint más reciente tenía 'planificado' o 'completado' inicial, lo
-- normalizamos a 'activo' para que el dashboard lo levante como sprint vigente.
DO $mark_active$
DECLARE
  v_client    TEXT;
  v_max_num   INTEGER;
BEGIN
  FOR v_client IN
    SELECT DISTINCT client_id
      FROM public.support_sprints
     WHERE client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi')
  LOOP
    SELECT MAX(CASE WHEN name ~ '\d+' THEN substring(name from '(\d+)')::int ELSE 0 END)
      INTO v_max_num
      FROM public.support_sprints
     WHERE client_id = v_client;

    UPDATE public.support_sprints
       SET status = 'activo',
           updated_at = NOW()
     WHERE client_id = v_client
       AND name ~ '\d+'
       AND substring(name from '(\d+)')::int = v_max_num;
  END LOOP;
  RAISE NOTICE 'Último sprint de cada cliente marcado activo';
END;
$mark_active$;

-- ─── 4. Reporte ───────────────────────────────────────────────────────────
DO $report$
DECLARE
  v_total       INTEGER;
  v_internas    INTEGER;
  v_externas    INTEGER;
  v_completadas INTEGER;
  v_activas     INTEGER;
  v_active_sp   INTEGER;
  v_done_sp     INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_total
    FROM public.tasks
   WHERE client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi');
  SELECT COUNT(*) INTO v_internas
    FROM public.tasks
   WHERE client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi') AND visibility='interna';
  SELECT COUNT(*) INTO v_externas
    FROM public.tasks
   WHERE client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi') AND visibility='externa';
  SELECT COUNT(*) INTO v_completadas
    FROM public.tasks
   WHERE client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi') AND status='completada';
  SELECT COUNT(*) INTO v_activas
    FROM public.tasks
   WHERE client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi') AND status != 'completada';
  SELECT COUNT(*) INTO v_active_sp
    FROM public.support_sprints
   WHERE client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi') AND status='activo';
  SELECT COUNT(*) INTO v_done_sp
    FROM public.support_sprints
   WHERE client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi') AND status='completado';

  RAISE NOTICE 'Tasks impl: % total · % internas · % externas', v_total, v_internas, v_externas;
  RAISE NOTICE 'Status: % completadas · % activas (pendiente/en-progreso)', v_completadas, v_activas;
  RAISE NOTICE 'Sprints: % activos (uno por cliente) · % completados (históricos)', v_active_sp, v_done_sp;
END;
$report$;
