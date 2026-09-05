-- ============================================================================
-- FASE 2 · Borrar las columnas viejas. ESTO es lo que cierra el hueco.
--
-- Corré esto SÓLO después de que el frontend que lee y escribe
-- support_ticket_time esté desplegado y verificado. Mientras las columnas
-- existan en support_tickets, el cliente las puede pedir: la política
-- "Cliente selects own client tickets" entrega la fila completa.
--
-- Es destructivo e irreversible. La fase 1 ya copió los datos a
-- support_ticket_time y los mantuvo sincronizados; la comprobación de abajo
-- aborta la migración si alguna fila no coincide, para no borrar nada que no
-- esté a salvo.
-- ============================================================================

-- ── 0 · red de seguridad: no borrar si las dos copias no coinciden ────────
do $$
declare
  descuadre bigint;
  huerfanos bigint;
begin
  select count(*) into descuadre
    from public.support_tickets t
    left join public.support_ticket_time x on x.ticket_id = t.id
   where x.ticket_id is null
      or x.tiempo_consumido_minutos is distinct from coalesce(t.tiempo_consumido_minutos, 0)
      or x.tiempo_cobrado_minutos   is distinct from coalesce(t.tiempo_cobrado_minutos,   0);

  select count(*) into huerfanos
    from public.support_ticket_time x
    left join public.support_tickets t on t.id = x.ticket_id
   where t.id is null;

  if descuadre > 0 then
    raise exception
      'ABORTADO: % caso(s) no coinciden entre support_tickets y support_ticket_time. '
      'Revisá antes de borrar las columnas.', descuadre;
  end if;
  if huerfanos > 0 then
    raise exception 'ABORTADO: % fila(s) huérfanas en support_ticket_time.', huerfanos;
  end if;

  raise notice 'Copias verificadas: todo cuadra. Se puede borrar.';
end;
$$;

-- ── 1 · quitar el puente ──────────────────────────────────────────────────
drop trigger  if exists trg_puente_tiempo_desde_el_caso on public.support_tickets;
drop trigger  if exists trg_puente_caso_desde_el_tiempo on public.support_ticket_time;
drop function if exists public.puente_tiempo_desde_el_caso();
drop function if exists public.puente_caso_desde_el_tiempo();

-- ── 2 · borrar las columnas del alcance del cliente ───────────────────────
alter table public.support_tickets
  drop column if exists tiempo_consumido_minutos,
  drop column if exists tiempo_cobrado_minutos;
