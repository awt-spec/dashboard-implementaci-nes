-- El bucket privado contract-docs no tenía políticas de storage, así que subir
-- el PDF de un contrato fallaba con "new row violates row-level security policy"
-- (RLS en storage.objects). Se conceden a admin/pm — coherente con la escritura
-- de contract_documents.
DROP POLICY IF EXISTS "contract-docs admin/pm insert" ON storage.objects;
CREATE POLICY "contract-docs admin/pm insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'contract-docs' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'pm'::app_role)));

DROP POLICY IF EXISTS "contract-docs admin/pm read" ON storage.objects;
CREATE POLICY "contract-docs admin/pm read" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'contract-docs' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'pm'::app_role)));

DROP POLICY IF EXISTS "contract-docs admin/pm update" ON storage.objects;
CREATE POLICY "contract-docs admin/pm update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'contract-docs' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'pm'::app_role)))
  WITH CHECK (bucket_id = 'contract-docs' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'pm'::app_role)));

DROP POLICY IF EXISTS "contract-docs admin/pm delete" ON storage.objects;
CREATE POLICY "contract-docs admin/pm delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'contract-docs' AND (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'pm'::app_role)));
