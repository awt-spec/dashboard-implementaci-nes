
CREATE TABLE public.gerente_client_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  client_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, client_id)
);

ALTER TABLE public.gerente_client_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assignments" ON public.gerente_client_assignments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage assignments" ON public.gerente_client_assignments FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Insert current assignments
INSERT INTO public.gerente_client_assignments (user_id, client_id) VALUES
  ('9b682208-c910-4128-831e-1ea497abdaab', 'aurum'),
  ('67deb6be-154b-437d-99f8-115d4b701489', 'arkfin'),
  ('154e6669-7bbc-4b19-b4c2-8dcf37fe9dbd', 'apex');
