-- ════════════════════════════════════════════════════════════════════════════
-- FIX: race condition en assign_ticket_consecutivos cuando hay INSERTs paralelos
--      del MISMO client_id.
--
-- Bug detectado por stress-test (scripts/stress-test.mjs · Mixed workload):
--   "duplicate key value violates unique constraint
--    idx_support_tickets_consecutivo_cliente"
--
-- Causa:
--   El trigger BEFORE INSERT calcula
--     SELECT COALESCE(MAX(consecutivo_cliente), 0) + 1
--   sin lock. Si 10 transacciones insertan al mismo tiempo para el MISMO
--   client_id, las 10 leen el mismo MAX, las 10 calculan el mismo +1, y
--   las 10 intentan insertar el mismo valor → 1 succeed + 9 fallan con
--   unique constraint violation.
--
-- Fix:
--   pg_advisory_xact_lock(hashtext('support_tickets_consec_' || client_id))
--   antes del SELECT MAX. Esto serializa la asignación de consecutivo POR
--   cliente (clientes distintos NO se bloquean entre sí). El lock es a
--   nivel transacción y se libera automáticamente al COMMIT/ROLLBACK.
--
-- Trade-off: latencia ligeramente mayor en concurrencia para el mismo
-- cliente, pero garantiza correctness. Para clientes distintos, no hay
-- impacto (cada uno tiene su propio lock por hash).
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.assign_ticket_consecutivos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prefix TEXT;
BEGIN
  -- 1. Consecutivo global único — usa nextval (atómico, no necesita lock)
  IF NEW.consecutivo_global IS NULL THEN
    NEW.consecutivo_global := nextval('public.support_tickets_consecutivo_global_seq');
  END IF;

  -- 2. Consecutivo por cliente — REQUIERE LOCK para evitar race condition
  IF NEW.consecutivo_cliente IS NULL THEN
    -- Advisory lock a nivel transacción, scoped al client_id.
    -- hashtext devuelve int4; el prefijo evita colisión con otros locks.
    -- Otras transacciones del MISMO client_id esperan acá; otras de OTROS
    -- clientes no se ven afectadas.
    PERFORM pg_advisory_xact_lock(
      hashtext('support_tickets_consec_' || NEW.client_id)
    );

    -- Ahora la lectura del MAX y la inserción son serializadas para este
    -- client_id. Cada transacción ve el último consecutivo real (incluyendo
    -- el de la transacción anterior que ya commiteó tras liberar el lock).
    SELECT COALESCE(MAX(consecutivo_cliente), 0) + 1
      INTO NEW.consecutivo_cliente
      FROM public.support_tickets
      WHERE client_id = NEW.client_id;
  END IF;

  -- 3. ticket_id legible compuesto (solo si no viene explícito)
  IF NEW.ticket_id IS NULL OR NEW.ticket_id = '' THEN
    v_prefix := UPPER(REGEXP_REPLACE(SUBSTRING(NEW.client_id, 1, 3), '[^A-Za-z0-9]', '', 'g'));
    IF LENGTH(v_prefix) = 0 THEN v_prefix := 'TKT'; END IF;
    NEW.ticket_id := v_prefix || '-' || LPAD(NEW.consecutivo_cliente::text, 4, '0');
  END IF;

  -- 4. fecha_estimada_cierre = fecha_entrega + 2 días si no viene explícita
  IF NEW.fecha_estimada_cierre IS NULL AND NEW.fecha_entrega IS NOT NULL THEN
    BEGIN
      NEW.fecha_estimada_cierre := (NEW.fecha_entrega::date) + INTERVAL '2 days';
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.assign_ticket_consecutivos() IS
  'Asigna consecutivo_global, consecutivo_cliente y ticket_id en BEFORE INSERT. '
  'Usa pg_advisory_xact_lock(hashtext(client_id)) para evitar race condition '
  'en consecutivo_cliente cuando hay INSERTs paralelos del mismo cliente. '
  'Validado con scripts/stress-test.mjs (10 paralelos = 10 OK, antes 1/10).';
