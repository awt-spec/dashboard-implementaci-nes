CREATE TABLE public.support_minutes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  title text NOT NULL,
  date text NOT NULL,
  summary text NOT NULL DEFAULT '',
  cases_referenced text[] NOT NULL DEFAULT '{}',
  action_items text[] NOT NULL DEFAULT '{}',
  agreements text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_minutes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select on support_minutes" ON public.support_minutes FOR SELECT TO public USING (true);
CREATE POLICY "Allow all insert on support_minutes" ON public.support_minutes FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow all update on support_minutes" ON public.support_minutes FOR UPDATE TO public USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete on support_minutes" ON public.support_minutes FOR DELETE TO public USING (true);