
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS case_agreements text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS case_actions text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.shared_support_presentations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  title text NOT NULL,
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(24), 'hex'),
  selected_slides integer[] NOT NULL DEFAULT '{0,1,2,3,4,5,6}',
  presentation_snapshot jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

ALTER TABLE public.shared_support_presentations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select on shared_support_presentations" ON public.shared_support_presentations FOR SELECT TO public USING (true);
CREATE POLICY "Allow all insert on shared_support_presentations" ON public.shared_support_presentations FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow all delete on shared_support_presentations" ON public.shared_support_presentations FOR DELETE TO public USING (true);

CREATE TABLE IF NOT EXISTS public.support_presentation_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_presentation_id uuid NOT NULL REFERENCES public.shared_support_presentations(id) ON DELETE CASCADE,
  overall_sentiment text,
  service_quality text,
  comments text,
  deliverable_ratings jsonb DEFAULT '[]',
  priority_rankings jsonb DEFAULT '[]',
  media_urls jsonb DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.support_presentation_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all insert on support_presentation_feedback" ON public.support_presentation_feedback FOR INSERT TO public WITH CHECK (true);
CREATE POLICY "Allow all select on support_presentation_feedback" ON public.support_presentation_feedback FOR SELECT TO public USING (true);
