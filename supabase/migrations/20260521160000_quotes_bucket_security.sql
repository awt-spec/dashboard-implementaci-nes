-- ============================================================================
-- P2-1: Defense-in-depth para attachments de cotizaciones (paths quotes/*)
--
-- Contexto: el bucket support-ticket-attachments es public=true (legacy) y
-- tiene una policy SELECT permisiva. Si alguien filtra un file_path de un
-- quote attachment, cualquier authenticated user con la URL puede leerlo
-- (porque la policy no chequea ownership).
--
-- Fix: agregamos una RESTRICTIVE policy que SOLO aplica a paths quotes/*
-- y exige que el caller tenga acceso al row de quote_attachments
-- correspondiente (que ya tiene RLS por client_id). Para tickets, mantiene
-- el comportamiento actual.
--
-- Nota: NO cambiamos public=false del bucket porque rompería URLs públicas
-- de tickets/minutes existentes. Esta restrictiva solo cierra el hueco para
-- los paths nuevos (quotes/).
-- ============================================================================

DROP POLICY IF EXISTS "Quotes attachments: ownership check restrictive" ON storage.objects;
CREATE POLICY "Quotes attachments: ownership check restrictive"
  ON storage.objects AS RESTRICTIVE
  FOR SELECT
  USING (
    -- Path no es del módulo quotes → no aplica esta restricción (deja pasar)
    bucket_id != 'support-ticket-attachments'
    OR name IS NULL
    OR NOT (name LIKE 'quotes/%')
    -- Path es quotes/* → exigir que exista row visible en quote_attachments
    OR EXISTS (
      SELECT 1 FROM public.quote_attachments qa
      WHERE qa.file_path = storage.objects.name
      -- RLS de quote_attachments aplica automáticamente al EXISTS
    )
  );

DROP POLICY IF EXISTS "Quotes attachments: upload ownership check" ON storage.objects;
CREATE POLICY "Quotes attachments: upload ownership check"
  ON storage.objects AS RESTRICTIVE
  FOR INSERT
  WITH CHECK (
    bucket_id != 'support-ticket-attachments'
    OR name IS NULL
    OR NOT (name LIKE 'quotes/%')
    -- Solo staff puede subir archivos a quotes/*
    OR public.is_staff_user()
  );

DROP POLICY IF EXISTS "Quotes attachments: delete ownership check" ON storage.objects;
CREATE POLICY "Quotes attachments: delete ownership check"
  ON storage.objects AS RESTRICTIVE
  FOR DELETE
  USING (
    bucket_id != 'support-ticket-attachments'
    OR name IS NULL
    OR NOT (name LIKE 'quotes/%')
    OR EXISTS (
      SELECT 1 FROM public.quote_attachments qa
      WHERE qa.file_path = storage.objects.name
      -- RLS de quote_attachments aplica; solo admin/staff puede borrar via tabla
    )
  );

-- Nota: NO se usa COMMENT ON POLICY ... ON storage.objects porque el rol de
-- migración de Supabase no es owner de storage.objects (owned by
-- supabase_storage_admin) y COMMENT exige ownership. La doc de estas policies
-- vive en este archivo. Las CREATE POLICY sí están permitidas para el rol postgres.
