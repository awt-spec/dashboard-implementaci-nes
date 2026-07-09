-- Señales comerciales reales por cliente para el módulo Comercial del CSR.
-- Reemplaza la heurística "# tickets + última cotización" por datos reales:
-- consumo de la bolsa de horas del mes, hitos cumplidos sin facturar,
-- suscripción vencida, contrato activo y estado de la última cotización.
-- SECURITY DEFINER: el CSR no tiene lectura directa de todas estas tablas.

create or replace function public.get_csr_commercial_signals()
returns table(
  client_id text, open_tickets int, has_active_contract boolean,
  included_hours int, consumed_hours_month numeric,
  hitos_cumplidos int, sub_vencida boolean, last_quote_status text
) language sql security definer set search_path = public as $$
  with cl as (select id from clients),
  tk as (
    select client_id, count(*)::int n from support_tickets
    where estado not in ('CERRADA','ANULADA','ENTREGADA','APROBADA')
    group by client_id
  ),
  ct as (
    select distinct on (client_id) client_id, included_hours
    from client_contracts where is_active order by client_id, included_hours desc
  ),
  hrs as (
    select client_id, coalesce(sum(duration_seconds),0)/3600.0 h
    from work_time_entries
    where duration_seconds is not null and started_at >= date_trunc('month', now())
    group by client_id
  ),
  ms as (
    select client_id, count(*) filter (where status='cumplido')::int c
    from contract_milestones where client_id is not null group by client_id
  ),
  sub as (
    select client_id, bool_or(is_subscription and next_payment_date is not null and next_payment_date < current_date) v
    from billed_packages group by client_id
  ),
  q as (
    select distinct on (client_id) client_id, status from quotes order by client_id, created_at desc
  )
  select cl.id,
    coalesce(tk.n,0),
    (ct.client_id is not null),
    coalesce(ct.included_hours,0),
    round(coalesce(hrs.h,0),1),
    coalesce(ms.c,0),
    coalesce(sub.v,false),
    q.status
  from cl
  left join tk on tk.client_id=cl.id
  left join ct on ct.client_id=cl.id
  left join hrs on hrs.client_id=cl.id
  left join ms on ms.client_id=cl.id
  left join sub on sub.client_id=cl.id
  left join q on q.client_id=cl.id;
$$;

grant execute on function public.get_csr_commercial_signals() to authenticated;
