-- ════════════════════════════════════════════════════════════════════════════
-- Hardening RLS sobre support_reopens_summary
--
-- La view se creó sin security_invoker, lo que en Postgres 15+ default puede
-- bypassear las políticas RLS de las tablas subyacentes. Forzamos
-- security_invoker=on para que herede el RLS de support_ticket_reopens
-- (visible solo para admin/pm/ceo/gerente_soporte/colaborador).
--
-- Cliente y gerente (per-client) no podrán leer agregados aunque tengan
-- el GRANT SELECT.
-- ════════════════════════════════════════════════════════════════════════════

ALTER VIEW public.support_reopens_summary SET (security_invoker = on);

COMMENT ON VIEW public.support_reopens_summary IS
  'Agregado por cliente × responsable × producto. security_invoker=on → '
  'hereda RLS de support_ticket_reopens (interno staff únicamente). '
  'Excluye reopen_type=historico del cálculo de tasa real (90d).';
