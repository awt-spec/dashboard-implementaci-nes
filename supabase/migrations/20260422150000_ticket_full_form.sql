-- ============================================================================
-- Fase 1: Extensión del modelo de tickets para reemplazar el legacy Gurunet.
--
-- Agrega:
--   - 11 columnas en support_tickets (consecutivos, descripción separada,
--     prioridad interna, orden atención, contexto técnico, tiempos, fecha cierre)
--   - 3 columnas en clients (categoría interna, nivel servicio, ranking)
--   - Trigger BEFORE INSERT que asigna consecutivo_cliente + genera ticket_id
--
-- Idempotente: usa IF NOT EXISTS y DROP IF EXISTS donde aplica. Se puede correr
-- múltiples veces sin dañar datos. NO modifica columnas existentes.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. support_tickets: columnas faltantes del formulario legacy
-- ---------------------------------------------------------------------------

-- Nota: `centro_servicio` NO se agrega — SYSDE tiene un único centro de servicio,
-- por lo que no aporta valor poblar una columna. Si se necesita en el futuro,
-- agregar via migración posterior.
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS consecutivo_global      BIGINT,
  ADD COLUMN IF NOT EXISTS consecutivo_cliente     INTEGER,
  ADD COLUMN IF NOT EXISTS descripcion             TEXT,
  ADD COLUMN IF NOT EXISTS prioridad_interna       TEXT,
  ADD COLUMN IF NOT EXISTS orden_atencion          INTEGER    NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ubicacion_error         TEXT,
  ADD COLUMN IF NOT EXISTS unidad_fabricacion      TEXT,
  ADD COLUMN IF NOT EXISTS tiempo_consumido_minutos INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tiempo_cobrado_minutos   INTEGER   NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fecha_estimada_cierre   DATE;

-- ---------------------------------------------------------------------------
-- 2. clients: propiedades del cliente que el legacy muestra en el ticket
-- ---------------------------------------------------------------------------

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS categoria_interna   TEXT,
  ADD COLUMN IF NOT EXISTS nivel_servicio      TEXT NOT NULL DEFAULT 'Base',
  ADD COLUMN IF NOT EXISTS ranking_position    INTEGER NOT NULL DEFAULT 999;

-- Constraint con DROP IF EXISTS para poder re-correr
DO $$ BEGIN
  ALTER TABLE public.clients
    DROP CONSTRAINT IF EXISTS clients_nivel_servicio_check;
  ALTER TABLE public.clients
    ADD CONSTRAINT clients_nivel_servicio_check
    CHECK (nivel_servicio IN ('Base', 'Premium', 'Platinum'));
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- ---------------------------------------------------------------------------
-- 3. Sequence para consecutivo_global (único en todo el sistema)
-- ---------------------------------------------------------------------------

CREATE SEQUENCE IF NOT EXISTS public.support_tickets_consecutivo_global_seq
  START WITH 10000
  INCREMENT BY 1
  MINVALUE 1
  NO MAXVALUE
  CACHE 1;

-- Alineamos la sequence con los tickets existentes para que números nuevos
-- continúen la numeración sin colisión con cualquier dato legacy.
DO $$
DECLARE max_global BIGINT;
BEGIN
  SELECT COALESCE(MAX(consecutivo_global), 9999) INTO max_global FROM public.support_tickets;
  PERFORM setval('public.support_tickets_consecutivo_global_seq', GREATEST(max_global, 10000), true);
END $$;

-- ---------------------------------------------------------------------------
-- 4. Trigger: asigna consecutivo_cliente + consecutivo_global + ticket_id
--    * Solo aplica si los valores vienen NULL/empty en el INSERT
--    * Respeta valores explícitos para backward-compat con inserts del legacy
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.assign_ticket_consecutivos()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prefix TEXT;
BEGIN
  -- 1. Consecutivo global único
  IF NEW.consecutivo_global IS NULL THEN
    NEW.consecutivo_global := nextval('public.support_tickets_consecutivo_global_seq');
  END IF;

  -- 2. Consecutivo por cliente (correlativo local, ej: Credicefi 376, 377, …)
  IF NEW.consecutivo_cliente IS NULL THEN
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
      -- fecha_entrega puede ser text con formato no-estándar; si falla, se deja NULL
      NULL;
    END;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_ticket_consecutivos ON public.support_tickets;
CREATE TRIGGER trg_assign_ticket_consecutivos
  BEFORE INSERT ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.assign_ticket_consecutivos();

-- ---------------------------------------------------------------------------
-- 5. Backfill: tickets existentes sin consecutivo_cliente
--    Para que las queries de legacy-compat funcionen inmediatamente.
-- ---------------------------------------------------------------------------

WITH numbered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY created_at, id) AS rn
  FROM public.support_tickets
  WHERE consecutivo_cliente IS NULL
)
UPDATE public.support_tickets t
   SET consecutivo_cliente = n.rn
  FROM numbered n
 WHERE t.id = n.id;

UPDATE public.support_tickets
   SET consecutivo_global = nextval('public.support_tickets_consecutivo_global_seq')
 WHERE consecutivo_global IS NULL;

-- ---------------------------------------------------------------------------
-- 6. Índices útiles para queries frecuentes del formulario
-- ---------------------------------------------------------------------------

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_tickets_consecutivo_cliente
  ON public.support_tickets(client_id, consecutivo_cliente);

CREATE UNIQUE INDEX IF NOT EXISTS idx_support_tickets_consecutivo_global
  ON public.support_tickets(consecutivo_global);

CREATE INDEX IF NOT EXISTS idx_support_tickets_prioridad_orden
  ON public.support_tickets(prioridad, orden_atencion, created_at DESC);

-- ---------------------------------------------------------------------------
-- 7. Ahora que todas las filas tienen valores válidos, hacemos NOT NULL
--    los consecutivos (defensa contra inserts directos sin trigger).
-- ---------------------------------------------------------------------------

ALTER TABLE public.support_tickets
  ALTER COLUMN consecutivo_cliente SET NOT NULL,
  ALTER COLUMN consecutivo_global  SET NOT NULL;

-- ---------------------------------------------------------------------------
-- 8. Comentarios para documentación
-- ---------------------------------------------------------------------------

COMMENT ON COLUMN public.support_tickets.consecutivo_global IS
  'Número único global del ticket (equivalente al "consecutivo del centro de servicio" del legacy Gurunet). Auto-asignado por trigger.';
COMMENT ON COLUMN public.support_tickets.consecutivo_cliente IS
  'Número correlativo del ticket DENTRO del cliente. Empieza en 1. Ej: Credicefi 376.';
COMMENT ON COLUMN public.support_tickets.descripcion IS
  'Descripción detallada de la solicitud (separada de `notas` que se usa para seguimiento).';
COMMENT ON COLUMN public.support_tickets.prioridad_interna IS
  'Prioridad asignada internamente por el PM — puede diferir de la prioridad que ve el cliente.';
COMMENT ON COLUMN public.support_tickets.orden_atencion IS
  'Número de orden dentro de la misma prioridad (desempate cuando hay varios tickets Alta, Media, etc.).';
COMMENT ON COLUMN public.support_tickets.ubicacion_error IS
  'Dónde ocurre el error (módulo, pantalla, proceso).';
COMMENT ON COLUMN public.support_tickets.tiempo_consumido_minutos IS
  'Tiempo real invertido en el ticket, en minutos.';
COMMENT ON COLUMN public.support_tickets.tiempo_cobrado_minutos IS
  'Tiempo facturable al cliente (puede diferir del consumido).';
COMMENT ON COLUMN public.clients.nivel_servicio IS
  'Plan contratado: Base, Premium, Platinum. Define los SLA default.';
