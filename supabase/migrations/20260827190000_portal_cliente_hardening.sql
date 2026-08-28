-- ============================================================================
-- Cuatro superficies del portal del cliente que esquivaban RLS.
--
-- El portal está bien contenido en lo que pasa por policies: las escrituras
-- están todas bloqueadas —no puede cerrar casos ajenos, ni tocar su contrato,
-- ni auto-aprobar su cotización— y las lecturas de negocio acotadas. Lo que
-- falla es lo que NO pasa por policies: tres funciones SECURITY DEFINER y una
-- tabla sin RLS.
--
-- Dos de las cuatro las introduje esta semana. La lección, anotada acá para
-- que quede: `grant execute … to authenticated` incluye a clientes y
-- contratistas, y en este proyecto eso casi nunca es lo que se quiere.
-- ============================================================================

-- ── 1 · Los jobs de contratos no son para cualquiera ────────────────────────
-- Verificado con una sesión real de cliente.apex: POST /rpc/run_contract_lifecycle
-- devolvía [{vencidos: 0, renovados: 0}]. Hoy es inocuo porque ningún contrato
-- tiene fecha pasada, pero el día que uno venza, cualquier cliente podría
-- adelantar la vigencia de los 30 contratos con una llamada.
--
-- El guard va DENTRO de la función y no en el grant, por dos razones: da un
-- mensaje claro en vez de un 403 sin explicación, y deja pasar al cron, que
-- corre sin sesión (auth.uid() nulo).
create or replace function public.assert_contract_job_caller()
returns void
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  -- Sin sesión = pg_cron. Se deja pasar: es quien debe correr esto a diario.
  if auth.uid() is null then
    return;
  end if;
  if not exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'pm', 'ceo')
  ) then
    raise exception 'Solo admin, PM o CEO pueden correr los procesos de contratos'
      using errcode = '42501';
  end if;
end;
$$;

create or replace function public.run_contract_lifecycle()
returns table (vencidos int, renovados int)
language plpgsql
security definer
set search_path = public
as $$
declare
  r            record;
  v_term       interval;
  v_old_end    date;
  v_new_end    date;
  v_guard      int;
  v_vencidos   int := 0;
  v_renovados  int := 0;
begin
  perform public.assert_contract_job_caller();

  -- ── Renovación automática ─────────────────────────────────────────────────
  for r in
    select id, client_id, start_date, end_date
    from public.client_contracts
    where status = 'vigente' and deleted_at is null
      and end_date is not null and end_date < current_date
      and coalesce(auto_renewal, false)
  loop
    -- age() y no (fin - inicio) en días: sumar 730 días a un contrato de dos
    -- años lo corre un día por cada bisiesto.
    v_term := age(r.end_date, r.start_date);
    if r.start_date is null or v_term <= interval '0' then
      continue;
    end if;
    v_old_end := r.end_date;
    v_new_end := r.end_date;
    v_guard := 0;
    while v_new_end < current_date and v_guard < 100 loop
      v_new_end := (v_new_end + v_term)::date;
      v_guard := v_guard + 1;
    end loop;
    if v_new_end <= v_old_end then
      continue;
    end if;

    update public.client_contracts set end_date = v_new_end where id = r.id;
    v_renovados := v_renovados + 1;

    insert into public.user_notifications (user_id, kind, title, body, link, payload)
    select ur.user_id, 'contract_auto_renewed',
      'Contrato renovado automáticamente: ' || cl.name,
      'La vigencia pasó del ' || to_char(v_old_end, 'DD/MM/YYYY') ||
      ' al ' || to_char(v_new_end, 'DD/MM/YYYY') || '. Confirmá que corresponde.',
      null,
      jsonb_build_object('contract_id', r.id, 'client_id', r.client_id,
                         'end_date_anterior', v_old_end, 'end_date_nuevo', v_new_end)
    from public.clients cl
    cross join (select distinct user_id from public.user_roles where role in ('admin','pm')) ur
    where cl.id = r.client_id;
  end loop;

  -- ── Vencimiento ───────────────────────────────────────────────────────────
  for r in
    select c.id, c.client_id, c.end_date, cl.name as client_name,
           coalesce(c.auto_renewal, false) as auto_renewal
    from public.client_contracts c
    join public.clients cl on cl.id = c.client_id
    where c.status = 'vigente' and c.deleted_at is null
      and c.end_date is not null and c.end_date < current_date
  loop
    update public.client_contracts set status = 'vencido' where id = r.id;
    v_vencidos := v_vencidos + 1;

    insert into public.user_notifications (user_id, kind, title, body, link, payload)
    select ur.user_id, 'contract_expired',
      'Contrato vencido: ' || r.client_name,
      'Venció el ' || to_char(r.end_date, 'DD/MM/YYYY') ||
      case when r.auto_renewal
           then '. Estaba marcado como renovación automática pero no tiene plazo (falta fecha de inicio), así que no se pudo rodar.'
           else '. Los casos nuevos de este cliente quedan fuera de vigencia.' end,
      null,
      jsonb_build_object('contract_id', r.id, 'client_id', r.client_id, 'end_date', r.end_date)
    from (select distinct user_id from public.user_roles where role in ('admin','pm')) ur;
  end loop;

  vencidos := v_vencidos;
  renovados := v_renovados;
  return next;
end;
$$;

create or replace function public.notify_contract_renewals()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows integer;
begin
  perform public.assert_contract_job_caller();

  with vencen as (
    select
      c.id as contract_id, c.client_id, c.end_date, cl.name as client_name,
      coalesce(c.auto_renewal, false) as auto_renewal,
      (c.end_date - current_date) as dias,
      case
        when (c.end_date - current_date) <= 30 then 30
        when (c.end_date - current_date) <= 60 then 60
        else 90
      end as threshold
    from public.client_contracts c
    join public.clients cl on cl.id = c.client_id
    where c.status = 'vigente' and c.deleted_at is null
      and c.end_date is not null
      and c.end_date >= current_date
      and (c.end_date - current_date) <= 90
  ),
  nuevas as (
    insert into public.contract_renewal_alerts (contract_id, threshold_days, end_date)
    select contract_id, threshold, end_date from vencen
    on conflict (contract_id, threshold_days, end_date) do nothing
    returning contract_id, threshold_days, end_date
  )
  insert into public.user_notifications (user_id, kind, title, body, link, payload)
  select
    ur.user_id, 'contract_renewal',
    'Contrato por vencer: ' || v.client_name,
    'Vence el ' || to_char(v.end_date, 'DD/MM/YYYY') || ' (faltan ' || v.dias || ' días). ' ||
    case when v.auto_renewal
         then 'Se renovará solo por su plazo salvo que lo cambies antes.'
         else 'Sin renovación automática: al vencer, los casos nuevos quedan fuera de vigencia.' end,
    null,
    jsonb_build_object('contract_id', v.contract_id, 'client_id', v.client_id,
                       'end_date', v.end_date, 'dias_restantes', v.dias,
                       'auto_renewal', v.auto_renewal, 'threshold', n.threshold_days)
  from nuevas n
  join vencen v on v.contract_id = n.contract_id and v.end_date = n.end_date
  cross join (select distinct user_id from public.user_roles where role in ('admin','pm')) ur;

  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;


-- ── 2 · pm_ai_analysis: los análisis internos no son del cliente ────────────
-- Devolvía las 27 filas a cualquier cliente. Apex podía leer la extracción del
-- contrato de Aurum, con el nombre de su cliente final (BanSuma) y su
-- escalonamiento de precios (USD 749 meses 1-6, USD 999 desde el 7).
--
-- No se acota por client_id porque la columna está en nulo en las 27 filas: el
-- vínculo con el cliente vive dentro del texto y de `scope`. Mientras eso siga
-- así, la única respuesta segura es que el cliente no lea la tabla.
alter table public.pm_ai_analysis enable row level security;

drop policy if exists "Staff lee analisis de IA" on public.pm_ai_analysis;
create policy "Staff lee analisis de IA" on public.pm_ai_analysis
  for select to authenticated
  using (public.is_staff_user() and not public.is_cliente_user());

drop policy if exists "Admin y pm escriben analisis de IA" on public.pm_ai_analysis;
create policy "Admin y pm escriben analisis de IA" on public.pm_ai_analysis
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'pm'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role) or public.has_role(auth.uid(), 'pm'::app_role));

comment on table public.pm_ai_analysis is
  'Análisis de IA para uso interno. Nunca visible al cliente: incluye extracciones de contratos de otros clientes.';


-- ── 3 · get_sla_history sólo del cliente propio ─────────────────────────────
-- Es SECURITY DEFINER, recibe _client_id por parámetro y no validaba quién
-- pregunta. cliente.apex leía el histórico de CMI: 23 cerrados, 3120 h de
-- resolución promedio. Mismo patrón que ya corregimos en
-- get_tickets_sla_status() y contract_coverage_for().
create or replace function public.get_sla_history(_client_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with permitido as (
  select (
    (not public.is_cliente_user() and not public.is_colaborador_user())
    or public.user_can_see_client(_client_id)
  ) as ok
),
sla as (
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
      and (select ok from permitido)
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
  where t.client_id = _client_id
    and t.estado in ('CERRADA','ENTREGADA','APROBADA')
    and t.fecha_registro is not null
    and (select ok from permitido)
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

comment on function public.get_sla_history(text) is
  'Histórico de cumplimiento del cliente. Un usuario cliente o colaborador sólo puede pedir el suyo.';


-- ── 4 · El directorio interno no es del cliente ─────────────────────────────
-- Devolvía las 19 filas con nombre, rol, correo corporativo, tipo de
-- contratación y la columna hourly_rate. Hoy las tarifas están en 0, así que
-- no hay fuga de costos todavía — pero la columna es legible y el día que
-- alguien la llene, el cliente ve lo que le cuesta cada persona.
--
-- Se deniega entero y no por columnas: RLS es por fila, y ningún panel del
-- portal (estado de cuenta, horas, cotizaciones) consulta esta tabla, así que
-- cerrarla no le quita nada que use.
drop policy if exists "cliente sin directorio interno" on public.sysde_team_members;
create policy "cliente sin directorio interno" on public.sysde_team_members
  as restrictive for all to authenticated
  using (not public.is_cliente_user())
  with check (not public.is_cliente_user());

-- ── Verificación posterior ──────────────────────────────────────────────────
-- Con sesión de cliente, las cuatro deben cerrarse:
--   select * from public.run_contract_lifecycle();      -> error 42501
--   select count(*) from public.pm_ai_analysis;         -> 0
--   select public.get_sla_history('cmi');               -> closed_total 0
--   select count(*) from public.sysde_team_members;     -> 0
-- Con sesión de admin, todo igual que antes.
