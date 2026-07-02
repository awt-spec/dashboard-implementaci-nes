-- Casos DEMO para validar la alerta de SLA en sus 3 estados (al día / en riesgo
-- / incumplido). Aditivo: no toca los casos reales. Marcados con "[DEMO SLA]".
-- Idempotente por ticket_id.

WITH sc AS (SELECT DISTINCT client_id FROM public.support_tickets),
maxc AS (SELECT COALESCE(max(consecutivo_global), 100000) AS mg FROM public.support_tickets),
spec(idx, prioridad, limit_h, factor, estado_lbl) AS (
  VALUES
    (1, 'Critica, Impacto Negocio', 8,  0.30, 'al dia'),
    (2, 'Alta',                     24, 0.90, 'en riesgo'),
    (3, 'Media',                    48, 1.50, 'incumplido'),
    (4, 'Critica, Impacto Negocio', 8,  1.60, 'incumplido'),
    (5, 'Baja',                     72, 0.85, 'en riesgo')
),
rows AS (
  SELECT sc.client_id, spec.idx, spec.prioridad, spec.limit_h, spec.factor, spec.estado_lbl,
    row_number() OVER (ORDER BY sc.client_id, spec.idx) AS rn
  FROM sc CROSS JOIN spec
)
INSERT INTO public.support_tickets
  (client_id, ticket_id, consecutivo_global, consecutivo_cliente, asunto, producto, tipo, prioridad, estado, fecha_registro, dias_antiguedad, fuente)
SELECT
  r.client_id,
  'DEMO-SLA-' || r.client_id || '-' || r.idx,
  maxc.mg + r.rn,
  9000 + r.idx,
  '[DEMO SLA] Caso ' || r.estado_lbl || ' — validación de alerta',
  'SYSDE SAF', 'Consulta', r.prioridad, 'EN ATENCIÓN',
  now() - make_interval(hours => round(r.limit_h * r.factor)::int),
  GREATEST(0, floor((r.limit_h * r.factor) / 24.0)::int),
  'interno'
FROM rows r CROSS JOIN maxc
WHERE NOT EXISTS (
  SELECT 1 FROM public.support_tickets st
  WHERE st.ticket_id = 'DEMO-SLA-' || r.client_id || '-' || r.idx
);
