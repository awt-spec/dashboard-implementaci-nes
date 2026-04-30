-- ════════════════════════════════════════════════════════════════════════════
-- Recalibración de fechas para los backlogs de implementación
--
-- Problema: el import inicial usaba 2024-01-01 como anchor para Sprint 1,
-- lo que daba "+840d" para tickets en folder raíz aunque clientes como CMI
-- empezaron hace ~1 año. Feedback COO María Fernanda.
--
-- Solución: anclar la ÚLTIMA sprint de cada cliente ≈ hoy y trabajar hacia
-- atrás (2 semanas por sprint). Para tickets sin sprint (folder raíz del
-- team), usar fecha del último sprint (son backlog "vivo", no histórico).
--
-- Solo afecta tickets con fuente='devops' creados por el import de
-- backlogs (20260430140000) — preserva los demás.
-- ════════════════════════════════════════════════════════════════════════════

DO $recalibrate$
DECLARE
  v_client_id  TEXT;
  v_max_sprint INTEGER;
  v_sprint     RECORD;
  v_anchor     DATE := CURRENT_DATE;       -- ancla = hoy
  v_idx        INTEGER;
BEGIN
  -- Procesar cada cliente de implementación que tenga sprints
  FOR v_client_id IN
    SELECT DISTINCT client_id
      FROM public.support_sprints
     WHERE client_id IN ('aurum','apex','dos-pinos','arkfin','amc')
        OR (client_id = 'cmi' AND EXISTS (
              SELECT 1 FROM public.support_tickets t
               WHERE t.client_id='cmi' AND t.producto='Arrendamiento'
                 AND t.sprint_id IS NOT NULL))
  LOOP
    -- Encontrar el máximo número de sprint del cliente
    SELECT MAX(
      CASE
        WHEN name ~ '\d+'
          THEN substring(name from '(\d+)')::int
        ELSE 0
      END
    ) INTO v_max_sprint
    FROM public.support_sprints
    WHERE client_id = v_client_id;

    -- Recorrer los sprints del cliente y reasignar fechas:
    -- Sprint K → start = v_anchor - (v_max_sprint - K + 1) * 14 días
    --           end   = start + 14 días
    FOR v_sprint IN
      SELECT id, name FROM public.support_sprints
       WHERE client_id = v_client_id
       ORDER BY (CASE WHEN name ~ '\d+' THEN substring(name from '(\d+)')::int ELSE 0 END)
    LOOP
      v_idx := CASE
        WHEN v_sprint.name ~ '\d+'
          THEN substring(v_sprint.name from '(\d+)')::int
        ELSE 1
      END;

      UPDATE public.support_sprints
         SET start_date = v_anchor - ((v_max_sprint - v_idx + 1) * 14)::int,
             end_date   = v_anchor - ((v_max_sprint - v_idx) * 14)::int
       WHERE id = v_sprint.id;
    END LOOP;
  END LOOP;

  RAISE NOTICE 'Sprints reanclados con la última = hoy';
END;
$recalibrate$;

-- ─── Actualizar tickets vinculados a sprint con la nueva fecha del sprint ──
UPDATE public.support_tickets t
   SET fecha_registro = s.start_date,
       dias_antiguedad = (CURRENT_DATE - s.start_date)::int
  FROM public.support_sprints s
 WHERE t.sprint_id = s.id
   AND t.fuente = 'devops'
   AND (t.client_id IN ('aurum','apex','dos-pinos','arkfin','amc')
     OR (t.client_id = 'cmi' AND t.producto = 'Arrendamiento'));

-- ─── Tickets SIN sprint (folder raíz del team) → fecha = último sprint ─────
-- Son backlog "vivo" (todavía no priorizado a un sprint). Les asignamos la
-- fecha del último sprint + 1 día → aparecen como "agregados al backlog
-- recientemente" (no como históricos de hace 2 años).
UPDATE public.support_tickets t
   SET fecha_registro = sub.last_sprint_start,
       dias_antiguedad = (CURRENT_DATE - sub.last_sprint_start)::int
  FROM (
    SELECT client_id, MAX(start_date) AS last_sprint_start
      FROM public.support_sprints
     WHERE client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi')
     GROUP BY client_id
  ) sub
 WHERE t.client_id = sub.client_id
   AND t.sprint_id IS NULL
   AND t.fuente = 'devops'
   AND (t.client_id IN ('aurum','apex','dos-pinos','arkfin','amc')
     OR (t.client_id = 'cmi' AND t.producto = 'Arrendamiento'));

-- ─── Reportar el resultado ────────────────────────────────────────────────
DO $report$
DECLARE
  v_oldest INTEGER;
  v_newest INTEGER;
  v_avg    INTEGER;
BEGIN
  SELECT MAX(dias_antiguedad), MIN(dias_antiguedad), AVG(dias_antiguedad)::int
    INTO v_oldest, v_newest, v_avg
    FROM public.support_tickets
   WHERE fuente='devops'
     AND (client_id IN ('aurum','apex','dos-pinos','arkfin','amc')
       OR (client_id='cmi' AND producto='Arrendamiento'));
  RAISE NOTICE 'Tickets implementación: días_antiguedad min=%, max=%, avg=%',
    v_newest, v_oldest, v_avg;
END;
$report$;
