
-- Table for SYSDE team members (internal staff available for assignment)
CREATE TABLE public.sysde_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text DEFAULT '',
  role text DEFAULT 'consultor',
  department text DEFAULT 'soporte',
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sysde_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select on sysde_team_members" ON public.sysde_team_members FOR SELECT USING (true);
CREATE POLICY "Allow all insert on sysde_team_members" ON public.sysde_team_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on sysde_team_members" ON public.sysde_team_members FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on sysde_team_members" ON public.sysde_team_members FOR DELETE USING (true);

-- Table for client-specific contacts/team (client-side people assignable)
CREATE TABLE public.client_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  name text NOT NULL,
  email text DEFAULT '',
  role text DEFAULT 'contacto',
  department text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.client_team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select on client_team_members" ON public.client_team_members FOR SELECT USING (true);
CREATE POLICY "Allow all insert on client_team_members" ON public.client_team_members FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on client_team_members" ON public.client_team_members FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on client_team_members" ON public.client_team_members FOR DELETE USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_sysde_team_members_updated_at BEFORE UPDATE ON public.sysde_team_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_client_team_members_updated_at BEFORE UPDATE ON public.client_team_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
