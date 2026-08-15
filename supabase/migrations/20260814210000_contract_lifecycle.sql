-- ============================================================================
-- Ciclo de vida del contrato: estados, borrado suave, historial y adendas.
--
-- Hasta ahora un contrato sólo tenía un booleano is_active: no había forma de
-- distinguir un borrador de uno vigente, ni un vencido de uno renovado o
-- cancelado. Borrar era definitivo (hard delete tras un confirm() del
-- navegador) y no quedaba rastro de quién cambió qué.
-- ============================================================================

-- ── 1. Estado ───────────────────────────────────────────────────────────────
alter table public.client_contracts
  add column if not exists status text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'client_contracts_status_check'
  ) then
    alter table public.client_contracts add constraint client_contracts_status_check
      check (status in ('borrador','vigente','vencido','renovado','cancelado'));
  end if;
end $$;

-- Backfill desde is_active + fechas.
-- NOTA: para is_active = false no hay información que distinga un contrato
-- cancelado de uno reemplazado por una renovación, así que se asume
-- 'cancelado'. Se corrige desde la UI donde corresponda.
update public.client_contracts
   set status = case
     when not coalesce(is_active, false) then 'cancelado'
     when end_date is not null and end_date < current_date then 'vencido'
     else 'vigente'
   end
 where status is null;

alter table public.client_contracts alter column status set default 'vigente';
alter table public.client_contracts alter column status set not null;

comment on column public.client_contracts.status is
  'Ciclo de vida: borrador → vigente → vencido/renovado/cancelado. is_active se mantiene sincronizado por trigger para el código que todavía lo lee.';

-- Sincronización bidireccional con is_active.
-- El código existente (21 lugares) sigue leyendo y escribiendo is_active; el
-- código nuevo escribe status. El trigger deriva el que no se tocó, de modo que
-- ninguna de las dos vías queda inconsistente.
create or replace function public.sync_contract_status_active()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.status is null then
      new.status := case when coalesce(new.is_active, true) then 'vigente' else 'cancelado' end;
    end if;
    new.is_active := (new.status = 'vigente');
  elsif new.status is distinct from old.status then
    new.is_active := (new.status = 'vigente');
  elsif new.is_active is distinct from old.is_active then
    new.status := case when new.is_active then 'vigente' else 'cancelado' end;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_contract_status_active on public.client_contracts;
create trigger trg_sync_contract_status_active
  before insert or update on public.client_contracts
  for each row execute function public.sync_contract_status_active();

-- ── 2. Borrado suave ────────────────────────────────────────────────────────
-- Un contrato respalda pólizas, hitos, paquetes facturados y el estado de
-- cuenta que se le envía al cliente: borrarlo de verdad destruye evidencia.
alter table public.client_contracts
  add column if not exists deleted_at timestamptz;

create index if not exists client_contracts_not_deleted_idx
  on public.client_contracts (client_id) where deleted_at is null;

comment on column public.client_contracts.deleted_at is
  'Borrado suave. Las lecturas de la app filtran deleted_at is null.';

-- ── 3. Historial de cambios ─────────────────────────────────────────────────
create table if not exists public.contract_history (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.client_contracts(id) on delete cascade,
  changed_by uuid,
  changed_at timestamptz not null default now(),
  action text not null check (action in ('created','updated','deleted','restored')),
  changes jsonb not null default '{}'::jsonb
);

create index if not exists contract_history_contract_idx
  on public.contract_history (contract_id, changed_at desc);

alter table public.contract_history enable row level security;

drop policy if exists "staff read contract history" on public.contract_history;
create policy "staff read contract history" on public.contract_history
  for select using (public.is_staff_user());

comment on table public.contract_history is
  'Bitácora automática de cambios del contrato. La escribe un trigger, no la app.';

create or replace function public.log_contract_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_changes jsonb := '{}'::jsonb;
  v_action  text;
  -- Sólo campos con significado de negocio: created_at/updated_at cambian
  -- siempre y llenarían la bitácora de ruido.
  v_fields  text[] := array[
    'contract_type','monthly_value','hourly_rate','included_hours','currency',
    'start_date','end_date','auto_renewal','payment_terms','penalty_clause',
    'notes','status'
  ];
  f text;
  v_old jsonb;
  v_new jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.contract_history (contract_id, changed_by, action, changes)
    values (new.id, auth.uid(), 'created', '{}'::jsonb);
    return new;
  end if;

  v_old := to_jsonb(old);
  v_new := to_jsonb(new);

  if old.deleted_at is null and new.deleted_at is not null then
    v_action := 'deleted';
  elsif old.deleted_at is not null and new.deleted_at is null then
    v_action := 'restored';
  else
    v_action := 'updated';
    foreach f in array v_fields loop
      if v_old -> f is distinct from v_new -> f then
        v_changes := v_changes || jsonb_build_object(f, jsonb_build_object('old', v_old -> f, 'new', v_new -> f));
      end if;
    end loop;
    -- Update que no tocó nada relevante: no ensucia la bitácora.
    if v_changes = '{}'::jsonb then
      return new;
    end if;
  end if;

  insert into public.contract_history (contract_id, changed_by, action, changes)
  values (new.id, auth.uid(), v_action, v_changes);
  return new;
end;
$$;

drop trigger if exists trg_log_contract_change on public.client_contracts;
create trigger trg_log_contract_change
  after insert or update on public.client_contracts
  for each row execute function public.log_contract_change();

-- ── 4. Adendas ──────────────────────────────────────────────────────────────
-- Modificaciones formales al contrato original (cambio de alcance, de valor,
-- prórroga). Se distinguen del historial: el historial es automático y técnico,
-- la adenda es un documento que las partes acuerdan.
create table if not exists public.contract_amendments (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.client_contracts(id) on delete cascade,
  numero integer,
  titulo text not null,
  descripcion text,
  effective_date date,
  -- Valores que la adenda modifica, para no perder qué cambió respecto del
  -- contrato original aunque después se edite el contrato.
  nuevo_valor_mensual numeric,
  nueva_fecha_fin date,
  moneda text,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists contract_amendments_contract_idx
  on public.contract_amendments (contract_id, effective_date desc nulls last);

alter table public.contract_amendments enable row level security;

drop policy if exists "staff read amendments" on public.contract_amendments;
create policy "staff read amendments" on public.contract_amendments
  for select using (public.is_staff_user());

drop policy if exists "admin pm write amendments" on public.contract_amendments;
create policy "admin pm write amendments" on public.contract_amendments
  for all using (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'pm'))
  with check (public.has_role(auth.uid(), 'admin') or public.has_role(auth.uid(), 'pm'));

comment on table public.contract_amendments is
  'Adendas: modificaciones formales acordadas sobre el contrato original. Distinto de contract_history, que es la bitácora técnica automática.';
