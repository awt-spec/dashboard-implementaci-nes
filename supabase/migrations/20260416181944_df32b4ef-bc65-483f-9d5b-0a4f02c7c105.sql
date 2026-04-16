
-- 1. Add CV fields to sysde_team_members
ALTER TABLE public.sysde_team_members
  ADD COLUMN IF NOT EXISTS cv_url TEXT,
  ADD COLUMN IF NOT EXISTS cv_filename TEXT,
  ADD COLUMN IF NOT EXISTS cv_uploaded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cv_analysis JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS cv_skills TEXT[] DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS cv_years_experience INTEGER,
  ADD COLUMN IF NOT EXISTS cv_seniority TEXT,
  ADD COLUMN IF NOT EXISTS cv_recommended_clients JSONB DEFAULT '[]'::jsonb;

-- 2. Client contracts table
CREATE TABLE IF NOT EXISTS public.client_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  contract_type TEXT NOT NULL DEFAULT 'bolsa_horas',
  monthly_value NUMERIC NOT NULL DEFAULT 0,
  hourly_rate NUMERIC NOT NULL DEFAULT 0,
  included_hours INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  start_date DATE,
  end_date DATE,
  auto_renewal BOOLEAN NOT NULL DEFAULT false,
  penalty_clause TEXT,
  payment_terms TEXT DEFAULT 'mensual',
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_contracts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select on client_contracts" ON public.client_contracts FOR SELECT USING (true);
CREATE POLICY "Allow all insert on client_contracts" ON public.client_contracts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on client_contracts" ON public.client_contracts FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on client_contracts" ON public.client_contracts FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_client_contracts_client ON public.client_contracts(client_id);

CREATE TRIGGER trg_client_contracts_updated
  BEFORE UPDATE ON public.client_contracts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. Client SLAs table
CREATE TABLE IF NOT EXISTS public.client_slas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL,
  priority_level TEXT NOT NULL,
  case_type TEXT DEFAULT 'all',
  response_time_hours NUMERIC NOT NULL DEFAULT 24,
  resolution_time_hours NUMERIC NOT NULL DEFAULT 72,
  business_hours_only BOOLEAN NOT NULL DEFAULT true,
  penalty_amount NUMERIC DEFAULT 0,
  penalty_description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.client_slas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select on client_slas" ON public.client_slas FOR SELECT USING (true);
CREATE POLICY "Allow all insert on client_slas" ON public.client_slas FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all update on client_slas" ON public.client_slas FOR UPDATE USING (true);
CREATE POLICY "Allow all delete on client_slas" ON public.client_slas FOR DELETE USING (true);

CREATE INDEX IF NOT EXISTS idx_client_slas_client ON public.client_slas(client_id);

CREATE TRIGGER trg_client_slas_updated
  BEFORE UPDATE ON public.client_slas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 4. PM AI Analysis history
CREATE TABLE IF NOT EXISTS public.pm_ai_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_type TEXT NOT NULL DEFAULT 'global',
  scope TEXT,
  executive_summary TEXT,
  duration_estimate_weeks NUMERIC,
  team_health_score INTEGER,
  recommendations JSONB DEFAULT '[]'::jsonb,
  client_priorities JSONB DEFAULT '[]'::jsonb,
  risks JSONB DEFAULT '[]'::jsonb,
  metrics JSONB DEFAULT '{}'::jsonb,
  full_analysis JSONB DEFAULT '{}'::jsonb,
  model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pm_ai_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all select on pm_ai_analysis" ON public.pm_ai_analysis FOR SELECT USING (true);
CREATE POLICY "Allow all insert on pm_ai_analysis" ON public.pm_ai_analysis FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow all delete on pm_ai_analysis" ON public.pm_ai_analysis FOR DELETE USING (true);

-- 5. Storage bucket for CVs (private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('team-cvs', 'team-cvs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated can upload CVs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'team-cvs');

CREATE POLICY "Authenticated can read CVs"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'team-cvs');

CREATE POLICY "Authenticated can delete CVs"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'team-cvs');
