-- ============================================================================
-- Una sola fuente de verdad para el SLA.
--
-- Hasta ahora convivían DOS sistemas que respondían distinto a la misma
-- pregunta, y las dos respuestas se mostraban en la misma pantalla:
--
--   A) get_tickets_sla_status() leía business_rules v4.5, en DÍAS, por
--      prioridad + tipo de caso.  → sidebar, chip del header, bandeja
--   B) useSlaCompliance leía client_slas, en HORAS, sólo por prioridad.
--      → fila de KPIs, ficha del cliente, panel de SLA
--
-- Para "Alta / Requerimiento" A daba 5 días (120 h) y B daba 24 h: B era 5x
-- más estricto. De ahí que el sidebar dijera 318 vencidos y los KPIs 383.
--
-- Esta migración deja UNA implementación, acá, y le agrega las horas para que
-- el cliente pueda consumirla sin recalcular nada.
--
-- REGLA DE PRECEDENCIA (decisión explícita): manda el SLA contractual del
-- cliente (client_slas) cuando existe para esa prioridad; si no, se aplica la
-- política interna v4.5. Un contrato firmado con un cliente supersede al
-- default interno. La columna sla_source dice cuál se aplicó, para que el
-- número sea auditable.
--
-- Corrige además el match de la política: el COALESCE anterior buscaba SÓLO
-- por prioridad con LIMIT 1 y sin ORDER BY, así que se quedaba con la primera
-- fila del arreglo — siempre 'correccion', el deadline más corto. 229 de 318
-- casos abiertos (72%) recibían un deadline equivocado, siempre más estricto.
-- ============================================================================

-- Normaliza para comparar: minúsculas y sin acentos. Los tickets guardan
-- "Critica, Impacto Negocio" y client_slas guarda "Crítica"; sin esto sólo uno
-- de los dos matchea.
create or replace function public.sla_norm(txt text)
returns text
language sql
immutable
as $$
  select translate(lower(coalesce(txt, '')), 'áéíóúüñ', 'aeiouun');
$$;

comment on function public.sla_norm(text) is
  'Minúsculas sin acentos, para comparar prioridades y tipos entre tablas que los escriben distinto.';

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
  sla_status text
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
    -- Mismo filtro que la versión anterior: los cerrados y anulados no entran
    -- en el universo. Sin esto el total del chip del header pasaría de 383 a
    -- 840 y nadie entendería por qué.
    where t.estado not in ('CERRADA', 'ANULADA')
  ),
  resolved as (
    select
      b.*,
      -- (1) SLA contractual del cliente: gana si existe. Se prefiere la regla
      -- de case_type 'all' sobre una específica, igual que hacía el cliente.
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
    end
  from computed c;
$$;

comment on function public.get_tickets_sla_status() is
  'Estado de SLA por ticket. Fuente única: SLA contractual del cliente si existe, si no la política v4.5. sla_source indica cuál se aplicó.';

-- get_sla_summary() ya agrega sobre esta función, así que hereda el arreglo
-- sin tocarla. Se re-crea sólo para que su firma siga alineada.
create or replace function public.get_sla_summary()
returns table (
  total int,
  overdue int,
  warning int,
  ok int,
  no_sla int
)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::int,
    count(*) filter (where sla_status = 'overdue')::int,
    count(*) filter (where sla_status = 'warning')::int,
    count(*) filter (where sla_status = 'ok')::int,
    count(*) filter (where sla_status = 'no_sla')::int
  from public.get_tickets_sla_status();
$$;

revoke execute on function public.get_tickets_sla_status() from public, anon;
revoke execute on function public.get_sla_summary() from public, anon;
revoke execute on function public.sla_norm(text) from public, anon;
grant execute on function public.get_tickets_sla_status() to authenticated;
grant execute on function public.get_sla_summary() to authenticated;
grant execute on function public.sla_norm(text) to authenticated;

-- ── Verificación posterior ──────────────────────────────────────────────────
-- Correr después de aplicar. Debe dar UNA sola fila por estado y la suma de
-- overdue+warning+ok+no_sla tiene que igualar el total de get_sla_summary().
--
--   select sla_status, sla_source, count(*)
--   from public.get_tickets_sla_status()
--   group by 1, 2 order by 1, 2;
--
--   select * from public.get_sla_summary();
--
-- Y el contraste que motivó todo esto: estos dos números tienen que coincidir.
--
--   select count(*) from public.get_tickets_sla_status() where sla_status='overdue';
