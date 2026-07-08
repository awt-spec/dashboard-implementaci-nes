-- El CSR necesita leer las minutas de soporte (sesiones periódicas con el
-- cliente) para su vista de agente. Faltaba esta política en la migración
-- del rol.
DROP POLICY IF EXISTS "csr read support minutes" ON public.support_minutes;
CREATE POLICY "csr read support minutes" ON public.support_minutes FOR SELECT
  USING (public.is_csr_user());
