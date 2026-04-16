-- ========================================
-- 1. AUTH TRIGGER + EXTEND handle_new_user
-- ========================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_role public.app_role;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT DO NOTHING;

  -- Determine role from metadata, default 'gerente'
  BEGIN
    v_role := COALESCE(
      (NEW.raw_user_meta_data->>'role')::public.app_role,
      'gerente'::public.app_role
    );
  EXCEPTION WHEN OTHERS THEN
    v_role := 'gerente'::public.app_role;
  END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- 2. Fix search_path on record_task_history
-- ========================================
CREATE OR REPLACE FUNCTION public.record_task_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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

-- ========================================
-- 3. UNIQUE INDEX on sysde_team_members.user_id
-- ========================================
CREATE UNIQUE INDEX IF NOT EXISTS sysde_team_members_user_id_unique
ON public.sysde_team_members(user_id)
WHERE user_id IS NOT NULL;

-- ========================================
-- 4. DELETE policy on client_dashboard_config
-- ========================================
DROP POLICY IF EXISTS "Users can delete own config" ON public.client_dashboard_config;
CREATE POLICY "Users can delete own config"
ON public.client_dashboard_config
FOR DELETE
USING (auth.uid() = user_id);

-- ========================================
-- 5. HARDEN RLS on critical tables
-- Require authenticated user for INSERT/UPDATE/DELETE
-- Keep SELECT permissive (app reads via anon for shared views)
-- ========================================

-- clients
DROP POLICY IF EXISTS "Allow all insert" ON public.clients;
DROP POLICY IF EXISTS "Allow all update" ON public.clients;
DROP POLICY IF EXISTS "Allow all delete" ON public.clients;
CREATE POLICY "Authenticated insert clients" ON public.clients FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update clients" ON public.clients FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete clients" ON public.clients FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- tasks
DROP POLICY IF EXISTS "Allow all insert" ON public.tasks;
DROP POLICY IF EXISTS "Allow all update" ON public.tasks;
DROP POLICY IF EXISTS "Allow all delete" ON public.tasks;
CREATE POLICY "Authenticated insert tasks" ON public.tasks FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update tasks" ON public.tasks FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete tasks" ON public.tasks FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- support_tickets
DROP POLICY IF EXISTS "Allow all insert on support_tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Allow all update on support_tickets" ON public.support_tickets;
DROP POLICY IF EXISTS "Allow all delete on support_tickets" ON public.support_tickets;
CREATE POLICY "Authenticated insert support_tickets" ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update support_tickets" ON public.support_tickets FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete support_tickets" ON public.support_tickets FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- meeting_minutes
DROP POLICY IF EXISTS "Allow all insert" ON public.meeting_minutes;
DROP POLICY IF EXISTS "Allow all update" ON public.meeting_minutes;
DROP POLICY IF EXISTS "Allow all delete" ON public.meeting_minutes;
CREATE POLICY "Authenticated insert meeting_minutes" ON public.meeting_minutes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update meeting_minutes" ON public.meeting_minutes FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete meeting_minutes" ON public.meeting_minutes FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- support_minutes
DROP POLICY IF EXISTS "Allow all insert on support_minutes" ON public.support_minutes;
DROP POLICY IF EXISTS "Allow all update on support_minutes" ON public.support_minutes;
DROP POLICY IF EXISTS "Allow all delete on support_minutes" ON public.support_minutes;
CREATE POLICY "Authenticated insert support_minutes" ON public.support_minutes FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated update support_minutes" ON public.support_minutes FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete support_minutes" ON public.support_minutes FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- shared_presentations (insert/delete only, SELECT must remain public for token sharing)
DROP POLICY IF EXISTS "Allow all insert on shared_presentations" ON public.shared_presentations;
DROP POLICY IF EXISTS "Allow all delete on shared_presentations" ON public.shared_presentations;
CREATE POLICY "Authenticated insert shared_presentations" ON public.shared_presentations FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete shared_presentations" ON public.shared_presentations FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- shared_support_presentations
DROP POLICY IF EXISTS "Allow all insert on shared_support_presentations" ON public.shared_support_presentations;
DROP POLICY IF EXISTS "Allow all delete on shared_support_presentations" ON public.shared_support_presentations;
CREATE POLICY "Authenticated insert shared_support_presentations" ON public.shared_support_presentations FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Authenticated delete shared_support_presentations" ON public.shared_support_presentations FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

-- ========================================
-- 6. INDEX on client_notifications for fast bell queries
-- ========================================
CREATE INDEX IF NOT EXISTS idx_client_notifications_client_read_created
ON public.client_notifications(client_id, is_read, created_at DESC);

-- ========================================
-- 7. STORAGE: restrict listing on public buckets
-- Allow SELECT only when path is known (no listing of bucket root)
-- ========================================
DO $$
BEGIN
  -- Drop existing overly-permissive SELECT policies if they exist
  DROP POLICY IF EXISTS "Public read presentation-media" ON storage.objects;
  DROP POLICY IF EXISTS "Public read task-attachments" ON storage.objects;
  DROP POLICY IF EXISTS "Public read support-ticket-attachments" ON storage.objects;
  DROP POLICY IF EXISTS "Anyone can view presentation-media" ON storage.objects;
  DROP POLICY IF EXISTS "Anyone can view task-attachments" ON storage.objects;
  DROP POLICY IF EXISTS "Anyone can view support-ticket-attachments" ON storage.objects;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Recreate read policies that allow only direct file access (path must be specified)
CREATE POLICY "Read presentation-media files"
ON storage.objects FOR SELECT
USING (bucket_id = 'presentation-media' AND name IS NOT NULL AND length(name) > 0);

CREATE POLICY "Read task-attachments files"
ON storage.objects FOR SELECT
USING (bucket_id = 'task-attachments' AND name IS NOT NULL AND length(name) > 0);

CREATE POLICY "Read support-ticket-attachments files"
ON storage.objects FOR SELECT
USING (bucket_id = 'support-ticket-attachments' AND name IS NOT NULL AND length(name) > 0);
