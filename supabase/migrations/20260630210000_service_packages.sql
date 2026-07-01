-- ============================================================================
-- Paquetes de servicio (pólizas) — para el Estado de Cuenta estilo SYSDE.
-- Cada póliza tiene paquetes con horas contratadas y un período de vigencia.
-- El consumo se calcula desde work_time_entries por período. Estado = Activo /
-- Vencido según end_date vs hoy.
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.service_packages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       text NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  policy_number   integer NOT NULL,
  package_number  integer NOT NULL,
  product         text,
  hours_contracted numeric NOT NULL DEFAULT 0,
  start_date      date NOT NULL,
  end_date        date NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_packages_client ON public.service_packages(client_id);
ALTER TABLE public.service_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Read service_packages" ON public.service_packages;
CREATE POLICY "Read service_packages" ON public.service_packages FOR SELECT TO authenticated
  USING (public.is_staff_user() OR public.user_can_see_client(client_id));
DROP POLICY IF EXISTS "Admin pm manage service_packages" ON public.service_packages;
CREATE POLICY "Admin pm manage service_packages" ON public.service_packages FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'pm'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'pm'::app_role));
COMMENT ON TABLE public.service_packages IS 'Paquetes de servicio (pólizas) con horas y vigencia. Estado de cuenta estilo SYSDE.';
