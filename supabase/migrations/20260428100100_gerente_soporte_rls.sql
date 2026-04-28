-- ════════════════════════════════════════════════════════════════════════════
-- RLS para el rol gerente_soporte.
-- ════════════════════════════════════════════════════════════════════════════

-- Helper: verifica si el usuario actual es gerente_soporte
CREATE OR REPLACE FUNCTION public.is_gerente_soporte_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'gerente_soporte'::public.app_role)
$$;

COMMENT ON FUNCTION public.is_gerente_soporte_user() IS
  'True si el usuario tiene rol gerente_soporte. Usado por las policies de soporte.';

-- ────────────────────────────────────────────────────────────────────────
-- LECTURA: gerente_soporte ve clientes de SOPORTE y todos los tickets
-- ────────────────────────────────────────────────────────────────────────

-- Clientes: ve solo client_type='soporte'
DROP POLICY IF EXISTS "gerente_soporte read support clients" ON public.clients;
CREATE POLICY "gerente_soporte read support clients" ON public.clients
  FOR SELECT TO authenticated
  USING (public.is_gerente_soporte_user() AND client_type = 'soporte');

-- Support tickets: ve todos
DROP POLICY IF EXISTS "gerente_soporte read support tickets" ON public.support_tickets;
CREATE POLICY "gerente_soporte read support tickets" ON public.support_tickets
  FOR SELECT TO authenticated
  USING (public.is_gerente_soporte_user());

-- Notas de tickets
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='support_ticket_notes') THEN
    EXECUTE $sql$
      DROP POLICY IF EXISTS "gerente_soporte read support notes" ON public.support_ticket_notes;
      CREATE POLICY "gerente_soporte read support notes" ON public.support_ticket_notes
        FOR SELECT TO authenticated
        USING (public.is_gerente_soporte_user());
    $sql$;
  END IF;
END $$;

-- Minutas (puede ver todas para reuniones de soporte)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='minutas') THEN
    EXECUTE $sql$
      DROP POLICY IF EXISTS "gerente_soporte read minutas" ON public.minutas;
      CREATE POLICY "gerente_soporte read minutas" ON public.minutas
        FOR SELECT TO authenticated
        USING (public.is_gerente_soporte_user());
    $sql$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='minuta_acuerdos') THEN
    EXECUTE $sql$
      DROP POLICY IF EXISTS "gerente_soporte read minuta acuerdos" ON public.minuta_acuerdos;
      CREATE POLICY "gerente_soporte read minuta acuerdos" ON public.minuta_acuerdos
        FOR SELECT TO authenticated
        USING (public.is_gerente_soporte_user());
    $sql$;
  END IF;
END $$;

-- Profiles + user_roles (para ver responsables / asignaciones)
DROP POLICY IF EXISTS "gerente_soporte read profiles" ON public.profiles;
CREATE POLICY "gerente_soporte read profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (public.is_gerente_soporte_user());

DROP POLICY IF EXISTS "gerente_soporte read user_roles" ON public.user_roles;
CREATE POLICY "gerente_soporte read user_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (public.is_gerente_soporte_user());

-- AI usage logs (puede ver clasificaciones IA de tickets)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='ai_usage_logs') THEN
    EXECUTE $sql$
      DROP POLICY IF EXISTS "gerente_soporte read ai logs" ON public.ai_usage_logs;
      CREATE POLICY "gerente_soporte read ai logs" ON public.ai_usage_logs
        FOR SELECT TO authenticated
        USING (public.is_gerente_soporte_user());
    $sql$;
  END IF;
END $$;

-- Equipo SYSDE (para ver lista de responsables a asignar)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='sysde_team_members') THEN
    EXECUTE $sql$
      DROP POLICY IF EXISTS "gerente_soporte read team" ON public.sysde_team_members;
      CREATE POLICY "gerente_soporte read team" ON public.sysde_team_members
        FOR SELECT TO authenticated
        USING (public.is_gerente_soporte_user());
    $sql$;
  END IF;
END $$;

-- ────────────────────────────────────────────────────────────────────────
-- ESCRITURA: solo en lo relacionado a soporte (UPDATE/INSERT tickets, notas)
-- ────────────────────────────────────────────────────────────────────────

-- UPDATE de tickets: cambiar estado, asignar responsable, agregar notas
DROP POLICY IF EXISTS "gerente_soporte update support tickets" ON public.support_tickets;
CREATE POLICY "gerente_soporte update support tickets" ON public.support_tickets
  FOR UPDATE TO authenticated
  USING (public.is_gerente_soporte_user())
  WITH CHECK (public.is_gerente_soporte_user());

-- INSERT de tickets: puede crear nuevos
DROP POLICY IF EXISTS "gerente_soporte insert support tickets" ON public.support_tickets;
CREATE POLICY "gerente_soporte insert support tickets" ON public.support_tickets
  FOR INSERT TO authenticated
  WITH CHECK (public.is_gerente_soporte_user());

-- INSERT/UPDATE/DELETE de notas
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='support_ticket_notes') THEN
    EXECUTE $sql$
      DROP POLICY IF EXISTS "gerente_soporte write support notes" ON public.support_ticket_notes;
      CREATE POLICY "gerente_soporte write support notes" ON public.support_ticket_notes
        FOR ALL TO authenticated
        USING (public.is_gerente_soporte_user())
        WITH CHECK (public.is_gerente_soporte_user());
    $sql$;
  END IF;
END $$;

-- INSERT/UPDATE de minutas (para registrar reuniones de soporte)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='minutas') THEN
    EXECUTE $sql$
      DROP POLICY IF EXISTS "gerente_soporte write minutas" ON public.minutas;
      CREATE POLICY "gerente_soporte write minutas" ON public.minutas
        FOR ALL TO authenticated
        USING (public.is_gerente_soporte_user())
        WITH CHECK (public.is_gerente_soporte_user());
    $sql$;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='minuta_acuerdos') THEN
    EXECUTE $sql$
      DROP POLICY IF EXISTS "gerente_soporte write minuta acuerdos" ON public.minuta_acuerdos;
      CREATE POLICY "gerente_soporte write minuta acuerdos" ON public.minuta_acuerdos
        FOR ALL TO authenticated
        USING (public.is_gerente_soporte_user())
        WITH CHECK (public.is_gerente_soporte_user());
    $sql$;
  END IF;
END $$;
