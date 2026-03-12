
CREATE TABLE public.shared_presentations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  title text NOT NULL,
  selected_slides integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  presentation_snapshot jsonb NOT NULL,
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE public.presentation_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_presentation_id uuid NOT NULL REFERENCES public.shared_presentations(id) ON DELETE CASCADE,
  service_quality text,
  overall_sentiment text,
  deliverable_ratings jsonb DEFAULT '[]',
  sysde_response_rating text,
  comments text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.shared_presentations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.presentation_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select on shared_presentations" ON public.shared_presentations FOR SELECT TO public USING (true);
CREATE POLICY "Allow all insert on shared_presentations" ON public.shared_presentations FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow all delete on shared_presentations" ON public.shared_presentations FOR DELETE TO public USING (true);

CREATE POLICY "Allow all select on presentation_feedback" ON public.presentation_feedback FOR SELECT TO public USING (true);
CREATE POLICY "Allow all insert on presentation_feedback" ON public.presentation_feedback FOR INSERT TO public WITH CHECK (true);
