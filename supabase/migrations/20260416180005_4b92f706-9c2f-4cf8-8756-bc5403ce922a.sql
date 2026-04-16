-- Connections per client
CREATE TABLE public.devops_connections (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id text NOT NULL UNIQUE,
  organization text NOT NULL,
  project text NOT NULL,
  team text DEFAULT '',
  default_work_item_type text NOT NULL DEFAULT 'Task',
  state_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  priority_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  auto_sync boolean NOT NULL DEFAULT false,
  sync_interval_minutes integer NOT NULL DEFAULT 15,
  last_sync_at timestamp with time zone,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.devops_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select on devops_connections" ON public.devops_connections FOR SELECT USING (true);
CREATE POLICY "Allow all insert on devops_connections" ON public.devops_connections FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on devops_connections" ON public.devops_connections FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete on devops_connections" ON public.devops_connections FOR DELETE USING (true);

CREATE TRIGGER devops_connections_updated_at
BEFORE UPDATE ON public.devops_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Sync mappings (ticket <-> work item, sprint <-> iteration)
CREATE TABLE public.devops_sync_mappings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id text NOT NULL,
  entity_type text NOT NULL CHECK (entity_type IN ('ticket','sprint')),
  local_id text NOT NULL,
  devops_id text NOT NULL,
  devops_url text,
  devops_rev integer DEFAULT 0,
  last_synced_at timestamp with time zone NOT NULL DEFAULT now(),
  last_direction text DEFAULT 'pull' CHECK (last_direction IN ('pull','push')),
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (client_id, entity_type, local_id),
  UNIQUE (client_id, entity_type, devops_id)
);

ALTER TABLE public.devops_sync_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select on devops_sync_mappings" ON public.devops_sync_mappings FOR SELECT USING (true);
CREATE POLICY "Allow all insert on devops_sync_mappings" ON public.devops_sync_mappings FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on devops_sync_mappings" ON public.devops_sync_mappings FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete on devops_sync_mappings" ON public.devops_sync_mappings FOR DELETE USING (true);

CREATE INDEX idx_devops_mappings_client ON public.devops_sync_mappings(client_id);
CREATE INDEX idx_devops_mappings_local ON public.devops_sync_mappings(client_id, entity_type, local_id);

-- Sync logs
CREATE TABLE public.devops_sync_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('pull','push','bidirectional')),
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success','partial','error')),
  items_pulled integer NOT NULL DEFAULT 0,
  items_pushed integer NOT NULL DEFAULT 0,
  items_failed integer NOT NULL DEFAULT 0,
  duration_ms integer NOT NULL DEFAULT 0,
  error_message text,
  details jsonb DEFAULT '{}'::jsonb,
  triggered_by text DEFAULT 'manual',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.devops_sync_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select on devops_sync_logs" ON public.devops_sync_logs FOR SELECT USING (true);
CREATE POLICY "Allow all insert on devops_sync_logs" ON public.devops_sync_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all delete on devops_sync_logs" ON public.devops_sync_logs FOR DELETE USING (true);

CREATE INDEX idx_devops_logs_client_date ON public.devops_sync_logs(client_id, created_at DESC);