-- ============================================================================
-- Adjuntos en la mesa de discusión (notas) — cierra ERP-084 / PORTAL-013
-- ----------------------------------------------------------------------------
-- La mesa de discusión viva en la UI (TicketDetailSheet → tab "Notas") usa
-- public.support_ticket_notes, NO la tabla legacy public.comments (a la que la
-- migración 20260521200000 había agregado columnas de adjunto que la UI nunca
-- consumió). Se agregan las columnas de adjunto sobre la tabla viva y se
-- reutiliza el bucket existente `support-ticket-attachments` con prefijo
-- `notes/`. Las políticas del bucket ya permiten select/insert/delete.
-- Idempotente.
-- ============================================================================

ALTER TABLE public.support_ticket_notes
  ADD COLUMN IF NOT EXISTS attachment_path text,
  ADD COLUMN IF NOT EXISTS attachment_name text,
  ADD COLUMN IF NOT EXISTS attachment_size bigint;

COMMENT ON COLUMN public.support_ticket_notes.attachment_path IS
  'Path en bucket support-ticket-attachments (prefijo notes/). Adjunto opcional de la nota. ERP-084 / PORTAL-013.';
COMMENT ON COLUMN public.support_ticket_notes.attachment_name IS
  'Nombre original del archivo adjunto de la nota.';
COMMENT ON COLUMN public.support_ticket_notes.attachment_size IS
  'Tamaño en bytes del archivo adjunto de la nota.';
