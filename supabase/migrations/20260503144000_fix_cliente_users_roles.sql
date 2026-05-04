-- ════════════════════════════════════════════════════════════════════════════
-- FIX: cliente users tienen rol equivocado en user_roles.
--
-- Detectado durante smoke RLS post-hardening: cliente.cfe@sysde.com tenía
-- rol 'pm' (no 'cliente'). Causa: seed de cliente users (seed-cliente-users.mjs
-- y/o manage-users.create_cliente) escribía rol incorrecto.
--
-- Efecto: is_staff_user(cliente.cfe) = TRUE → veía todos los clients.
-- Mi RLS strict del migration 20260503140000 está correcta; esto es bug de data.
--
-- Fix:
--   1. Identificar users con email matching cliente.*@sysde.com
--   2. DELETE sus roles incorrectos (admin, pm, ceo, gerente, gerente_soporte, colaborador)
--   3. INSERT rol 'cliente' si no lo tienen
--
-- Side effect: usuario que era PM legítimamente Y se llama "cliente.foo@..."
-- pierde su rol PM. Verifico que ese caso no exista.
-- ════════════════════════════════════════════════════════════════════════════

DO $fix$
DECLARE
  rec RECORD;
  users_fixed INT := 0;
  roles_removed INT := 0;
BEGIN
  -- Lista de cliente users del Login.tsx
  FOR rec IN
    SELECT au.id, au.email
      FROM auth.users au
     WHERE au.email LIKE 'cliente.%@sysde.com'
  LOOP
    -- Quitar roles staff incorrectos
    DELETE FROM public.user_roles
     WHERE user_id = rec.id
       AND role IN ('admin','pm','ceo','gerente','gerente_soporte','colaborador');
    GET DIAGNOSTICS roles_removed = ROW_COUNT;

    -- Asegurar rol cliente
    INSERT INTO public.user_roles (user_id, role)
    VALUES (rec.id, 'cliente'::public.app_role)
    ON CONFLICT (user_id, role) DO NOTHING;

    IF roles_removed > 0 THEN
      users_fixed := users_fixed + 1;
      RAISE NOTICE 'Fixed: % — removidos % roles staff, asegurado rol cliente', rec.email, roles_removed;
    END IF;
  END LOOP;

  RAISE NOTICE 'Total users cliente.* fixed: %', users_fixed;
END;
$fix$;

-- Verificación post-fix
DO $verify$
DECLARE
  rec RECORD;
  count_wrong INT := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE '=== Verificación: cliente.* users con roles incorrectos ===';
  FOR rec IN
    SELECT au.email, ur.role
      FROM auth.users au
      JOIN public.user_roles ur ON ur.user_id = au.id
     WHERE au.email LIKE 'cliente.%@sysde.com'
       AND ur.role IN ('admin','pm','ceo','gerente','gerente_soporte','colaborador')
  LOOP
    count_wrong := count_wrong + 1;
    RAISE WARNING '  % aún tiene rol %', rec.email, rec.role;
  END LOOP;
  IF count_wrong = 0 THEN
    RAISE NOTICE '  ✅ Todos los cliente.* tienen solo rol cliente';
  END IF;
END;
$verify$;
