-- 1. Agregar rol 'colaborador' al enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'colaborador';

-- 2. Vincular miembros del equipo SYSDE con auth.users
ALTER TABLE public.sysde_team_members
  ADD COLUMN IF NOT EXISTS user_id uuid UNIQUE;

-- 3. Agregar assigned_user_id a tasks y support_tickets
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assigned_user_id uuid;

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS assigned_user_id uuid;

ALTER TABLE public.action_items
  ADD COLUMN IF NOT EXISTS assigned_user_id uuid;

-- 4. Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_user ON public.tasks(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_assigned_user ON public.support_tickets(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_action_items_assigned_user ON public.action_items(assigned_user_id);
CREATE INDEX IF NOT EXISTS idx_sysde_team_members_user ON public.sysde_team_members(user_id);