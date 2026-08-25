-- ============================================================================
-- Cierre del backlog: ENTREGADA y POR CERRAR → CERRADA
--
-- Para pegar en el editor SQL de Supabase. Esto ES SQL.
--
-- Por qué: get_tickets_sla_status() define su universo con
--   where t.estado not in ('CERRADA', 'ANULADA')
-- así que un caso "ENTREGADA" o "POR CERRAR" sigue contando en el total del
-- chip del header aunque el trabajo ya esté hecho. Hoy son 63 + 25 = 88 de los
-- 383 abiertos. Cerrarlos los saca del universo.
--
-- QUÉ ESPERAR, SIN ADORNOS:
--   total          383 → ~295
--   no_sla          65 → 2     (quedan sólo las 2 APROBADA)
--   overdue        318 → ~293
--   cumplimiento     0% → 0%   ← NO cambia.
--
-- Las 63 ENTREGADA ya contaban como no_sla, o sea fuera del cálculo, y las 25
-- POR CERRAR eran vencidas. Sacar 25 vencidas de un universo donde las otras
-- 293 también están vencidas deja el porcentaje igual. Esto limpia el
-- inventario; no arregla la métrica. El porcentaje sólo se mueve cuando entren
-- casos nuevos atendidos dentro del plazo.
--
-- Correr los pasos EN ORDEN, uno por uno, leyendo el resultado de cada uno.
-- El paso 2 deja un respaldo y el paso 5 revierte todo desde él.
-- ============================================================================


-- ── PASO 1 · Vista previa. No modifica nada. ────────────────────────────────
-- Confirma los números antes de tocar la tabla. La columna sin_fecha_entrega
-- importa para el paso 3b.

select
  t.estado,
  count(*)                                        as casos,
  count(*) filter (where t.fecha_entrega is null)  as sin_fecha_entrega,
  min(t.fecha_registro)::date                      as mas_viejo,
  max(t.fecha_registro)::date                      as mas_nuevo,
  count(distinct t.client_id)                      as clientes
from public.support_tickets t
where t.estado in ('ENTREGADA', 'POR CERRAR')
group by t.estado
order by t.estado;

-- Desglose por cliente, por si alguno concentra el backlog y conviene avisarle
-- antes de cerrarle veinte casos de golpe:
--
--   select c.name as cliente, t.estado, count(*) as casos
--   from public.support_tickets t
--   join public.clients c on c.id = t.client_id
--   where t.estado in ('ENTREGADA', 'POR CERRAR')
--   group by 1, 2 order by 3 desc;


-- ── PASO 2 · Respaldo. Obligatorio: el paso 5 depende de esta tabla. ────────

create table if not exists public.backup_cierre_backlog_20260825 as
select t.id, t.ticket_id, t.estado, t.fecha_entrega, now() as respaldado_en
from public.support_tickets t
where t.estado in ('ENTREGADA', 'POR CERRAR');

-- La tabla queda en el esquema public, que PostgREST publica. Sin RLS la
-- leería cualquiera con la anon key. Se habilita sin políticas: nadie entra
-- salvo desde el editor SQL.
alter table public.backup_cierre_backlog_20260825 enable row level security;

-- Debe dar 88, o lo que haya dicho el paso 1:
select count(*) as respaldados from public.backup_cierre_backlog_20260825;


-- ── PASO 3 · El cierre. ─────────────────────────────────────────────────────

update public.support_tickets
   set estado = 'CERRADA'
 where estado in ('ENTREGADA', 'POR CERRAR');


-- ── PASO 3b · Deshacer las fechas de entrega inventadas. ────────────────────
-- El trigger trg_set_fecha_entrega estampa fecha_entrega = now() cuando un caso
-- pasa a cerrado y no la tenía. Para las POR CERRAR eso sería mentira: diría
-- que un caso registrado en marzo se resolvió hoy, y get_sla_history() mide el
-- tiempo de resolución como fecha_entrega - fecha_registro. Quedarían
-- resoluciones de cinco meses cargadas al mes en curso y el histórico se
-- desplomaría por un cierre administrativo.
--
-- Lo que no sabemos cuándo se resolvió se queda sin fecha y no entra al
-- histórico. Preferible no medir a medir mal.
--
-- Este UPDATE vuelve a disparar el trigger, pero ya no estampa nada: el caso
-- venía cerrado y viene cerrado (closed_before y closed_now son ambos true).

update public.support_tickets t
   set fecha_entrega = null
  from public.backup_cierre_backlog_20260825 b
 where b.id = t.id
   and b.fecha_entrega is null
   and t.fecha_entrega is not null;

-- Los otros triggers de la tabla, que sí se dejan correr:
--   • trg_log_ticket_change    → deja una fila por caso en ticket_access_log
--     con el estado anterior y el nuevo. Es la bitácora del cierre; se quiere.
--     user_id queda NULL porque el editor SQL no tiene sesión de usuario.
--   • trg_detect_ticket_reopen → no dispara: sólo detecta ENTREGADA/APROBADA
--     hacia un estado ACTIVO, y CERRADA no lo es. No se cuentan reaperturas.
--   • trg_ticket_assigned_notify → no dispara: escucha UPDATE OF
--     assigned_user_id, que no se toca. Nadie recibe correo.


-- ── PASO 4 · Verificación. ──────────────────────────────────────────────────

-- (a) No debe quedar ninguno:
select count(*) as pendientes
from public.support_tickets
where estado in ('ENTREGADA', 'POR CERRAR');

-- (b) Ninguna fecha de entrega inventada hoy:
select count(*) as fechas_de_hoy
from public.support_tickets t
join public.backup_cierre_backlog_20260825 b on b.id = t.id
where b.fecha_entrega is null and t.fecha_entrega is not null;

-- (c) El resumen que alimenta el chip del header y la fila de KPIs:
select * from public.get_sla_summary();

-- (d) El detalle; la suma tiene que dar el total de (c):
select sla_status, sla_source, count(*)
from public.get_tickets_sla_status()
group by 1, 2
order by 1, 2;

-- (e) Lo que queda abierto. Acá está el trabajo real que sigue:
select estado, count(*) as casos
from public.support_tickets
where estado not in ('CERRADA', 'ANULADA')
group by 1
order by 2 desc;


-- ── PASO 5 · Revertir, sólo si hizo falta. ──────────────────────────────────
-- Devuelve cada caso a su estado y su fecha originales desde el respaldo.
--
--   update public.support_tickets t
--      set estado = b.estado, fecha_entrega = b.fecha_entrega
--     from public.backup_cierre_backlog_20260825 b
--    where b.id = t.id;
--
-- Cuando ya no se necesite el respaldo:
--   drop table public.backup_cierre_backlog_20260825;
