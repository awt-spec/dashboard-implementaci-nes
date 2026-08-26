-- ============================================================================
-- El contrato como PROCESO, no como archivo.
--
-- Hasta ahora status llegaba a 'vencido' en UN solo lugar del repo: el backfill
-- de una sola vez de 20260814210000. Ningún cron, ningún trigger, ningún código
-- de app lo volvía a evaluar. Comprobado contra la base:
--
--   alta con end_date 2025-12-31 (vencido hace 8 meses) -> status 'vigente'
--   update moviendo end_date a 2024-06-30               -> status 'vigente'
--
-- Cada contrato mostraba el badge verde "Vigente" para siempre. El primero de
-- la cartera vence el 23/04/2027 y ese día no iba a pasar nada.
--
-- Y auto_renewal no renovaba: sólo excluía el contrato de las alertas y pintaba
-- la UI de verde. 29 de los 30 contratos lo tienen en true, así que el 97% de
-- la cartera no podía ni vencer ni avisar. Las dos mitades del problema son la
-- misma: nadie movía nada con el paso del tiempo.
--
-- Este job cierra las dos. Al pasar la fecha de fin:
--
--   auto_renewal = true   -> RUEDA la vigencia por su propio plazo y notifica.
--                            Si el job no corrió en años, rueda las veces que
--                            haga falta hasta alcanzar el presente.
--   auto_renewal = false  -> VENCE y notifica.
--
-- DECISIÓN QUE CONVIENE MIRAR: rodar la fecha sola cambia un dato comercial.
-- Se hace porque es lo que "renovación automática" significa —el contrato se
-- prorroga salvo aviso en contra— y porque dejarlo verde y quieto es peor: hoy
-- oculta el vencimiento sin renovar nada. Todo rodaje queda en contract_history
-- con la fecha anterior, así que revertirlo es leer la bitácora. Si el negocio
-- no opera así, la alternativa es poner auto_renewal en false y que venza.
-- ============================================================================

-- Los dos tipos de aviso nuevos no estaban contemplados en el check de kinds.
alter table public.user_notifications drop constraint if exists user_notifications_kind_check;
alter table public.user_notifications add constraint user_notifications_kind_check
  check (kind = any (array[
    'ticket_assigned','ticket_status_changed','note_added',
    'subtask_assigned','minute_shared','mention','escalation','system',
    'contract_renewal','contract_expired','contract_auto_renewed'
  ]));

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
  -- ── 1. Renovación automática ──────────────────────────────────────────────
  for r in
    select id, client_id, start_date, end_date
    from public.client_contracts
    where status = 'vigente'
      and deleted_at is null
      and end_date is not null
      and end_date < current_date
      and coalesce(auto_renewal, false)
  loop
    -- El plazo sale del propio contrato. age() y no (fin - inicio) en días:
    -- sumar 730 días a un contrato de 2 años lo corre un día por cada bisiesto.
    v_term := age(r.end_date, r.start_date);

    -- Sin start_date no hay plazo que rodar. No se inventa uno: cae al camino
    -- de vencimiento de abajo, que sí avisa.
    if r.start_date is null or v_term <= interval '0' then
      continue;
    end if;

    v_old_end := r.end_date;
    v_new_end := r.end_date;
    v_guard := 0;
    -- Si el job estuvo caído, rueda las veces necesarias para alcanzar el
    -- presente. El tope evita un bucle infinito si el plazo fuera degenerado.
    while v_new_end < current_date and v_guard < 100 loop
      v_new_end := (v_new_end + v_term)::date;
      v_guard := v_guard + 1;
    end loop;

    if v_new_end <= v_old_end then
      continue;
    end if;

    -- El update dispara log_contract_change(), que deja el end_date anterior en
    -- contract_history. La reversión es leer la bitácora.
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

  -- ── 2. Vencimiento ────────────────────────────────────────────────────────
  -- Todo lo que quedó con fecha pasada: los que no renuevan solos, y los que
  -- decían renovar pero no tenían plazo con el cual hacerlo.
  for r in
    select c.id, c.client_id, c.end_date, cl.name as client_name,
           coalesce(c.auto_renewal, false) as auto_renewal
    from public.client_contracts c
    join public.clients cl on cl.id = c.client_id
    where c.status = 'vigente'
      and c.deleted_at is null
      and c.end_date is not null
      and c.end_date < current_date
  loop
    -- El trigger sync_contract_status_active pone is_active en false solo.
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

comment on function public.run_contract_lifecycle() is
  'Corre el ciclo de vida: rueda los contratos con renovación automática y vence los demás cuando pasa end_date. Idempotente — sólo toca filas cuya fecha ya pasó. Devuelve cuántos venció y cuántos renovó.';

revoke execute on function public.run_contract_lifecycle() from public, anon;
grant execute on function public.run_contract_lifecycle() to authenticated;

-- ── Aviso previo: que un contrato con auto_renewal también se avise ──────────
-- notify_contract_renewals() excluía auto_renewal con el criterio "si renueva
-- solo, no hay que avisar". Ahora que rodar la fecha cambia un dato comercial,
-- el aviso previo es justamente cuando hay que poder frenarlo.
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
      c.id as contract_id, c.client_id, c.end_date, cl.name as client_name,
      coalesce(c.auto_renewal, false) as auto_renewal,
      (c.end_date - current_date) as dias,
      -- El umbral más chico ya cruzado, para no avisar 90/60/30 de golpe
      -- cuando un contrato se carga faltando pocos días.
      case
        when (c.end_date - current_date) <= 30 then 30
        when (c.end_date - current_date) <= 60 then 60
        else 90
      end as threshold
    from public.client_contracts c
    join public.clients cl on cl.id = c.client_id
    where c.status = 'vigente'
      and c.deleted_at is null
      and c.end_date is not null
      and c.end_date >= current_date          -- ya vencidos: los toma el otro job
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
    -- link en NULL a propósito: la app navega por secciones en estado local, no
    -- por URL, así que cualquier href sería un enlace muerto.
    null,
    jsonb_build_object('contract_id', v.contract_id, 'client_id', v.client_id,
                       'end_date', v.end_date, 'dias_restantes', v.dias,
                       'auto_renewal', v.auto_renewal, 'threshold', n.threshold_days)
  from nuevas n
  join vencen v on v.contract_id = n.contract_id and v.end_date = n.end_date
  cross join (select distinct user_id from public.user_roles where role in ('admin','pm')) ur;

  get diagnostics v_rows = row_count;
  v_total := v_rows;
  return v_total;
end;
$$;

comment on function public.notify_contract_renewals is
  'Avisa a admin/PM los contratos vigentes que vencen en 90/60/30 días, renueven solos o no. Idempotente vía contract_renewal_alerts.';

-- ── Schedule diario (defensivo: si pg_cron no está, las funciones quedan usables) ──
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('run-contract-lifecycle')
      where exists (select 1 from cron.job where jobname = 'run-contract-lifecycle');
    -- 06:45 UTC = 00:45 en Costa Rica, y antes de las 07:00 en que corre el
    -- aviso previo: primero se resuelve lo que ya venció, después se avisa de
    -- lo que viene. Al revés, un contrato vencido anoche generaría un "faltan
    -- 0 días" antes de que el ciclo lo procese.
    perform cron.schedule('run-contract-lifecycle', '45 6 * * *',
                          'SELECT public.run_contract_lifecycle()');
    raise notice 'pg_cron job "run-contract-lifecycle" agendado (diario 06:45 UTC)';
  else
    raise notice 'pg_cron no está habilitado — run_contract_lifecycle() quedó disponible para correr manual.';
  end if;
end $$;

-- ── Verificación posterior ──────────────────────────────────────────────────
--   select * from public.run_contract_lifecycle();
--
-- Con la cartera de hoy debe dar vencidos 0 y renovados 0: ningún contrato
-- tiene fecha pasada. El primero vence el 23/04/2027.
--
--   select status, count(*) from public.client_contracts
--   where deleted_at is null group by 1;
