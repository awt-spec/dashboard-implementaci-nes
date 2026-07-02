-- Estructura de SLA real y consistente (4 niveles) para clientes de soporte.
-- Tiempos de respuesta/resolución estándar por prioridad + penalidades.

-- 1) Estandariza tiempos + penalidades de los SLA existentes, por prioridad.
UPDATE public.client_slas s SET
  response_time_hours = v.resp,
  resolution_time_hours = v.reso,
  penalty_amount = v.pen,
  penalty_description = v.pdesc,
  case_type = COALESCE(s.case_type, 'all'),
  business_hours_only = false
FROM (VALUES
  ('critica', 2, 8,  500, 'Penalización por incumplimiento de SLA en caso crítico'),
  ('alta',    4, 24, 250, 'Penalización por incumplimiento de SLA en caso alto'),
  ('media',   8, 48, 0,   NULL),
  ('baja',    24, 72, 0,  NULL)
) AS v(k, resp, reso, pen, pdesc)
WHERE s.is_active
  AND s.client_id IN (SELECT DISTINCT client_id FROM public.support_tickets)
  AND lower(translate(s.priority_level, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) LIKE '%' || v.k || '%';

-- 2) Inserta los niveles faltantes (ej. "Baja" donde sólo había 3 niveles).
WITH lvl(priority_level, resp, reso, pen, pdesc) AS (
  VALUES
    ('Crítica', 2, 8,  500, 'Penalización por incumplimiento de SLA en caso crítico'),
    ('Alta',    4, 24, 250, 'Penalización por incumplimiento de SLA en caso alto'),
    ('Media',   8, 48, 0,   NULL::text),
    ('Baja',    24, 72, 0,  NULL::text)
),
sc AS (SELECT DISTINCT client_id FROM public.support_tickets)
INSERT INTO public.client_slas (client_id, priority_level, case_type, response_time_hours, resolution_time_hours, penalty_amount, penalty_description, business_hours_only, is_active)
SELECT sc.client_id, lvl.priority_level, 'all', lvl.resp, lvl.reso, lvl.pen, lvl.pdesc, false, true
FROM sc CROSS JOIN lvl
WHERE NOT EXISTS (
  SELECT 1 FROM public.client_slas s
  WHERE s.client_id = sc.client_id AND s.is_active
    AND lower(translate(s.priority_level, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU'))
        LIKE '%' || lower(translate(lvl.priority_level, 'áéíóúÁÉÍÓÚ', 'aeiouAEIOU')) || '%'
);
