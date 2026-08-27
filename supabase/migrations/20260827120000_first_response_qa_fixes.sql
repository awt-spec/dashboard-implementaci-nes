-- ============================================================================
-- Cinco correcciones al SLA de primera respuesta, salidas de un QA sobre la
-- migración de ayer. Van juntas porque comparten el trigger y el cuerpo de la
-- RPC; separarlas obligaría a reescribir los dos varias veces.
--
-- 1. EL MENSAJE DEL CLIENTE DETENÍA NUESTRO RELOJ (severidad alta). Existe la
--    policy "Cliente editors insert external notes": un usuario cliente puede
--    escribir notas externas en sus propios casos. El trigger estampaba con
--    CUALQUIER nota externa. Verificado con una sesión real de cliente:
--
--      el cliente escribe "¿alguna novedad?"  -> HTTP 201
--      first_response_at queda sellado        -> response_status 'ok', 3.33 h
--
--    La métrica mentía justo en el escenario que debe detectar: el cliente
--    persiguiéndonos. Ahora se marca al autor y sólo cuentan las notas
--    nuestras.
--
-- 2. UN CASO ENTREGADO MOSTRABA RELOJ VIVO (severidad alta). La regla de
--    estados terminales se aplicó a resolución y no a respuesta, así que un
--    caso ENTREGADA sin notas daba 'pending'. Y como ENTREGADA no está en los
--    estados cerrados de la app, seguía en la cola con una cuenta regresiva
--    pidiendo contestar algo ya entregado.
--
-- 3. HORAS NEGATIVAS CONTABAN COMO CUMPLIDAS. Una nota fechada antes del
--    registro daba -168 h con estado 'ok'. Es la misma clase de error que la
--    fecha futura en resolución, que se corrigió el lunes y no se replicó acá.
--
-- 4. BORRAR LA NOTA DEJABA EL SELLO HUÉRFANO. Quedaba una respuesta registrada
--    sin nada que la respalde.
--
-- 5. LA REAPERTURA NO REINICIABA EL RELOJ. La segunda iteración arrancaba ya
--    respondida, y las reaperturas son justo donde el cliente más espera.
--
--    DECISIÓN: el SLA de respuesta es POR ITERACIÓN, no por caso, porque es lo
--    que el cliente percibe — a quien le reabren un caso espera que le
--    contesten de nuevo. Contrapartida honesta: el modelo no tiene tabla de
--    SLA por iteración, así que al reiniciar se mide la ÚLTIMA iteración y la
--    anterior no queda medida. Es mejor que medir sólo la primera y llamar
--    "respondido" a un caso que lleva tres reaperturas sin contestar.
-- ============================================================================

-- ── 1 · Quién escribió la nota ──────────────────────────────────────────────
-- Se marca en el alta y no se deduce después: author_name es texto libre y no
-- sirve para decidir nada. Con la marca, el recálculo del punto 4 puede
-- filtrar igual que el sellado.
alter table public.support_ticket_notes
  add column if not exists authored_by_client boolean not null default false;

comment on column public.support_ticket_notes.authored_by_client is
  'La escribió un usuario con rol cliente. Se estampa en el alta: author_name es texto libre y no permite decidirlo después. Las notas del cliente NO cuentan como primera respuesta nuestra.';

create or replace function public.mark_note_author()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  NEW.authored_by_client := public.is_cliente_user();
  return NEW;
end;
$$;

drop trigger if exists trg_mark_note_author on public.support_ticket_notes;
create trigger trg_mark_note_author
  before insert on public.support_ticket_notes
  for each row execute function public.mark_note_author();

-- Retroactivo: las notas que ya existen se dan por nuestras. Hoy la tabla está
-- vacía salvo por las pruebas del QA, así que no hay nada que interpretar mal.
update public.support_ticket_notes set authored_by_client = false
 where authored_by_client is null;


-- ── 1 y 4 · Sellado y recálculo, sobre la misma definición ──────────────────
-- Una sola fuente para "cuál es la primera respuesta": la nota externa más
-- antigua que NO escribió el cliente. El alta y el borrado la consultan igual,
-- así que no pueden discrepar.
create or replace function public.first_response_of(_ticket uuid)
returns timestamptz
language sql
stable
security definer
set search_path = public
as $$
  select min(n.created_at)
  from support_ticket_notes n
  join support_tickets t on t.id = n.ticket_id
  where n.ticket_id = _ticket
    and n.visibility = 'externa'
    and not coalesce(n.authored_by_client, false)
    -- Sólo notas de la iteración en curso. Sin esta condición el reinicio del
    -- punto 5 duraba hasta la siguiente nota: el recálculo volvía a tomar el
    -- mínimo de TODAS las notas y resucitaba la respuesta de la iteración
    -- anterior. Medido: un caso respondido a las 2 h, entregado y reabierto,
    -- pasaba a 48 h 'overdue' —correcto— y volvía a 2 h 'ok' en cuanto se
    -- escribía cualquier nota nueva.
    and (t.last_reopen_at is null or n.created_at >= t.last_reopen_at);
$$;

comment on function public.first_response_of(uuid) is
  'Primera respuesta NUESTRA de la iteración en curso: nota externa más antigua no escrita por el cliente y posterior a la última reapertura.';

create or replace function public.sync_first_response()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ticket uuid := coalesce(NEW.ticket_id, OLD.ticket_id);
begin
  -- Se recalcula en vez de asignar: al borrar la única nota el sello tiene que
  -- volver a nulo, y al borrar la primera de varias tiene que pasar a la
  -- siguiente. Asignar sólo funcionaba para el alta.
  update public.support_tickets
     set first_response_at = public.first_response_of(v_ticket)
   where id = v_ticket
     and first_response_at is distinct from public.first_response_of(v_ticket);
  return null;
end;
$$;

drop trigger if exists trg_stamp_first_response on public.support_ticket_notes;
drop trigger if exists trg_sync_first_response on public.support_ticket_notes;
create trigger trg_sync_first_response
  after insert or update or delete on public.support_ticket_notes
  for each row execute function public.sync_first_response();

drop function if exists public.stamp_first_response();

comment on function public.sync_first_response() is
  'Mantiene support_tickets.first_response_at igual a la nota externa nuestra más antigua. Recalcula en alta, cambio y borrado.';


-- ── 5 · La reapertura reinicia el reloj ─────────────────────────────────────
-- Se cuelga de reopen_count, que ya incrementa detect_ticket_reopen, en vez de
-- repetir su condición de transición: si algún día cambia qué cuenta como
-- reapertura, cambia en un solo lugar. El nombre del trigger empieza con 'r'
-- para que corra DESPUÉS de 'trg_detect_ticket_reopen' — los BEFORE se
-- disparan en orden alfabético y necesitamos ver el contador ya incrementado.
create or replace function public.reset_first_response_on_reopen()
returns trigger
language plpgsql
as $$
begin
  if coalesce(NEW.reopen_count, 0) is distinct from coalesce(OLD.reopen_count, 0) then
    NEW.first_response_at := null;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_reset_first_response_on_reopen on public.support_tickets;
create trigger trg_reset_first_response_on_reopen
  before update on public.support_tickets
  for each row execute function public.reset_first_response_on_reopen();

comment on function public.reset_first_response_on_reopen() is
  'Al reabrir un caso el reloj de respuesta vuelve a cero: el SLA de respuesta se mide por iteración, no por caso.';


-- ── 2 y 3 · El veredicto ────────────────────────────────────────────────────
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
      and (
        not public.is_cliente_user()
        or t.client_id = public.get_cliente_client_id(auth.uid())
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
      -- Un caso ya entregado o aprobado no espera respuesta. La regla es la
      -- misma que la de resolución; antes sólo estaba en una de las dos mitades.
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
      -- Entregado: nadie espera que contestemos. Antes daba 'pending' y el caso
      -- seguía en la cola con cuenta regresiva.
      when c.terminal then 'no_sla'
      when c.elapsed_h < 0 then 'no_sla'
      -- Respuesta anterior al registro del caso: el dato está mal, no es un
      -- cumplimiento. Misma regla que el elapsed negativo de resolución.
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
  'SLA de resolución y de primera respuesta, más cobertura contractual. La respuesta sólo cuenta notas externas escritas por nosotros, se mide por iteración y se apaga en estados terminales.';

revoke execute on function public.get_tickets_sla_status() from public, anon;
revoke execute on function public.first_response_of(uuid) from public, anon;
grant execute on function public.get_tickets_sla_status() to authenticated;
grant execute on function public.first_response_of(uuid) to authenticated;

-- ── Verificación posterior ──────────────────────────────────────────────────
--   select response_status, count(*) from public.get_tickets_sla_status()
--   group by 1 order by 2 desc;
--
-- Debe seguir dando 295 overdue: ningún caso abierto tiene nota externa
-- nuestra. Lo que cambia es que ahora no se puede falsear.
