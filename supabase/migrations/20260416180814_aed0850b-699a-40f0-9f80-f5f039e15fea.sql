ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS sprint_id uuid REFERENCES public.support_sprints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS story_points integer,
  ADD COLUMN IF NOT EXISTS business_value integer,
  ADD COLUMN IF NOT EXISTS effort integer,
  ADD COLUMN IF NOT EXISTS backlog_rank integer,
  ADD COLUMN IF NOT EXISTS scrum_status text DEFAULT 'backlog';

CREATE INDEX IF NOT EXISTS idx_tasks_sprint ON public.tasks(sprint_id);
CREATE INDEX IF NOT EXISTS idx_tickets_sprint ON public.support_tickets(sprint_id);