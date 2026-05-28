-- ============================================================================
-- Plantillas de pólizas de servicio + paquetes — gap Tanda C.2 (ERP-058 a 062)
-- Templates reutilizables que definen los términos de una póliza de servicio
-- (versión, alcance) con paquetes de servicios anidados. Se usan como base
-- para crear pólizas/contratos concretos por cliente.
-- ============================================================================

CREATE TABLE public.policy_templates (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  description    text,
  policy_version text NOT NULL DEFAULT 'v1',
  is_active      boolean NOT NULL DEFAULT true,
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, policy_version)
);

CREATE INDEX idx_policy_templates_active ON public.policy_templates(is_active);

CREATE TRIGGER set_policy_templates_updated_at
  BEFORE UPDATE ON public.policy_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Paquetes de servicios anidados en una plantilla ─────────────────────────
CREATE TABLE public.policy_template_packages (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_template_id uuid NOT NULL REFERENCES public.policy_templates(id) ON DELETE CASCADE,
  name               text NOT NULL,
  description        text,
  included_hours     integer NOT NULL DEFAULT 0,
  price              numeric(12,2) NOT NULL DEFAULT 0,
  currency           text NOT NULL DEFAULT 'USD' CHECK (currency IN ('USD','CRC','EUR','MXN','GTQ')),
  billing_cycle      text NOT NULL DEFAULT 'mensual' CHECK (billing_cycle IN ('mensual','trimestral','anual','unico')),
  sort_order         int NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_policy_template_packages_template ON public.policy_template_packages(policy_template_id, sort_order);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.policy_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.policy_template_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff reads policy_templates" ON public.policy_templates FOR SELECT USING (public.is_staff_user());
CREATE POLICY "Admin or pm manages policy_templates" ON public.policy_templates FOR ALL
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'pm'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'pm'::app_role));

CREATE POLICY "Staff reads policy_template_packages" ON public.policy_template_packages FOR SELECT USING (public.is_staff_user());
CREATE POLICY "Admin or pm manages policy_template_packages" ON public.policy_template_packages FOR ALL
  USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'pm'::app_role))
  WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'pm'::app_role));

COMMENT ON TABLE public.policy_templates IS
  'Plantillas reutilizables de pólizas de servicio. Gap Tanda C.2 (ERP-058 a 060).';
COMMENT ON TABLE public.policy_template_packages IS
  'Paquetes de servicios anidados en una plantilla de póliza. Gap ERP-061 a 062.';
