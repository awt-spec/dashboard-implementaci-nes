-- ============================================================================
-- Expiración automática de cotizaciones — QA fix P2 del gap P1
-- Issue detectado en QA: el campo quotes.valid_until existía pero ninguna
-- cotización pasaba a status='expired' automáticamente. El frontend lo
-- calculaba visualmente, pero una query `WHERE status='expired'` daba 0.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.expire_stale_quotes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.quotes
  SET status = 'expired',
      updated_at = now()
  WHERE status = 'sent'
    AND valid_until IS NOT NULL
    AND valid_until < CURRENT_DATE;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.expire_stale_quotes() TO authenticated;

COMMENT ON FUNCTION public.expire_stale_quotes IS
  'Mueve cotizaciones sent → expired cuando valid_until ya pasó. Idempotente. Devuelve cuántas expiró. Correr diario vía pg_cron o manualmente.';

-- ── Schedule diario vía pg_cron (si la extensión está disponible) ───────────
-- Supabase soporta pg_cron pero hay que habilitarlo desde el dashboard.
-- Este bloque es defensivo: si pg_cron no está, no rompe la migración —
-- solo deja la función disponible para correr manual o vía edge function.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    -- Desagendar si ya existía (idempotencia)
    PERFORM cron.unschedule('expire-stale-quotes')
      WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-stale-quotes');
    -- Agendar: todos los días 06:00 UTC
    PERFORM cron.schedule(
      'expire-stale-quotes',
      '0 6 * * *',
      'SELECT public.expire_stale_quotes()'
    );
    RAISE NOTICE 'pg_cron job "expire-stale-quotes" agendado (diario 06:00 UTC)';
  ELSE
    RAISE NOTICE 'pg_cron no está habilitado — expire_stale_quotes() quedó disponible para correr manual. Para automatizar: habilitar pg_cron en Supabase Dashboard → Database → Extensions, y re-correr esta migración.';
  END IF;
END $$;

-- Corrida inicial: expira lo que ya esté vencido al momento de aplicar
SELECT public.expire_stale_quotes();
