-- ============================================================================
-- El cliente puede validar y reabrir sus casos. Hasta ahora no podía.
--
-- El portal muestra "Validar" y "Reabrir" para usuarios editor/admin, y ambos
-- hacían UPDATE directo sobre support_tickets. Pero sobre esa tabla el rol
-- cliente sólo tiene políticas de SELECT e INSERT: la de UPDATE es
-- "Staff update support_tickets", que lo excluye. Postgres no da error cuando
-- ninguna política deja pasar un UPDATE — actualiza CERO filas en silencio.
-- Resultado: el catch nunca se disparaba, salía el toast verde "Caso cerrado",
-- el update optimista lo pintaba, y al siguiente refetch todo volvía atrás.
-- El cliente creía haber cerrado el caso y el caso seguía abierto.
--
-- No se arregla abriendo una política de UPDATE para el cliente: RLS es por
-- fila, no por columna, así que eso le daría permiso sobre responsable,
-- prioridad, fecha_entrega y dias_antiguedad además de estado. Es el mismo
-- problema que nos costó las tres migraciones del tiempo facturable.
--
-- En su lugar, una función que hace exactamente una cosa. El cliente no
-- escribe la tabla; pide un cambio de estado acotado y la función decide.
-- ============================================================================

create or replace function public.cliente_cambiar_estado_caso(
  _ticket_id     uuid,
  _nuevo_estado  text,
  _motivo        text default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_client_id text;
  v_estado    text;
begin
  -- Sólo el portal. El staff tiene su propia política de UPDATE y no necesita
  -- esta puerta; dejarla abierta para todos sería un rodeo a la RLS.
  if not public.is_cliente_user() then
    raise exception 'Esta función es sólo para usuarios del portal del cliente'
      using errcode = '42501';
  end if;

  select client_id, estado into v_client_id, v_estado
    from public.support_tickets
   where id = _ticket_id;

  if v_client_id is null then
    raise exception 'El caso no existe' using errcode = 'P0002';
  end if;

  -- has_cliente_permission comprueba la asignación PARA ESE cliente, así que
  -- resuelve pertenencia y permiso de una vez. Se usa en lugar de comparar
  -- contra get_cliente_client_id(), que hace LIMIT 1 y elegiría mal si un
  -- usuario estuviera asignado a dos empresas.
  if not public.has_cliente_permission(auth.uid(), v_client_id, 'editor') then
    raise exception 'Tu usuario no tiene permiso de edición sobre este caso'
      using errcode = '42501';
  end if;

  -- Las dos únicas decisiones que el portal le pide al cliente, y sólo sobre
  -- un caso ya entregado. Validar cierra; reabrir devuelve el caso al equipo.
  if v_estado not in ('ENTREGADA', 'APROBADA') then
    raise exception 'Sólo se puede validar o reabrir un caso entregado (éste está en "%")', v_estado
      using errcode = '22023';
  end if;

  if _nuevo_estado not in ('CERRADA', 'EN ATENCIÓN') then
    raise exception 'Estado no permitido desde el portal: "%"', _nuevo_estado
      using errcode = '22023';
  end if;

  -- El trigger de reincidencias (trg_detect_ticket_reopen) lee esta metadata
  -- de la sesión. Sin ella registraría "(sin motivo registrado)"; acá al menos
  -- queda dicho de dónde vino la reapertura. is_local = true: vive lo que dure
  -- la transacción, que es donde ocurre el UPDATE.
  if _nuevo_estado = 'EN ATENCIÓN' then
    perform set_config(
      'app.reopen_metadata',
      jsonb_build_object(
        'reason', coalesce(nullif(btrim(_motivo), ''), 'Reabierto por el cliente desde el portal'),
        'reopen_type', 'cliente_rechazo'
      )::text,
      true);
  end if;

  update public.support_tickets
     set estado = _nuevo_estado
   where id = _ticket_id;

  return _nuevo_estado;
end;
$$;

comment on function public.cliente_cambiar_estado_caso(uuid, text, text) is
  'Única vía por la que el rol cliente puede escribir sobre support_tickets. '
  'Acota el cambio a estado, y sólo entre ENTREGADA/APROBADA y CERRADA o '
  'EN ATENCIÓN. Una política de UPDATE no serviría: RLS no distingue columnas.';

revoke all on function public.cliente_cambiar_estado_caso(uuid, text, text) from public;
revoke all on function public.cliente_cambiar_estado_caso(uuid, text, text) from anon;
grant execute on function public.cliente_cambiar_estado_caso(uuid, text, text) to authenticated;
