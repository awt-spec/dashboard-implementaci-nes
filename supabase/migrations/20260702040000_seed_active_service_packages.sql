-- Siembra un paquete de servicio ACTIVO (vigente a la fecha) por cada cliente
-- de soporte que no tenga uno, para que el estado de cuenta muestre pólizas
-- activas y "TOTAL SALDO HORAS ACTIVAS" real. Idempotente.

WITH sc AS (SELECT DISTINCT client_id FROM public.support_tickets),
maxn AS (
  SELECT coalesce(max(policy_number), 500) mp, coalesce(max(package_number), 4000) mpk
  FROM public.service_packages
),
need AS (
  SELECT sc.client_id, row_number() OVER (ORDER BY sc.client_id) rn
  FROM sc
  WHERE NOT EXISTS (
    SELECT 1 FROM public.service_packages sp
    WHERE sp.client_id = sc.client_id AND sp.end_date >= current_date
  )
)
INSERT INTO public.service_packages (client_id, policy_number, package_number, product, hours_contracted, start_date, end_date)
SELECT need.client_id, maxn.mp + need.rn, maxn.mpk + need.rn * 2, 'SYSDE SAF', 24, DATE '2026-06-01', DATE '2026-09-30'
FROM need CROSS JOIN maxn;
