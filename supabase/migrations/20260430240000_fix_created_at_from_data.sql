-- ════════════════════════════════════════════════════════════════════════════
-- Corrección de `created_at` para reflejar la fecha REAL del dato, no la
-- fecha de migración.
--
-- Problema: cuando importé los CSVs (574 tickets soporte + 2099 backlog impl),
-- `created_at` quedó con NOW() = momento de la migración. La UI muestra
-- "hace alrededor de 3 horas" para todos esos items, lo cual es engañoso —
-- el dato existía hace meses/años, no fue creado ahora.
--
-- Feedback COO María: "eso fue algo que de migración, no de hace cuanto está,
-- sácalo de los datos".
--
-- Fix:
--   • support_tickets devops/import → created_at = fecha_registro (Excel data)
--   • tasks (todos los implementación) → created_at = sprint.start_date
--     (anclado a hoy con sprint último; viejos retroceden 2 semanas por sprint)
--   • tasks sin sprint → created_at = primer sprint del cliente (más antiguo)
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. support_tickets: created_at = fecha_registro ────────────────────
UPDATE public.support_tickets
   SET created_at = fecha_registro::timestamptz
 WHERE fuente = 'devops'
   AND fecha_registro IS NOT NULL
   AND ABS(EXTRACT(EPOCH FROM (created_at - fecha_registro::timestamptz))) > 86400;
   -- Solo si hay diferencia >1 día (no re-tocar los ya correctos)

-- ─── 2. tasks con sprint_id: created_at = sprint.start_date ──────────────
UPDATE public.tasks t
   SET created_at = (s.start_date)::timestamptz
  FROM public.support_sprints s
 WHERE t.sprint_id = s.id
   AND t.client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi')
   AND s.start_date IS NOT NULL;

-- ─── 3. tasks sin sprint_id: created_at = primer sprint del cliente ──────
-- (Items en folder raíz del team — backlog vivo, fecha = inicio del proyecto)
UPDATE public.tasks t
   SET created_at = sub.first_sprint_start::timestamptz
  FROM (
    SELECT client_id, MIN(start_date) AS first_sprint_start
      FROM public.support_sprints
     WHERE client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi')
     GROUP BY client_id
  ) sub
 WHERE t.client_id = sub.client_id
   AND t.sprint_id IS NULL
   AND t.client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi');

-- ─── 4. Reporte ──────────────────────────────────────────────────────────
DO $r$
DECLARE
  v_avg_days  INTEGER;
  v_min_days  INTEGER;
  v_max_days  INTEGER;
  v_tk_avg    INTEGER;
BEGIN
  SELECT AVG(EXTRACT(DAY FROM NOW() - created_at))::int,
         MIN(EXTRACT(DAY FROM NOW() - created_at))::int,
         MAX(EXTRACT(DAY FROM NOW() - created_at))::int
    INTO v_avg_days, v_min_days, v_max_days
    FROM public.tasks
   WHERE client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi');

  SELECT AVG(EXTRACT(DAY FROM NOW() - created_at))::int
    INTO v_tk_avg
    FROM public.support_tickets WHERE fuente = 'devops';

  RAISE NOTICE 'Tasks impl: edad min=%d max=%d avg=%d días (antes era ~0)',
    v_min_days, v_max_days, v_avg_days;
  RAISE NOTICE 'support_tickets devops: edad avg=%d días (antes era ~0)', v_tk_avg;
END;
$r$;
