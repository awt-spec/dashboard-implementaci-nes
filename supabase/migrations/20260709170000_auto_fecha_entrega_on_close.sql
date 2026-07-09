-- Estampa automáticamente support_tickets.fecha_entrega cuando un caso pasa a
-- cerrado/entregado, para que el histórico de cumplimiento SLA (get_sla_history)
-- se llene solo hacia adelante sin depender de carga manual.
--
-- Diseño:
--  • Solo estampa en la transición abierto→cerrado (o INSERT ya cerrado), y solo
--    si fecha_entrega venía nula. NO backfillea casos ya cerrados (evitaría fechas
--    de resolución falsas = now() sobre casos viejos).
--  • ANULADA no cuenta como entrega (cancelado ≠ resuelto).
--  • No pisa una fecha_entrega ya cargada.

create or replace function public.set_fecha_entrega_on_close()
returns trigger language plpgsql as $$
declare
  closed_now boolean := NEW.estado in ('CERRADA','ENTREGADA','APROBADA');
  closed_before boolean := TG_OP = 'UPDATE' and OLD.estado in ('CERRADA','ENTREGADA','APROBADA');
begin
  if closed_now and not closed_before and NEW.fecha_entrega is null then
    NEW.fecha_entrega := now();
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_set_fecha_entrega on support_tickets;
create trigger trg_set_fecha_entrega
before insert or update on support_tickets
for each row execute function public.set_fecha_entrega_on_close();
