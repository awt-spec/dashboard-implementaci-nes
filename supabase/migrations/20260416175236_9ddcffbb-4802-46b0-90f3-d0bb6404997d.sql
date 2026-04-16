
-- Sprint planning a nivel de cliente
CREATE TABLE public.support_sprints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  name text NOT NULL,
  goal text DEFAULT '',
  start_date date,
  end_date date,
  status text NOT NULL DEFAULT 'planificado', -- planificado | activo | completado
  capacity_points integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.support_sprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select on support_sprints" ON public.support_sprints FOR SELECT USING (true);
CREATE POLICY "Allow all insert on support_sprints" ON public.support_sprints FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on support_sprints" ON public.support_sprints FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on support_sprints" ON public.support_sprints FOR DELETE USING (true);

CREATE TRIGGER trg_support_sprints_updated
BEFORE UPDATE ON public.support_sprints
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Campos Scrum a nivel de caso
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS sprint_id uuid REFERENCES public.support_sprints(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS story_points integer,
  ADD COLUMN IF NOT EXISTS business_value integer, -- 1..10
  ADD COLUMN IF NOT EXISTS effort integer,         -- 1..10
  ADD COLUMN IF NOT EXISTS backlog_rank integer,
  ADD COLUMN IF NOT EXISTS scrum_status text DEFAULT 'backlog'; -- backlog | ready | in_sprint | in_progress | done

CREATE INDEX IF NOT EXISTS idx_support_tickets_sprint_id ON public.support_tickets(sprint_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_backlog_rank ON public.support_tickets(client_id, backlog_rank);
