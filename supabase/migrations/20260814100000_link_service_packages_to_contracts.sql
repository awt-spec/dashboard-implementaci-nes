-- Conecta las pólizas (service_packages) con el contrato que las originó.
--
-- Hasta ahora service_packages sólo tenía client_id, así que las bolsas de horas
-- que alimentan el estado de cuenta vivían desconectadas del contrato que las
-- pactó: no se podía responder "¿qué contrato originó esta póliza?" ni cruzar
-- horas contratadas contra lo pactado en el clausulado.
--
-- La columna es NULLABLE a propósito: hay pólizas históricas anteriores a que
-- existiera la gestión de contratos, y forzarlas rompería el estado de cuenta.
-- on delete set null: borrar un contrato no debe borrar la póliza ni su consumo,
-- que son el respaldo del estado de cuenta que se le envía al cliente.

alter table public.service_packages
  add column if not exists contract_id uuid
  references public.client_contracts(id) on delete set null;

create index if not exists service_packages_contract_id_idx
  on public.service_packages (contract_id);

comment on column public.service_packages.contract_id is
  'Contrato que originó la póliza. NULL = póliza histórica sin contrato asociado.';

-- Backfill SÓLO donde no hay ambigüedad: clientes con exactamente UN contrato.
-- Con dos o más contratos no hay forma de saber cuál originó cada póliza sin
-- criterio humano, y adivinar dejaría datos incorrectos en el estado de cuenta.
-- Esas quedan en NULL para que alguien las asigne desde la UI.
with unico as (
  select client_id, min(id) as contract_id
  from public.client_contracts
  group by client_id
  having count(*) = 1
)
update public.service_packages sp
   set contract_id = u.contract_id
  from unico u
 where sp.client_id = u.client_id
   and sp.contract_id is null;
