-- ─────────────────────────────────────────────────────────────────────
-- RLS hardening contra el rol "cliente".
--
-- El smoke test descubrió que un usuario con role='cliente' veía tickets
-- de otros clientes. Raíz: varias tablas tenían policies "Authenticated
-- select X" USING (auth.uid() IS NOT NULL) que incluyen al rol cliente
-- (también está autenticado).
--
-- Fix: sacar al cliente de las policies amplias y que sólo vea data
-- vía sus policies scoped (creadas en 20260423130001_cliente_role_policies).
-- ─────────────────────────────────────────────────────────────────────

-- 1. Helper: rápida verificación si el usuario actual tiene rol cliente
CREATE OR REPLACE FUNCTION public.is_cliente_user()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'cliente'
  );
$$;

-- ── support_tickets ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated select support_tickets" ON public.support_tickets;
CREATE POLICY "Staff select support_tickets"
  ON public.support_tickets FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND NOT public.is_cliente_user());

DROP POLICY IF EXISTS "Authenticated insert support_tickets" ON public.support_tickets;
CREATE POLICY "Staff insert support_tickets"
  ON public.support_tickets FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND NOT public.is_cliente_user());

DROP POLICY IF EXISTS "Authenticated update support_tickets" ON public.support_tickets;
CREATE POLICY "Staff update support_tickets"
  ON public.support_tickets FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL AND NOT public.is_cliente_user())
  WITH CHECK (auth.uid() IS NOT NULL AND NOT public.is_cliente_user());

DROP POLICY IF EXISTS "Authenticated delete support_tickets" ON public.support_tickets;
CREATE POLICY "Staff delete support_tickets"
  ON public.support_tickets FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND NOT public.is_cliente_user());

-- ── shared_support_presentations ────────────────────────────────────
DROP POLICY IF EXISTS "Authenticated select shared_support_presentations" ON public.shared_support_presentations;
CREATE POLICY "Staff select shared_support_presentations"
  ON public.shared_support_presentations FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND NOT public.is_cliente_user());

DROP POLICY IF EXISTS "Authenticated insert shared_support_presentations" ON public.shared_support_presentations;
CREATE POLICY "Staff insert shared_support_presentations"
  ON public.shared_support_presentations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND NOT public.is_cliente_user());

DROP POLICY IF EXISTS "Authenticated update shared_support_presentations" ON public.shared_support_presentations;
CREATE POLICY "Staff update shared_support_presentations"
  ON public.shared_support_presentations FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL AND NOT public.is_cliente_user())
  WITH CHECK (auth.uid() IS NOT NULL AND NOT public.is_cliente_user());

DROP POLICY IF EXISTS "Authenticated delete shared_support_presentations" ON public.shared_support_presentations;
CREATE POLICY "Staff delete shared_support_presentations"
  ON public.shared_support_presentations FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND NOT public.is_cliente_user());

-- Mantenemos SELECT público sólo por token (la página pública /shared-support/:token)
-- usa anon + token, no auth user. No está afectada por estos cambios.

-- ── support_ticket_notes ────────────────────────────────────────────
DROP POLICY IF EXISTS "Allow all select on support_ticket_notes" ON public.support_ticket_notes;
DROP POLICY IF EXISTS "Allow all insert on support_ticket_notes" ON public.support_ticket_notes;
DROP POLICY IF EXISTS "Allow all delete on support_ticket_notes" ON public.support_ticket_notes;

CREATE POLICY "Staff select support_ticket_notes"
  ON public.support_ticket_notes FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND NOT public.is_cliente_user());

CREATE POLICY "Staff insert support_ticket_notes"
  ON public.support_ticket_notes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND NOT public.is_cliente_user());

CREATE POLICY "Staff update support_ticket_notes"
  ON public.support_ticket_notes FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL AND NOT public.is_cliente_user())
  WITH CHECK (auth.uid() IS NOT NULL AND NOT public.is_cliente_user());

CREATE POLICY "Staff delete support_ticket_notes"
  ON public.support_ticket_notes FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND NOT public.is_cliente_user());

-- ── support_minutes_feedback ────────────────────────────────────────
-- La policy "public_select USING (true)" permitía lectura sin auth. Ya no.
DROP POLICY IF EXISTS "support_minutes_feedback_public_select" ON public.support_minutes_feedback;
DROP POLICY IF EXISTS "support_minutes_feedback_public_insert" ON public.support_minutes_feedback;

-- Staff lee todo
CREATE POLICY "Staff select support_minutes_feedback"
  ON public.support_minutes_feedback FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND NOT public.is_cliente_user());

-- Cualquier autenticado (incluido cliente con nuestras policies scoped) puede insert
-- pero con restricción a su propio cliente cuando es cliente (policy scoped ya existe).
-- Para staff:
CREATE POLICY "Staff insert support_minutes_feedback"
  ON public.support_minutes_feedback FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND NOT public.is_cliente_user());

-- Público sigue pudiendo insertar feedback desde la página compartida (sin auth)
-- porque la página pública no está logueada. Esa página usa anon key + token.
CREATE POLICY "Public inserts feedback via shared presentation"
  ON public.support_minutes_feedback FOR INSERT TO public
  WITH CHECK (
    shared_presentation_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.shared_support_presentations
      WHERE id = shared_presentation_id
        AND (expires_at IS NULL OR expires_at > now())
    )
  );

-- ── clients ─────────────────────────────────────────────────────────
-- Cliente sólo debe ver su propio client row (no la lista completa).
DROP POLICY IF EXISTS "Authenticated select clients" ON public.clients;
CREATE POLICY "Staff select clients"
  ON public.clients FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL AND NOT public.is_cliente_user());

CREATE POLICY "Cliente selects own client"
  ON public.clients FOR SELECT TO authenticated
  USING (
    public.is_cliente_user()
    AND id = public.get_cliente_client_id(auth.uid())
  );

-- Staff sigue pudiendo insert/update/delete clients (las policies originales
-- eran "Authenticated insert/update/delete" — las reemplazamos también)
DROP POLICY IF EXISTS "Authenticated insert clients" ON public.clients;
CREATE POLICY "Staff insert clients"
  ON public.clients FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND NOT public.is_cliente_user());

DROP POLICY IF EXISTS "Authenticated update clients" ON public.clients;
CREATE POLICY "Staff update clients"
  ON public.clients FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL AND NOT public.is_cliente_user())
  WITH CHECK (auth.uid() IS NOT NULL AND NOT public.is_cliente_user());

DROP POLICY IF EXISTS "Authenticated delete clients" ON public.clients;
CREATE POLICY "Staff delete clients"
  ON public.clients FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL AND NOT public.is_cliente_user());

-- ── meeting_minutes / tasks / phases / deliverables / action_items / comments / risks / client_financials / email_notifications / shared_presentations / support_minutes ──
-- Data interna que cliente no debe ver. Simplemente excluimos cliente de las SELECT amplias.
-- No modificamos INSERT/UPDATE/DELETE (cliente no tiene UI para esas tablas, pero
-- defense-in-depth: también los bloqueamos abajo).

DO $$
DECLARE
  tbls text[] := ARRAY[
    'meeting_minutes', 'tasks', 'phases', 'deliverables', 'action_items',
    'comments', 'risks', 'client_financials', 'email_notifications',
    'shared_presentations', 'support_minutes'
  ];
  tbl text;
BEGIN
  FOREACH tbl IN ARRAY tbls LOOP
    -- SELECT
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated select %s" ON public.%I', tbl, tbl);
    EXECUTE format($f$
      CREATE POLICY "Staff select %s"
        ON public.%I FOR SELECT TO authenticated
        USING (auth.uid() IS NOT NULL AND NOT public.is_cliente_user())
    $f$, tbl, tbl);

    -- INSERT (si existe)
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated insert %s" ON public.%I', tbl, tbl);
    BEGIN
      EXECUTE format($f$
        CREATE POLICY "Staff insert %s"
          ON public.%I FOR INSERT TO authenticated
          WITH CHECK (auth.uid() IS NOT NULL AND NOT public.is_cliente_user())
      $f$, tbl, tbl);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    -- UPDATE
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated update %s" ON public.%I', tbl, tbl);
    BEGIN
      EXECUTE format($f$
        CREATE POLICY "Staff update %s"
          ON public.%I FOR UPDATE TO authenticated
          USING (auth.uid() IS NOT NULL AND NOT public.is_cliente_user())
          WITH CHECK (auth.uid() IS NOT NULL AND NOT public.is_cliente_user())
      $f$, tbl, tbl);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;

    -- DELETE
    EXECUTE format('DROP POLICY IF EXISTS "Authenticated delete %s" ON public.%I', tbl, tbl);
    BEGIN
      EXECUTE format($f$
        CREATE POLICY "Staff delete %s"
          ON public.%I FOR DELETE TO authenticated
          USING (auth.uid() IS NOT NULL AND NOT public.is_cliente_user())
      $f$, tbl, tbl);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

COMMENT ON FUNCTION public.is_cliente_user() IS
  'Retorna true si el usuario actual (auth.uid()) tiene rol cliente. Usado en policies RLS para excluirlo de las vistas internas.';
