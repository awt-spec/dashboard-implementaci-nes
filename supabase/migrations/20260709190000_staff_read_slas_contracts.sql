-- Fix de visibilidad: faltaba el policy de SELECT para el staff en client_slas
-- y client_contracts. Con RLS activa, el staff (admin/PM/gerente/…) NO podía
-- LEER los SLAs ni los contratos por su JWT → la ficha de "Contratos & SLA"
-- aparecía vacía ("Sin SLAs registrados" / "Sin definir") aunque los datos
-- existieran. Las escrituras (insert/update/delete) siguen restringidas a
-- admin/PM (crear/editar) y admin (borrar); esto solo agrega LECTURA.

-- client_slas: staff puede leer (CSR ya tenía su propio policy "csr read slas").
drop policy if exists "staff read slas" on public.client_slas;
create policy "staff read slas" on public.client_slas
  for select using (public.is_staff_user());

-- client_contracts: no tenía ningún policy de SELECT (nadie leía por JWT).
drop policy if exists "staff read contracts" on public.client_contracts;
create policy "staff read contracts" on public.client_contracts
  for select using (public.is_staff_user() or public.is_csr_user());
