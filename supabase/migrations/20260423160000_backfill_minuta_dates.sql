-- ─────────────────────────────────────────────────────────────────────
-- Backfill: agregar hora a las support_minutes.date que estaban en formato
-- YYYY-MM-DD (sin componente de hora).
--
-- Bug: se guardaba solo la fecha. Al parsearse en JS como UTC 00:00, los
-- displays en TZ local (ej: UTC-6 Costa Rica) mostraban el día ANTERIOR.
-- Ahora el insert guarda ISO completo; esta migración arregla las filas
-- históricas agregando mediodía UTC (12:00) para que el display sea la
-- misma fecha guardada sin importar la TZ del cliente.
-- ─────────────────────────────────────────────────────────────────────

UPDATE public.support_minutes
SET date = date || 'T12:00:00Z'
WHERE date ~ '^\d{4}-\d{2}-\d{2}$';
