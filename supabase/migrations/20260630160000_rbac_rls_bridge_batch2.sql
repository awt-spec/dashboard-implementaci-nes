-- ============================================================================
-- RBAC dinámico — fase 3 (batch 2): bridge en más tablas con has_role
-- ----------------------------------------------------------------------------
-- Mismo patrón ADITIVO de la fase 3: se agrega `OR has_permission('<key>')` a
-- las políticas que hoy usan has_role, sin quitar acceso a los roles de sistema.
-- Cada permiso se concede a los roles de sistema que YA tenían el acceso, de
-- modo que el comportamiento de admin/pm es idéntico y solo se habilita el
-- enforcement para roles personalizados.
--
--   • config.catalogos_admin      (admin)       → task_types, reopen_reasons
--   • equipo.supervisiones        (admin)       → user_supervisions, team_supervisions
--   • comercial.paquetes_facturados (admin, pm) → billed_packages (insert/update)
--
-- billed_packages DELETE queda admin-only (igual que hoy; pm tampoco borra).
-- Idempotente.
-- ============================================================================

-- 1. Permisos + concesión a los roles de sistema que ya tenían el acceso.
INSERT INTO public.permissions (key, module, action) VALUES
  ('config.catalogos_admin',       'Configuración', 'Gestionar catálogos de soporte (tipos de tarea, motivos)'),
  ('equipo.supervisiones',         'Equipo SYSDE',  'Gestionar supervisiones'),
  ('comercial.paquetes_facturados','Comercial',     'Gestionar paquetes facturados')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_key, permission_key) VALUES
  ('admin', 'config.catalogos_admin'),
  ('admin', 'equipo.supervisiones'),
  ('admin', 'comercial.paquetes_facturados'),
  ('pm',    'comercial.paquetes_facturados')
ON CONFLICT DO NOTHING;

-- 2. task_types — admin OR has_permission(config.catalogos_admin)
DROP POLICY IF EXISTS "Admin manages task_types" ON public.task_types;
CREATE POLICY "Admin manages task_types"
  ON public.task_types FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_permission(auth.uid(), 'config.catalogos_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_permission(auth.uid(), 'config.catalogos_admin'));

-- 3. reopen_reasons
DROP POLICY IF EXISTS "Admin manages reopen_reasons" ON public.reopen_reasons;
CREATE POLICY "Admin manages reopen_reasons"
  ON public.reopen_reasons FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_permission(auth.uid(), 'config.catalogos_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_permission(auth.uid(), 'config.catalogos_admin'));

-- 4. user_supervisions
DROP POLICY IF EXISTS "Admin manages user_supervisions" ON public.user_supervisions;
CREATE POLICY "Admin manages user_supervisions"
  ON public.user_supervisions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_permission(auth.uid(), 'equipo.supervisiones'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_permission(auth.uid(), 'equipo.supervisiones'));

-- 5. team_supervisions
DROP POLICY IF EXISTS "Admin manages team_supervisions" ON public.team_supervisions;
CREATE POLICY "Admin manages team_supervisions"
  ON public.team_supervisions FOR ALL
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_permission(auth.uid(), 'equipo.supervisiones'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_permission(auth.uid(), 'equipo.supervisiones'));

-- 6. billed_packages — insert/update (preservando AND created_by = auth.uid() en INSERT)
DROP POLICY IF EXISTS "Admin or pm inserts billed_packages" ON public.billed_packages;
CREATE POLICY "Admin or pm inserts billed_packages"
  ON public.billed_packages FOR INSERT
  WITH CHECK (
    (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'pm'::app_role)
      OR public.has_permission(auth.uid(), 'comercial.paquetes_facturados')
    )
    AND created_by = auth.uid()
  );

DROP POLICY IF EXISTS "Admin or pm updates billed_packages" ON public.billed_packages;
CREATE POLICY "Admin or pm updates billed_packages"
  ON public.billed_packages FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'pm'::app_role)
    OR public.has_permission(auth.uid(), 'comercial.paquetes_facturados')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'pm'::app_role)
    OR public.has_permission(auth.uid(), 'comercial.paquetes_facturados')
  );
-- DELETE: se mantiene admin-only (sin cambios) — pm tampoco elimina.
