
-- Communication threads table
CREATE TABLE public.communication_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  subject text NOT NULL,
  linked_task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  linked_deliverable_id uuid REFERENCES public.deliverables(id) ON DELETE SET NULL,
  linked_thread_id uuid REFERENCES public.communication_threads(id) ON DELETE SET NULL,
  category text NOT NULL DEFAULT 'general',
  status text NOT NULL DEFAULT 'abierto',
  created_by text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Thread messages table
CREATE TABLE public.thread_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.communication_threads(id) ON DELETE CASCADE,
  user_name text NOT NULL,
  user_avatar text NOT NULL DEFAULT '',
  message text NOT NULL,
  message_type text NOT NULL DEFAULT 'comentario',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE public.communication_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select on communication_threads" ON public.communication_threads FOR SELECT TO public USING (true);
CREATE POLICY "Allow all insert on communication_threads" ON public.communication_threads FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow all update on communication_threads" ON public.communication_threads FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete on communication_threads" ON public.communication_threads FOR DELETE TO public USING (true);

CREATE POLICY "Allow all select on thread_messages" ON public.thread_messages FOR SELECT TO public USING (true);
CREATE POLICY "Allow all insert on thread_messages" ON public.thread_messages FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow all delete on thread_messages" ON public.thread_messages FOR DELETE TO public USING (true);
