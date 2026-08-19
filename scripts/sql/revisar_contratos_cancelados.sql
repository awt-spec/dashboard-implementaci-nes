-- ============================================================================
-- Diagnóstico: contratos marcados 'cancelado' por el backfill del ciclo de vida
-- (migración 20260814210000_contract_lifecycle.sql).
--
-- El backfill puso 'cancelado' en TODO lo que tenía is_active = false, porque la
-- base no guardaba nada que distinguiera un contrato cancelado de uno que
-- simplemente fue reemplazado por su renovación. Pero esa señal SÍ existe de
-- forma indirecta: si el mismo cliente tiene otro contrato que empieza cerca de
-- —o después de— la fecha en que terminó el inactivo, lo más probable es que el
-- viejo no se haya cancelado sino renovado.
--
-- Esta consulta NO modifica nada: clasifica y sugiere. La decisión es humana.
-- ============================================================================

with cancelados as (
  select c.id, c.client_id, cl.name as cliente, c.contract_type,
         c.start_date, c.end_date, c.monthly_value, c.currency
  from public.client_contracts c
  join public.clients cl on cl.id = c.client_id
  where c.status = 'cancelado'
    and c.deleted_at is null
)
select
  x.cliente,
  x.contract_type                       as tipo,
  x.start_date                          as inicio,
  x.end_date                            as fin,
  x.monthly_value                       as valor_mensual,
  x.currency                            as moneda,
  s.start_date                          as sucesor_inicia,
  case
    when s.id is null then 'CANCELADO (sin contrato posterior)'
    when x.end_date is null then 'REVISAR (el inactivo no tiene fecha de fin)'
    when s.start_date between x.end_date - 31 and x.end_date + 92
      then 'RENOVADO probable (sucesor arranca junto al fin)'
    else 'REVISAR (hay contrato posterior, pero con hueco)'
  end                                   as sugerencia,
  x.id                                  as contract_id
from cancelados x
left join lateral (
  -- Primer contrato del mismo cliente que arranca a partir del fin del inactivo.
  select c2.id, c2.start_date
  from public.client_contracts c2
  where c2.client_id = x.client_id
    and c2.id <> x.id
    and c2.deleted_at is null
    and c2.start_date is not null
    and (x.end_date is null or c2.start_date >= x.end_date - 31)
  order by c2.start_date asc
  limit 1
) s on true
order by sugerencia, x.cliente;

-- ── Corrección automática ───────────────────────────────────────────────────
-- Aplica SOLO el caso inequívoco ("RENOVADO probable"): el cliente tiene otro
-- contrato que arranca en la ventana del vencimiento. Los "REVISAR" y los
-- "CANCELADO (sin contrato posterior)" NO se tocan: esos necesitan criterio.
--
-- No hay que copiar ids: el WHERE reproduce exactamente la misma condición que
-- la columna "sugerencia" de la consulta de arriba.
--
-- PASO 1 — cuántas filas cambiaría (no modifica nada):
--
-- select count(*)
--   from public.client_contracts c
--  where c.status = 'cancelado'
--    and c.deleted_at is null
--    and c.end_date is not null
--    and exists (
--      select 1 from public.client_contracts c2
--       where c2.client_id = c.client_id
--         and c2.id <> c.id
--         and c2.deleted_at is null
--         and c2.start_date is not null
--         and c2.start_date between c.end_date - 31 and c.end_date + 92
--    );
--
-- PASO 2 — aplicar. Los triggers hacen el resto: sync_contract_status_active
-- ajusta is_active y log_contract_change asienta el cambio en contract_history,
-- así que queda auditado y visible en el expediente 360.
--
-- update public.client_contracts c
--    set status = 'renovado'
--  where c.status = 'cancelado'
--    and c.deleted_at is null
--    and c.end_date is not null
--    and exists (
--      select 1 from public.client_contracts c2
--       where c2.client_id = c.client_id
--         and c2.id <> c.id
--         and c2.deleted_at is null
--         and c2.start_date is not null
--         and c2.start_date between c.end_date - 31 and c.end_date + 92
--    );
