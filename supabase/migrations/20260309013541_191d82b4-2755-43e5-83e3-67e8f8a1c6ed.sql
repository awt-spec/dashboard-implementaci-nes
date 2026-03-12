
-- Clients table
CREATE TABLE public.clients (
  id text PRIMARY KEY,
  name text NOT NULL,
  country text NOT NULL,
  industry text NOT NULL,
  contact_name text NOT NULL,
  contact_email text NOT NULL,
  contract_start text NOT NULL,
  contract_end text NOT NULL,
  status text NOT NULL CHECK (status IN ('activo','en-riesgo','pausado','completado')),
  progress integer NOT NULL DEFAULT 0,
  team_assigned text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Client financials
CREATE TABLE public.client_financials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL UNIQUE,
  contract_value numeric NOT NULL DEFAULT 0,
  billed numeric NOT NULL DEFAULT 0,
  paid numeric NOT NULL DEFAULT 0,
  pending numeric NOT NULL DEFAULT 0,
  hours_estimated integer NOT NULL DEFAULT 0,
  hours_used integer NOT NULL DEFAULT 0,
  monthly_breakdown jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Phases
CREATE TABLE public.phases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  status text NOT NULL CHECK (status IN ('completado','en-progreso','por-iniciar','pendiente')),
  progress integer NOT NULL DEFAULT 0,
  start_date text NOT NULL,
  end_date text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Deliverables
CREATE TABLE public.deliverables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  original_id text NOT NULL,
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('documento','modulo','configuracion','capacitacion','reporte')),
  status text NOT NULL CHECK (status IN ('entregado','en-revision','pendiente','aprobado')),
  due_date text NOT NULL,
  delivered_date text,
  approved_by text,
  version text NOT NULL DEFAULT '1.0',
  detail jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Tasks
CREATE TABLE public.tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  original_id integer NOT NULL,
  title text NOT NULL,
  status text NOT NULL CHECK (status IN ('completada','en-progreso','bloqueada','pendiente')),
  owner text NOT NULL,
  due_date text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('alta','media','baja')),
  assignees jsonb NOT NULL DEFAULT '[]',
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Action items
CREATE TABLE public.action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  original_id text NOT NULL,
  title text NOT NULL,
  assignee text NOT NULL,
  due_date text NOT NULL,
  status text NOT NULL CHECK (status IN ('pendiente','completado','vencido')),
  source text NOT NULL,
  priority text NOT NULL CHECK (priority IN ('alta','media','baja')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Meeting minutes
CREATE TABLE public.meeting_minutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  original_id text NOT NULL,
  title text NOT NULL,
  date text NOT NULL,
  attendees text[] NOT NULL DEFAULT '{}',
  summary text NOT NULL,
  agreements text[] NOT NULL DEFAULT '{}',
  action_items text[] NOT NULL DEFAULT '{}',
  next_meeting text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Email notifications
CREATE TABLE public.email_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  original_id text NOT NULL,
  subject text NOT NULL,
  "to" text[] NOT NULL DEFAULT '{}',
  "from" text NOT NULL,
  date text NOT NULL,
  status text NOT NULL CHECK (status IN ('enviado','pendiente','fallido')),
  type text NOT NULL CHECK (type IN ('reporte','alerta','seguimiento','minuta')),
  preview text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Comments
CREATE TABLE public.comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  original_id text NOT NULL,
  "user" text NOT NULL,
  avatar text NOT NULL,
  message text NOT NULL,
  date text NOT NULL,
  type text NOT NULL CHECK (type IN ('comentario','aprobacion','solicitud','alerta')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Risks
CREATE TABLE public.risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  original_id text NOT NULL,
  description text NOT NULL,
  impact text NOT NULL CHECK (impact IN ('alto','medio','bajo')),
  status text NOT NULL CHECK (status IN ('abierto','mitigado','cerrado')),
  mitigation text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on all tables (open access for now - no auth required)
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.client_financials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deliverables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_minutes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risks ENABLE ROW LEVEL SECURITY;

-- Open RLS policies (public dashboard - no auth)
CREATE POLICY "Allow all select" ON public.clients FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.clients FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON public.clients FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete" ON public.clients FOR DELETE USING (true);

CREATE POLICY "Allow all select" ON public.client_financials FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.client_financials FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON public.client_financials FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete" ON public.client_financials FOR DELETE USING (true);

CREATE POLICY "Allow all select" ON public.phases FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.phases FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON public.phases FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete" ON public.phases FOR DELETE USING (true);

CREATE POLICY "Allow all select" ON public.deliverables FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.deliverables FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON public.deliverables FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete" ON public.deliverables FOR DELETE USING (true);

CREATE POLICY "Allow all select" ON public.tasks FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.tasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON public.tasks FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete" ON public.tasks FOR DELETE USING (true);

CREATE POLICY "Allow all select" ON public.action_items FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.action_items FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON public.action_items FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete" ON public.action_items FOR DELETE USING (true);

CREATE POLICY "Allow all select" ON public.meeting_minutes FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.meeting_minutes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON public.meeting_minutes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete" ON public.meeting_minutes FOR DELETE USING (true);

CREATE POLICY "Allow all select" ON public.email_notifications FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.email_notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON public.email_notifications FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete" ON public.email_notifications FOR DELETE USING (true);

CREATE POLICY "Allow all select" ON public.comments FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.comments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON public.comments FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete" ON public.comments FOR DELETE USING (true);

CREATE POLICY "Allow all select" ON public.risks FOR SELECT USING (true);
CREATE POLICY "Allow all insert" ON public.risks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update" ON public.risks FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete" ON public.risks FOR DELETE USING (true);

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to all tables
CREATE TRIGGER update_clients_updated_at BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_client_financials_updated_at BEFORE UPDATE ON public.client_financials FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_phases_updated_at BEFORE UPDATE ON public.phases FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_deliverables_updated_at BEFORE UPDATE ON public.deliverables FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_tasks_updated_at BEFORE UPDATE ON public.tasks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_action_items_updated_at BEFORE UPDATE ON public.action_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_meeting_minutes_updated_at BEFORE UPDATE ON public.meeting_minutes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_email_notifications_updated_at BEFORE UPDATE ON public.email_notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON public.comments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_risks_updated_at BEFORE UPDATE ON public.risks FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
