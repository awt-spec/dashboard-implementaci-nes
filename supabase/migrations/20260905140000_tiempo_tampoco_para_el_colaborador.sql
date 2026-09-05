-- ============================================================================
-- El tiempo del caso tampoco es del colaborador.
--
-- La migración anterior sacó tiempo_consumido_minutos y tiempo_cobrado_minutos
-- del alcance del cliente, pero dejó a propósito el mismo límite que tenía el
-- staff: "todo el que no es cliente". El colaborador es externo (migración
-- 20260828100000) y tiempo_cobrado_minutos es dato comercial — lo que le
-- facturamos al cliente por ese caso. No es suyo.
--
-- Se comprobó antes de cerrarlo que no le rompe nada: el rol colaborador entra
-- por su propia pantalla (src/pages/Index.tsx corta antes de la vista de
-- soporte) y ni ColaboradorDashboard ni ningún componente de su árbol
-- —colaborador/, scrum/, team/— menciona tiempo_* ni support_ticket_time. Su
-- registro de horas va por work_time_entries, que es otra tabla y no se toca.
--
-- Con sólo apretar la permisiva ya alcanza: se comprobó que sin la restrictiva
-- de abajo el colaborador igual queda afuera, en lectura, escritura y borrado.
-- La restrictiva se agrega igual porque las permisivas se combinan con O: una
-- política que alguien sume mañana podría reabrir esto por la espalda, y las
-- restrictivas se combinan con Y, así que ésta no se deja anular. Es defensa en
-- profundidad, no el cerrojo principal — conviene saber cuál es cuál.
-- ============================================================================

-- ── 1 · la permisiva: ahora también deja fuera al colaborador ─────────────
drop policy if exists "staff maneja el tiempo del caso" on public.support_ticket_time;
create policy "staff maneja el tiempo del caso"
  on public.support_ticket_time
  for all to authenticated
  using      (auth.uid() is not null
              and not public.is_cliente_user()
              and not public.is_colaborador_user())
  with check (auth.uid() is not null
              and not public.is_cliente_user()
              and not public.is_colaborador_user());

-- ── 2 · la restrictiva: el cerrojo que no depende de las demás ────────────
drop policy if exists "externos fuera del tiempo del caso" on public.support_ticket_time;
create policy "externos fuera del tiempo del caso"
  on public.support_ticket_time
  as restrictive
  for all to authenticated
  using      (not public.is_cliente_user() and not public.is_colaborador_user())
  with check (not public.is_cliente_user() and not public.is_colaborador_user());
