-- ============================================================================
-- FASE 1 · Sacar el tiempo facturable del alcance del cliente.
--
-- El problema: la política "Cliente selects own client tickets" es FOR SELECT
-- sobre la fila completa. RLS en Postgres es por FILA, no por columna, así que
-- esa política le entrega al cliente TODAS las columnas de sus casos —
-- incluidas tiempo_consumido_minutos y tiempo_cobrado_minutos. Quitar esas dos
-- columnas de la consulta del frontend (CLIENT_SAFE_COLUMNS) las esconde de la
-- pantalla, no de la base: un GET /support_tickets?select=tiempo_cobrado_minutos
-- con un JWT de cliente las sigue devolviendo.
--
-- Por qué no se arregla con privilegios de columna: en Supabase el staff y los
-- clientes comparten el mismo rol de base (`authenticated`) — el rol de la app
-- vive en la tabla user_roles, no en el JWT. Un REVOKE de columna le pegaría
-- también al staff.
--
-- Por qué no se arregla con una vista para el cliente: habría que cerrarle la
-- tabla base, y el update de validar/reabrir hace .select() de vuelta
-- (useSupportTickets.ts, useReopenTicket.ts). Se rompería el portal.
--
-- Lo que sí cierra el hueco por construcción: mover las dos columnas a una
-- tabla compañera con su propia RLS. El dato deja de existir donde el cliente
-- puede mirar. El portal no se toca.
--
-- Esta fase NO borra nada todavía: crea la tabla, la llena y deja las dos
-- copias sincronizadas con triggers, para que el orden entre correr este SQL y
-- desplegar el frontend no importe. El hueco se cierra en la FASE 2, que borra
-- las columnas viejas — correla sólo después de verificar el despliegue.
-- ============================================================================

-- ── 1 · la tabla compañera ────────────────────────────────────────────────
create table if not exists public.support_ticket_time (
  ticket_id                uuid primary key
                             references public.support_tickets(id) on delete cascade,
  tiempo_consumido_minutos integer     not null default 0,
  tiempo_cobrado_minutos   integer     not null default 0,
  updated_at               timestamptz not null default now()
);

comment on table public.support_ticket_time is
  'Tiempo consumido y cobrado por caso. Vive aparte de support_tickets porque '
  'RLS es por fila y el cliente lee sus propias filas completas: mientras estas '
  'columnas estuvieran en support_tickets, el cliente podía pedirlas.';

-- ── 2 · llenarla con lo que ya hay ────────────────────────────────────────
insert into public.support_ticket_time
       (ticket_id, tiempo_consumido_minutos, tiempo_cobrado_minutos)
select id,
       coalesce(tiempo_consumido_minutos, 0),
       coalesce(tiempo_cobrado_minutos,   0)
  from public.support_tickets
    on conflict (ticket_id) do update
   set tiempo_consumido_minutos = excluded.tiempo_consumido_minutos,
       tiempo_cobrado_minutos   = excluded.tiempo_cobrado_minutos;

-- ── 3 · RLS: el cliente no entra ──────────────────────────────────────────
-- Se conserva el mismo límite que hoy tiene el staff sobre support_tickets
-- (todo el que no es cliente), para no cambiar de paso el comportamiento de
-- nadie más. Acotar además al colaborador es otra decisión: el cronómetro de
-- SupportCommandCenter escribe tiempo_consumido_minutos y hay que revisar
-- quién lo usa antes de tocarlo.
alter table public.support_ticket_time enable row level security;

drop policy if exists "staff maneja el tiempo del caso" on public.support_ticket_time;
create policy "staff maneja el tiempo del caso"
  on public.support_ticket_time
  for all to authenticated
  using      (auth.uid() is not null and not public.is_cliente_user())
  with check (auth.uid() is not null and not public.is_cliente_user());

revoke all on public.support_ticket_time from anon;
grant select, insert, update, delete on public.support_ticket_time to authenticated;

-- ── 4 · un caso nuevo nace con su fila de tiempo ──────────────────────────
-- El cliente puede crear casos (política "Cliente editors insert tickets") y no
-- tiene permiso de escribir support_ticket_time; por eso la función es
-- SECURITY DEFINER: crea la fila en nombre del dueño, no del cliente.
create or replace function public.crear_tiempo_del_caso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.support_ticket_time (ticket_id)
  values (new.id)
  on conflict (ticket_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_crear_tiempo_del_caso on public.support_tickets;
create trigger trg_crear_tiempo_del_caso
  after insert on public.support_tickets
  for each row execute function public.crear_tiempo_del_caso();

-- ── 5 · puente temporal entre las dos copias ──────────────────────────────
-- Mientras el frontend viejo siga escribiendo las columnas de support_tickets y
-- el nuevo escriba support_ticket_time, las dos tienen que verse iguales. Sin
-- esto habría que sincronizar el deploy con el SQL al segundo. pg_trigger_depth
-- corta el rebote entre ambos triggers.
create or replace function public.puente_tiempo_desde_el_caso()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  insert into public.support_ticket_time
         (ticket_id, tiempo_consumido_minutos, tiempo_cobrado_minutos, updated_at)
  values (new.id,
          coalesce(new.tiempo_consumido_minutos, 0),
          coalesce(new.tiempo_cobrado_minutos,   0),
          now())
      on conflict (ticket_id) do update
     set tiempo_consumido_minutos = excluded.tiempo_consumido_minutos,
         tiempo_cobrado_minutos   = excluded.tiempo_cobrado_minutos,
         updated_at               = now();
  return new;
end;
$$;

drop trigger if exists trg_puente_tiempo_desde_el_caso on public.support_tickets;
create trigger trg_puente_tiempo_desde_el_caso
  after update of tiempo_consumido_minutos, tiempo_cobrado_minutos
  on public.support_tickets
  for each row execute function public.puente_tiempo_desde_el_caso();

create or replace function public.puente_caso_desde_el_tiempo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return new;
  end if;
  update public.support_tickets t
     set tiempo_consumido_minutos = new.tiempo_consumido_minutos,
         tiempo_cobrado_minutos   = new.tiempo_cobrado_minutos
   where t.id = new.ticket_id
     and (t.tiempo_consumido_minutos is distinct from new.tiempo_consumido_minutos
       or t.tiempo_cobrado_minutos   is distinct from new.tiempo_cobrado_minutos);
  return new;
end;
$$;

drop trigger if exists trg_puente_caso_desde_el_tiempo on public.support_ticket_time;
create trigger trg_puente_caso_desde_el_tiempo
  after insert or update on public.support_ticket_time
  for each row execute function public.puente_caso_desde_el_tiempo();
