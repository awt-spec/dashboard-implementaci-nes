-- ─────────────────────────────────────────────────────────────────────
-- Extiende user_saved_views.scope para permitir 'scrum' (además de
-- 'insights' y 'operacion'). Usado por el wizard de Equipo Scrum.
-- ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.user_saved_views
  DROP CONSTRAINT IF EXISTS user_saved_views_scope_check;

ALTER TABLE public.user_saved_views
  ADD CONSTRAINT user_saved_views_scope_check
  CHECK (scope IN ('insights', 'operacion', 'scrum'));
