-- ============================================================================
-- Tabla para compartir el historial de un caso de soporte con el cliente
-- vía link público con token único (patrón similar a shared_support_presentations).
--
-- Incluye un snapshot congelado del historial para no depender de las RLS
-- restrictivas de ticket_access_log / support_ticket_notes al consumir el link
-- sin sesión.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.shared_ticket_history (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id              UUID REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  token                  TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  title                  TEXT NOT NULL,
  client_name            TEXT,
  include_internal_notes BOOLEAN NOT NULL DEFAULT false,
  include_system_views   BOOLEAN NOT NULL DEFAULT false,
  history_snapshot       JSONB NOT NULL,
  ticket_snapshot        JSONB NOT NULL,
  view_count             INTEGER NOT NULL DEFAULT 0,
  last_viewed_at         TIMESTAMPTZ,
  expires_at             TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by             UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_shared_ticket_history_token
  ON public.shared_ticket_history (token);

CREATE INDEX IF NOT EXISTS idx_shared_ticket_history_ticket
  ON public.shared_ticket_history (ticket_id, created_at DESC);

ALTER TABLE public.shared_ticket_history ENABLE ROW LEVEL SECURITY;

-- Cualquiera con el token puede LEER el registro — el token cumple el rol de
-- secreto suficiente. La expiración se valida en el cliente y en el filtro.
DROP POLICY IF EXISTS "shared_ticket_history_public_select" ON public.shared_ticket_history;
CREATE POLICY "shared_ticket_history_public_select"
  ON public.shared_ticket_history
  FOR SELECT TO public
  USING (expires_at > now());

-- Solo usuarios autenticados pueden crear links de compartir.
DROP POLICY IF EXISTS "shared_ticket_history_authenticated_insert" ON public.shared_ticket_history;
CREATE POLICY "shared_ticket_history_authenticated_insert"
  ON public.shared_ticket_history
  FOR INSERT TO authenticated
  WITH CHECK (true);

-- Solo el creador o admins/pm/gerentes pueden borrar/invalidar.
-- Usa el helper public.has_role() ya definido en migración 20260320221601.
DROP POLICY IF EXISTS "shared_ticket_history_creator_delete" ON public.shared_ticket_history;
CREATE POLICY "shared_ticket_history_creator_delete"
  ON public.shared_ticket_history
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'pm'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente'::public.app_role)
  );

-- Incremento de view_count permitido a público (ÚNICAMENTE de los campos
-- view_count y last_viewed_at — PostgREST obliga a WITH CHECK a nivel RLS,
-- pero no puede restringir qué columnas se actualizan; para eso se usa una
-- función helper).
CREATE OR REPLACE FUNCTION public.bump_shared_ticket_history_view(p_token TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.shared_ticket_history
     SET view_count = view_count + 1,
         last_viewed_at = now()
   WHERE token = p_token
     AND expires_at > now();
END;
$$;

REVOKE ALL ON FUNCTION public.bump_shared_ticket_history_view(TEXT) FROM public;
GRANT EXECUTE ON FUNCTION public.bump_shared_ticket_history_view(TEXT) TO anon, authenticated;

COMMENT ON TABLE public.shared_ticket_history IS
  'Links públicos (con token) para compartir el historial de un caso con el cliente. '
  'Guarda un snapshot para no depender del RLS de ticket_access_log.';

COMMENT ON COLUMN public.shared_ticket_history.history_snapshot IS
  'Array JSON con los eventos del timeline al momento de compartir. '
  'Estructura espejo del tipo TicketHistoryEvent en el frontend.';

COMMENT ON COLUMN public.shared_ticket_history.include_internal_notes IS
  'Si false, el snapshot excluye notas con visibility=interna al ser generado.';

COMMENT ON COLUMN public.shared_ticket_history.include_system_views IS
  'Si false, el snapshot excluye eventos "view" (ruido para el cliente).';
