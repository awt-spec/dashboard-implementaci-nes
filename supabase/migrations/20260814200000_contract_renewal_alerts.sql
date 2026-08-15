-- ============================================================================
-- Alertas de renovación de contratos (90 / 60 / 30 días)
--
-- Hasta ahora el vencimiento sólo se veía si alguien abría la pestaña de
-- Contratos: el semáforo era pasivo. Un contrato podía vencer sin que nadie se
-- enterara. Esto lo vuelve activo, notificando a admin y PM.
--
-- Va entero en Postgres (función + pg_cron) y no en una edge function, para que
-- no dependa de un despliegue aparte: aplicar esta migración deja el aviso
-- funcionando.
-- ============================================================================

-- Registro de avisos ya emitidos. La clave única (contract_id, threshold_days)
-- es lo que hace idempotente al job: correrlo diez veces el mismo día no genera
-- diez notificaciones.
create table if not exists public.contract_renewal_alerts (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.client_contracts(id) on delete cascade,
  threshold_days integer not null,
  end_date date not null,
  created_at timestamptz not null default now(),
  unique (contract_id, threshold_days, end_date)
);

comment on table public.contract_renewal_alerts is
  'Avisos de vencimiento ya emitidos por contrato y umbral. Evita duplicados. end_date forma parte de la clave para que renovar el contrato (nueva fecha) vuelva a habilitar los avisos.';

alter table public.contract_renewal_alerts enable row level security;

drop policy if exists "staff read renewal alerts" on public.contract_renewal_alerts;
create policy "staff read renewal alerts" on public.contract_renewal_alerts
  for select using (public.is_staff_user());

-- El kind 'contract_renewal' no estaba contemplado en el check de kinds.
alter table public.user_notifications drop constraint if exists user_notifications_kind_check;
alter table public.user_notifications add constraint user_notifications_kind_check
  check (kind = any (array[
    'ticket_assigned','ticket_status_changed','note_added',
    'subtask_assigned','minute_shared','mention','escalation','system',
    'contract_renewal'
  ]));

-- ── Job ─────────────────────────────────────────────────────────────────────
create or replace function public.notify_contract_renewals()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer := 0;
  v_rows  integer;
begin
  with vencen as (
    select
      c.id            as contract_id,
      c.client_id,
      c.end_date,
      cl.name         as client_name,
      (c.end_date - current_date) as dias,
      -- Umbral alcanzado: el más chico de los que ya cruzó, para no avisar
      -- 90/60/30 de golpe cuando un contrato se carga faltando pocos días.
      case
        when (c.end_date - current_date) <= 30 then 30
        when (c.end_date - current_date) <= 60 then 60
        else 90
      end as threshold
    from public.client_contracts c
    join public.clients cl on cl.id = c.client_id
    where c.is_active
      and c.end_date is not null
      and not coalesce(c.auto_renewal, false)   -- si renueva solo, no hay que avisar
      and c.end_date >= current_date            -- ya vencidos: no es "por renovar"
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
    ur.user_id,
    'contract_renewal',
    'Contrato por vencer: ' || v.client_name,
    'Vence el ' || to_char(v.end_date, 'DD/MM/YYYY') || ' (faltan ' || v.dias || ' días). Sin renovación automática.',
    -- link en NULL a propósito: la app navega por secciones en estado local, no
    -- por URL, así que cualquier href sería un enlace muerto. El payload lleva
    -- client_id y contract_id para cuando exista deep-linking.
    null,
    jsonb_build_object(
      'contract_id', v.contract_id,
      'client_id', v.client_id,
      'end_date', v.end_date,
      'dias_restantes', v.dias,
      'threshold', n.threshold_days
    )
  from nuevas n
  join vencen v on v.contract_id = n.contract_id and v.end_date = n.end_date
  cross join (
    select distinct user_id from public.user_roles where role in ('admin', 'pm')
  ) ur;

  get diagnostics v_rows = row_count;
  v_total := v_rows;
  return v_total;
end;
$$;

grant execute on function public.notify_contract_renewals() to authenticated;

comment on function public.notify_contract_renewals is
  'Notifica a admin/PM los contratos activos sin renovación automática que vencen en 90/60/30 días. Idempotente vía contract_renewal_alerts. Devuelve cuántas notificaciones creó.';

-- ── Schedule diario (defensivo: si pg_cron no está, la función queda usable) ──
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('notify-contract-renewals')
      where exists (select 1 from cron.job where jobname = 'notify-contract-renewals');
    perform cron.schedule(
      'notify-contract-renewals',
      '0 7 * * *',
      'SELECT public.notify_contract_renewals()'
    );
    raise notice 'pg_cron job "notify-contract-renewals" agendado (diario 07:00 UTC)';
  else
    raise notice 'pg_cron no está habilitado — notify_contract_renewals() quedó disponible para correr manual. Para automatizar: habilitar pg_cron en Supabase Dashboard → Database → Extensions y re-correr esta migración.';
  end if;
end $$;

-- Corrida inicial: avisa de lo que ya está por vencer al aplicar la migración.
select public.notify_contract_renewals();
