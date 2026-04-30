-- Link los 8 colaboradores restantes con sus auth users.
-- 7 creados ahora + 1 (Walter Gómez) que ya existía pero no estaba linkeado.
-- Mismo patrón que 20260430230000.

-- Linkear sysde_team_members.user_id
UPDATE public.sysde_team_members m
   SET user_id = au.id
  FROM auth.users au
 WHERE LOWER(au.email) = LOWER(m.email)
   AND m.user_id IS NULL;

-- Linkear assigned_user_id en tasks (para que ColaboradorDashboard funcione)
UPDATE public.tasks t
   SET assigned_user_id = au.id
  FROM auth.users au
  JOIN public.sysde_team_members m ON LOWER(m.email) = LOWER(au.email)
 WHERE t.owner = m.name
   AND t.assigned_user_id IS NULL
   AND t.client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi');

-- Sincronizar profile.full_name (el trigger handle_new_user debería haberlo hecho)
UPDATE public.profiles p
   SET full_name = m.name
  FROM public.sysde_team_members m
  JOIN auth.users au ON LOWER(au.email) = LOWER(m.email)
 WHERE p.user_id = au.id
   AND (p.full_name IS NULL OR p.full_name = '' OR p.full_name != m.name);

DO $r$
DECLARE
  v_with_user INT;
  v_total     INT;
  v_unlinked  INT;
BEGIN
  SELECT COUNT(*) INTO v_with_user
    FROM public.tasks
   WHERE assigned_user_id IS NOT NULL
     AND client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi');
  SELECT COUNT(*) INTO v_total
    FROM public.tasks
   WHERE client_id IN ('aurum','apex','dos-pinos','arkfin','amc','cmi');
  SELECT COUNT(*) INTO v_unlinked
    FROM public.sysde_team_members WHERE user_id IS NULL AND is_active = TRUE;
  RAISE NOTICE 'Tasks linked: %/% (%.0f%%) · sysde_team_members sin user_id: %',
    v_with_user, v_total, v_with_user::float * 100 / v_total, v_unlinked;
END;
$r$;
