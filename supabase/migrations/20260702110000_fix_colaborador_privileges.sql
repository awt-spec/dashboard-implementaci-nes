-- Auditoría del rol colaborador: a nivel RLS convivían políticas antiguas
-- permisivas ("Staff …" = cualquier staff, incluido colaborador) con las nuevas
-- restrictivas ("Admin/PM …"). Como RLS es permisivo (OR de todas), las viejas
-- ANULABAN la restricción: un colaborador podía borrar/editar clientes y borrar
-- tickets/tareas vía API directa. Se cierran las operaciones destructivas de
-- alto valor. Las vistas internas ya gatean estas acciones a admin/pm en la UI.

-- ── clients: escritura solo admin/pm; borrado solo admin ──────────────────
DROP POLICY IF EXISTS "Staff insert clients" ON public.clients;
DROP POLICY IF EXISTS "Staff update clients" ON public.clients;
DROP POLICY IF EXISTS "Staff delete clients" ON public.clients;
-- (Quedan: "Admin/PM insert/update clients" y "Admin delete clients".)

-- ── support_tickets: el borrado no debe ser de cualquier staff (data-loss) ──
DROP POLICY IF EXISTS "Staff delete support_tickets" ON public.support_tickets;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'support_tickets' AND policyname = 'Managers delete support_tickets') THEN
    CREATE POLICY "Managers delete support_tickets" ON public.support_tickets
      FOR DELETE USING (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'pm'::app_role)
        OR has_role(auth.uid(), 'gerente_soporte'::app_role)
      );
  END IF;
END $$;

-- ── tasks: quitar el borrado amplio por staff (ya existe "Admin/PM delete") ──
DROP POLICY IF EXISTS "Staff delete tasks" ON public.tasks;
