-- ============================================================================
-- Cotizaciones compartibles por link externo (sin login)
-- ----------------------------------------------------------------------------
-- Replica el patrón de shared_support_presentations: una fila con token único
-- y un snapshot de la cotización (cotización + ítems + datos del cliente). El
-- público accede por /cotizacion/:token mientras no esté expirada; el snapshot
-- evita exponer la tabla quotes vía RLS.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shared_quotes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token          text NOT NULL UNIQUE DEFAULT replace(gen_random_uuid()::text, '-', ''),
  quote_id       uuid REFERENCES public.quotes(id) ON DELETE CASCADE,
  client_id      text,
  title          text NOT NULL DEFAULT 'Cotización',
  quote_snapshot jsonb NOT NULL,
  expires_at     timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_by     uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_shared_quotes_token ON public.shared_quotes(token);

ALTER TABLE public.shared_quotes ENABLE ROW LEVEL SECURITY;

-- SELECT público mientras no esté expirada (acceso por token desde la URL).
DROP POLICY IF EXISTS "Public select active shared_quotes" ON public.shared_quotes;
CREATE POLICY "Public select active shared_quotes"
  ON public.shared_quotes FOR SELECT
  USING (expires_at > now());

-- INSERT / DELETE: staff interno (no cliente).
DROP POLICY IF EXISTS "Staff insert shared_quotes" ON public.shared_quotes;
CREATE POLICY "Staff insert shared_quotes"
  ON public.shared_quotes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND NOT public.is_cliente_user());

DROP POLICY IF EXISTS "Staff delete shared_quotes" ON public.shared_quotes;
CREATE POLICY "Staff delete shared_quotes"
  ON public.shared_quotes FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND NOT public.is_cliente_user());

COMMENT ON TABLE public.shared_quotes IS
  'Links públicos de cotizaciones (token + snapshot). Acceso por /cotizacion/:token mientras no expire.';
