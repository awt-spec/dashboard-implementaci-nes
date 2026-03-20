
-- Table for client team/contacts structure
CREATE TABLE public.client_contacts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL DEFAULT '',
  phone text DEFAULT '',
  position text NOT NULL DEFAULT '',
  department text DEFAULT '',
  role_type text NOT NULL DEFAULT 'equipo',
  is_decision_maker boolean NOT NULL DEFAULT false,
  is_primary_contact boolean NOT NULL DEFAULT false,
  notes text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- role_type: 'gerente', 'director', 'coordinador', 'equipo', 'sponsor', 'tecnico'

ALTER TABLE public.client_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select on client_contacts" ON public.client_contacts FOR SELECT USING (true);
CREATE POLICY "Allow all insert on client_contacts" ON public.client_contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on client_contacts" ON public.client_contacts FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow all delete on client_contacts" ON public.client_contacts FOR DELETE USING (true);
