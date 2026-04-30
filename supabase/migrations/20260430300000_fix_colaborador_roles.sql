-- ════════════════════════════════════════════════════════════════════════════
-- Fix roles colaboradores recién creados
--
-- Problema: el trigger handle_new_user crea por default rol 'gerente' en
-- cada nuevo signup. Cuando manage-users action=create insertó
-- 'colaborador', estos users quedaron con AMBOS roles.
--
-- useAuth() resuelve por prioridad → gerente (3) > colaborador (2), por
-- eso eran ruteados a GerenteSupportDashboard en vez de ColaboradorDashboard.
--
-- Fix: eliminar el rol 'gerente' de los 13 colaboradores cuyos auth users
-- creamos en las migraciones 20260430230000 + 20260430280000 (todos los
-- contratistas y los staff CRICO/BHERNANDEZ que claramente son colaboradores).
-- ════════════════════════════════════════════════════════════════════════════

DELETE FROM public.user_roles
 WHERE role = 'gerente'
   AND user_id IN (
     SELECT au.id FROM auth.users au
     WHERE au.email IN (
       'lalfaro-contratista@sysde.com',
       'cquesada-contratista@sysde.com',
       'mavargas-contratista@sysde.com',
       'crico@sysde.com',
       'bhernandez-contratista@sysde.com',
       'wgomez-contratista@sysde.com',
       'ajgomez-contratista@sysde.com',
       'lmangel-contratista@sysde.com',
       'fpinto-contratista@sysde.com',
       'dgarcia-contratista@sysde.com',
       'avenegas-contratista@sysde.com',
       'mpisacreta-contratista@sysde.com',
       'sguerra-contratista@sysde.com'
     )
   );

-- Asegurar que TODOS estos auth users tengan al menos rol 'colaborador'
-- (idempotente vía ON CONFLICT — la tabla user_roles tiene UNIQUE en
--  (user_id, role)).
INSERT INTO public.user_roles (user_id, role)
SELECT au.id, 'colaborador'::public.app_role
  FROM auth.users au
 WHERE au.email IN (
   'lalfaro-contratista@sysde.com', 'cquesada-contratista@sysde.com',
   'mavargas-contratista@sysde.com', 'crico@sysde.com',
   'bhernandez-contratista@sysde.com', 'wgomez-contratista@sysde.com',
   'ajgomez-contratista@sysde.com', 'lmangel-contratista@sysde.com',
   'fpinto-contratista@sysde.com', 'dgarcia-contratista@sysde.com',
   'avenegas-contratista@sysde.com', 'mpisacreta-contratista@sysde.com',
   'sguerra-contratista@sysde.com'
 )
ON CONFLICT (user_id, role) DO NOTHING;

DO $r$
DECLARE
  rec RECORD;
BEGIN
  RAISE NOTICE 'Roles finales por colaborador:';
  FOR rec IN
    SELECT au.email, string_agg(ur.role::text, ',') AS roles
      FROM auth.users au
      LEFT JOIN public.user_roles ur ON ur.user_id = au.id
     WHERE au.email IN (
       'lalfaro-contratista@sysde.com', 'cquesada-contratista@sysde.com',
       'mavargas-contratista@sysde.com', 'crico@sysde.com',
       'bhernandez-contratista@sysde.com', 'wgomez-contratista@sysde.com',
       'ajgomez-contratista@sysde.com', 'lmangel-contratista@sysde.com',
       'fpinto-contratista@sysde.com', 'dgarcia-contratista@sysde.com',
       'avenegas-contratista@sysde.com', 'mpisacreta-contratista@sysde.com',
       'sguerra-contratista@sysde.com'
     )
     GROUP BY au.email
  LOOP
    RAISE NOTICE '  % → %', rec.email, rec.roles;
  END LOOP;
END;
$r$;
