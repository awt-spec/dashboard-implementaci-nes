-- ============================================================================
-- REVERSIÓN del cierre administrativo de ENTREGADA + POR CERRAR.
--
-- Estado exacto de los 88 casos ANTES del cierre aplicado el 2026-08-25.
-- Capturado desde la base, no reconstruido: 63 ENTREGADA + 25 POR CERRAR,
-- de los cuales 55 no tenían fecha_entrega.
--
-- Reemplaza a la tabla de respaldo del paso 2 de
-- cerrar_entregadas_y_por_cerrar.sql: el cierre se aplicó vía PostgREST, que
-- no ejecuta DDL, así que el respaldo se materializó acá en vez de en una
-- tabla. Versionado es más durable que una tabla que alguien puede borrar.
--
-- Correr COMPLETO en el editor SQL de Supabase sólo si hay que deshacer.
-- Ningún trigger se dispara al revertir: trg_set_fecha_entrega no estampa
-- porque el caso viene de CERRADA, y trg_detect_ticket_reopen sólo mira
-- transiciones que salen de ENTREGADA/APROBADA.
-- ============================================================================

update public.support_tickets t
   set estado        = b.estado,
       fecha_entrega = b.fecha_entrega
  from (values
  ('f1da9e56-0b04-4cc2-bda3-32bef14412ad'::uuid, 'ENTREGADA', null),
  ('31785917-97cd-4ba5-a37d-c1673dda2173'::uuid, 'ENTREGADA', null),
  ('2234b266-d4ce-4929-aa54-c83d3f4a6f32'::uuid, 'ENTREGADA', null),
  ('e283044a-cac4-4fc6-a007-a454a1a792ed'::uuid, 'ENTREGADA', null),
  ('db2fc143-2ce2-4d24-b470-e39249985872'::uuid, 'ENTREGADA', null),
  ('0ae44b91-710b-4242-bfb2-88c30b9b6353'::uuid, 'ENTREGADA', null),
  ('b8127b47-ba64-4c28-ac24-c90ea0000eb8'::uuid, 'ENTREGADA', null),
  ('ed9f8168-c9ed-4cfa-8cfa-b072f7aee5d4'::uuid, 'ENTREGADA', null),
  ('4f367b6a-7783-425a-8908-5ff9759c8650'::uuid, 'ENTREGADA', null),
  ('9177a865-b603-47c8-84a1-333d4adaa7e0'::uuid, 'ENTREGADA', null),
  ('56ee6718-22c6-4469-90a9-68cdd9546b58'::uuid, 'ENTREGADA', null),
  ('e2d7ce7d-cf26-40c3-b086-138ff4d1eb03'::uuid, 'ENTREGADA', null),
  ('401bcede-4c15-4aaf-bad4-abfc284c3125'::uuid, 'ENTREGADA', null),
  ('aacef304-7406-47ff-ae0b-c1d68177104c'::uuid, 'ENTREGADA', null),
  ('8c8d93e8-e9dc-43e4-8016-28d85ac3ad39'::uuid, 'ENTREGADA', null),
  ('f01644d8-f29a-41b6-a5d7-34556475f410'::uuid, 'ENTREGADA', null),
  ('6db16086-9b10-4f10-8059-2e8f9cfba2d0'::uuid, 'ENTREGADA', null),
  ('83c21c98-c5fe-4ac5-b071-bb099c0ca46b'::uuid, 'POR CERRAR', null),
  ('c438f357-0bce-4541-91a1-bfa229e1bcb6'::uuid, 'POR CERRAR', null),
  ('4e0919fb-fda9-4e17-ac01-dcba2ef02057'::uuid, 'POR CERRAR', null),
  ('0e4c06d9-752d-4035-8651-ce2ae50ec6ef'::uuid, 'POR CERRAR', null),
  ('1b46e31f-5ffc-48db-a22b-7de996da86d7'::uuid, 'ENTREGADA', null),
  ('b7978853-17df-49f7-9cee-5001c42b3006'::uuid, 'ENTREGADA', null),
  ('7d7b4458-3f1b-480d-8695-c73463ddc197'::uuid, 'ENTREGADA', null),
  ('5a26c881-71ed-49ee-ba4e-4c1408268c70'::uuid, 'ENTREGADA', null),
  ('2f15a81b-46c6-4657-b64a-24e44c27aaa2'::uuid, 'ENTREGADA', null),
  ('645f85cc-ac03-4209-9873-9b41eda4e562'::uuid, 'ENTREGADA', null),
  ('bce87afb-8853-4fb6-b27c-273cb33fd5ec'::uuid, 'ENTREGADA', null),
  ('665fae3b-a003-446c-a59a-71246e51f578'::uuid, 'ENTREGADA', null),
  ('c5ccdb0e-0f8b-404c-9839-587681c60b5a'::uuid, 'ENTREGADA', null),
  ('a9a74336-2276-4e47-909e-89dfb9304139'::uuid, 'ENTREGADA', null),
  ('55ac4757-0bc1-4b6f-bf6d-a70748c64265'::uuid, 'ENTREGADA', null),
  ('a656a2ea-5aff-4f52-9ac7-b9c79bcd2bed'::uuid, 'ENTREGADA', null),
  ('aafbac42-07f6-4ab2-852e-ad4d447d3d52'::uuid, 'ENTREGADA', '2025-12-18T07:20:18.715489+00:00'::timestamptz),
  ('960d9a86-0fd3-47c5-bdde-9a259550f7f4'::uuid, 'ENTREGADA', '2026-02-24T07:20:18.715489+00:00'::timestamptz),
  ('fc0224ed-b377-45d1-a67d-0939b8fe51a1'::uuid, 'ENTREGADA', '2026-01-26T07:20:18.715489+00:00'::timestamptz),
  ('4f5facbf-d575-4051-98ae-0d69da0def71'::uuid, 'ENTREGADA', '2026-01-14T07:20:18.715489+00:00'::timestamptz),
  ('9e2044e1-9fc1-451d-af85-1b7fbff747e3'::uuid, 'POR CERRAR', null),
  ('032ae901-54ab-479c-9eb2-601ce62e586c'::uuid, 'POR CERRAR', null),
  ('6616b6c0-17bd-4abc-938f-1a473e30786c'::uuid, 'POR CERRAR', null),
  ('18744135-cb07-4fc2-9328-b0b876a4f2b7'::uuid, 'POR CERRAR', null),
  ('94219ef1-6c0d-4233-bfa3-b43b310cd750'::uuid, 'ENTREGADA', '2026-01-26T07:20:18.715489+00:00'::timestamptz),
  ('b340388d-af0b-4486-b03a-cb100b5cd681'::uuid, 'ENTREGADA', '2026-04-06T07:20:18.715489+00:00'::timestamptz),
  ('e966e1c4-5edd-467e-bbca-9e31fbe33606'::uuid, 'ENTREGADA', '2026-02-28T07:20:18.715489+00:00'::timestamptz),
  ('a9d3b46a-f9c3-4886-8c3a-f88b1f05ae54'::uuid, 'ENTREGADA', '2026-04-16T07:20:18.715489+00:00'::timestamptz),
  ('d91f2259-8291-49eb-87bb-b6da5adcb338'::uuid, 'ENTREGADA', '2026-04-17T07:20:18.715489+00:00'::timestamptz),
  ('685fd33e-a23f-4e02-b5e2-4262346087f7'::uuid, 'ENTREGADA', '2026-02-18T07:20:18.715489+00:00'::timestamptz),
  ('86ee0b85-2909-4156-8a58-df697db19d84'::uuid, 'ENTREGADA', '2026-01-23T07:20:18.715489+00:00'::timestamptz),
  ('2aabd123-e8a4-4e59-85af-ef727ee77956'::uuid, 'ENTREGADA', '2026-03-16T07:20:18.715489+00:00'::timestamptz),
  ('939bd2ca-bcae-4f14-9ed2-471eee0c5ddf'::uuid, 'ENTREGADA', '2026-04-17T07:20:18.715489+00:00'::timestamptz),
  ('f7d163ab-4581-4802-bd1b-e68459b24e95'::uuid, 'ENTREGADA', '2026-01-17T07:20:18.715489+00:00'::timestamptz),
  ('bfcc3c5e-05e3-4462-9f15-a0f2388189f5'::uuid, 'ENTREGADA', '2026-02-24T07:20:18.715489+00:00'::timestamptz),
  ('26e9faa7-d758-47f9-a827-040025846309'::uuid, 'POR CERRAR', null),
  ('e3ba9275-74af-4dea-9544-727b88c0b397'::uuid, 'POR CERRAR', null),
  ('47c59c07-bbb7-4053-8c0a-07b40a7cd56b'::uuid, 'POR CERRAR', null),
  ('e21d5562-66ab-486a-8ec3-49e1685760dc'::uuid, 'POR CERRAR', null),
  ('da437a7e-d595-42f7-8339-2163645389f5'::uuid, 'ENTREGADA', '2026-02-27T07:20:18.715489+00:00'::timestamptz),
  ('10f50964-1fd4-4d7e-aef4-99a609e05ab4'::uuid, 'ENTREGADA', '2026-02-27T07:20:18.715489+00:00'::timestamptz),
  ('46c79854-c771-4488-bbff-581fb1467624'::uuid, 'POR CERRAR', null),
  ('056dfc84-1e0e-48fc-a470-7ce1738521f6'::uuid, 'ENTREGADA', '2026-03-25T07:20:18.715489+00:00'::timestamptz),
  ('ae6c2d5b-effa-4269-8f49-d3e417e01746'::uuid, 'ENTREGADA', '2026-04-23T07:20:18.715489+00:00'::timestamptz),
  ('19f3adb1-ee8f-4fa1-8efc-17c9848d9b14'::uuid, 'ENTREGADA', '2026-04-17T07:20:18.715489+00:00'::timestamptz),
  ('ee94614c-c6b0-4816-acd8-0be71d93e20a'::uuid, 'POR CERRAR', null),
  ('b21d5072-116c-4672-8cbe-1f23393c30b7'::uuid, 'POR CERRAR', null),
  ('0edd0ff1-b42f-40b5-a489-589bc3c6921b'::uuid, 'POR CERRAR', null),
  ('6d7a69eb-7cad-4fc5-87dc-6369a0ee892b'::uuid, 'POR CERRAR', null),
  ('796d90de-54de-4966-9bfc-02421263c2e3'::uuid, 'POR CERRAR', null),
  ('3ff4f5e5-9fd7-4307-83f1-77a18bb02f3c'::uuid, 'ENTREGADA', '2026-04-07T07:20:18.715489+00:00'::timestamptz),
  ('2b425ebd-d07e-47b8-9d1a-7b360a6e1769'::uuid, 'ENTREGADA', '2026-03-09T07:20:18.715489+00:00'::timestamptz),
  ('d9f7eb1f-8c89-4c7e-a3a0-2a9325e04b3c'::uuid, 'ENTREGADA', '2026-01-24T07:20:18.715489+00:00'::timestamptz),
  ('48067cec-8d6b-4710-a037-9a5329aac93e'::uuid, 'ENTREGADA', '2026-04-23T07:20:18.715489+00:00'::timestamptz),
  ('733d2abd-6654-4bf0-a006-40ead7c334e1'::uuid, 'ENTREGADA', '2026-03-29T07:20:18.715489+00:00'::timestamptz),
  ('ef57065a-2c3f-47a4-a1b8-d3e95d8d87b0'::uuid, 'ENTREGADA', '2026-04-01T07:20:18.715489+00:00'::timestamptz),
  ('8d8778fb-968c-470d-bbae-fde774d940a4'::uuid, 'ENTREGADA', '2026-01-12T07:20:18.715489+00:00'::timestamptz),
  ('303e25e8-af4d-4089-a634-cf9bfcf36ad8'::uuid, 'POR CERRAR', null),
  ('b93c1fff-e560-4ea1-a2da-9f4c018817eb'::uuid, 'ENTREGADA', '2026-04-01T07:20:18.715489+00:00'::timestamptz),
  ('ef937b68-d2b2-4129-ad85-300697c2ec18'::uuid, 'ENTREGADA', '2025-12-02T07:20:18.715489+00:00'::timestamptz),
  ('bfa9cc76-2c0a-4b3b-b1ab-7705e36d3f20'::uuid, 'ENTREGADA', '2026-03-03T07:20:18.715489+00:00'::timestamptz),
  ('c4137394-094d-4d06-bf9b-964a9a40d34d'::uuid, 'ENTREGADA', '2026-02-08T07:20:18.715489+00:00'::timestamptz),
  ('c624fc6a-2be4-4975-a240-60040ac709ac'::uuid, 'ENTREGADA', '2026-03-15T07:20:18.715489+00:00'::timestamptz),
  ('6b591cd8-836f-4bb6-a568-ff63dc5b4712'::uuid, 'POR CERRAR', null),
  ('a9c4ad15-6765-4129-a191-8735878a74b4'::uuid, 'POR CERRAR', null),
  ('f904c7e7-aa30-4914-a00c-827db203ed87'::uuid, 'POR CERRAR', null),
  ('cbf7b415-e955-48b4-a325-abc6f9e74628'::uuid, 'ENTREGADA', '2026-03-28T07:20:18.715489+00:00'::timestamptz),
  ('39cf9a32-53cd-404c-a835-a1e2470c8255'::uuid, 'POR CERRAR', null),
  ('638fd10b-0db4-4b62-a91d-f2b211a1521e'::uuid, 'POR CERRAR', null),
  ('abd8fc0a-f12b-45c4-8fe9-a754337f35ed'::uuid, 'POR CERRAR', null),
  ('c8f3fffe-40e2-44f4-847c-5a9ca62ca698'::uuid, 'ENTREGADA', null)
) as b(id, estado, fecha_entrega)
 where b.id = t.id;

-- Debe devolver 63 y 25:
select estado, count(*) from public.support_tickets
where estado in ('ENTREGADA','POR CERRAR') group by 1 order by 1;
