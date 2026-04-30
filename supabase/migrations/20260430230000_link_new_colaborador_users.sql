-- Link los 5 auth users colaborador recién creados con sus tasks
-- (Luis Alfaro, Carlos Quesada, Maria Vargas, Carlos Rico, Bryan Hernandez)
--
-- Re-ejecuta el join sysde_team_members ↔ auth.users para los que tengan
-- email match. También sincroniza profile.full_name desde user_metadata
-- (debería estar via trigger, pero lo aseguramos).

UPDATE public.tasks t
   SET assigned_user_id = au.id
  FROM auth.users au
  JOIN public.sysde_team_members m ON LOWER(m.email) = LOWER(au.email)
 WHERE t.owner = m.name
   AND t.assigned_user_id IS NULL
   AND t.client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi');

-- Asegurar profile.full_name correcto (el trigger debería haberlo hecho)
UPDATE public.profiles p
   SET full_name = m.name
  FROM public.sysde_team_members m
  JOIN auth.users au ON LOWER(au.email) = LOWER(m.email)
 WHERE p.user_id = au.id
   AND (p.full_name IS NULL OR p.full_name = '');

-- Linkear sysde_team_members.user_id para que useMyTeamMember los resuelva
UPDATE public.sysde_team_members m
   SET user_id = au.id
  FROM auth.users au
 WHERE LOWER(au.email) = LOWER(m.email)
   AND m.user_id IS NULL;

DO $r$
DECLARE
  v_linked INT;
BEGIN
  SELECT COUNT(*) INTO v_linked
    FROM public.tasks
   WHERE assigned_user_id IS NOT NULL
     AND client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi');
  RAISE NOTICE 'Tasks de implementación con assigned_user_id: %', v_linked;
END;
$r$;
