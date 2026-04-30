-- ════════════════════════════════════════════════════════════════════════════
-- Fix sprint analytics: story_points default + dedupe sprints duplicados
--
-- Problemas:
--   A) Los CSVs no traían columna `Effort` poblada — solo ~3% de las tasks
--      tienen story_points. Velocity en SprintAnalytics = 0 (no útil).
--      Fix: story_points default por tipo de work item:
--        Product Backlog Item → 5 (feature mediana)
--        Bug                  → 3 (corrección)
--        Task                 → 1 (sub-paso atómico)
--      Esto da una "velocity por count" defensible que permite ver tendencias.
--
--   B) Aurum tiene un sprint duplicado: "Sprint 1 Aurum" + "Sprint 1".
--      Origen: una iteration_path inusual en el CSV "Grupo Aurum\Sprint 1 Aurum".
--      Fix: mover items a "Sprint 1" y eliminar el duplicado.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── A. story_points default basado en work_item_type (de description) ──
UPDATE public.tasks
   SET story_points = 5
 WHERE story_points IS NULL
   AND description LIKE 'DevOps Product Backlog Item %'
   AND client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi');

UPDATE public.tasks
   SET story_points = 3
 WHERE story_points IS NULL
   AND description LIKE 'DevOps Bug %'
   AND client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi');

UPDATE public.tasks
   SET story_points = 1
 WHERE story_points IS NULL
   AND client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi');

-- También effort (mismo valor para consistencia)
UPDATE public.tasks
   SET effort = story_points
 WHERE effort IS NULL
   AND story_points IS NOT NULL
   AND client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi');

-- business_value default = 5 (medio) para que WSJF (V/E) sea calculable
UPDATE public.tasks
   SET business_value = 5
 WHERE business_value IS NULL
   AND client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi');

-- ─── B. Dedupe "Sprint 1 Aurum" → mover items a "Sprint 1" ────────────────
DO $dedupe$
DECLARE
  v_dup_id    UUID;
  v_canon_id  UUID;
  v_moved     INT;
BEGIN
  SELECT id INTO v_dup_id FROM public.support_sprints
   WHERE client_id='aurum' AND name='Sprint 1 Aurum' LIMIT 1;
  SELECT id INTO v_canon_id FROM public.support_sprints
   WHERE client_id='aurum' AND name='Sprint 1' LIMIT 1;

  IF v_dup_id IS NOT NULL AND v_canon_id IS NOT NULL THEN
    UPDATE public.tasks SET sprint_id = v_canon_id
     WHERE sprint_id = v_dup_id;
    GET DIAGNOSTICS v_moved = ROW_COUNT;

    DELETE FROM public.support_sprints WHERE id = v_dup_id;
    RAISE NOTICE 'Aurum: % items movidos de "Sprint 1 Aurum" a "Sprint 1", duplicado eliminado', v_moved;
  END IF;
END;
$dedupe$;

-- ─── C. Recalcular capacity_points de cada sprint = sum(story_points) ────
UPDATE public.support_sprints s
   SET capacity_points = COALESCE(sub.total, 0)
  FROM (
    SELECT sprint_id, SUM(story_points) AS total
      FROM public.tasks
     WHERE sprint_id IS NOT NULL
       AND client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi')
     GROUP BY sprint_id
  ) sub
 WHERE s.id = sub.sprint_id;

-- ─── D. Reporte ──────────────────────────────────────────────────────────
DO $r$
DECLARE
  v_sp_filled  INT;
  v_total      INT;
  v_avg_cap    INT;
  v_active_caps INT;
BEGIN
  SELECT COUNT(*), COUNT(story_points)
    INTO v_total, v_sp_filled
    FROM public.tasks
   WHERE client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi');

  SELECT AVG(capacity_points)::int INTO v_avg_cap
    FROM public.support_sprints
   WHERE client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi')
     AND capacity_points > 0;

  SELECT COUNT(*) INTO v_active_caps
    FROM public.support_sprints
   WHERE client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi')
     AND status = 'activo';

  RAISE NOTICE 'Tasks impl: %/% con story_points (%.0f%%)',
    v_sp_filled, v_total, (v_sp_filled::float * 100 / v_total);
  RAISE NOTICE 'Avg capacity_points por sprint: %  ·  Sprints activos: %',
    v_avg_cap, v_active_caps;
END;
$r$;
