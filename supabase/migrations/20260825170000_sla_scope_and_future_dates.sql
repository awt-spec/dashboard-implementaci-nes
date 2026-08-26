-- ============================================================================
-- Tres correcciones sobre get_tickets_sla_status(), salidas de un QA sobre los
-- cambios del corte. Van juntas porque las tres tocan el mismo cuerpo de
-- función y separarlas obligaría a reescribirlo tres veces.
--
-- 1. FUGA ENTRE CLIENTES (severidad alta). La función es SECURITY DEFINER —
--    salta RLS por diseño, para poder agregar sobre datos que el rol no lee
--    directo— y está otorgada a `authenticated`, que incluye a los usuarios
--    con rol cliente. Verificado con una sesión real de cliente.apex:
--
--      GET  /support_tickets            ->   0 filas   (RLS hace su trabajo)
--      POST /rpc/get_tickets_sla_status -> 295 filas, 24 clientes distintos
--
--    Exponía id, código, client_id, estado, prioridad, fecha y límites de SLA
--    de todos los clientes a cualquiera de ellos. No lo introdujo el corte:
--    viene de 20260428180000 y sobrevivió a 20260824120000.
--
--    El arreglo aplica el MISMO criterio que la policy de RLS de la tabla
--    ("Cliente selects own client tickets"), para que la RPC y la tabla no
--    puedan volver a discrepar.
--
-- 2. FECHA EN EL FUTURO (severidad alta). Un ticket con fecha_registro
--    posterior a hoy daba elapsed_h negativo, que nunca supera el límite ni
--    el umbral del 80%, así que caía en 'ok' y contaba como CUMPLIDO:
--
--      fecha_registro 2027-06-01 -> elapsed_hours -6713.51 -> sla_status 'ok'
--                                -> compliance_pct 100 con un solo caso
--
--    Con el corte recién puesto el denominador es chico, así que un "2027" en
--    vez de "2026" bastaba para poner el cumplimiento en 100%. Un caso que
--    todavía no empezó no es cumplido ni incumplido: no es medible.
--
-- 3. RETRODATADOS INVISIBLES (severidad media). Un caso cargado después del
--    corte pero con fecha anterior sale de la medición sin dejar rastro. A
--    veces es legítimo — el caso llegó antes y se registró tarde — así que no
--    se bloquea; se cuenta, para que la salida sea visible en vez de silenciosa.
-- ============================================================================

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
  registered_late boolean
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
      -- columna guarda la edad al momento de la importación y no se recalcula
      -- (desfase mediano de 116 días sobre los casos abiertos).
      -- Cast explícito: extract(epoch ...) devuelve double en PostgreSQL <14
      -- y numeric desde la 14; round(x, 2) sólo existe para numeric.
      (extract(epoch from (now() - coalesce(t.fecha_registro, t.created_at))) / 3600.0)::numeric as elapsed_h
    from support_tickets t
    -- Los cerrados y anulados no entran en el universo.
    where t.estado not in ('CERRADA', 'ANULADA')
      -- Un usuario cliente ve SÓLO su empresa. Misma condición que la policy
      -- "Cliente selects own client tickets" de support_tickets: si algún día
      -- cambia el criterio de asignación, cambia para los dos a la vez.
      -- El staff no matchea is_cliente_user() y sigue viendo todo.
      and (
        not public.is_cliente_user()
        or t.client_id = public.get_cliente_client_id(auth.uid())
      )
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
      -- Antes de las demás ramas: un caso fechado en el futuro tiene elapsed
      -- negativo y se colaba como 'ok'. No es cumplido ni incumplido — no
      -- empezó. Como no_sla queda fuera del cociente sin ensuciar el conteo.
      when c.elapsed_h < 0 then 'no_sla'
      when c.limit_h is null then 'no_sla'
      when c.elapsed_h > c.limit_h then 'overdue'
      when c.elapsed_h >= c.limit_h * 0.8 then 'warning'
      else 'ok'
    end,
    -- Entra a la medición sólo lo registrado desde el corte. El estado de
    -- arriba NO depende de esto: un caso viejo sigue vencido, sólo que su
    -- incumplimiento no se le cobra al equipo de hoy.
    c.started_at >= public.sla_measurement_start(),
    -- Cargado después del corte pero fechado antes: sale de la medición de
    -- forma legítima, pero conviene poder contarlo.
    c.loaded_at >= public.sla_measurement_start()
      and c.started_at < public.sla_measurement_start()
  from computed c;
$$;

comment on function public.get_tickets_sla_status() is
  'Estado de SLA por ticket. Fuente única: SLA contractual del cliente si existe, si no la política v4.5. Un usuario con rol cliente sólo ve su empresa. in_scope = entra al cumplimiento; registered_late = cargado tras el corte con fecha anterior.';

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
  cutoff timestamptz,
  -- Cuántos casos se cargaron después del corte con fecha anterior. No es un
  -- error por sí solo; es la salida por la que un caso deja de medirse sin
  -- que nadie lo note.
  registered_late int
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
    (select count(*) from s where registered_late)::int;
$$;

comment on function public.get_sla_summary() is
  'Resumen de SLA. total/overdue/warning/ok/no_sla son el inventario completo de casos abiertos; measured_* y compliance_pct sólo lo registrado desde cutoff. Hereda el filtro por cliente de get_tickets_sla_status().';

revoke execute on function public.get_tickets_sla_status() from public, anon;
revoke execute on function public.get_sla_summary() from public, anon;
grant execute on function public.get_tickets_sla_status() to authenticated;
grant execute on function public.get_sla_summary() to authenticated;

-- ── Verificación posterior ──────────────────────────────────────────────────
-- Con una sesión de staff:
--   select * from public.get_sla_summary();
--     -> total 295, overdue 293, measured_total 0, compliance_pct null
--
-- Con una sesión de rol cliente, la MISMA llamada tiene que devolver sólo su
-- empresa. Éste es el caso que fallaba:
--   select count(*), count(distinct client_id) from public.get_tickets_sla_status();
--     -> antes: 295 filas / 24 clientes.  ahora: sólo los suyos.
