-- ─────────────────────────────────────────────────────────────────────
-- user_saved_views: vistas guardadas por usuario (Insights/Operación).
-- Permite al usuario persistir presets armados a través del wizard guiado.
-- ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.user_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scope text NOT NULL CHECK (scope IN ('insights', 'operacion')),
  name text NOT NULL,
  preset_key text NOT NULL,
  config jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, scope, name)
);

ALTER TABLE public.user_saved_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own saved views" ON public.user_saved_views;
CREATE POLICY "Users manage own saved views"
  ON public.user_saved_views
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_user_saved_views_user_scope
  ON public.user_saved_views(user_id, scope, created_at DESC);

CREATE TRIGGER trg_user_saved_views_updated
  BEFORE UPDATE ON public.user_saved_views
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

COMMENT ON TABLE public.user_saved_views IS
  'Vistas guardadas por usuario. scope=insights|operacion, preset_key indica qué preset inicial y config los refinamientos (cliente, período, etc.)';
