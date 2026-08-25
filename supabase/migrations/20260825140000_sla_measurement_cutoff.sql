-- ============================================================================
-- Fecha de corte para la MEDICIÓN del SLA.
--
-- El problema: quedan 293 casos abiertos y vencidos, todos anteriores a mayo
-- 2026, que ninguna gestión de hoy puede recuperar — un caso registrado en
-- marzo ya rompió su plazo y no hay forma de que deje de haberlo roto. Con
-- ellos en el denominador el cumplimiento es 0% y se queda ahí: cien casos
-- nuevos atendidos perfectamente lo suben a 25%.
--
-- Pedirle al equipo que empiece a registrar en la app mientras la pantalla
-- dice 0% haga lo que haga es pedirle que trabaje para un número que no se
-- mueve. Así no se adopta una herramienta.
--
-- La decisión: se MIDE desde el 1 de septiembre de 2026. Lo anterior sigue
-- existiendo, sigue apareciendo como vencido en la bandeja y en el sidebar, y
-- sigue habiendo que triarlo — simplemente no entra al porcentaje.
--
-- Lo que esto NO hace: no cambia el sla_status de ningún caso. Un caso de
-- marzo sigue diciendo 'overdue', porque lo está. La única diferencia es la
-- columna in_scope, que decide si cuenta para el cociente.
-- ============================================================================

-- Un solo lugar donde vive la fecha. Con offset explícito -06 porque el equipo
-- opera en Costa Rica: sin el offset el literal se interpreta en la zona del
-- servidor (UTC) y un caso registrado a las 19:00 del 31 de agosto hora local
-- entraría a la medición por ser 01:00 del 1 de septiembre en UTC.
create or replace function public.sla_measurement_start()
returns timestamptz
language sql
immutable
as $$
  select '2026-09-01 00:00:00-06'::timestamptz;
$$;

comment on function public.sla_measurement_start() is
  'Desde cuándo se mide el cumplimiento de SLA. Los casos anteriores se muestran pero no entran al porcentaje. Cambiar acá y en ningún otro lado.';

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
  in_scope boolean
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
      coalesce(t.fecha_registro, t.created_at) as started_at,
      -- El elapsed sale SIEMPRE de la fecha, nunca de dias_antiguedad: esa
      -- columna guarda la edad al momento de la importación y no se recalcula
      -- (desfase mediano de 116 días sobre los casos abiertos).
      -- Cast explícito: extract(epoch ...) devuelve double en PostgreSQL <14
      -- y numeric desde la 14; round(x, 2) sólo existe para numeric.
      (extract(epoch from (now() - coalesce(t.fecha_registro, t.created_at))) / 3600.0)::numeric as elapsed_h
    from support_tickets t
    -- Los cerrados y anulados no entran en el universo.
    where t.estado not in ('CERRADA', 'ANULADA')
  ),
  resolved as (
    select
      b.*,
      -- (1) SLA contractual del cliente: gana si existe. Se prefiere la regla
      -- de case_type 'all' sobre una específica.
      (
        select cs.resolution_time_hours
        from client_slas cs
        where cs.client_id = b.client_id
          and cs.is_active = true
          and cs.resolution_time_hours is not null
          and cs.resolution_time_hours > 0
          -- Sin este guard, un priority_level vacío haría LIKE '%%' y
          -- matchearía con cualquier prioridad.
          and coalesce(cs.priority_level, '') <> ''
          and public.sla_norm(b.prioridad) like '%' || public.sla_norm(cs.priority_level) || '%'
        order by case when coalesce(cs.case_type, 'all') = 'all' then 0 else 1 end
        limit 1
      ) as contract_h,
      -- (2) Política v4.5, en días. Primero prioridad Y tipo; recién si eso no
      -- matchea, prioridad sola con 'correccion' como default declarado.
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
    -- Compatibilidad: los consumidores viejos siguen leyendo días.
    case when c.limit_h is not null then ceil(c.limit_h / 24.0)::int end,
    greatest(0, floor(c.elapsed_h / 24.0)::int),
    round(c.limit_h, 2),
    round(c.elapsed_h, 2),
    c.source,
    case
      when upper(c.estado) in ('CERRADA', 'ANULADA', 'ENTREGADA', 'APROBADA') then 'no_sla'
      when c.limit_h is null then 'no_sla'
      when c.elapsed_h > c.limit_h then 'overdue'
      when c.elapsed_h >= c.limit_h * 0.8 then 'warning'
      else 'ok'
    end,
    -- Entra a la medición sólo lo registrado desde el corte. El estado de
    -- arriba NO depende de esto: un caso viejo sigue vencido, sólo que su
    -- incumplimiento no se le cobra al equipo de hoy.
    c.started_at >= public.sla_measurement_start()
  from computed c;
$$;

comment on function public.get_tickets_sla_status() is
  'Estado de SLA por ticket. Fuente única: SLA contractual del cliente si existe, si no la política v4.5. sla_source indica cuál se aplicó. in_scope indica si el caso entra al cumplimiento (registrado desde sla_measurement_start()).';

drop function if exists public.get_sla_summary();

create function public.get_sla_summary()
returns table (
  -- Inventario completo de lo abierto. Es lo que alimenta el chip del header
  -- y el sidebar, y no cambia: si hay 293 casos rotos, hay que verlos.
  total int,
  overdue int,
  warning int,
  ok int,
  no_sla int,
  -- Subconjunto medible: registrado desde el corte y con SLA aplicable.
  measured_total int,
  measured_overdue int,
  measured_warning int,
  measured_ok int,
  measured_no_sla int,
  -- El porcentaje que se muestra. null cuando todavía no hay nada que medir,
  -- que es distinto de 0% — un 0% dice "lo hicieron mal", un guión dice
  -- "todavía no hay con qué juzgarlos".
  compliance_pct numeric,
  cutoff timestamptz
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
    public.sla_measurement_start();
$$;

comment on function public.get_sla_summary() is
  'Resumen de SLA. total/overdue/warning/ok/no_sla son el inventario completo de casos abiertos; measured_* y compliance_pct sólo lo registrado desde cutoff.';

revoke execute on function public.get_tickets_sla_status() from public, anon;
revoke execute on function public.get_sla_summary() from public, anon;
revoke execute on function public.sla_measurement_start() from public, anon;
grant execute on function public.get_tickets_sla_status() to authenticated;
grant execute on function public.get_sla_summary() to authenticated;
grant execute on function public.sla_measurement_start() to authenticated;

-- ── Verificación posterior ──────────────────────────────────────────────────
--   select * from public.get_sla_summary();
--
-- Antes del 1 de septiembre debe dar measured_total = 0 y compliance_pct null,
-- con total/overdue intactos. Después, measured_total crece con cada caso
-- nuevo y el porcentaje empieza a moverse.
--
--   select in_scope, sla_status, count(*)
--   from public.get_tickets_sla_status() group by 1, 2 order by 1, 2;
