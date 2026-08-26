-- ============================================================================
-- ¿Este caso está dentro del contrato?
--
-- Hasta ahora contratos y casos vivían separados: el contrato guardaba fechas y
-- horas, los casos guardaban trabajo, y nadie cruzaba lo uno con lo otro. Se
-- podía dar de alta un caso de un cliente cuyo contrato venció hace meses sin
-- que nada lo dijera, ni del lado nuestro ni del lado del cliente.
--
-- LA DECISIÓN QUE DEFINE TODO ACÁ: la cobertura se juzga contra la fecha DEL
-- CASO, no contra hoy. Un caso registrado en marzo, bajo un contrato que corrió
-- de enero a junio, ESTABA cubierto — y lo sigue estando, aunque ese contrato
-- hoy figure vencido. Al revés sería reescribir la historia: un contrato que
-- vence hoy no deja fuera de cobertura, retroactivamente, el trabajo que amparó
-- durante seis meses.
--
-- Por eso la función mira contratos 'vigente', 'vencido' y 'renovado'. Excluye
-- 'borrador' (todavía no rige) y 'cancelado' (se anuló; sin fecha de efecto en
-- el modelo, lo prudente es no dar por cubierto lo que alguien canceló).
-- ============================================================================

create or replace function public.contract_coverage_for(
  _client_id text,
  _at        timestamptz
)
returns table (
  coverage      text,   -- 'cubierto' | 'fuera_de_vigencia' | 'sin_contrato'
  contract_id   uuid,
  contract_type text,
  start_date    date,
  end_date      date
)
language sql
stable
security definer
set search_path = public
as $$
  with visibles as (
    select c.*
    from client_contracts c
    where c.client_id = _client_id
      and c.deleted_at is null
      and c.status in ('vigente', 'vencido', 'renovado')
      -- Un usuario cliente sólo puede preguntar por su propia empresa. Mismo
      -- criterio que la policy de RLS de support_tickets.
      and (
        not public.is_cliente_user()
        or _client_id = public.get_cliente_client_id(auth.uid())
      )
  ),
  cubre as (
    select v.*
    from visibles v
    where (v.start_date is null or _at::date >= v.start_date)
      and (v.end_date   is null or _at::date <= v.end_date)
    -- Con dos contratos solapados gana el que empezó después: es el vigente
    -- para esa fecha. nulls last porque un contrato sin inicio es el más
    -- viejo, no el más nuevo.
    order by v.start_date desc nulls last, v.created_at desc
    limit 1
  ),
  cercano as (
    -- Sin cobertura: se devuelve el contrato más pertinente para que la
    -- pantalla pueda decir "venció el X" en vez de sólo "no cubierto".
    select v.* from visibles v
    order by abs(extract(epoch from (_at - coalesce(v.end_date, v.start_date, current_date)::timestamptz)))
    limit 1
  )
  select 'cubierto', c.id, c.contract_type, c.start_date, c.end_date from cubre c
  union all
  select
    case when exists (select 1 from visibles) then 'fuera_de_vigencia' else 'sin_contrato' end,
    n.id, n.contract_type, n.start_date, n.end_date
  from (select * from cercano) n
  where not exists (select 1 from cubre)
  union all
  -- El cliente no tiene ningún contrato visible: igual hay que devolver fila,
  -- si no el LATERAL de abajo deja la columna en null y "sin contrato" se
  -- confundiría con "no se pudo calcular".
  select 'sin_contrato', null::uuid, null::text, null::date, null::date
  where not exists (select 1 from visibles);
$$;

comment on function public.contract_coverage_for(text, timestamptz) is
  'Si la fecha dada cae dentro de la vigencia de algún contrato del cliente. Se juzga contra la fecha del caso, no contra hoy: un contrato ya vencido sigue cubriendo lo que amparó mientras rigió.';

revoke execute on function public.contract_coverage_for(text, timestamptz) from public, anon;
grant execute on function public.contract_coverage_for(text, timestamptz) to authenticated;


-- ── La misma regla, aplicada a cada caso abierto ────────────────────────────
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
  contract_id uuid
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
      t.id,
      t.ticket_id  as code,
      t.client_id,
      t.estado,
      t.prioridad,
      t.tipo,
      t.created_at as loaded_at,
      coalesce(t.fecha_registro, t.created_at) as started_at,
      -- El elapsed sale SIEMPRE de la fecha, nunca de dias_antiguedad: esa
      -- columna guarda la edad al momento de la importación y no se recalcula.
      -- Cast explícito: extract(epoch ...) devuelve double en PostgreSQL <14
      -- y numeric desde la 14; round(x, 2) sólo existe para numeric.
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
      (
        select cs.resolution_time_hours
        from client_slas cs
        where cs.client_id = b.client_id
          and cs.is_active = true
          and cs.resolution_time_hours is not null
          and cs.resolution_time_hours > 0
          and coalesce(cs.priority_level, '') <> ''
          and public.sla_norm(b.prioridad) like '%' || public.sla_norm(cs.priority_level) || '%'
        order by case when coalesce(cs.case_type, 'all') = 'all' then 0 else 1 end
        limit 1
      ) as contract_h,
      coalesce(
        (
          select (d->>'deadline_days')::int
          from policy p, jsonb_array_elements(p.deadlines) d
          where coalesce(d->>'priority', '') <> ''
            and coalesce(d->>'case_type', '') <> ''
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
      end as source
    from resolved r
  )
  select
    c.id,
    c.code,
    c.client_id,
    c.estado,
    c.prioridad,
    c.started_at,
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
    -- formulario de alta y el portal del cliente. Si la regla cambia, cambia
    -- para los tres a la vez.
    cov.coverage,
    cov.contract_id
  from computed c
  left join lateral public.contract_coverage_for(c.client_id, c.started_at) cov on true;
$$;

comment on function public.get_tickets_sla_status() is
  'Estado de SLA y cobertura contractual por ticket. Un usuario con rol cliente sólo ve su empresa. coverage se juzga contra la fecha del caso, no contra hoy.';

drop function if exists public.get_sla_summary();

create function public.get_sla_summary()
returns table (
  total int, overdue int, warning int, ok int, no_sla int,
  measured_total int, measured_overdue int, measured_warning int,
  measured_ok int, measured_no_sla int,
  compliance_pct numeric,
  cutoff timestamptz,
  registered_late int,
  -- Casos abiertos cuya fecha cae fuera de toda vigencia, o de un cliente sin
  -- contrato. Es trabajo que se está haciendo sin respaldo contractual.
  uncovered int
)
language sql
stable
security definer
set search_path = public
as $$
  with s as (select * from public.get_tickets_sla_status()),
  m as (select * from s where in_scope and sla_status <> 'no_sla')
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
    (select count(*) from s where coverage <> 'cubierto')::int;
$$;

comment on function public.get_sla_summary() is
  'Resumen de SLA y cobertura. total/overdue/... es el inventario completo; measured_* y compliance_pct sólo lo registrado desde cutoff; uncovered son los casos abiertos sin respaldo contractual.';

revoke execute on function public.get_tickets_sla_status() from public, anon;
revoke execute on function public.get_sla_summary() from public, anon;
grant execute on function public.get_tickets_sla_status() to authenticated;
grant execute on function public.get_sla_summary() to authenticated;

-- ── Verificación posterior ──────────────────────────────────────────────────
--   select coverage, count(*) from public.get_tickets_sla_status()
--   group by 1 order by 2 desc;
--
--   select * from public.contract_coverage_for('arkfin', now());
