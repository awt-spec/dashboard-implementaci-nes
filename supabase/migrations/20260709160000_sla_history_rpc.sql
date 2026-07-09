-- Histórico de cumplimiento SLA por cliente (casos cerrados).
-- Mide el tiempo de resolución (fecha_registro → fecha_entrega) contra el SLA
-- de la prioridad, y la primera respuesta (primera nota del caso). Solo mide
-- casos con fecha de entrega registrada; devuelve también el total cerrado para
-- exponer la cobertura. SECURITY DEFINER (agrega datos que el rol puede no leer).

create or replace function public.get_sla_history(_client_id text)
returns jsonb language sql stable security definer set search_path = public as $$
with sla as (
  select priority_key, resolution_time_hours, response_time_hours from (
    select case
      when lower(priority_level) like '%crit%' then 'critica'
      when lower(priority_level) like '%alta%' then 'alta'
      when lower(priority_level) like '%media%' then 'media'
      when lower(priority_level) like '%baja%' then 'baja' end as priority_key,
      resolution_time_hours, response_time_hours,
      row_number() over (partition by (case
        when lower(priority_level) like '%crit%' then 'critica'
        when lower(priority_level) like '%alta%' then 'alta'
        when lower(priority_level) like '%media%' then 'media'
        when lower(priority_level) like '%baja%' then 'baja' end)
        order by (case when case_type='all' then 0 else 1 end)) rn
    from client_slas where client_id = _client_id and is_active
  ) s where priority_key is not null and rn = 1
),
closed as (
  select t.id, t.prioridad, t.fecha_registro, t.fecha_entrega,
    case
      when lower(t.prioridad) like '%crit%' then 'critica'
      when lower(t.prioridad) like '%alta%' then 'alta'
      when lower(t.prioridad) like '%media%' then 'media'
      when lower(t.prioridad) like '%baja%' then 'baja' end as priority_key,
    (select min(n.created_at) from support_ticket_notes n where n.ticket_id = t.id) as first_note_at
  from support_tickets t
  where t.client_id = _client_id and t.estado in ('CERRADA','ENTREGADA','APROBADA') and t.fecha_registro is not null
),
eval as (
  select c.*, s.resolution_time_hours, s.response_time_hours,
    extract(epoch from (c.fecha_entrega - c.fecha_registro)) / 3600.0 as resolution_hours,
    case when c.first_note_at is not null then extract(epoch from (c.first_note_at - c.fecha_registro)) / 3600.0 end as response_hours
  from closed c join sla s on s.priority_key = c.priority_key
  where c.fecha_entrega is not null and c.fecha_entrega >= c.fecha_registro
)
select jsonb_build_object(
  'closed_total', (select count(*) from closed),
  'overall', (select jsonb_build_object('measured', count(*),
     'met', count(*) filter (where resolution_hours <= resolution_time_hours),
     'avg_resolution_hours', round(avg(resolution_hours)::numeric, 1)) from eval),
  'response', (select jsonb_build_object('measured', count(*) filter (where response_hours is not null),
     'met', count(*) filter (where response_hours is not null and response_hours <= response_time_hours)) from eval),
  'by_month', (select coalesce(jsonb_agg(x order by x->>'month'), '[]'::jsonb) from (
     select jsonb_build_object('month', to_char(date_trunc('month', fecha_entrega), 'YYYY-MM'),
       'total', count(*), 'met', count(*) filter (where resolution_hours <= resolution_time_hours)) x
     from eval group by date_trunc('month', fecha_entrega)) m),
  'by_priority', (select coalesce(jsonb_agg(x), '[]'::jsonb) from (
     select jsonb_build_object('priority', priority_key, 'total', count(*),
       'met', count(*) filter (where resolution_hours <= resolution_time_hours),
       'avg_resolution_hours', round(avg(resolution_hours)::numeric, 1)) x
     from eval group by priority_key) p)
);
$$;

grant execute on function public.get_sla_history(text) to authenticated;
