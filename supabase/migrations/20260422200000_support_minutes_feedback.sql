-- ============================================================================
-- Feedback rich sobre minutas: texto + audio + video + sentimiento.
--
-- Se captura desde la página pública compartida (token de shared_support_presentations)
-- para que el cliente pueda enviar feedback sin login, incluyendo audio/video
-- grabados directamente desde el browser (MediaRecorder API).
--
-- El bucket `minute-feedback-media` es PRIVADO: la app usa signed URLs para
-- tocar los archivos. El uso de tokens de la presentación compartida se valida
-- a nivel aplicación (no en storage RLS — ver comentarios abajo).
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.support_minutes_feedback (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  minute_id                UUID REFERENCES public.support_minutes(id) ON DELETE SET NULL,
  shared_presentation_id   UUID REFERENCES public.shared_support_presentations(id) ON DELETE SET NULL,
  sentiment                TEXT CHECK (sentiment IN ('positivo', 'neutro', 'negativo') OR sentiment IS NULL),
  text_comment             TEXT,
  audio_url                TEXT,
  audio_duration_seconds   NUMERIC,
  audio_transcript         TEXT,
  video_url                TEXT,
  video_duration_seconds   NUMERIC,
  video_transcript         TEXT,
  author_name              TEXT,
  author_role              TEXT,
  client_id                TEXT,
  metadata                 JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_support_minutes_feedback_minute
  ON public.support_minutes_feedback (minute_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_minutes_feedback_shared
  ON public.support_minutes_feedback (shared_presentation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_support_minutes_feedback_client
  ON public.support_minutes_feedback (client_id, created_at DESC);

ALTER TABLE public.support_minutes_feedback ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_minutes_feedback_public_insert" ON public.support_minutes_feedback;
CREATE POLICY "support_minutes_feedback_public_insert"
  ON public.support_minutes_feedback
  FOR INSERT TO public
  WITH CHECK (true);

DROP POLICY IF EXISTS "support_minutes_feedback_public_select" ON public.support_minutes_feedback;
CREATE POLICY "support_minutes_feedback_public_select"
  ON public.support_minutes_feedback
  FOR SELECT TO public
  USING (true);

DROP POLICY IF EXISTS "support_minutes_feedback_authenticated_update" ON public.support_minutes_feedback;
CREATE POLICY "support_minutes_feedback_authenticated_update"
  ON public.support_minutes_feedback
  FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "support_minutes_feedback_authenticated_delete" ON public.support_minutes_feedback;
CREATE POLICY "support_minutes_feedback_authenticated_delete"
  ON public.support_minutes_feedback
  FOR DELETE TO authenticated
  USING (true);

COMMENT ON TABLE public.support_minutes_feedback IS
  'Feedback rich (texto + audio + video + sentimiento) sobre una minuta. '
  'Se captura desde SharedSupportPresentation via el token — el caller sin '
  'sesión solo inserta rows, no puede modificar ni borrar.';

-- ─── Bucket para media de feedback ────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public)
VALUES ('minute-feedback-media', 'minute-feedback-media', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- El bucket es PÚBLICO (cualquiera con la URL reproduce) para simplificar el
-- flujo: el cliente sube, el URL queda en support_minutes_feedback, el equipo
-- lo consume con un <audio>/<video> estándar.
-- Las URLs son UUID-random por lo que requieren conocer el path exacto.
DROP POLICY IF EXISTS "minute_feedback_media_public_insert" ON storage.objects;
CREATE POLICY "minute_feedback_media_public_insert"
  ON storage.objects
  FOR INSERT TO public
  WITH CHECK (bucket_id = 'minute-feedback-media');

DROP POLICY IF EXISTS "minute_feedback_media_public_select" ON storage.objects;
CREATE POLICY "minute_feedback_media_public_select"
  ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'minute-feedback-media');

DROP POLICY IF EXISTS "minute_feedback_media_authenticated_delete" ON storage.objects;
CREATE POLICY "minute_feedback_media_authenticated_delete"
  ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'minute-feedback-media');
