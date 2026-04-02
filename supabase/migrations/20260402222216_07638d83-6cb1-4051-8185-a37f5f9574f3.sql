
-- Add visibility flag to meeting minutes
ALTER TABLE public.meeting_minutes ADD COLUMN visible_to_client boolean NOT NULL DEFAULT false;

-- Dashboard widget config per user
CREATE TABLE public.client_dashboard_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  widgets jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

ALTER TABLE public.client_dashboard_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own config" ON public.client_dashboard_config FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own config" ON public.client_dashboard_config FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own config" ON public.client_dashboard_config FOR UPDATE USING (auth.uid() = user_id);

-- Client notifications
CREATE TABLE public.client_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all select on client_notifications" ON public.client_notifications FOR SELECT USING (true);
CREATE POLICY "Authenticated can insert notifications" ON public.client_notifications FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update on client_notifications" ON public.client_notifications FOR UPDATE USING (true);
