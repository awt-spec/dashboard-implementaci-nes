-- ─────────────────────────────────────────────────────────────────────
-- One-shot cleanup: usuarios que son "cliente" (tienen un row en
-- cliente_company_assignments) NO deben tener otros roles en user_roles.
--
-- Bug que motiva esto: el trigger handle_new_user() inserta 'gerente' como
-- role por default cuando no se pasa metadata. La edge function
-- create_cliente no pasaba metadata y luego agregaba 'cliente' on top.
-- Resultado: users terminan con [gerente, cliente]. useAuth prioriza
-- gerente → los rutea al dashboard interno en vez del ClientPortalDashboard.
--
-- La edge function ya fue arreglada (pasa role=cliente en metadata y además
-- hace DELETE de otros roles). Esta migración limpia los users creados
-- antes del fix.
-- ─────────────────────────────────────────────────────────────────────

DELETE FROM public.user_roles
WHERE role != 'cliente'
  AND user_id IN (
    SELECT DISTINCT user_id FROM public.cliente_company_assignments
  );

-- Asegurar que los users con asignación tengan el rol cliente (idempotente)
INSERT INTO public.user_roles (user_id, role)
SELECT DISTINCT user_id, 'cliente'::public.app_role
FROM public.cliente_company_assignments
ON CONFLICT (user_id, role) DO NOTHING;
