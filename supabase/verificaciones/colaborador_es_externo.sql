-- ============================================================================
-- VERIFICACIÓN de la migración "el colaborador es externo".
--
-- No cambia nada. Simula la sesión de Luis Alfaro y la de un admin dentro de
-- la base, y prueba lectura y escritura. Cada escritura va en su propia
-- subtransacción que se revierte siempre — el resultado se conserva, el
-- cambio no.
--
-- Corré el archivo entero. Devuelve una tabla con una fila por prueba.
-- ============================================================================
drop table if exists _v;
create temp table _v (n int, prueba text, esperado text, obtenido text);
grant all on _v to authenticated;

do $$
declare
  luis uuid; admin uuid; k int; j jsonb; cli text; ncerr int;
begin
  select user_id into luis from public.sysde_team_members
    where email = 'lalfaro-contratista@sysde.com';
  select ur.user_id into admin from public.user_roles ur where ur.role = 'admin' limit 1;

  -- El cliente de prueba NO puede elegirse con un "limit 1" arbitrario: si cae
  -- uno sin casos cerrados, el histórico da 0 para todo el mundo y la prueba 15
  -- pasa igual sin la migración. Falso verde. Se toma el que más cerrados tenga.
  select x.client_id, x.cerrados into cli, ncerr
  from (
    select c.client_id,
           (select count(*) from public.support_tickets t
              where t.client_id = c.client_id
                and t.estado in ('CERRADA','ENTREGADA','APROBADA')) as cerrados
    from (
      select distinct client_id from public.tasks where assigned_user_id = luis
      union
      select distinct client_id from public.support_tickets where assigned_user_id = luis
    ) c
    where c.client_id is not null
  ) x
  order by x.cerrados desc nulls last limit 1;
  if coalesce(ncerr, 0) = 0 then cli := null; end if;

  insert into _v values (0,'Luis encontrado en el directorio','un uuid',
    coalesce(luis::text,'NO ENCONTRADO'));
  insert into _v values (1,'cliente de prueba (con casos cerrados)','uno con >0',
    coalesce(cli || ' (' || ncerr || ' cerrados)',
             'NINGUNO — las pruebas 15 y 31 no se corren'));

  -- ═══════════════ COLABORADOR ═══════════════
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', luis::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', luis, 'email','lalfaro-contratista@sysde.com')::text, true);

  insert into _v values (10,'is_colaborador_user() para Luis','true',
    public.is_colaborador_user()::text);
  insert into _v values (11,'filas del directorio que ve','1',
    (select count(*)::text from public.sysde_team_members));
  insert into _v values (12,'filas AJENAS que ve','0',
    (select count(*)::text from public.sysde_team_members
       where email is distinct from 'lalfaro-contratista@sysde.com'));
  insert into _v values (13,'conserva su propia fila','Luis Alfaro',
    coalesce((select max(name) from public.sysde_team_members),'NINGUNA (le rompe el panel)'));
  insert into _v values (14,'conserva su employment_type','no nulo',
    coalesce((select max(employment_type) from public.sysde_team_members),
             'NULO (horas no facturables)'));

  if cli is not null then
    j := public.get_sla_history(cli);
    insert into _v values (15,'histórico del cliente donde trabaja','0',
      coalesce(j->>'closed_total','(nulo)'));
  end if;

  -- Escrituras: cada una se revierte, el conteo sobrevive.
  k := -1;
  begin
    update public.sysde_team_members set hourly_rate = 999 where user_id = luis;
    get diagnostics k = row_count;
    raise exception 'revertir' using errcode = 'BE000';
  exception when others then null; end;
  insert into _v values (20,'se sube su propia tarifa','0 filas',
    case when k < 0 then 'rechazado por RLS' else k||' filas' end);

  k := -1;
  begin
    delete from public.sysde_team_members where user_id = luis;
    get diagnostics k = row_count;
    raise exception 'revertir' using errcode = 'BE000';
  exception when others then null; end;
  insert into _v values (21,'se borra a sí mismo','0 filas',
    case when k < 0 then 'rechazado por RLS' else k||' filas' end);

  k := -1;
  begin
    update public.sysde_team_members set hourly_rate = 0 where user_id is distinct from luis;
    get diagnostics k = row_count;
    raise exception 'revertir' using errcode = 'BE000';
  exception when others then null; end;
  insert into _v values (22,'toca filas ajenas','0 filas',
    case when k < 0 then 'rechazado por RLS' else k||' filas' end);

  reset role;

  -- ═══════════════ ADMIN — el panel no se puede haber roto ═══════════════
  set local role authenticated;
  perform set_config('request.jwt.claim.sub', admin::text, true);
  perform set_config('request.jwt.claims',
    json_build_object('sub', admin, 'email','admin@sysde.com')::text, true);

  insert into _v values (30,'admin sigue viendo el directorio','todas',
    (select count(*)::text from public.sysde_team_members));
  if cli is not null then
    j := public.get_sla_history(cli);
    insert into _v values (31,'admin sigue viendo el histórico', ncerr::text,
      coalesce(j->>'closed_total','(nulo)'));
  end if;

  k := -1;
  begin
    update public.sysde_team_members set hourly_rate = 7 where user_id = luis;
    get diagnostics k = row_count;
    raise exception 'revertir' using errcode = 'BE000';
  exception when others then null; end;
  insert into _v values (32,'admin sigue pudiendo editar','1 filas',
    case when k < 0 then 'RECHAZADO (panel roto)' else k||' filas' end);

  reset role;
end $$;

select n, prueba, esperado, obtenido,
  case
    when n < 10 then ''
    when n = 30 then case when obtenido ~ '^[0-9]+$' and obtenido::int > 1 then 'OK' else 'REVISAR' end
    when n = 13 then case when obtenido like 'Luis%' then 'OK' else 'REVISAR' end
    when n = 14 then case when obtenido not like 'NULO%' then 'OK' else 'REVISAR' end
    when esperado = obtenido then 'OK'
    when esperado = '0 filas' and obtenido = 'rechazado por RLS' then 'OK'
    else 'REVISAR'
  end as veredicto
from _v order by n;
