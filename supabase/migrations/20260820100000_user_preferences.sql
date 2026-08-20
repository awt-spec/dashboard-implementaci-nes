-- ============================================================================
-- Preferencias por usuario.
--
-- Los toggles de Configuración móvil eran estado local: se reseteaban al
-- navegar y no configuraban nada. Esta tabla los hace persistentes.
--
-- Una fila por usuario con columnas booleanas explícitas, en vez de un jsonb
-- genérico: son cinco preferencias conocidas y así quedan tipadas en types.ts y
-- consultables desde SQL (p. ej. para que un job decida a quién notificar).
-- Agregar una preferencia nueva cuesta un ALTER, que es el precio correcto por
-- tener el esquema explícito.
-- ============================================================================

create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,

  -- Notificaciones
  sla_alerts        boolean not null default true,   -- avisos de SLA por vencer
  reassigned_cases  boolean not null default true,   -- casos reasignados a mí
  daily_summary     boolean not null default false,  -- resumen diario del turno

  -- Trabajo
  ai_case_summary   boolean not null default true,   -- resumen IA del caso
  offline_mode      boolean not null default false,  -- modo sin conexión

  updated_at timestamptz not null default now()
);

comment on table public.user_preferences is
  'Preferencias personales. Una fila por usuario; se crea al primer guardado (upsert). Las columnas son el contrato con la UI de Configuración.';

alter table public.user_preferences enable row level security;

-- Son personales: cada quien ve y escribe SÓLO su fila. Ni siquiera el staff
-- lee las de otros — no hay razón operativa y sí riesgo de perfilar usuarios.
drop policy if exists "own preferences select" on public.user_preferences;
create policy "own preferences select" on public.user_preferences
  for select using (auth.uid() = user_id);

drop policy if exists "own preferences insert" on public.user_preferences;
create policy "own preferences insert" on public.user_preferences
  for insert with check (auth.uid() = user_id);

drop policy if exists "own preferences update" on public.user_preferences;
create policy "own preferences update" on public.user_preferences
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- updated_at al día sin que la app tenga que acordarse.
create or replace function public.touch_user_preferences()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_touch_user_preferences on public.user_preferences;
create trigger trg_touch_user_preferences
  before update on public.user_preferences
  for each row execute function public.touch_user_preferences();
