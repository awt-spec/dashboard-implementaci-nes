
-- Task subtasks/checklist
CREATE TABLE public.task_subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.task_subtasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all select on task_subtasks" ON public.task_subtasks FOR SELECT USING (true);
CREATE POLICY "Allow all insert on task_subtasks" ON public.task_subtasks FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on task_subtasks" ON public.task_subtasks FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete on task_subtasks" ON public.task_subtasks FOR DELETE USING (true);

-- Task dependencies
CREATE TABLE public.task_dependencies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  depends_on_task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  dependency_type text NOT NULL DEFAULT 'blocks', -- 'blocks' or 'related'
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, depends_on_task_id)
);
ALTER TABLE public.task_dependencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all select on task_dependencies" ON public.task_dependencies FOR SELECT USING (true);
CREATE POLICY "Allow all insert on task_dependencies" ON public.task_dependencies FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all delete on task_dependencies" ON public.task_dependencies FOR DELETE USING (true);

-- Task tags
CREATE TABLE public.task_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  tag text NOT NULL,
  color text NOT NULL DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(task_id, tag)
);
ALTER TABLE public.task_tags ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all select on task_tags" ON public.task_tags FOR SELECT USING (true);
CREATE POLICY "Allow all insert on task_tags" ON public.task_tags FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all delete on task_tags" ON public.task_tags FOR DELETE USING (true);

-- Task attachments
CREATE TABLE public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_size integer DEFAULT 0,
  mime_type text DEFAULT 'application/octet-stream',
  uploaded_by text NOT NULL DEFAULT 'Sistema',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all select on task_attachments" ON public.task_attachments FOR SELECT USING (true);
CREATE POLICY "Allow all insert on task_attachments" ON public.task_attachments FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all delete on task_attachments" ON public.task_attachments FOR DELETE USING (true);

-- Storage bucket for task attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('task-attachments', 'task-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for task-attachments bucket
CREATE POLICY "Allow public read on task-attachments" ON storage.objects FOR SELECT USING (bucket_id = 'task-attachments');
CREATE POLICY "Allow public upload on task-attachments" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'task-attachments');
CREATE POLICY "Allow public delete on task-attachments" ON storage.objects FOR DELETE USING (bucket_id = 'task-attachments');
