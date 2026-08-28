-- ============================================================================
-- Dos correcciones a las migraciones de permisos de hoy. Las dos son mías.
--
-- 1. EL ALCANCE DEL COLABORADOR LE ROMPIÓ EL TABLERO (severidad alta).
--    user_can_see_client() llamaba a colaborador_client_ids(), que recorre
--    tasks entera. Como la policy se evalúa POR FILA, eso es O(n²) sobre 2108
--    tareas. Medido contra la base:
--
--      admin        2108 filas    703 ms
--      colaborador  HTTP 500     8253 ms   57014 statement timeout
--      colaborador, hasta con limit=100 -> timeout
--
--    No es un problema de corrección sino de costo, y deja al colaborador sin
--    poder abrir su tablero. Se reemplaza el escaneo por un EXISTS indexado:
--    una búsqueda puntual por fila en vez de un recorrido completo.
--
-- 2. pm_ai_analysis SIGUIÓ ABIERTO. Le puse una policy PERMISIVA, y las
--    permisivas se combinan con OR: la que ya existía seguía dejando pasar al
--    cliente, que siguió leyendo las 27 filas. Para negar hay que usar
--    RESTRICTIVE, que es lo que sí hice en sysde_team_members —y por eso esa
--    quedó bien y ésta no—. Verificado después de aplicar: cliente 27, admin 27.
-- ============================================================================

-- ── 1 · El alcance, ahora barato ────────────────────────────────────────────
-- Dos EXISTS separados y no uno con OR adentro: así cada uno usa su propio
-- índice. Con el OR dentro de un solo EXISTS el planner descarta los dos.
create index if not exists tasks_assigned_user_client_idx
  on public.tasks (assigned_user_id, client_id);

create index if not exists tasks_assignees_gin_idx
  on public.tasks using gin (assignees);

create or replace function public.user_can_see_client(_client_id text, _user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    -- Staff sin restricción. El colaborador no está en esta lista.
    exists (
      select 1 from public.user_roles
      where user_id = _user_id
        and role in ('admin','pm','ceo','gerente_soporte')
    )
    or exists (
      select 1 from public.gerente_client_assignments
      where user_id = _user_id and client_id = _client_id
    )
    or exists (
      select 1 from public.cliente_company_assignments
      where user_id = _user_id and client_id = _client_id
    )
    -- Colaborador: ¿tiene ALGUNA tarea suya en este cliente? Es la misma
    -- pregunta que antes, pero preguntada de forma que el índice la conteste
    -- sin recorrer la tabla. colaborador_client_ids() sigue existiendo para
    -- quien necesite la lista completa; acá no se usa.
    or (
      exists (select 1 from public.user_roles
              where user_id = _user_id and role = 'colaborador')
      and (
        exists (
          select 1 from public.tasks t
          where t.client_id = _client_id and t.assigned_user_id = _user_id
        )
        or exists (
          select 1 from public.tasks t
          where t.client_id = _client_id
            and t.assignees @> to_jsonb(array[_user_id::text])
        )
      )
    );
$$;

comment on function public.user_can_see_client(text, uuid) is
  'Visibilidad por cliente. Sin restricción para admin/pm/ceo/gerente_soporte; gerente y cliente por asignación; colaborador si tiene alguna tarea en ese cliente (EXISTS indexado, no escaneo).';


-- ── 2 · pm_ai_analysis, ahora sí ────────────────────────────────────────────
-- La policy permisiva del intento anterior no negaba nada: las permisivas se
-- suman con OR y la preexistente seguía abriendo la tabla. Ésta es restrictiva
-- y se combina con AND, así que corta sin importar qué más haya.
drop policy if exists "Staff lee analisis de IA" on public.pm_ai_analysis;

drop policy if exists "cliente sin analisis de IA" on public.pm_ai_analysis;
create policy "cliente sin analisis de IA" on public.pm_ai_analysis
  as restrictive for all to authenticated
  using (not public.is_cliente_user())
  with check (not public.is_cliente_user());

-- ── Verificación posterior ──────────────────────────────────────────────────
--   Con sesión de colaborador, tasks debe responder rápido y acotado:
--     select count(*) from public.tasks;
--   Con sesión de cliente:
--     select count(*) from public.pm_ai_analysis;   -> 0
--   Con sesión de admin, ambas sin cambio: 2108 y 27.
