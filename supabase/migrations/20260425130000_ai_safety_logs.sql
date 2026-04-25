-- ─────────────────────────────────────────────────────────────────────
-- Hardening de ai_usage_logs:
--   • user_id: trackeo de quién llamó la IA (no había)
--   • scope: identificador del recurso analizado (ticket_id, client_id, etc.)
--   • redacted: marca si el payload pasado al LLM fue redactado por
--     contener data confidencial
--   • Index combinado para queries de rate limit eficientes
--
-- También endurece RLS: solo admin/pm pueden ver logs ajenos; cualquier
-- user ve los suyos. Cliente NO ve nada (RLS por user_id propio).
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.ai_usage_logs
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scope text,
  ADD COLUMN IF NOT EXISTS redacted boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_ai_usage_user_fn_created
  ON public.ai_usage_logs(user_id, function_name, created_at DESC);

-- RLS hardening
ALTER TABLE public.ai_usage_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all select on ai_usage_logs" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "Allow all insert on ai_usage_logs" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "Authenticated select ai_usage_logs" ON public.ai_usage_logs;

-- Cualquier user ve sus propios logs
CREATE POLICY "Users see own ai logs"
  ON public.ai_usage_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Admin/PM ven todos
CREATE POLICY "Admin PM see all ai logs"
  ON public.ai_usage_logs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'pm'));

-- Insert: edge fns usan service_role (bypass RLS), pero por si acaso:
CREATE POLICY "Authenticated insert own ai logs"
  ON public.ai_usage_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR user_id IS NULL);

COMMENT ON COLUMN public.ai_usage_logs.user_id IS 'Usuario que invocó la IA (opt-in para auditing).';
COMMENT ON COLUMN public.ai_usage_logs.scope IS 'Recurso analizado: ticket_id, client_id, member_id, etc.';
COMMENT ON COLUMN public.ai_usage_logs.redacted IS 'true si el payload fue sanitizado antes de mandarlo al LLM (ticket confidencial).';
