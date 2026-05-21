-- ============================================================================
-- Catálogo de motivos de reapertura / incidencia — gap P3 (ERP-052 a 054)
-- Reemplaza el enum hardcoded de ReopenReasonDialog por una tabla administrable.
-- Decisión: NO agregar FK desde support_ticket_reopens.reopen_type al catálogo —
-- esto permite que se desactiven motivos sin perder datos históricos. El campo
-- queda como text libre validado contra el catálogo solo en la UI.
-- ============================================================================

CREATE TABLE public.reopen_reasons (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  name        text NOT NULL,
  hint        text,
  severity    text NOT NULL DEFAULT 'media'
              CHECK (severity IN ('alta','media','baja','neutra')),
  is_active   boolean NOT NULL DEFAULT true,
  sort_order  int NOT NULL DEFAULT 0,
  is_system   boolean NOT NULL DEFAULT false,  -- true para motivos que no pueden eliminarse
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reopen_reasons_active_sort
  ON public.reopen_reasons(is_active, sort_order);

CREATE TRIGGER set_reopen_reasons_updated_at
  BEFORE UPDATE ON public.reopen_reasons
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at();

-- ── Seed con los motivos que existían como enum hardcoded ───────────────────
INSERT INTO public.reopen_reasons (code, name, hint, severity, sort_order, is_system) VALUES
  ('cliente_rechazo',
   'Cliente rechazó la entrega',
   'Inconformidad real del cliente — el caso volvió por su pedido',
   'alta', 10, true),
  ('qa_falla',
   'Falla detectada por QA / soporte',
   'Lo encontramos nosotros antes/después del cierre — falla del entregable',
   'alta', 20, true),
  ('solicitud_relacionada',
   'Caso relacionado, no es la misma falla',
   'Cliente reabrió por algo relacionado pero no por la misma falla',
   'media', 30, true),
  ('otro',
   'Otro motivo',
   'Solo si nada de lo anterior aplica — explicá en el motivo',
   'neutra', 90, true),
  ('historico',
   'Histórico (migrado)',
   'Datos importados de antes del módulo de reaperturas — no usar para casos nuevos',
   'neutra', 100, true);

-- ── Quitar el CHECK constraint del enum en support_ticket_reopens ──────────
-- Para que se acepten códigos del catálogo sin tener que migrar el constraint
-- cada vez que se agrega un motivo nuevo. La validación pasa a hacerse en la UI
-- contra reopen_reasons.is_active=true.
ALTER TABLE public.support_ticket_reopens
  DROP CONSTRAINT IF EXISTS support_ticket_reopens_reopen_type_check;

-- ── RLS ──────────────────────────────────────────────────────────────────
ALTER TABLE public.reopen_reasons ENABLE ROW LEVEL SECURITY;

-- SELECT: cualquier usuario autenticado puede leer (necesario para que la UI
-- muestre los nombres legibles al ver el historial de reaperturas).
CREATE POLICY "Authenticated reads reopen_reasons"
  ON public.reopen_reasons FOR SELECT
  TO authenticated
  USING (true);

-- INSERT / UPDATE / DELETE: solo admin.
CREATE POLICY "Admin manages reopen_reasons"
  ON public.reopen_reasons FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Protección extra: motivos is_system=true no pueden eliminarse, solo desactivarse
CREATE OR REPLACE FUNCTION public.prevent_system_reason_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.is_system = true THEN
    RAISE EXCEPTION 'No se puede eliminar el motivo del sistema "%". Desactivalo con is_active=false en su lugar.', OLD.code;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER prevent_system_reason_delete
  BEFORE DELETE ON public.reopen_reasons
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_system_reason_delete();

COMMENT ON TABLE public.reopen_reasons IS
  'Catálogo de motivos de reapertura/incidencia. Reemplaza el enum hardcoded. Gap P3 (ERP-052 a 054).';
COMMENT ON COLUMN public.reopen_reasons.code IS
  'Identificador estable usado en support_ticket_reopens.reopen_type. No FK para preservar historia si se desactiva un motivo.';
COMMENT ON COLUMN public.reopen_reasons.is_system IS
  'true para motivos seed que no pueden eliminarse (solo desactivarse). Garantiza backward compat.';
