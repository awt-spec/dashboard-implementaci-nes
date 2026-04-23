-- ============================================================================
-- Habilitar Realtime para tablas clave del SVA
--
-- Esto permite que los componentes del frontend (SupportInbox, por ejemplo)
-- se suscriban a cambios INSERT/UPDATE vía `postgres_changes` y reciban los
-- eventos en tiempo real sin necesidad de refrescar.
--
-- Idempotente: re-correr no causa daño; si la tabla ya está en la publication
-- simplemente falla silenciosamente con el DO block.
-- ============================================================================

DO $$
DECLARE
  t TEXT;
  tables_to_enable TEXT[] := ARRAY[
    'support_tickets',
    'client_notifications',
    'ticket_access_log'
  ];
BEGIN
  FOREACH t IN ARRAY tables_to_enable LOOP
    -- Verifica que la tabla exista
    IF EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t
    ) THEN
      -- Agrega a la publication solo si no está ya
      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = 'public'
          AND tablename = t
      ) THEN
        EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
        RAISE NOTICE 'Realtime habilitado para: %', t;
      ELSE
        RAISE NOTICE 'Realtime ya estaba habilitado en: %', t;
      END IF;

      -- REPLICA IDENTITY FULL para que los eventos UPDATE incluyan todos los campos
      EXECUTE format('ALTER TABLE public.%I REPLICA IDENTITY FULL', t);
    END IF;
  END LOOP;
END $$;

COMMENT ON EXTENSION pgcrypto IS
  'Usado para cifrado simétrico de campos sensibles en support_tickets (ver migración 20260422160000).';
