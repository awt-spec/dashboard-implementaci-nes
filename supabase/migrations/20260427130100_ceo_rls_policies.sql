-- ════════════════════════════════════════════════════════════════════════════
-- Permisos de SOLO LECTURA del rol CEO sobre todas las tablas operacionales.
-- Patrón: agregar UNA policy "CEO read-only" por tabla con USING has_role('ceo').
-- No se le da INSERT/UPDATE/DELETE — el CEO observa, no opera.
-- ════════════════════════════════════════════════════════════════════════════

-- Helper: verificar si el usuario actual es CEO
CREATE OR REPLACE FUNCTION public.is_ceo_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'ceo'::public.app_role)
$$;

-- ─── Tablas de clientes y operación ──────────────────────────────────────
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'clients','client_financials','client_metrics','team_members',
    'support_tickets','support_ticket_notes','minutas','minuta_acuerdos',
    'tasks','deliverables','risks','collaboration','pendings',
    'client_health_history','time_entries','sysde_team_members',
    'client_users','user_roles','profiles','ai_usage_logs',
    'cliente_company_assignments','gerente_client_assignments',
    'sprints','team_sprints','work_items','contracts','sla_metrics',
    'saved_views','rbac_permissions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Solo crear si la tabla existe (defensivo — algunas pueden no estar en envs viejos)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = t) THEN
      EXECUTE format($p$
        DROP POLICY IF EXISTS "CEO read all on %I" ON public.%I;
        CREATE POLICY "CEO read all on %I" ON public.%I
          FOR SELECT TO authenticated
          USING (public.is_ceo_user());
      $p$, t, t, t, t);
    END IF;
  END LOOP;
END $$;

-- Comentario para auditoría
COMMENT ON FUNCTION public.is_ceo_user() IS
  'Devuelve true si el usuario autenticado tiene rol ceo. Usado por las policies CEO read-all.';
