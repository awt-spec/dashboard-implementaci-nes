-- ─────────────────────────────────────────────────────────────────────
-- Fix RLS leak en shared_support_presentations y shared_presentations:
--
-- La policy "Public select active ..." aplicaba TO public, que incluye
-- usuarios autenticados con rol cliente. Resultado: un usuario cliente
-- veía TODAS las minutas activas (incluídas las de otros clientes).
--
-- Fix: la policy de acceso público sólo debe aplicar al role `anon` (usado
-- por la página /shared-support/:token sin login). Los autenticados pasan
-- por "Staff select" o "Cliente selects own client minutas".
-- ─────────────────────────────────────────────────────────────────────

-- shared_support_presentations
DROP POLICY IF EXISTS "Public select active shared_support_presentations" ON public.shared_support_presentations;
CREATE POLICY "Anon select active shared_support_presentations"
  ON public.shared_support_presentations FOR SELECT TO anon
  USING (expires_at > now());

-- shared_presentations (implementación) — mismo patrón por defensa en profundidad
DROP POLICY IF EXISTS "Public select active shared_presentations" ON public.shared_presentations;
CREATE POLICY "Anon select active shared_presentations"
  ON public.shared_presentations FOR SELECT TO anon
  USING (expires_at > now());
