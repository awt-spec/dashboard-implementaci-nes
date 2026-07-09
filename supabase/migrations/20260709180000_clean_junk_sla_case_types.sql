-- Limpieza de SLAs malformados por la extracción de contratos: filas con
-- case_type = descripción larga y priority_level en mayúsculas (ALTA/MEDIA/BAJA),
-- que además duplicaban los SLAs limpios existentes (case_type='all').
-- La prevención vive en la edge function apply-contract-terms (normaliza
-- priority_level y valida case_type contra el set permitido).

delete from public.client_slas
where case_type is not null
  and case_type <> 'all'
  and case_type not in ('Incidente', 'Requerimiento', 'Mejora', 'Consulta')
  and priority_level not in ('Crítica', 'Alta', 'Media', 'Baja');
