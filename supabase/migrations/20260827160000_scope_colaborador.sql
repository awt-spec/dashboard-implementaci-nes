-- ============================================================================
-- Acotar el rol colaborador.
--
-- La auditoría de 20260702130000 acotó al gerente envolviendo las policies con
-- user_can_see_client(), y dejó al colaborador fuera a propósito — el comentario
-- de la función lo dice: "devuelve true para admin/pm/ceo/gerente_soporte/
-- colaborador (sin cambio)". El resultado, medido con una sesión real de
-- lalfaro-contratista:
--
--                    colaborador   admin
--   tasks                   2108    2108
--   support_tickets          840     840
--   clients                   29      29
--   client_contracts          30      30     <- monthly_value y hourly_rate
--   quotes                    52      52
--   billed_packages           81      81
--
-- Ve la tarifa horaria de cada cliente —de 23 a 116 USD— o sea la estructura de
-- precios diferenciada, para un rol que se usa con contratistas externos. Y
-- puede cerrar cualquiera de los 840 casos, dar de alta casos a nombre de
-- cualquier cliente, y escribir notas externas que el cliente ve (que además
-- ahora sellan nuestra primera respuesta).
--
-- Su trabajo real son 56 tareas.
--
-- POR QUÉ POLICIES RESTRICTIVAS: se combinan con AND sobre lo que ya existe, en
-- vez de reemplazarlo. No hace falta conocer el nombre de cada policy vigente
-- —hay capas de varias migraciones— ni se arriesga a romperle la lectura a
-- admin o PM. Cada una dice "salvo que seas colaborador", y para todos los
-- demás roles es transparente.
-- ============================================================================

create or replace function public.is_colaborador_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'colaborador'
  );
$$;

comment on function public.is_colaborador_user() is
  'El usuario actual tiene rol colaborador. Espejo de is_cliente_user().';


-- ── 1 · Los clientes del colaborador ────────────────────────────────────────
-- Se derivan de sus tareas asignadas, que es el único vínculo real que existe
-- hoy: no hay tabla de asignación colaborador→cliente como la del gerente.
-- Cuando exista, esta función es el único lugar a cambiar.
create or replace function public.colaborador_client_ids(_user_id uuid default auth.uid())
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select distinct t.client_id
  from public.tasks t
  where t.client_id is not null
    and (
      t.assigned_user_id = _user_id
      or t.assignees @> to_jsonb(array[_user_id::text])
    );
$$;

comment on function public.colaborador_client_ids(uuid) is
  'Clientes donde el colaborador tiene tareas asignadas. Es el alcance de todo lo que puede ver.';

-- user_can_see_client() deja de dar vía libre al colaborador. Como todas las
-- policies scoped ya la consultan, acotarla acá las acota a todas de una vez.
create or replace function public.user_can_see_client(_client_id text, _user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- Staff sin restricción. El colaborador SALE de esta lista.
    exists (
      select 1 from public.user_roles
      where user_id = _user_id
        and role in ('admin','pm','ceo','gerente_soporte')
    )
    -- Gerente sólo si está asignado a este cliente
    or exists (
      select 1 from public.gerente_client_assignments
      where user_id = _user_id and client_id = _client_id
    )
    -- Cliente sólo si está asignado a esta empresa
    or exists (
      select 1 from public.cliente_company_assignments
      where user_id = _user_id and client_id = _client_id
    )
    -- Colaborador sólo donde tiene trabajo asignado
    or (
      exists (select 1 from public.user_roles
              where user_id = _user_id and role = 'colaborador')
      and _client_id in (select public.colaborador_client_ids(_user_id))
    );
$$;

comment on function public.user_can_see_client(text, uuid) is
  'Visibilidad por cliente. Sin restricción para admin/pm/ceo/gerente_soporte; gerente y cliente por asignación; colaborador por sus tareas.';


-- ── 2 · Las tablas comerciales quedan cerradas ──────────────────────────────
-- No es un recorte por cliente sino una negación completa: el tablero del
-- colaborador —pantalla completa, sin sidebar— sólo consulta clients, tasks,
-- support_tickets, support_sprints, meeting_minutes, work_time_entries y
-- user_sessions. Ninguna de éstas. Cerrarlas no le quita nada que use.
do $$
declare t text;
begin
  foreach t in array array[
    'client_contracts', 'client_slas', 'quotes', 'quote_items',
    'billed_packages', 'service_packages', 'client_financials',
    'pm_ai_analysis', 'contract_documents', 'contract_document_chunks'
  ] loop
    if to_regclass('public.' || t) is not null then
      execute format('drop policy if exists %I on public.%I',
                     'colaborador sin acceso comercial', t);
      execute format(
        'create policy %I on public.%I as restrictive for all to authenticated '
        'using (not public.is_colaborador_user()) '
        'with check (not public.is_colaborador_user())',
        'colaborador sin acceso comercial', t);
    end if;
  end loop;
end $$;


-- ── 3 · Lectura y escritura, sólo dentro de sus clientes ────────────────────
-- Cubre también el SELECT: algunas policies viejas ("Allow all select …") no
-- pasan por user_can_see_client(), así que el punto 1 solo no alcanzaría.
do $$
declare t text;
begin
  foreach t in array array[
    'support_tickets', 'tasks', 'support_ticket_notes',
    'meeting_minutes', 'risks', 'deliverables', 'phases', 'action_items'
  ] loop
    if to_regclass('public.' || t) is null then continue; end if;
    execute format('drop policy if exists %I on public.%I',
                   'colaborador solo sus clientes', t);
    if t = 'support_ticket_notes' then
      -- Las notas no tienen client_id: se resuelve por su ticket.
      -- La columna de la nota va CALIFICADA. Sin el prefijo, `ticket_id` se
      -- liga a support_tickets.ticket_id —que es el código en texto, no el
      -- uuid— y la policy no compila: "operator does not exist: uuid = text".
      execute format(
        'create policy %I on public.%I as restrictive for all to authenticated '
        'using (not public.is_colaborador_user() or exists ('
        '  select 1 from public.support_tickets st '
        '  where st.id = support_ticket_notes.ticket_id '
        '    and public.user_can_see_client(st.client_id))) '
        'with check (not public.is_colaborador_user() or exists ('
        '  select 1 from public.support_tickets st '
        '  where st.id = support_ticket_notes.ticket_id '
        '    and public.user_can_see_client(st.client_id)))',
        'colaborador solo sus clientes', t);
    else
      execute format(
        'create policy %I on public.%I as restrictive for all to authenticated '
        'using (not public.is_colaborador_user() or public.user_can_see_client(client_id)) '
        'with check (not public.is_colaborador_user() or public.user_can_see_client(client_id))',
        'colaborador solo sus clientes', t);
    end if;
  end loop;
end $$;

-- clients se filtra por su propio id, no por una columna client_id.
drop policy if exists "colaborador solo sus clientes" on public.clients;
create policy "colaborador solo sus clientes" on public.clients
  as restrictive for all to authenticated
  using (not public.is_colaborador_user() or public.user_can_see_client(id))
  with check (not public.is_colaborador_user() or public.user_can_see_client(id));


-- ── 4 · La RPC de SLA, que salta RLS por ser SECURITY DEFINER ───────────────
-- Las policies de arriba no la alcanzan. Devolvía 295 casos de 24 clientes a un
-- colaborador. Se le aplica el mismo filtro que al rol cliente.
drop function if exists public.get_tickets_sla_status();

create function public.get_tickets_sla_status()
returns table (
  ticket_id uuid, ticket_code text, client_id text, estado text, prioridad text,
  fecha_registro timestamptz, deadline_days int, days_elapsed int,
  limit_hours numeric, elapsed_hours numeric, sla_source text, sla_status text,
  in_scope boolean, registered_late boolean, coverage text, contract_id uuid,
  first_response_at timestamptz, response_limit_hours numeric,
  response_hours numeric, response_status text
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
      t.created_at as loaded_at, t.first_response_at,
      coalesce(t.fecha_registro, t.created_at) as started_at,
      (extract(epoch from (now() - coalesce(t.fecha_registro, t.created_at))) / 3600.0)::numeric as elapsed_h
    from support_tickets t
    where t.estado not in ('CERRADA', 'ANULADA')
      -- Cliente: sólo su empresa. Colaborador: sólo donde tiene trabajo.
      -- Los dos salen de user_can_see_client(), que es la misma regla que
      -- aplican las policies de la tabla; así la RPC y la tabla no discrepan.
      and (
        (not public.is_cliente_user() and not public.is_colaborador_user())
        or public.user_can_see_client(t.client_id)
      )
  ),
  resolved as (
    select
      b.*,
      (
        select cs.resolution_time_hours from client_slas cs
        where cs.client_id = b.client_id and cs.is_active = true
          and cs.resolution_time_hours is not null and cs.resolution_time_hours > 0
          and coalesce(cs.priority_level, '') <> ''
          and public.sla_norm(b.prioridad) like '%' || public.sla_norm(cs.priority_level) || '%'
        order by case when coalesce(cs.case_type, 'all') = 'all' then 0 else 1 end
        limit 1
      ) as contract_h,
      (
        select cs.response_time_hours from client_slas cs
        where cs.client_id = b.client_id and cs.is_active = true
          and cs.response_time_hours is not null and cs.response_time_hours > 0
          and coalesce(cs.priority_level, '') <> ''
          and public.sla_norm(b.prioridad) like '%' || public.sla_norm(cs.priority_level) || '%'
        order by case when coalesce(cs.case_type, 'all') = 'all' then 0 else 1 end
        limit 1
      ) as response_h,
      coalesce(
        (select (d->>'deadline_days')::int
         from policy p, jsonb_array_elements(p.deadlines) d
         where coalesce(d->>'priority', '') <> '' and coalesce(d->>'case_type', '') <> ''
           and public.sla_norm(b.prioridad) like '%' || public.sla_norm(d->>'priority') || '%'
           and public.sla_norm(b.tipo)      like '%' || public.sla_norm(d->>'case_type') || '%'
         limit 1),
        (select (d->>'deadline_days')::int
         from policy p, jsonb_array_elements(p.deadlines) d
         where coalesce(d->>'priority', '') <> ''
           and public.sla_norm(d->>'case_type') = 'correccion'
           and public.sla_norm(b.prioridad) like '%' || public.sla_norm(d->>'priority') || '%'
         limit 1)
      ) as policy_days
    from base b
  ),
  computed as (
    select
      r.*,
      case when r.contract_h is not null then r.contract_h
           when r.policy_days is not null then r.policy_days * 24.0 end::numeric as limit_h,
      case when r.contract_h is not null then 'contrato'
           when r.policy_days is not null then 'politica'
           else 'sin_regla' end as source,
      case
        when r.first_response_at is not null
          then (extract(epoch from (r.first_response_at - r.started_at)) / 3600.0)::numeric
        else r.elapsed_h
      end as resp_h,
      upper(r.estado) in ('CERRADA', 'ANULADA', 'ENTREGADA', 'APROBADA') as terminal
    from resolved r
  )
  select
    c.id, c.code, c.client_id, c.estado, c.prioridad, c.started_at,
    case when c.limit_h is not null then ceil(c.limit_h / 24.0)::int end,
    greatest(0, floor(c.elapsed_h / 24.0)::int),
    round(c.limit_h, 2), round(c.elapsed_h, 2), c.source,
    case
      when c.terminal then 'no_sla'
      when c.elapsed_h < 0 then 'no_sla'
      when c.limit_h is null then 'no_sla'
      when c.elapsed_h > c.limit_h then 'overdue'
      when c.elapsed_h >= c.limit_h * 0.8 then 'warning'
      else 'ok'
    end,
    c.started_at >= public.sla_measurement_start(),
    c.loaded_at >= public.sla_measurement_start()
      and c.started_at < public.sla_measurement_start(),
    cov.coverage, cov.contract_id,
    c.first_response_at,
    round(c.response_h, 2),
    round(c.resp_h, 2),
    case
      when c.response_h is null then 'no_sla'
      when c.terminal then 'no_sla'
      when c.elapsed_h < 0 then 'no_sla'
      when c.resp_h < 0 then 'no_sla'
      when c.first_response_at is not null and c.resp_h <= c.response_h then 'ok'
      when c.first_response_at is not null then 'late'
      when c.resp_h > c.response_h then 'overdue'
      else 'pending'
    end
  from computed c
  left join lateral public.contract_coverage_for(c.client_id, c.started_at) cov on true;
$$;

comment on function public.get_tickets_sla_status() is
  'SLA de resolución y primera respuesta más cobertura contractual. Cliente y colaborador ven sólo su alcance, por la misma regla que las policies de la tabla.';

-- contract_coverage_for() también salta RLS: se le aplica el mismo criterio.
create or replace function public.contract_coverage_for(_client_id text, _at timestamptz)
returns table (
  coverage text, contract_id uuid, contract_type text,
  start_date date, end_date date
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
      and (
        (not public.is_cliente_user() and not public.is_colaborador_user())
        or public.user_can_see_client(_client_id)
      )
  ),
  cubre as (
    select v.* from visibles v
    where (v.start_date is null or _at::date >= v.start_date)
      and (v.end_date   is null or _at::date <= v.end_date)
    order by v.start_date desc nulls last, v.created_at desc
    limit 1
  ),
  cercano as (
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
  select 'sin_contrato', null::uuid, null::text, null::date, null::date
  where not exists (select 1 from visibles);
$$;

revoke execute on function public.get_tickets_sla_status() from public, anon;
revoke execute on function public.is_colaborador_user() from public, anon;
revoke execute on function public.colaborador_client_ids(uuid) from public, anon;
grant execute on function public.get_tickets_sla_status() to authenticated;
grant execute on function public.is_colaborador_user() to authenticated;
grant execute on function public.colaborador_client_ids(uuid) to authenticated;

-- ── Verificación posterior ──────────────────────────────────────────────────
-- Con sesión de staff nada cambia: 295 casos, 30 contratos, 2108 tareas.
-- Con sesión de colaborador: contratos/cotizaciones/facturación en 0, y
-- clientes, tareas y casos acotados a donde tiene trabajo asignado.
--
--   select count(*) from public.client_contracts;
--   select count(*) from public.get_tickets_sla_status();
