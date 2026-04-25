-- Permitir scope 'executive' en user_saved_views (composer del Resumen Ejecutivo).
ALTER TABLE public.user_saved_views
  DROP CONSTRAINT IF EXISTS user_saved_views_scope_check;

ALTER TABLE public.user_saved_views
  ADD CONSTRAINT user_saved_views_scope_check
  CHECK (scope IN ('insights', 'operacion', 'scrum', 'executive'));
