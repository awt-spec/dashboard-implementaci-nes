-- ============================================================================
-- Catálogo de categorías de clientes — gap Tanda A.2 (ERP-055, 056, 057)
-- Los clientes solo tenían "industry" (fintech, manufactura...). Se agrega una
-- categorización de segmento SVA administrable (Estratégico, Premium, etc.)
-- + columna opcional en clients. Patrón idéntico a task_types.
-- ============================================================================

CREATE TABLE public.client_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  description text,
  color       text NOT NULL DEFAULT '#6366f1',
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,
  is_system   boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_client_categories_active_sort ON public.client_categories(is_active, sort_order);

CREATE TRIGGER set_client_categories_updated_at
  BEFORE UPDATE ON public.client_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ── Seed con categorías de segmentación SVA ────────────────────────────────
INSERT INTO public.client_categories (code, name, description, color, sort_order, is_system) VALUES
  ('estrategico', 'Estratégico', 'Cuenta clave — máxima prioridad y atención dedicada', '#C8200F', 10, true),
  ('premium',     'Premium',     'Cliente de alto valor con SLA preferente',           '#f59e0b', 20, true),
  ('estandar',    'Estándar',    'Cliente regular con SLA base',                       '#0ea5e9', 30, true),
  ('en_riesgo',   'En riesgo',   'Relación deteriorada — requiere plan de retención',  '#ef4444', 40, true),
  ('nuevo',       'Nuevo',       'Cliente en onboarding / primeros 90 días',          '#10b981', 50, true);

-- ── Columna opcional en clients ─────────────────────────────────────────────
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.client_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_clients_category ON public.clients(category_id);

-- ── RLS ─────────────────────────────────────────────────────────────────────
ALTER TABLE public.client_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated reads client_categories"
  ON public.client_categories FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin or pm manages client_categories"
  ON public.client_categories FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'pm'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'pm'::app_role));

-- ── Protección: categorías del sistema no se eliminan ──────────────────────
CREATE OR REPLACE FUNCTION public.prevent_system_client_category_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_system = true THEN
    RAISE EXCEPTION 'No se puede eliminar la categoría del sistema "%". Desactivala con is_active=false.', OLD.code;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER prevent_system_client_category_delete
  BEFORE DELETE ON public.client_categories
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_system_client_category_delete();

COMMENT ON TABLE public.client_categories IS
  'Catálogo de categorías/segmentos de cliente administrable. Gap Tanda A.2 (ERP-055 a 057).';
