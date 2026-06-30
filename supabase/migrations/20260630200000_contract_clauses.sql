-- ============================================================================
-- Cláusulas / términos del contrato (texto analizable por IA)
-- ----------------------------------------------------------------------------
-- client_contracts ya tiene penalty_clause / payment_terms / notes, pero no un
-- cuerpo de cláusulas. Se agrega `clauses` (texto libre con el clausulado) y
-- `ai_analysis` (jsonb) para guardar el último análisis IA del contrato.
-- ============================================================================

ALTER TABLE public.client_contracts
  ADD COLUMN IF NOT EXISTS clauses     text,
  ADD COLUMN IF NOT EXISTS ai_analysis jsonb;

COMMENT ON COLUMN public.client_contracts.clauses IS
  'Clausulado / términos del contrato en texto libre. Insumo para el análisis IA.';
COMMENT ON COLUMN public.client_contracts.ai_analysis IS
  'Último análisis IA del contrato (riesgos, obligaciones, recomendaciones).';
