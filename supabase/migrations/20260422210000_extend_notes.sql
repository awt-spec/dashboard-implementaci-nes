-- ============================================================================
-- Renombra columnas de public.support_ticket_notes para alinear con la
-- convención usada por la UI (`content`, `author_name`) y el timeline de
-- historial (useTicketHistory). El esquema original (`message`, `author`)
-- causaba inserts con contenido vacío desde TicketDetailSheet porque TS no
-- detectaba el mismatch (noImplicitAny: false).
--
-- Idempotente: solo renombra si la columna vieja aún existe.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'support_ticket_notes'
      AND column_name  = 'message'
  ) THEN
    ALTER TABLE public.support_ticket_notes RENAME COLUMN message TO content;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'support_ticket_notes'
      AND column_name  = 'author'
  ) THEN
    ALTER TABLE public.support_ticket_notes RENAME COLUMN author TO author_name;
  END IF;
END $$;

COMMENT ON COLUMN public.support_ticket_notes.content IS
  'Texto de la nota. Renombrado desde `message` en la migración 20260422200000.';
COMMENT ON COLUMN public.support_ticket_notes.author_name IS
  'Nombre visible del autor. Renombrado desde `author` en la migración 20260422200000.';
