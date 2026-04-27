-- ════════════════════════════════════════════════════════════════════════════
-- Agregar rol 'ceo' al enum app_role
-- El CEO tiene visibilidad de SOLO LECTURA sobre todo el sistema (read-only).
-- Las RLS que extienden este acceso van en 20260427130100_ceo_rls_policies.sql
-- (separadas porque PostgreSQL exige que ALTER TYPE ADD VALUE commitee antes
-- de poder usar el nuevo valor en SQL del mismo batch).
-- ════════════════════════════════════════════════════════════════════════════

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'ceo';
