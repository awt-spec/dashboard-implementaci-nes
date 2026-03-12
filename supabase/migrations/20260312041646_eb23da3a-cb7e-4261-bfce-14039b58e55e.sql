
-- Task history/audit log table
CREATE TABLE public.task_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL,
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  changed_by TEXT NOT NULL DEFAULT 'Sistema',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.task_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select on task_history" ON public.task_history FOR SELECT TO public USING (true);
CREATE POLICY "Allow all insert on task_history" ON public.task_history FOR INSERT TO public WITH CHECK (true);

-- Trigger function to auto-record task changes
CREATE OR REPLACE FUNCTION public.record_task_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF OLD.title IS DISTINCT FROM NEW.title THEN
    INSERT INTO public.task_history (task_id, field_changed, old_value, new_value) VALUES (NEW.id, 'title', OLD.title, NEW.title);
  END IF;
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO public.task_history (task_id, field_changed, old_value, new_value) VALUES (NEW.id, 'status', OLD.status, NEW.status);
  END IF;
  IF OLD.priority IS DISTINCT FROM NEW.priority THEN
    INSERT INTO public.task_history (task_id, field_changed, old_value, new_value) VALUES (NEW.id, 'priority', OLD.priority, NEW.priority);
  END IF;
  IF OLD.owner IS DISTINCT FROM NEW.owner THEN
    INSERT INTO public.task_history (task_id, field_changed, old_value, new_value) VALUES (NEW.id, 'owner', OLD.owner, NEW.owner);
  END IF;
  IF OLD.due_date IS DISTINCT FROM NEW.due_date THEN
    INSERT INTO public.task_history (task_id, field_changed, old_value, new_value) VALUES (NEW.id, 'due_date', OLD.due_date, NEW.due_date);
  END IF;
  IF OLD.description IS DISTINCT FROM NEW.description THEN
    INSERT INTO public.task_history (task_id, field_changed, old_value, new_value) VALUES (NEW.id, 'description', OLD.description, NEW.description);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER task_changes_trigger
AFTER UPDATE ON public.tasks
FOR EACH ROW
EXECUTE FUNCTION public.record_task_history();
