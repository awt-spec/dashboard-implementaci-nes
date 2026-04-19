
-- Nuevas columnas en work_time_entries
ALTER TABLE public.work_time_entries
  ADD COLUMN IF NOT EXISTS category text DEFAULT 'desarrollo',
  ADD COLUMN IF NOT EXISTS mood smallint,
  ADD COLUMN IF NOT EXISTS productivity_score smallint,
  ADD COLUMN IF NOT EXISTS is_locked boolean NOT NULL DEFAULT false;

-- Constraint check para category
ALTER TABLE public.work_time_entries
  DROP CONSTRAINT IF EXISTS work_time_entries_category_check;
ALTER TABLE public.work_time_entries
  ADD CONSTRAINT work_time_entries_category_check
  CHECK (category IN ('desarrollo','soporte','reunion','documentacion','testing','consultoria','otros'));

-- Tabla audit log
CREATE TABLE IF NOT EXISTS public.time_entry_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id uuid NOT NULL,
  changed_by uuid NOT NULL,
  changed_by_email text,
  action text NOT NULL CHECK (action IN ('created','updated','deleted','approved','rejected','locked','unlocked')),
  field_changed text,
  old_value text,
  new_value text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_time_audit_entry ON public.time_entry_audit_log(entry_id);
CREATE INDEX IF NOT EXISTS idx_time_audit_changed_by ON public.time_entry_audit_log(changed_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_time_audit_created ON public.time_entry_audit_log(created_at DESC);

ALTER TABLE public.time_entry_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins/PM view audit log" ON public.time_entry_audit_log;
CREATE POLICY "Admins/PM view audit log" ON public.time_entry_audit_log
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pm'::app_role));

DROP POLICY IF EXISTS "Authenticated insert audit log" ON public.time_entry_audit_log;
CREATE POLICY "Authenticated insert audit log" ON public.time_entry_audit_log
  FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Tabla cierres semanales
CREATE TABLE IF NOT EXISTS public.time_weekly_locks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start date NOT NULL UNIQUE,
  locked_by uuid NOT NULL,
  locked_at timestamptz NOT NULL DEFAULT now(),
  notes text
);

ALTER TABLE public.time_weekly_locks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view locks" ON public.time_weekly_locks;
CREATE POLICY "Anyone authenticated can view locks" ON public.time_weekly_locks
  FOR SELECT
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admins manage locks" ON public.time_weekly_locks;
CREATE POLICY "Admins manage locks" ON public.time_weekly_locks
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Trigger: bloquear update si is_locked=true (excepto admin/pm)
CREATE OR REPLACE FUNCTION public.prevent_locked_time_entry_edit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_locked = true AND NOT (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pm'::app_role)) THEN
    RAISE EXCEPTION 'Esta entrada está bloqueada por cierre semanal';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_locked_edit ON public.work_time_entries;
CREATE TRIGGER trg_prevent_locked_edit
  BEFORE UPDATE ON public.work_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_locked_time_entry_edit();

-- Trigger: registrar audit log automático en cambios
CREATE OR REPLACE FUNCTION public.log_time_entry_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
BEGIN
  SELECT email INTO v_email FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.time_entry_audit_log (entry_id, changed_by, changed_by_email, action, new_value, metadata)
    VALUES (NEW.id, COALESCE(auth.uid(), NEW.user_id), v_email, 'created',
            (NEW.duration_seconds/3600.0)::text || 'h',
            jsonb_build_object('source', NEW.source, 'item_id', NEW.item_id, 'work_date', NEW.work_date));
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.duration_seconds IS DISTINCT FROM NEW.duration_seconds THEN
      INSERT INTO public.time_entry_audit_log (entry_id, changed_by, changed_by_email, action, field_changed, old_value, new_value)
      VALUES (NEW.id, COALESCE(auth.uid(), NEW.user_id), v_email, 'updated', 'duration',
              ((OLD.duration_seconds/3600.0)::text || 'h'),
              ((NEW.duration_seconds/3600.0)::text || 'h'));
    END IF;
    IF OLD.approval_status IS DISTINCT FROM NEW.approval_status THEN
      INSERT INTO public.time_entry_audit_log (entry_id, changed_by, changed_by_email, action, field_changed, old_value, new_value)
      VALUES (NEW.id, COALESCE(auth.uid(), NEW.user_id), v_email,
              CASE NEW.approval_status WHEN 'approved' THEN 'approved' WHEN 'rejected' THEN 'rejected' ELSE 'updated' END,
              'approval_status', OLD.approval_status, NEW.approval_status);
    END IF;
    IF OLD.is_locked IS DISTINCT FROM NEW.is_locked THEN
      INSERT INTO public.time_entry_audit_log (entry_id, changed_by, changed_by_email, action, field_changed, old_value, new_value)
      VALUES (NEW.id, COALESCE(auth.uid(), NEW.user_id), v_email,
              CASE NEW.is_locked WHEN true THEN 'locked' ELSE 'unlocked' END,
              'is_locked', OLD.is_locked::text, NEW.is_locked::text);
    END IF;
    IF OLD.description IS DISTINCT FROM NEW.description THEN
      INSERT INTO public.time_entry_audit_log (entry_id, changed_by, changed_by_email, action, field_changed, old_value, new_value)
      VALUES (NEW.id, COALESCE(auth.uid(), NEW.user_id), v_email, 'updated', 'description', OLD.description, NEW.description);
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.time_entry_audit_log (entry_id, changed_by, changed_by_email, action, old_value, metadata)
    VALUES (OLD.id, COALESCE(auth.uid(), OLD.user_id), v_email, 'deleted',
            (OLD.duration_seconds/3600.0)::text || 'h',
            jsonb_build_object('source', OLD.source, 'item_id', OLD.item_id, 'work_date', OLD.work_date));
    RETURN OLD;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_time_changes ON public.work_time_entries;
CREATE TRIGGER trg_log_time_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.work_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION public.log_time_entry_changes();
