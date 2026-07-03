-- FIX de seguridad: las políticas de backlog_items eran `auth.uid() IS NOT NULL`
-- (cualquier autenticado, incluido un cliente, podía leer/escribir el backlog de
-- CUALQUIER cliente → fuga cross-tenant). Se restringe:
--   • Lectura: staff, o el usuario del propio cliente (por si alguna vista futura
--     lo muestra al cliente) — nunca otros clientes.
--   • Escritura: solo staff (no clientes).

DROP POLICY IF EXISTS backlog_items_read ON public.backlog_items;
CREATE POLICY backlog_items_read ON public.backlog_items
  FOR SELECT USING (is_staff_user() OR user_can_see_client(client_id));

DROP POLICY IF EXISTS backlog_items_write ON public.backlog_items;
CREATE POLICY backlog_items_write ON public.backlog_items
  FOR ALL USING (is_staff_user()) WITH CHECK (is_staff_user());
