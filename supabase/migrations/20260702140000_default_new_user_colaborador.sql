-- Auditoría del rol gerente (flag #1 — privilegio por defecto):
-- handle_new_user() asignaba a TODO registro nuevo sin rol explícito el rol
-- 'gerente' (rol de gestión con finanzas.ver_montos y lectura amplia). Un
-- signup sin metadata 'role' escalaba de facto a gerente. Se cambia el default
-- (y el fallback ante cast inválido) a 'colaborador', el rol de menor privilegio
-- del staff (0 permisos RBAC, finanzas enmascaradas). Los signups que traen
-- raw_user_meta_data->>'role' explícito NO cambian: solo cambia el fallback.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_role public.app_role;
BEGIN
  -- Insert profile
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT DO NOTHING;

  -- Determine role from metadata, default 'colaborador' (menor privilegio)
  BEGIN
    v_role := COALESCE(
      (NEW.raw_user_meta_data->>'role')::public.app_role,
      'colaborador'::public.app_role
    );
  EXCEPTION WHEN OTHERS THEN
    v_role := 'colaborador'::public.app_role;
  END;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, v_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$function$;
