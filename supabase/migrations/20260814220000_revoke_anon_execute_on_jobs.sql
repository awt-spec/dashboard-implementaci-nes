-- ============================================================================
-- Cierra la ejecución ANÓNIMA de funciones que exponen datos o mutan estado.
--
-- Causa: PostgreSQL otorga EXECUTE a PUBLIC por defecto al crear una función, y
-- PUBLIC incluye al rol anon. Los `grant execute ... to authenticated` que hay
-- por todo el repo son ADITIVOS: no revocan nada. Como la clave anon es pública
-- (viaja en el bundle del front), cualquiera podía invocar por REST funciones
-- SECURITY DEFINER, que además ignoran RLS por definición.
--
-- Verificado empíricamente contra producción con la clave anon, sin login:
--   get_csr_commercial_signals  -> HTTP 200, devolvió 29 filas de datos comerciales
--   get_sla_summary             -> HTTP 200, ejecutó
--   get_user_email              -> HTTP 200, ejecutó (expone correos)
--   notify_contract_renewals    -> HTTP 200, ejecutó (escribe notificaciones)
--
-- Complementa a 20260710120000_close_anon_rls_leak.sql, que cerró la fuga a
-- nivel de TABLAS. Ésta cierra la que quedaba por FUNCIONES, que es peor porque
-- SECURITY DEFINER se salta las políticas.
-- ============================================================================

do $$
declare
  fn text;
  r  record;
  -- Funciones a cerrar. Se excluyen a propósito:
  --  · bump_shared_ticket_history_view → la usa SharedTicketHistory.tsx, que es
  --    una página pública sin login: revocarla rompería el enlace compartido.
  --  · has_permission, has_role, is_ceo_user, is_cliente_user, is_csr_user,
  --    is_gerente_soporte_user, is_staff_user, user_can_see_client → las invocan
  --    las políticas RLS. Sin EXECUTE, la consulta de un anónimo FALLA en vez de
  --    devolver vacío, y rompería las páginas públicas.
  objetivo text[] := array[
    'notify_contract_renewals',
    'expire_stale_quotes',
    'get_csr_commercial_signals',
    'get_user_email',
    'get_sla_summary',
    'get_sla_history',
    'get_tickets_sla_status',
    'get_client_account_statement',
    'get_audience_recipients',
    'get_supervisors_of_user',
    'get_my_permissions',
    'match_contract_chunks',
    'set_reopen_metadata'
  ];
begin
  foreach fn in array objetivo loop
    -- Recorre TODAS las sobrecargas de cada nombre.
    for r in
      select p.oid::regprocedure as sig
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = fn
    loop
      execute format('revoke all on function %s from public, anon', r.sig);
      execute format('grant execute on function %s to authenticated, service_role', r.sig);
      raise notice 'cerrada a anon: %', r.sig;
    end loop;
  end loop;
end $$;
