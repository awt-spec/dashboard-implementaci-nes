-- ════════════════════════════════════════════════════════════════════════════
-- Cierra el SELECT de tablas confidenciales SOLO a admin/pm/ceo.
-- Colaborador y gerente_soporte pierden acceso aquí (data financial
-- + emails con clientes son admin-tier).
--
-- Detección: smoke RLS post-fix mostró colaborador leyendo 10 client_financials
-- porque la policy "Staff select client_financials" (creada por
-- cliente_rls_hardening) incluye colaborador via NOT is_cliente_user().
-- ════════════════════════════════════════════════════════════════════════════

-- client_financials — solo admin/pm/ceo
DROP POLICY IF EXISTS "Staff select client_financials" ON public.client_financials;
DROP POLICY IF EXISTS "Staff insert client_financials" ON public.client_financials;
DROP POLICY IF EXISTS "Staff update client_financials" ON public.client_financials;
DROP POLICY IF EXISTS "Staff delete client_financials" ON public.client_financials;

-- email_notifications — solo admin/pm/ceo
DROP POLICY IF EXISTS "Staff select email_notifications" ON public.email_notifications;
DROP POLICY IF EXISTS "Staff insert email_notifications" ON public.email_notifications;
DROP POLICY IF EXISTS "Staff update email_notifications" ON public.email_notifications;
DROP POLICY IF EXISTS "Staff delete email_notifications" ON public.email_notifications;

-- ai_usage_logs — el migration 20260503140000 ya las cerró pero por si quedaba algo legacy
DROP POLICY IF EXISTS "Staff select ai_usage_logs" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "Staff insert ai_usage_logs" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "Staff update ai_usage_logs" ON public.ai_usage_logs;
DROP POLICY IF EXISTS "Staff delete ai_usage_logs" ON public.ai_usage_logs;

-- También: client_notifications.UPDATE→true (warning del migration anterior)
DROP POLICY IF EXISTS "Allow update on client_notifications" ON public.client_notifications;

DO $verify$
DECLARE
  rec RECORD;
  cnt INT := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Policies SELECT en tablas confidenciales (deberían ser admin/pm/ceo only) ===';
  FOR rec IN
    SELECT tablename, policyname, qual
      FROM pg_policies
     WHERE schemaname = 'public'
       AND tablename IN ('client_financials','email_notifications','ai_usage_logs')
       AND cmd = 'SELECT'
  LOOP
    cnt := cnt + 1;
    RAISE NOTICE '  %.% → %', rec.tablename, rec.policyname, substring(rec.qual, 1, 100);
  END LOOP;
  RAISE NOTICE '  Total SELECT policies: %', cnt;
END;
$verify$;
