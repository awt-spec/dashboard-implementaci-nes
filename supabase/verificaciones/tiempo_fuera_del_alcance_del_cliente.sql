-- ============================================================================
-- VERIFICACIÓN de "el tiempo facturable fuera del alcance del cliente".
--
-- No cambia nada. Simula dentro de la base la sesión de un usuario con rol
-- cliente y la de un admin, y prueba lectura y escritura. Cada escritura va en
-- su propia subtransacción que se revierte siempre: el resultado se guarda en
-- una variable —que sobrevive al rollback— y recién después se escribe en la
-- tabla de resultados.
--
-- Corré el archivo entero. Devuelve una fila por prueba.
-- Sirve tanto después de la FASE 1 como después de la FASE 2; la prueba 7 es
-- la que distingue una de la otra.
-- ============================================================================
drop table if exists _v;
create temp table _v (n int, prueba text, esperado text, obtenido text);
grant all on _v to public;

do $$
declare
  u_cli uuid; u_adm uuid; u_col uuid; cid text; tid uuid;
  k bigint; e text; est text; hay_columnas boolean;
begin
  -- ── elegir sujetos reales: el cliente con MÁS casos, no el primero que
  --    aparezca. Un cliente con cero casos haría pasar todas las pruebas de
  --    fuga sin probar nada.
  select ca.user_id, ca.client_id into u_cli, cid
    from public.cliente_company_assignments ca
    join public.user_roles ur on ur.user_id = ca.user_id and ur.role = 'cliente'
    join public.support_tickets t on t.client_id = ca.client_id
   group by ca.user_id, ca.client_id
   order by count(t.id) desc
   limit 1;

  select ur.user_id into u_adm
    from public.user_roles ur where ur.role = 'admin' limit 1;

  select ur.user_id into u_col
    from public.user_roles ur where ur.role = 'colaborador' limit 1;

  if u_cli is null then
    insert into _v values (0,'hay un usuario cliente con casos','sí','NO — no se puede verificar');
    return;
  end if;

  select count(*) into k from public.support_tickets where client_id = cid;
  insert into _v values (0,'sujeto: cliente '||cid||' con casos','> 0',k::text);

  select exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='support_tickets'
                    and column_name='tiempo_cobrado_minutos') into hay_columnas;

  -- ── 1 · los datos están completos en la tabla nueva
  select count(*) into k
    from public.support_tickets t
    left join public.support_ticket_time x on x.ticket_id = t.id
   where x.ticket_id is null;
  insert into _v values (1,'casos SIN fila de tiempo','0',k::text);

  -- ── 2 · el cliente no ve nada de la tabla de tiempo
  perform set_config('role','authenticated',true);
  perform set_config('request.jwt.claim.sub', u_cli::text, true);
  select count(*) into k from public.support_ticket_time;
  insert into _v values (2,'el cliente ve filas de tiempo','0',k::text);

  -- ── 3 · el cliente no la puede modificar
  k := -1; e := null;
  begin
    update public.support_ticket_time set tiempo_cobrado_minutos = 0;
    get diagnostics k = row_count;
    raise exception 'revertir';
  exception when others then e := sqlerrm; end;
  insert into _v values (3,'filas de tiempo que el cliente modifica','0',
    case when e='revertir' then k::text else 'denegado (0)' end);

  -- ── 4 · el cliente sigue viendo SUS casos (no rompimos el portal)
  select count(*) into k from public.support_tickets where client_id = cid;
  insert into _v values (4,'el cliente sigue viendo sus casos','> 0',
    case when k > 0 then k::text else '0 — SE ROMPIÓ' end);

  -- ── 5 · el UPDATE directo del cliente sigue bloqueado, y así debe ser.
  -- Esta fila esperaba 1 y estaba mal planteada: se escribió suponiendo que el
  -- cliente podía escribir support_tickets. No puede —sólo tiene SELECT e
  -- INSERT— y ahí estaba el bug de Validar/Reabrir: el UPDATE afectaba cero
  -- filas sin dar error. Que valga siga funcionando se comprueba en la fila 16,
  -- por la RPC.
  select id into tid from public.support_tickets where client_id = cid limit 1;
  k := -1; e := null;
  begin
    update public.support_tickets set estado = estado where id = tid;
    get diagnostics k = row_count;
    raise exception 'revertir';
  exception when others then e := sqlerrm; end;
  insert into _v values (5,'el UPDATE directo del cliente sigue bloqueado','0',
    case when e='revertir' then k::text else 'denegado (0)' end);

  -- ── 6 · el staff sí lee el tiempo
  if u_adm is not null then
    perform set_config('request.jwt.claim.sub', u_adm::text, true);
    select count(*) into k from public.support_ticket_time;
    insert into _v values (6,'el admin ve filas de tiempo','> 0',
      case when k > 0 then k::text else '0 — SE ROMPIÓ EL STAFF' end);
  end if;

  -- ── 6b · el colaborador tampoco: es externo y esto es dato comercial
  if u_col is not null then
    perform set_config('request.jwt.claim.sub', u_col::text, true);
    select count(*) into k from public.support_ticket_time;
    insert into _v values (8,'el colaborador ve filas de tiempo','0',k::text);

    k := -1; e := null;
    begin
      delete from public.support_ticket_time;
      get diagnostics k = row_count;
      raise exception 'revertir';
    exception when others then e := sqlerrm; end;
    insert into _v values (9,'filas de tiempo que el colaborador BORRA','0',
      case when e='revertir' then k::text else 'denegado (0)' end);

    -- y que no le rompimos su pantalla: sigue viendo casos
    select count(*) into k from public.support_tickets;
    insert into _v values (10,'el colaborador sigue viendo casos','> 0',
      case when k > 0 then k::text else '0 — SE ROMPIÓ EL COLABORADOR' end);
  else
    insert into _v values (8,'hay un usuario colaborador para probar','sí','no — sin sujeto');
  end if;

  perform set_config('role','postgres',true);

  -- ── 6c · comprobación directa de que la migración del colaborador quedó.
  -- Las pruebas de arriba son de comportamiento y podrían pasar por la razón
  -- equivocada —por ejemplo si no existe ningún usuario colaborador—, así que
  -- se mira también la definición de las políticas.
  select count(*) into k
    from pg_policies
   where schemaname = 'public' and tablename = 'support_ticket_time'
     and qual like '%is_colaborador_user%';
  insert into _v values (11,'políticas que nombran al colaborador','2',k::text);

  select count(*) into k
    from pg_policies
   where schemaname = 'public' and tablename = 'support_ticket_time'
     and permissive = 'RESTRICTIVE';
  insert into _v values (12,'políticas restrictivas en la tabla','1',k::text);

  -- ── 6d · la RPC con la que el cliente valida y reabre (20260905150000).
  -- Existir no basta: si el GRANT no entró, el cliente recibe "permission
  -- denied" y los botones siguen sin funcionar, sólo que ahora ruidosamente.
  select count(*) into k from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname='public' and p.proname='cliente_cambiar_estado_caso';
  insert into _v values (13,'la RPC existe','1',k::text);

  -- has_function_privilege() lanza error si la función no existe, y eso
  -- abortaba el bloque entero: el escenario más probable —que la migración no
  -- se haya corrido— daba un crash en vez de una tabla legible. Por eso las
  -- dos filas de permisos van dentro del if.
  if k > 0 then
    insert into _v values (14,'authenticated puede ejecutarla','sí',
      case when has_function_privilege('authenticated',
             'public.cliente_cambiar_estado_caso(uuid,text,text)', 'EXECUTE')
           then 'sí' else 'NO — falta el GRANT' end);

    insert into _v values (15,'anon NO puede ejecutarla','no',
      case when has_function_privilege('anon',
             'public.cliente_cambiar_estado_caso(uuid,text,text)', 'EXECUTE')
           then 'SÍ — falta el REVOKE' else 'no' end);
  else
    insert into _v values (14,'authenticated puede ejecutarla','sí','no existe la RPC');
    insert into _v values (15,'anon NO puede ejecutarla','no','no existe la RPC');
  end if;

  -- La prueba de verdad: que el cliente mueva un caso suyo. Se revierte.
  select id into tid from public.support_tickets
   where client_id = cid and estado in ('ENTREGADA','APROBADA') limit 1;
  if k = 0 then
    insert into _v values (16,'el cliente valida un caso entregado','CERRADA','no existe la RPC');
  elsif tid is null then
    insert into _v values (16,'el cliente valida un caso entregado','CERRADA',
      'sin caso entregado para probar');
  else
    perform set_config('role','authenticated',true);
    perform set_config('request.jwt.claim.sub', u_cli::text, true);
    e := null; est := null;
    begin
      perform public.cliente_cambiar_estado_caso(tid, 'CERRADA');
      select estado into est from public.support_tickets where id = tid;
      raise exception 'revertir';
    exception when others then e := sqlerrm; end;
    insert into _v values (16,'el cliente valida un caso entregado','CERRADA',
      case when e = 'revertir' then est else 'ERROR: ' || e end);
    perform set_config('role','postgres',true);
  end if;

  -- ── 7 · ¿ya se cerró el hueco?
  -- Tras la FASE 1 esto dice "sí" y es correcto: el hueco sigue abierto a
  -- propósito hasta que el frontend esté desplegado. Tras la FASE 2 debe decir
  -- "no" — ahí es cuando queda cerrado.
  insert into _v values (7,'las columnas viejas siguen en support_tickets',
    'no', case when hay_columnas then 'sí — falta correr la fase 2' else 'no' end);
end $$;

select n, prueba, esperado, obtenido,
       case
         when esperado = '> 0' then case when obtenido ~ '^[1-9][0-9]*$' then 'OK' else 'REVISAR' end
         when obtenido = esperado then 'OK'
         when obtenido like 'denegado%' and esperado = '0' then 'OK'
         else 'REVISAR'
       end as veredicto
  from _v order by n;
