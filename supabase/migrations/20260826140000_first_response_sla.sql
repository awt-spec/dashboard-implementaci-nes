-- ============================================================================
-- SLA de PRIMERA RESPUESTA.
--
-- Los client_slas ya traen response_time_hours en las 113 filas activas —
-- Crítica 2 h, Alta 4 h, Media 8 h, Baja 24 h— o sea que el compromiso está
-- vendido y firmado. Pero nada lo medía: la app sólo evaluaba resolución. La
-- mitad del SLA contratado era invisible.
--
-- QUÉ CUENTA COMO RESPUESTA (la decisión que define todo acá):
-- la primera nota con visibility = 'externa'. Nada más.
--
--   • Una nota INTERNA no es una respuesta. Es trabajo, y el cliente no la ve.
--   • Cambiar de estado tampoco. Pasar a EN ATENCIÓN significa que alguien lo
--     tomó, no que le contestó. Contarlo inflaría el cumplimiento con un clic.
--
-- El efecto de lado es deliberado: hoy hay 0 notas en 840 casos porque
-- escribirlas no servía para nada. A partir de acá, escribir la nota externa
-- ES la respuesta, y es lo único que para el reloj.
--
-- NO SE BACKFILLEA. No sabemos cuándo se respondió cada caso viejo, e
-- inventarlo sería peor que no medirlo. first_response_at queda nulo hacia
-- atrás y la medición arranca con la fecha de corte que ya rige para
-- resolución (sla_measurement_start).
-- ============================================================================

alter table public.support_tickets
  add column if not exists first_response_at timestamptz;

comment on column public.support_tickets.first_response_at is
  'Cuándo se le respondió al cliente por primera vez. Lo estampa un trigger con la primera nota de visibility=externa. Nulo hacia atrás: no se backfilleó porque el dato no existía.';

create index if not exists support_tickets_first_response_idx
  on public.support_tickets (first_response_at) where first_response_at is null;

-- ── El trigger ──────────────────────────────────────────────────────────────
create or replace function public.stamp_first_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if coalesce(NEW.visibility, 'interna') <> 'externa' then
    return NEW;
  end if;
  -- Se estampa con la fecha de la NOTA, no con now(): si alguien carga una
  -- nota con fecha anterior, el reloj tiene que reflejar eso.
  update public.support_tickets
     set first_response_at = NEW.created_at
   where id = NEW.ticket_id
     and first_response_at is null;
  return NEW;
end;
$$;

drop trigger if exists trg_stamp_first_response on public.support_ticket_notes;
create trigger trg_stamp_first_response
  after insert on public.support_ticket_notes
  for each row execute function public.stamp_first_response();

comment on function public.stamp_first_response() is
  'Estampa support_tickets.first_response_at con la primera nota externa. Sólo la primera: no pisa una respuesta ya registrada.';


-- ── La RPC, ahora con las dos mitades del SLA ───────────────────────────────
drop function if exists public.get_tickets_sla_status();

create function public.get_tickets_sla_status()
returns table (
  ticket_id uuid,
  ticket_code text,
  client_id text,
  estado text,
  prioridad text,
  fecha_registro timestamptz,
  deadline_days int,
  days_elapsed int,
  limit_hours numeric,
  elapsed_hours numeric,
  sla_source text,
  sla_status text,
  in_scope boolean,
  registered_late boolean,
  coverage text,
  contract_id uuid,
  first_response_at timestamptz,
  response_limit_hours numeric,
  response_hours numeric,
  response_status text
)
language sql
stable
security definer
set search_path = public
as $$
  with policy as (
    select coalesce(content->'deadlines', '[]'::jsonb) as deadlines
    from business_rules
    where rule_type = 'sla' and policy_version = 'v4.5' and is_active = true
    limit 1
  ),
  base as (
    select
      t.id, t.ticket_id as code, t.client_id, t.estado, t.prioridad, t.tipo,
      t.created_at as loaded_at,
      t.first_response_at,
      coalesce(t.fecha_registro, t.created_at) as started_at,
      -- El elapsed sale SIEMPRE de la fecha, nunca de dias_antiguedad: esa
      -- columna guarda la edad al momento de la importación y no se recalcula.
      (extract(epoch from (now() - coalesce(t.fecha_registro, t.created_at))) / 3600.0)::numeric as elapsed_h
    from support_tickets t
    where t.estado not in ('CERRADA', 'ANULADA')
      -- Un usuario cliente ve SÓLO su empresa. Misma condición que la policy
      -- "Cliente selects own client tickets" de support_tickets.
      and (
        not public.is_cliente_user()
        or t.client_id = public.get_cliente_client_id(auth.uid())
      )
  ),
  resolved as (
    select
      b.*,
      -- SLA contractual del cliente: gana si existe. Se traen las DOS mitades
      -- de la misma fila para que resolución y respuesta no salgan de reglas
      -- distintas.
      (
        select cs.resolution_time_hours
        from client_slas cs
        where cs.client_id = b.client_id and cs.is_active = true
          and cs.resolution_time_hours is not null and cs.resolution_time_hours > 0
          and coalesce(cs.priority_level, '') <> ''
          and public.sla_norm(b.prioridad) like '%' || public.sla_norm(cs.priority_level) || '%'
        order by case when coalesce(cs.case_type, 'all') = 'all' then 0 else 1 end
        limit 1
      ) as contract_h,
      (
        select cs.response_time_hours
        from client_slas cs
        where cs.client_id = b.client_id and cs.is_active = true
          and cs.response_time_hours is not null and cs.response_time_hours > 0
          and coalesce(cs.priority_level, '') <> ''
          and public.sla_norm(b.prioridad) like '%' || public.sla_norm(cs.priority_level) || '%'
        order by case when coalesce(cs.case_type, 'all') = 'all' then 0 else 1 end
        limit 1
      ) as response_h,
      coalesce(
        (
          select (d->>'deadline_days')::int
          from policy p, jsonb_array_elements(p.deadlines) d
          where coalesce(d->>'priority', '') <> '' and coalesce(d->>'case_type', '') <> ''
            and public.sla_norm(b.prioridad) like '%' || public.sla_norm(d->>'priority') || '%'
            and public.sla_norm(b.tipo)      like '%' || public.sla_norm(d->>'case_type') || '%'
          limit 1
        ),
        (
          select (d->>'deadline_days')::int
          from policy p, jsonb_array_elements(p.deadlines) d
          where coalesce(d->>'priority', '') <> ''
            and public.sla_norm(d->>'case_type') = 'correccion'
            and public.sla_norm(b.prioridad) like '%' || public.sla_norm(d->>'priority') || '%'
          limit 1
        )
      ) as policy_days
    from base b
  ),
  computed as (
    select
      r.*,
      case
        when r.contract_h is not null then r.contract_h
        when r.policy_days is not null then r.policy_days * 24.0
      end::numeric as limit_h,
      case
        when r.contract_h is not null then 'contrato'
        when r.policy_days is not null then 'politica'
        else 'sin_regla'
      end as source,
      -- Horas hasta la respuesta si ya respondimos; si no, las que llevamos
      -- esperando. Las dos se comparan contra el mismo límite.
      case
        when r.first_response_at is not null
          then (extract(epoch from (r.first_response_at - r.started_at)) / 3600.0)::numeric
        else r.elapsed_h
      end as resp_h
    from resolved r
  )
  select
    c.id, c.code, c.client_id, c.estado, c.prioridad, c.started_at,
    case when c.limit_h is not null then ceil(c.limit_h / 24.0)::int end,
    greatest(0, floor(c.elapsed_h / 24.0)::int),
    round(c.limit_h, 2),
    round(c.elapsed_h, 2),
    c.source,
    case
      when upper(c.estado) in ('CERRADA', 'ANULADA', 'ENTREGADA', 'APROBADA') then 'no_sla'
      -- Un caso fechado en el futuro tiene elapsed negativo y se colaba como
      -- 'ok'. No es cumplido ni incumplido: no empezó.
      when c.elapsed_h < 0 then 'no_sla'
      when c.limit_h is null then 'no_sla'
      when c.elapsed_h > c.limit_h then 'overdue'
      when c.elapsed_h >= c.limit_h * 0.8 then 'warning'
      else 'ok'
    end,
    c.started_at >= public.sla_measurement_start(),
    c.loaded_at >= public.sla_measurement_start()
      and c.started_at < public.sla_measurement_start(),
    -- La cobertura NO se recalcula acá: se pide a la misma función que usan el
    -- formulario de alta y el portal del cliente.
    cov.coverage,
    cov.contract_id,
    c.first_response_at,
    round(c.response_h, 2),
    round(c.resp_h, 2),
    case
      when c.response_h is null then 'no_sla'
      when c.elapsed_h < 0 then 'no_sla'
      -- Ya respondimos: el veredicto es definitivo, a tiempo o tarde.
      when c.first_response_at is not null and c.resp_h <= c.response_h then 'ok'
      when c.first_response_at is not null then 'late'
      -- Todavía no: o el reloj corre, o ya se pasó.
      when c.resp_h > c.response_h then 'overdue'
      else 'pending'
    end
  from computed c
  left join lateral public.contract_coverage_for(c.client_id, c.started_at) cov on true;
$$;

comment on function public.get_tickets_sla_status() is
  'SLA de resolución y de primera respuesta, más cobertura contractual, por ticket. response_status: ok/late si ya se respondió, pending/overdue si no.';

drop function if exists public.get_sla_summary();

create function public.get_sla_summary()
returns table (
  total int, overdue int, warning int, ok int, no_sla int,
  measured_total int, measured_overdue int, measured_warning int,
  measured_ok int, measured_no_sla int,
  compliance_pct numeric,
  cutoff timestamptz,
  registered_late int,
  uncovered int,
  -- Primera respuesta, sobre el mismo subconjunto medido que la resolución:
  -- lo registrado desde el corte y con regla aplicable.
  resp_measured int,
  resp_ok int,
  resp_late int,
  resp_pending int,
  resp_overdue int,
  resp_compliance_pct numeric
)
language sql
stable
security definer
set search_path = public
as $$
  with s as (select * from public.get_tickets_sla_status()),
  m as (select * from s where in_scope and sla_status <> 'no_sla'),
  -- El universo de respuesta es propio: un caso ENTREGADA queda fuera del SLA
  -- de resolución pero su respuesta sigue siendo medible si tenía regla.
  r as (select * from s where in_scope and response_status <> 'no_sla')
  select
    (select count(*) from s)::int,
    (select count(*) from s where sla_status = 'overdue')::int,
    (select count(*) from s where sla_status = 'warning')::int,
    (select count(*) from s where sla_status = 'ok')::int,
    (select count(*) from s where sla_status = 'no_sla')::int,
    (select count(*) from m)::int,
    (select count(*) from m where sla_status = 'overdue')::int,
    (select count(*) from m where sla_status = 'warning')::int,
    (select count(*) from m where sla_status = 'ok')::int,
    (select count(*) from s where in_scope and sla_status = 'no_sla')::int,
    (select case when count(*) > 0
       then round(100.0 * (count(*) - count(*) filter (where sla_status = 'overdue')) / count(*), 0)
     end from m),
    public.sla_measurement_start(),
    (select count(*) from s where registered_late)::int,
    (select count(*) from s where coverage <> 'cubierto')::int,
    (select count(*) from r)::int,
    (select count(*) from r where response_status = 'ok')::int,
    (select count(*) from r where response_status = 'late')::int,
    (select count(*) from r where response_status = 'pending')::int,
    (select count(*) from r where response_status = 'overdue')::int,
    -- Cumple el que respondió a tiempo. El que todavía no respondió y aún está
    -- en plazo NO cuenta como incumplido — pero tampoco como cumplido: sale
    -- del denominador hasta que se resuelva.
    (select case when count(*) filter (where response_status <> 'pending') > 0
       then round(100.0 * count(*) filter (where response_status = 'ok')
                  / count(*) filter (where response_status <> 'pending'), 0)
     end from r);
$$;

comment on function public.get_sla_summary() is
  'Resumen de SLA (resolución y primera respuesta) y cobertura. measured_* y compliance_pct sólo sobre lo registrado desde cutoff.';

revoke execute on function public.get_tickets_sla_status() from public, anon;
revoke execute on function public.get_sla_summary() from public, anon;
revoke execute on function public.stamp_first_response() from public, anon;
grant execute on function public.get_tickets_sla_status() to authenticated;
grant execute on function public.get_sla_summary() to authenticated;

-- ── Verificación posterior ──────────────────────────────────────────────────
--   select response_status, count(*) from public.get_tickets_sla_status()
--   group by 1 order by 2 desc;
--
-- Hoy debe dar 'pending' u 'overdue' para todo: no hay ninguna nota externa
-- registrada, así que nadie respondió todavía según el sistema.
