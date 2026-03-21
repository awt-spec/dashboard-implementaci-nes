CREATE TABLE public.presentation_data (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  data_key text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(client_id, data_key)
);

ALTER TABLE public.presentation_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select on presentation_data" ON public.presentation_data FOR SELECT USING (true);
CREATE POLICY "Allow all insert on presentation_data" ON public.presentation_data FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on presentation_data" ON public.presentation_data FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete on presentation_data" ON public.presentation_data FOR DELETE USING (true);

CREATE TRIGGER update_presentation_data_updated_at BEFORE UPDATE ON public.presentation_data FOR EACH ROW EXECUTE FUNCTION update_updated_at();