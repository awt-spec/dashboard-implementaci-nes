-- ════════════════════════════════════════════════════════════════════════════
-- Rol gerente_soporte: gerente del área de soporte SYSDE.
-- Carlos Castante es el primer usuario con este rol.
--
-- Permisos:
--   • Ve TODOS los clientes de soporte (client_type='soporte')
--   • Gestiona boletas de soporte (update/insert support_tickets, notes)
--   • Ve minutas de soporte
--   • NO toca implementación, scrum, configuración admin, ni usuarios
--
-- Las RLS van en migración separada (ALTER TYPE ADD VALUE requiere commit
-- antes de poder usar el nuevo valor en SQL del mismo batch).
-- ════════════════════════════════════════════════════════════════════════════

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gerente_soporte';
