-- Tracking de sesiones de usuario
CREATE TABLE IF NOT EXISTS public.user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  last_heartbeat timestamptz NOT NULL DEFAULT now(),
  user_agent text,
  duration_seconds integer GENERATED ALWAYS AS (
    EXTRACT(EPOCH FROM (COALESCE(ended_at, last_heartbeat) - started_at))::integer
  ) STORED,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user ON public.user_sessions(user_id, started_at DESC);

ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own sessions" ON public.user_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own sessions" ON public.user_sessions
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users view own sessions" ON public.user_sessions
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pm'::app_role));

-- Time tracking por work item (task o ticket)
CREATE TABLE IF NOT EXISTS public.work_time_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  source text NOT NULL CHECK (source IN ('task','ticket')),
  item_id text NOT NULL,
  client_id text,
  started_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  duration_seconds integer,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wte_user ON public.work_time_entries(user_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_wte_item ON public.work_time_entries(source, item_id);

ALTER TABLE public.work_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own time entries" ON public.work_time_entries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins/PM view all time entries" ON public.work_time_entries
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pm'::app_role));

-- Activity log: cambios y acciones del colaborador
CREATE TABLE IF NOT EXISTS public.user_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  action text NOT NULL,
  entity_type text,
  entity_id text,
  client_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ual_user ON public.user_activity_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ual_action ON public.user_activity_log(action, created_at DESC);

ALTER TABLE public.user_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users insert own activity" ON public.user_activity_log
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users view own activity" ON public.user_activity_log
  FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'pm'::app_role));