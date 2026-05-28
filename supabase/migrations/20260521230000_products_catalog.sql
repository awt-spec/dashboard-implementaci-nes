-- ============================================================================
-- Catálogo maestro de productos/módulos/versiones — gap Tanda D (ERP-039 a 047)
-- Hoy "productos" vivían como strings en clients.modules[]. Esto crea el
-- catálogo central reutilizable del portafolio SYSDE: producto → módulos +
-- versiones, y la relación N:M de qué módulos trae cada versión.
-- ============================================================================

CREATE TABLE public.products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.product_modules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  code        text NOT NULL,
  name        text NOT NULL,
  description text,
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, code)
);

CREATE TABLE public.product_versions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id    uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  version_label text NOT NULL,
  release_date  date,
  notes         text,
  is_active     boolean NOT NULL DEFAULT true,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (product_id, version_label)
);

-- N:M qué módulos trae cada versión (ERP-047)
CREATE TABLE public.version_modules (
  version_id uuid NOT NULL REFERENCES public.product_versions(id) ON DELETE CASCADE,
  module_id  uuid NOT NULL REFERENCES public.product_modules(id) ON DELETE CASCADE,
  PRIMARY KEY (version_id, module_id)
);

CREATE INDEX idx_product_modules_product ON public.product_modules(product_id, sort_order);
CREATE INDEX idx_product_versions_product ON public.product_versions(product_id);
CREATE INDEX idx_version_modules_version ON public.version_modules(version_id);

CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Seed con productos del portafolio SYSDE ─────────────────────────────────
INSERT INTO public.products (code, name, description, sort_order) VALUES
  ('saf_plus',     'SAF+',              'Core bancario / financiero SYSDE',          10),
  ('factoraje',    'Factoraje OnCloud', 'Plataforma de factoraje',                    20),
  ('filemaster',   'FileMaster',        'Gestión documental y workflows (Gurunet)',   30),
  ('pension',      'SYSDE Pensión',     'Administración de fondos de pensión',         40),
  ('sentinel',     'Sentinel / PLD',    'Prevención de lavado de dinero',              50),
  ('leasing',      'Leasing',           'Arrendamiento financiero',                    60);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.version_modules ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier autenticado (catálogo de referencia).
-- Escritura: admin o pm.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products','product_modules','product_versions','version_modules'] LOOP
    EXECUTE format('CREATE POLICY "Authenticated reads %1$s" ON public.%1$s FOR SELECT TO authenticated USING (true);', t);
    EXECUTE format($f$CREATE POLICY "Admin or pm manages %1$s" ON public.%1$s FOR ALL
      USING (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'pm'::app_role))
      WITH CHECK (public.has_role(auth.uid(),'admin'::app_role) OR public.has_role(auth.uid(),'pm'::app_role));$f$, t);
  END LOOP;
END $$;

COMMENT ON TABLE public.products IS
  'Catálogo maestro de productos del portafolio SYSDE. Gap Tanda D (ERP-039 a 041).';
COMMENT ON TABLE public.version_modules IS
  'Relación N:M: qué módulos trae cada versión de producto. Gap ERP-047.';
