-- Auditoría del rol gerente: user_can_see_client() está diseñada para acotar al
-- gerente a sus clientes asignados (gerente_client_assignments), pero las
-- políticas de LECTURA "Staff select … (NOT is_cliente_user())" / "is_staff_user()"
-- incluían a gerente sin filtro → un gerente podía leer datos de TODOS los
-- clientes por API. Se envuelve cada condición amplia con user_can_see_client(),
-- que devuelve true para admin/pm/ceo/gerente_soporte/colaborador (sin cambio) y
-- acota a gerente (y cliente) a sus asignaciones. Las políticas de cliente
-- (con sus restricciones extra) no se tocan.

-- Helper de reemplazo por tabla (NOT is_cliente_user):
DO $$
DECLARE
  t text;
  pol text;
BEGIN
  FOR t, pol IN
    SELECT * FROM (VALUES
      ('support_tickets', 'Staff select support_tickets'),
      ('tasks', 'Staff select tasks'),
      ('deliverables', 'Staff select deliverables'),
      ('phases', 'Staff select phases'),
      ('risks', 'Staff select risks'),
      ('meeting_minutes', 'Staff select meeting_minutes'),
      ('action_items', 'Staff select action_items'),
      ('comments', 'Staff select comments'),
      ('shared_presentations', 'Staff select shared_presentations'),
      ('shared_support_presentations', 'Staff select shared_support_presentations'),
      ('support_minutes', 'Staff select support_minutes'),
      ('support_minutes_feedback', 'Staff select support_minutes_feedback')
    ) AS v(t, pol)
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (public.user_can_see_client(client_id) AND NOT public.is_cliente_user())',
      pol, t
    );
  END LOOP;
END $$;

-- is_staff_user() puras:
DROP POLICY IF EXISTS "Staff read risks" ON public.risks;
CREATE POLICY "Staff read risks" ON public.risks FOR SELECT
  USING (public.user_can_see_client(client_id) AND public.is_staff_user());

DROP POLICY IF EXISTS "Staff read comments" ON public.comments;
CREATE POLICY "Staff read comments" ON public.comments FOR SELECT
  USING (public.user_can_see_client(client_id) AND public.is_staff_user());

DROP POLICY IF EXISTS "Staff selects all billed_packages" ON public.billed_packages;
CREATE POLICY "Staff selects all billed_packages" ON public.billed_packages FOR SELECT
  USING (public.user_can_see_client(client_id) AND public.is_staff_user());

DROP POLICY IF EXISTS "Staff selects all quotes" ON public.quotes;
CREATE POLICY "Staff selects all quotes" ON public.quotes FOR SELECT
  USING (public.user_can_see_client(client_id) AND public.is_staff_user());

-- tasks: política compuesta "Scoped select tasks" (staff + cliente-externa).
DROP POLICY IF EXISTS "Scoped select tasks" ON public.tasks;
CREATE POLICY "Scoped select tasks" ON public.tasks FOR SELECT
  USING (
    (public.user_can_see_client(client_id) AND public.is_staff_user())
    OR (public.is_cliente_user() AND client_id = public.get_cliente_client_id(auth.uid()) AND visibility = 'externa')
  );
