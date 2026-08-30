-- ============================================================================
-- El colaborador es externo: se le cierran las dos superficies de gestión que
-- le quedaban abiertas.
--
-- Hasta ahora el rol vivía en una ambigüedad: is_staff_user() lo cuenta como
-- interno —junto a admin, pm, ceo y los gerentes— pero en la práctica se usa
-- con contratistas de afuera. Las policies heredaron esa ambigüedad. La
-- decisión, tomada explícitamente: es EXTERNO. Ve su trabajo, no la gestión.
--
-- Un barrido con la sesión real de un contratista confirmó que sólo quedaban
-- estas dos; el resto ya estaba acotado o vacío:
--
--   sysde_team_members       19 de 19   <- ésta
--   support_reopens_summary  10 de 178
--   user_activity_log         2 de 1907
--   work_time_entries         0 de 231
--   profiles                  1 de 41
--
-- Lo que SIGUE viendo, porque es su trabajo: sus tareas, los casos de los
-- clientes donde tiene tareas, su propio tiempo y su propio perfil.
-- ============================================================================

-- ── 1 · El directorio interno ───────────────────────────────────────────────
-- La policy anterior sólo bloqueaba al cliente. El colaborador seguía leyendo
-- las 19 filas con nombre, rol, correo corporativo, tipo de contratación y la
-- columna hourly_rate. Hoy las tarifas están en 0, así que no hay fuga de
-- costos todavía — pero es dato de costo interno frente a alguien de afuera, y
-- el día que se llene la columna ya sería tarde.
--
-- Ojo con el alcance: cerrar la tabla ENTERA al colaborador rompe su propio
-- panel. ManualTimeEntryDialog saca employment_type de su fila y hace
-- `is_billable: isHourly ? billable : false`; sin fila, isHourly queda en
-- false y TODA hora que registre un contratista se guarda como NO facturable,
-- en silencio. Justo el caso donde la hora sí importa para facturar.
--
-- Entonces: no ve el directorio, ve su propia fila. Su nombre, su tarifa y su
-- tipo de contratación son datos suyos; los de los otros 18, no.
--
-- Orden deliberado: primero se crean las nuevas, y sólo al final se borra la
-- vieja. Si algo falla en medio, el cliente sigue bloqueado por la policy
-- anterior en vez de quedar la tabla abierta.
drop policy if exists "externos sin directorio interno" on public.sysde_team_members;
drop policy if exists "colaborador no escribe el directorio" on public.sysde_team_members;

create policy "externos sin directorio interno" on public.sysde_team_members
  as restrictive for all to authenticated
  using (
    not public.is_cliente_user()
    and (
      not public.is_colaborador_user()
      -- Su propia fila, por user_id o por correo: useMyTeamMember() busca por
      -- correo, y no toda fila futura traerá user_id. Hoy las 19 lo tienen, así
      -- que la primera condición basta; la segunda es para lo que venga.
      -- Se lee el claim directo y no auth.jwt() para no depender de un helper
      -- cuya existencia no está verificada en este proyecto.
      or user_id = auth.uid()
      or lower(email) = lower(
           nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'email')
    )
  )
  -- Escribir, ninguno de los dos. Ni siquiera su propia fila: la tarifa la
  -- fija la administración, no el contratista.
  with check (not public.is_cliente_user() and not public.is_colaborador_user());

-- USING por sí sola habilita el DELETE de la fila propia — comprobado: sin esta
-- segunda policy el colaborador se borraba a sí mismo (DELETE 1). Se cierra.
create policy "colaborador no escribe el directorio" on public.sysde_team_members
  as restrictive for delete to authenticated
  using (not public.is_cliente_user() and not public.is_colaborador_user());

-- Ya protegido por lo de arriba: se retira la policy que sólo veía al cliente.
drop policy if exists "cliente sin directorio interno" on public.sysde_team_members;

comment on table public.sysde_team_members is
  'Directorio interno del equipo. Incluye correo corporativo y hourly_rate: sólo staff no externo. El cliente no lo ve; el colaborador ve únicamente su propia fila y no escribe ninguna.';


-- ── 2 · El histórico de cumplimiento ────────────────────────────────────────
-- La corrección anterior acotó al cliente a su propia empresa y dejó pasar al
-- colaborador por sus clientes asignados. Verificado: leía el histórico de CMI
-- —23 cerrados, 3120 h de resolución promedio— porque CMI es uno de los suyos.
--
-- Eso era coherente con "colaborador = staff". Con la decisión de que es
-- externo deja de serlo: el histórico de cumplimiento es una métrica de
-- gestión sobre el desempeño del equipo frente al cliente, no información que
-- un contratista necesite para hacer su trabajo. Se le cierra entero, no por
-- cliente.
create or replace function public.get_sla_history(_client_id text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
with permitido as (
  select (
    -- Externo = no pasa. Cliente = sólo su empresa. Staff interno = todo.
    not public.is_colaborador_user()
    and (not public.is_cliente_user() or public.user_can_see_client(_client_id))
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
  'Histórico de cumplimiento. Staff interno lo ve completo; el cliente sólo el suyo; el colaborador no lo ve: es métrica de gestión, no insumo de su trabajo.';

-- ── Comprobación ────────────────────────────────────────────────────────────
-- Devuelve UNA FILA. Si ves "Success. No rows returned", no se ejecutó:
-- Ctrl+A dentro del editor y Run de nuevo.
select
  (select count(*) from pg_policies
     where tablename = 'sysde_team_members'
       and policyname in ('externos sin directorio interno',
                          'colaborador no escribe el directorio'))    as policies_nuevas,
  (select count(*) from pg_policies
     where tablename = 'sysde_team_members'
       and policyname = 'cliente sin directorio interno')             as policy_vieja,
  (select count(*) from pg_proc where proname = 'get_sla_history')    as fn_historico,
  'esperado: 2, 0, 1'                                                 as esperado;
