
-- Subtasks for support tickets
CREATE TABLE public.support_ticket_subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_ticket_subtasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all select on support_ticket_subtasks" ON public.support_ticket_subtasks FOR SELECT USING (true);
CREATE POLICY "Allow all insert on support_ticket_subtasks" ON public.support_ticket_subtasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on support_ticket_subtasks" ON public.support_ticket_subtasks FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on support_ticket_subtasks" ON public.support_ticket_subtasks FOR DELETE USING (true);

-- Tags for support tickets
CREATE TABLE public.support_ticket_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  tag text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_ticket_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all select on support_ticket_tags" ON public.support_ticket_tags FOR SELECT USING (true);
CREATE POLICY "Allow all insert on support_ticket_tags" ON public.support_ticket_tags FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all delete on support_ticket_tags" ON public.support_ticket_tags FOR DELETE USING (true);

-- Attachments for support tickets
CREATE TABLE public.support_ticket_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer DEFAULT 0,
  mime_type text DEFAULT 'application/octet-stream',
  uploaded_by text NOT NULL DEFAULT 'Sistema',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_ticket_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all select on support_ticket_attachments" ON public.support_ticket_attachments FOR SELECT USING (true);
CREATE POLICY "Allow all insert on support_ticket_attachments" ON public.support_ticket_attachments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all delete on support_ticket_attachments" ON public.support_ticket_attachments FOR DELETE USING (true);

-- Notes/comments for support tickets
CREATE TABLE public.support_ticket_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  message text NOT NULL,
  author text NOT NULL DEFAULT 'Sistema',
  visibility text NOT NULL DEFAULT 'interna',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_ticket_notes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all select on support_ticket_notes" ON public.support_ticket_notes FOR SELECT USING (true);
CREATE POLICY "Allow all insert on support_ticket_notes" ON public.support_ticket_notes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all delete on support_ticket_notes" ON public.support_ticket_notes FOR DELETE USING (true);

-- Dependencies between support tickets
CREATE TABLE public.support_ticket_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  depends_on_ticket_id uuid NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  dependency_type text NOT NULL DEFAULT 'blocks',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.support_ticket_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all select on support_ticket_dependencies" ON public.support_ticket_dependencies FOR SELECT USING (true);
CREATE POLICY "Allow all insert on support_ticket_dependencies" ON public.support_ticket_dependencies FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all delete on support_ticket_dependencies" ON public.support_ticket_dependencies FOR DELETE USING (true);

-- Add visibility to support_tickets
ALTER TABLE public.support_tickets ADD COLUMN IF NOT EXISTS visibility text NOT NULL DEFAULT 'externa';

-- Storage bucket for support ticket attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('support-ticket-attachments', 'support-ticket-attachments', true) ON CONFLICT DO NOTHING;
CREATE POLICY "Allow all select on support-ticket-attachments" ON storage.objects FOR SELECT USING (bucket_id = 'support-ticket-attachments');
CREATE POLICY "Allow all insert on support-ticket-attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'support-ticket-attachments');
CREATE POLICY "Allow all delete on support-ticket-attachments" ON storage.objects FOR DELETE USING (bucket_id = 'support-ticket-attachments');
