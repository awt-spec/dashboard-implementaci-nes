-- Siembra las 5 épicas como fases del proyecto (auto-vinculadas) para los
-- clientes que tienen backlog de HU. El % y el estado salen del avance real;
-- las fechas se reparten en ventanas secuenciales sobre el período del contrato.
-- Idempotente: no duplica si el cliente ya tiene una fase para esa épica.

WITH epic_def(epic, label, ord) AS (
  VALUES
    ('administracion', 'Administración', 0),
    ('infraestructura', 'Infraestructura', 1),
    ('parametrizacion', 'Parametrización', 2),
    ('capacitaciones', 'Capacitaciones', 3),
    ('desarrollos', 'Desarrollos', 4)
),
prog AS (
  SELECT client_id, epic,
    round(100.0 * sum(coalesce(story_points, 1)) filter (where status = 'completada' or scrum_status = 'done')
      / nullif(sum(coalesce(story_points, 1)), 0)) AS pct
  FROM public.tasks
  GROUP BY client_id, epic
)
INSERT INTO public.phases (client_id, name, status, progress, start_date, end_date, epic)
SELECT
  c.id,
  e.label,
  CASE WHEN coalesce(p.pct, 0) >= 100 THEN 'completado'
       WHEN coalesce(p.pct, 0) > 0 THEN 'en-progreso'
       ELSE 'por-iniciar' END,
  coalesce(p.pct, 0)::int,
  to_char(c.contract_start::date + ((c.contract_end::date - c.contract_start::date) * e.ord / 5), 'YYYY-MM-DD'),
  to_char(c.contract_start::date + ((c.contract_end::date - c.contract_start::date) * (e.ord + 1) / 5), 'YYYY-MM-DD'),
  e.epic
FROM public.clients c
JOIN (SELECT DISTINCT client_id FROM public.tasks) ht ON ht.client_id = c.id
CROSS JOIN epic_def e
LEFT JOIN prog p ON p.client_id = c.id AND p.epic = e.epic
WHERE c.contract_start IS NOT NULL AND c.contract_end IS NOT NULL
  AND length(c.contract_start) >= 10 AND length(c.contract_end) >= 10
  AND NOT EXISTS (SELECT 1 FROM public.phases ph WHERE ph.client_id = c.id AND ph.epic = e.epic);
