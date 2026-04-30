-- ════════════════════════════════════════════════════════════════════════════
-- SISTEMA DE REINCIDENCIAS / INCONFORMIDADES
--
-- Pedido COO María Fernanda: rastrear cuando un ticket entregado vuelve por
-- inconformidad del cliente. "Cara cliente: EN ATENCIÓN. Cara interna: 3era
-- reincidencia". Reemplaza el Excel de inconformidades.
--
-- Cuenta reincidencia cuando: estado pasa de ENTREGADA o APROBADA → activo
-- (EN ATENCIÓN, PENDIENTE, VALORACIÓN, COTIZADA, POR CERRAR).
--
-- Backfill best-effort desde ticket_access_log para no perder histórico.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1. COLUMNAS NUEVAS EN support_tickets ────────────────────────────────
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS reopen_count       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reopen_at     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_reopen_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_support_tickets_reopen_count
  ON public.support_tickets(reopen_count)
  WHERE reopen_count > 0;

-- ─── 2. TABLA support_ticket_reopens ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.support_ticket_reopens (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id                UUID NOT NULL REFERENCES public.support_tickets(id) ON DELETE CASCADE,
  iteration_number         INTEGER NOT NULL,
  reopened_from_state      TEXT NOT NULL,
  reopened_to_state        TEXT NOT NULL,
  reason                   TEXT NOT NULL,
  reopen_type              TEXT NOT NULL DEFAULT 'cliente_rechazo'
    CHECK (reopen_type IN ('cliente_rechazo','qa_falla','solicitud_relacionada','otro','historico')),
  responsible_at_reopen    TEXT,
  new_responsible          TEXT,
  triggered_by_user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  triggered_by_name        TEXT,
  delivered_at             TIMESTAMPTZ,
  reopened_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at              TIMESTAMPTZ,
  metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_reopens_ticket
  ON public.support_ticket_reopens(ticket_id, iteration_number DESC);
CREATE INDEX IF NOT EXISTS idx_reopens_responsible
  ON public.support_ticket_reopens(responsible_at_reopen);
CREATE INDEX IF NOT EXISTS idx_reopens_at
  ON public.support_ticket_reopens(reopened_at DESC);
CREATE INDEX IF NOT EXISTS idx_reopens_type
  ON public.support_ticket_reopens(reopen_type);
CREATE UNIQUE INDEX IF NOT EXISTS uq_reopens_ticket_iter
  ON public.support_ticket_reopens(ticket_id, iteration_number);

COMMENT ON TABLE public.support_ticket_reopens IS
  'Registro de reincidencias/inconformidades. Cada vez que un ticket vuelve de '
  'ENTREGADA/APROBADA a estado activo, se inserta una fila vía trigger.';

-- ─── 3. RPC PARA PASAR METADATA DEL FRONT AL TRIGGER ──────────────────────
-- Patrón: el front llama a esta RPC ANTES del UPDATE para que el trigger lea
-- el motivo desde session config. Si nadie llamó la RPC, el trigger usa
-- defaults para no perder el registro.
CREATE OR REPLACE FUNCTION public.set_reopen_metadata(p_metadata jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM set_config('app.reopen_metadata', p_metadata::text, true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_reopen_metadata(jsonb) TO authenticated;

-- ─── 4. TRIGGER DE DETECCIÓN ──────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.detect_ticket_reopen()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_active_states TEXT[] := ARRAY['EN ATENCIÓN','PENDIENTE','VALORACIÓN','COTIZADA','POR CERRAR'];
  v_reopen_states TEXT[] := ARRAY['ENTREGADA','APROBADA'];
  v_user_name TEXT;
  v_meta JSONB;
  v_reason TEXT;
  v_type TEXT;
  v_lock_key BIGINT;
BEGIN
  -- Solo cambio de estado nos interesa
  IF OLD.estado IS NOT DISTINCT FROM NEW.estado THEN
    RETURN NEW;
  END IF;

  -- Detección de transición: ENTREGADA/APROBADA → activo
  IF NOT (OLD.estado = ANY(v_reopen_states) AND NEW.estado = ANY(v_active_states)) THEN
    RETURN NEW;
  END IF;

  -- Lock advisory por ticket para evitar race conditions
  v_lock_key := hashtext('reopen_' || NEW.id::text);
  PERFORM pg_advisory_xact_lock(v_lock_key);

  -- Leer metadata pasada por el front (vía set_reopen_metadata RPC)
  -- Si no hay (caller no usó la RPC), usar defaults — NO perder el registro
  BEGIN
    v_meta := COALESCE(current_setting('app.reopen_metadata', true)::jsonb, '{}'::jsonb);
  EXCEPTION WHEN OTHERS THEN
    v_meta := '{}'::jsonb;
  END;

  v_reason := COALESCE(NULLIF(v_meta->>'reason', ''), '(sin motivo registrado)');
  v_type := COALESCE(NULLIF(v_meta->>'reopen_type', ''), 'cliente_rechazo');
  -- Validar contra CHECK
  IF v_type NOT IN ('cliente_rechazo','qa_falla','solicitud_relacionada','otro','historico') THEN
    v_type := 'cliente_rechazo';
  END IF;

  -- Cerrar la iteración previa abierta (si existe)
  UPDATE public.support_ticket_reopens
     SET resolved_at = now()
   WHERE ticket_id = NEW.id
     AND resolved_at IS NULL
     AND iteration_number = COALESCE(OLD.reopen_count, 0);

  -- Incrementar contador
  NEW.reopen_count := COALESCE(OLD.reopen_count, 0) + 1;
  NEW.last_reopen_at := now();
  NEW.last_reopen_reason := v_reason;

  -- Buscar nombre del user que disparó el cambio
  SELECT full_name INTO v_user_name
    FROM public.profiles
   WHERE user_id = auth.uid();

  -- Insertar fila de reincidencia
  INSERT INTO public.support_ticket_reopens (
    ticket_id, iteration_number, reopened_from_state, reopened_to_state,
    reason, reopen_type, responsible_at_reopen, new_responsible,
    triggered_by_user_id, triggered_by_name, delivered_at, metadata
  ) VALUES (
    NEW.id, NEW.reopen_count, OLD.estado, NEW.estado,
    v_reason, v_type, OLD.responsable, NEW.responsable,
    auth.uid(), v_user_name,
    OLD.fecha_entrega::timestamptz,
    v_meta
  );

  -- Eco en ticket_access_log para que TicketHistoryTimeline lo pinte
  -- sin cambios en su componente.
  INSERT INTO public.ticket_access_log (ticket_id, user_id, action, metadata)
  VALUES (NEW.id, auth.uid(), 'update', jsonb_build_object(
    'kind', 'reopen',
    'iteration', NEW.reopen_count,
    'from', OLD.estado,
    'to', NEW.estado,
    'reason', v_reason,
    'reopen_type', v_type
  ));

  -- Limpiar el config para no contaminar transacciones siguientes
  PERFORM set_config('app.reopen_metadata', '', true);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_detect_ticket_reopen ON public.support_tickets;
CREATE TRIGGER trg_detect_ticket_reopen
  BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.detect_ticket_reopen();

COMMENT ON FUNCTION public.detect_ticket_reopen() IS
  'BEFORE UPDATE: detecta cambio ENTREGADA/APROBADA → activo. '
  'Lee app.reopen_metadata para reason+reopen_type (defaults si vacío). '
  'Usa pg_advisory_xact_lock por ticket para race conditions. '
  'Inserta en support_ticket_reopens + eco en ticket_access_log.';

-- ─── 5. RLS ───────────────────────────────────────────────────────────────
ALTER TABLE public.support_ticket_reopens ENABLE ROW LEVEL SECURITY;

-- Lectura: staff interno solamente
DROP POLICY IF EXISTS "Internal staff reads reopens" ON public.support_ticket_reopens;
CREATE POLICY "Internal staff reads reopens" ON public.support_ticket_reopens
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'pm'::public.app_role)
    OR public.has_role(auth.uid(), 'ceo'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente_soporte'::public.app_role)
    OR public.has_role(auth.uid(), 'colaborador'::public.app_role)
  );

-- INSERTs solo por trigger (security definer salta RLS) — no hay policy permisiva
DROP POLICY IF EXISTS "No direct inserts" ON public.support_ticket_reopens;
CREATE POLICY "No direct inserts" ON public.support_ticket_reopens
  FOR INSERT TO authenticated
  WITH CHECK (false);

-- UPDATE: solo gerente_soporte y admin pueden corregir reason+reopen_type
DROP POLICY IF EXISTS "Edit reason/type" ON public.support_ticket_reopens;
CREATE POLICY "Edit reason/type" ON public.support_ticket_reopens
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente_soporte'::public.app_role)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.has_role(auth.uid(), 'gerente_soporte'::public.app_role)
  );

-- DELETE: solo admin (caso excepcional)
DROP POLICY IF EXISTS "Admin delete" ON public.support_ticket_reopens;
CREATE POLICY "Admin delete" ON public.support_ticket_reopens
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

-- ─── 6. VIEW DE REPORTERÍA ────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.support_reopens_summary AS
SELECT
  t.client_id,
  t.responsable,
  t.producto,
  COUNT(DISTINCT r.id)::int                          AS total_reopens,
  COUNT(DISTINCT t.id) FILTER (WHERE t.reopen_count >= 2)::int AS tickets_reincidentes,
  MAX(r.iteration_number)::int                       AS max_iter,
  ROUND(AVG(r.iteration_number)::numeric, 2)         AS avg_iter,
  -- Solo cuenta reopens NO históricos para "tasa real" del periodo
  COUNT(DISTINCT r.id) FILTER (
    WHERE r.reopen_type != 'historico'
      AND r.reopened_at > now() - interval '90 days'
  )::int AS reopens_real_90d,
  COUNT(DISTINCT t.id) FILTER (
    WHERE t.fecha_entrega > now() - interval '90 days'
  )::int AS entregados_90d,
  CASE
    WHEN COUNT(DISTINCT t.id) FILTER (WHERE t.fecha_entrega > now() - interval '90 days') > 0
    THEN ROUND(
      (COUNT(DISTINCT r.id) FILTER (
        WHERE r.reopen_type != 'historico'
          AND r.reopened_at > now() - interval '90 days'
      ))::numeric * 100.0
      / COUNT(DISTINCT t.id) FILTER (WHERE t.fecha_entrega > now() - interval '90 days')::numeric,
      2
    )
    ELSE 0
  END AS reopen_rate_90d_pct
FROM public.support_tickets t
LEFT JOIN public.support_ticket_reopens r ON r.ticket_id = t.id
GROUP BY t.client_id, t.responsable, t.producto;

COMMENT ON VIEW public.support_reopens_summary IS
  'Agregado por cliente × responsable × producto. Excluye reopen_type=historico '
  'del cálculo de tasa real de los últimos 90 días.';

GRANT SELECT ON public.support_reopens_summary TO authenticated;

-- ─── 7. BACKFILL HISTÓRICO ────────────────────────────────────────────────
-- Recorre ticket_access_log buscando transiciones ENTREGADA/APROBADA → activo
-- e inserta filas con reopen_type='historico'. Best-effort: no tenemos el
-- motivo original, queda como '(reincidencia detectada en backfill)'.
DO $backfill$
DECLARE
  rec RECORD;
  v_iter INTEGER;
  v_ticket_count INTEGER := 0;
  v_total_inserted INTEGER := 0;
BEGIN
  -- Detectar tickets con histórico en access_log
  FOR rec IN
    SELECT
      l.ticket_id,
      l.created_at,
      l.metadata->'from'->>'estado' AS from_state,
      l.metadata->'to'->>'estado' AS to_state,
      l.user_id
    FROM public.ticket_access_log l
    WHERE l.action = 'update'
      AND l.metadata ? 'from'
      AND l.metadata ? 'to'
      AND (l.metadata->'from'->>'estado') IN ('ENTREGADA','APROBADA')
      AND (l.metadata->'to'->>'estado') IN ('EN ATENCIÓN','PENDIENTE','VALORACIÓN','COTIZADA','POR CERRAR')
    ORDER BY l.ticket_id, l.created_at ASC
  LOOP
    -- Calcular siguiente iteration_number
    SELECT COALESCE(MAX(iteration_number), 0) + 1
      INTO v_iter
      FROM public.support_ticket_reopens
     WHERE ticket_id = rec.ticket_id;

    -- Insertar reincidencia histórica (bypassa RLS porque DO se ejecuta como superuser)
    INSERT INTO public.support_ticket_reopens (
      ticket_id, iteration_number, reopened_from_state, reopened_to_state,
      reason, reopen_type, triggered_by_user_id,
      reopened_at, resolved_at, metadata
    ) VALUES (
      rec.ticket_id, v_iter, rec.from_state, rec.to_state,
      '(reincidencia detectada en backfill — sin motivo original)',
      'historico', rec.user_id,
      rec.created_at, NULL,  -- resolved_at se calcula después
      jsonb_build_object('source', 'backfill_from_access_log')
    )
    ON CONFLICT (ticket_id, iteration_number) DO NOTHING;

    v_total_inserted := v_total_inserted + 1;
  END LOOP;

  -- Recalcular reopen_count en support_tickets
  UPDATE public.support_tickets t
     SET reopen_count = sub.cnt,
         last_reopen_at = sub.last_at,
         last_reopen_reason = sub.last_reason
    FROM (
      SELECT
        ticket_id,
        COUNT(*)::int AS cnt,
        MAX(reopened_at) AS last_at,
        (ARRAY_AGG(reason ORDER BY iteration_number DESC))[1] AS last_reason
      FROM public.support_ticket_reopens
      GROUP BY ticket_id
    ) sub
   WHERE t.id = sub.ticket_id;

  GET DIAGNOSTICS v_ticket_count = ROW_COUNT;

  RAISE NOTICE 'Backfill reincidencias: % insertadas, % tickets actualizados', v_total_inserted, v_ticket_count;
END;
$backfill$;
