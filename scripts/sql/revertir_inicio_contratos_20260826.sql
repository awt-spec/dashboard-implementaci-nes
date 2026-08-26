-- ============================================================================
-- REVERSIÓN de los start_date de contratos al estado del 26/08/2026.
--
-- Antes de que se movieran a la fecha del primer caso de cada cliente. Los 30
-- contratos, con su fecha original exacta, capturada desde la base.
--
-- Correr COMPLETO en el editor SQL de Supabase sólo si hay que deshacer.
-- Mover start_date no dispara ningún efecto colateral: sync_contract_status_active
-- sólo reacciona a status e is_active, que no se tocan. log_contract_change deja
-- constancia del cambio en contract_history, igual que la ida.
-- ============================================================================

update public.client_contracts c
   set start_date = b.start_date
  from (values
  ('08cfcd78-29e8-45ed-9d79-acf91c82aead'::uuid, '2026-01-01'::date),  -- AFP ATLÁNTICO
  ('dfbe4a8e-1ff8-4e11-b800-2910a6627ec5'::uuid, '2026-01-01'::date),  -- AFP Atlántida
  ('a1545229-aabe-4617-b9a0-1ae2cc01017a'::uuid, '2026-01-01'::date),  -- AFPC Occidente
  ('1a4e4a20-f8a8-4deb-96c2-875150c90f69'::uuid, '2026-05-20'::date),  -- AMC
  ('217e30c4-345c-4da8-ac43-68213dc411e1'::uuid, '2026-04-23'::date),  -- Apex
  ('119463d0-38a1-407c-af59-7f5b24180958'::uuid, '2026-04-23'::date),  -- Arkfin
  ('e638a671-fe92-4ff6-bf3e-56c3628ff426'::uuid, '2026-04-23'::date),  -- Aurum
  ('efb34859-54b0-493d-91fc-a2446e91f1c4'::uuid, '2026-01-01'::date),  -- Banco de Bogotá
  ('36d92b0f-f5a0-43e8-966e-81beacbe7cee'::uuid, '2026-04-23'::date),  -- CFE Panamá
  ('525428e4-b9af-4e47-aeee-4177fd26805e'::uuid, '2026-01-01'::date),  -- CFE PANAMÁ
  ('d7fab81c-a59f-4795-9f86-91af3a9d4c16'::uuid, '2026-04-23'::date),  -- CMI
  ('2454edb2-c614-4be4-bd8b-f59e71a7bdf1'::uuid, '2026-01-01'::date),  -- CMI Leasing S.A.
  ('ab09059f-be98-4562-94c9-4c7e38178397'::uuid, '2026-04-23'::date),  -- Coopecar
  ('840e6967-cf3c-42c0-892a-6fbec2224c94'::uuid, '2026-04-23'::date),  -- Credicefi
  ('6ec4bb93-ab02-4318-8cbe-47ce4e2d36a0'::uuid, '2026-04-23'::date),  -- Credicefi
  ('882b04a9-0eaa-468a-8033-1e93fe96660f'::uuid, '2026-01-01'::date),  -- CRG Credit Rural
  ('92687463-420b-445d-b726-c6408a11a471'::uuid, '2026-02-01'::date),  -- Dos Pinos
  ('f49abfa2-39a4-432f-881c-32d427f69e6e'::uuid, '2026-01-01'::date),  -- FACTOR Y VALOR
  ('0c5dd690-ec5f-4ea9-b999-955d6e744640'::uuid, '2026-01-01'::date),  -- Fafidess
  ('0522eab5-02c3-467d-bf26-8fb120fe026f'::uuid, '2026-04-23'::date),  -- FIACG
  ('63d50ae7-d145-466c-9a28-b0678cbd13a7'::uuid, '2026-04-23'::date),  -- Fundap
  ('ffbe4751-7761-4556-831e-c5b59f28b8ea'::uuid, '2026-01-01'::date),  -- INS Filemaster
  ('4e74907f-1995-4b4d-bfe4-75240d0343b6'::uuid, '2026-05-02'::date),  -- Quiero Confianza (ION)
  ('d5da93e0-8878-4cf5-8160-c25630cc56fe'::uuid, '2026-01-01'::date),  -- KAFO JIGINEW
  ('cc406bb4-0828-4045-b9a5-ea4d78e4c762'::uuid, '2026-01-01'::date),  -- MECZY
  ('5af944b1-dd08-4072-8b1b-8bbeb64db09e'::uuid, '2026-01-01'::date),  -- Micitt
  ('71bf25bf-4a6b-43f0-b62b-f935059f9033'::uuid, '2026-01-01'::date),  -- Mun. Escazú
  ('8e61a150-dc6f-4e0d-9924-d7ec11bb2589'::uuid, '2026-01-01'::date),  -- Quiero Confianza
  ('f05d6f61-e74f-4ed8-b525-39b7d1f69294'::uuid, '2026-04-23'::date),  -- SAF UPV
  ('bc5c4b76-e4ee-4354-ba58-fe4cea9e12eb'::uuid, '2026-01-01'::date)   -- SOFIMSA
) as b(id, start_date)
 where b.id = c.id;

-- Debe volver a dar 78:
select count(*) from public.get_tickets_sla_status() where coverage <> 'cubierto';
