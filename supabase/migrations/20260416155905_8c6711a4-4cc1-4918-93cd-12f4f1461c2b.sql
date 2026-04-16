
CREATE TABLE public.ai_usage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  function_name text NOT NULL,
  model text NOT NULL,
  prompt_tokens integer NOT NULL DEFAULT 0,
  completion_tokens integer NOT NULL DEFAULT 0,
  total_tokens integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'success',
  error_message text,
  client_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select on ai_usage_logs" ON public.ai_usage_logs FOR SELECT USING (true);
CREATE POLICY "Allow all insert on ai_usage_logs" ON public.ai_usage_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all delete on ai_usage_logs" ON public.ai_usage_logs FOR DELETE USING (true);
