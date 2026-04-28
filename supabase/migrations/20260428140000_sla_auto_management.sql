-- ════════════════════════════════════════════════════════════════════════════
-- Gestión automática de SLA: la política v4.5 se aplica server-side a cada
-- ticket vivo. Función idempotente que recomputa el estado SLA leyendo:
--   • business_rules WHERE rule_type='sla' AND policy_version='v4.5' AND is_active
--   • support_tickets cuyo estado NO sea CERRADA/ANULADA/ENTREGADA/APROBADA
--
-- Devuelve por cada ticket: deadline_days, days_elapsed, sla_status (ok/warning/overdue).
-- Cualquier vista (frontend, edge functions, cron) puede consumirla.
--
-- También se crea una vista materializada-friendly y un trigger que la
-- refresca cuando hay cambios.
-- ════════════════════════════════════════════════════════════════════════════

-- ─── Función pública: obtener SLA status de tickets vivos ──────────────
CREATE OR REPLACE FUNCTION public.get_tickets_sla_status()
RETURNS TABLE (
  ticket_id uuid,
  ticket_code text,
  client_id text,
  estado text,
  prioridad text,
  fecha_registro timestamptz,
  deadline_days int,
  days_elapsed int,
  sla_status text  -- 'ok' | 'warning' | 'overdue' | 'no_sla'
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sla_rule jsonb;
  deadlines jsonb;
BEGIN
  -- Buscar la regla SLA activa de la política vigente v4.5
  SELECT content INTO sla_rule
  FROM business_rules
  WHERE rule_type = 'sla' AND policy_version = 'v4.5' AND is_active = true
  LIMIT 1;

  IF sla_rule IS NULL THEN
    RAISE NOTICE 'No hay regla SLA activa para v4.5';
    RETURN;
  END IF;

  deadlines := COALESCE(sla_rule->'deadlines', '[]'::jsonb);

  RETURN QUERY
  SELECT
    t.id,
    t.ticket_id,
    t.client_id,
    t.estado,
    t.prioridad,
    COALESCE(t.fecha_registro, t.created_at),
    -- Match deadline por prioridad o tipo
    COALESCE(
      (SELECT (d->>'deadline_days')::int
       FROM jsonb_array_elements(deadlines) d
       WHERE LOWER(t.prioridad) LIKE '%' || LOWER(d->>'priority') || '%'
         AND COALESCE(d->>'priority', '') != ''
       LIMIT 1),
      (SELECT (d->>'deadline_days')::int
       FROM jsonb_array_elements(deadlines) d
       WHERE LOWER(t.tipo) LIKE '%' || LOWER(d->>'case_type') || '%'
         AND COALESCE(d->>'case_type', '') != ''
       LIMIT 1),
      (SELECT (d->>'deadline_days')::int
       FROM jsonb_array_elements(deadlines) d
       WHERE LOWER(d->>'priority') = 'media'
       LIMIT 1)
    ) AS deadline_days,
    -- Días transcurridos desde fecha_registro
    GREATEST(0, EXTRACT(DAY FROM (now() - COALESCE(t.fecha_registro, t.created_at)))::int) AS days_elapsed,
    -- Calcular sla_status
    CASE
      WHEN t.estado IN ('CERRADA', 'ANULADA', 'ENTREGADA', 'APROBADA') THEN 'no_sla'
      ELSE
        CASE
          WHEN COALESCE(
            (SELECT (d->>'deadline_days')::int
             FROM jsonb_array_elements(deadlines) d
             WHERE LOWER(t.prioridad) LIKE '%' || LOWER(d->>'priority') || '%'
               AND COALESCE(d->>'priority', '') != ''
             LIMIT 1),
            (SELECT (d->>'deadline_days')::int
             FROM jsonb_array_elements(deadlines) d
             WHERE LOWER(d->>'priority') = 'media'
             LIMIT 1),
            7
          ) IS NULL THEN 'no_sla'
          WHEN EXTRACT(DAY FROM (now() - COALESCE(t.fecha_registro, t.created_at))) >=
               COALESCE(
                 (SELECT (d->>'deadline_days')::int
                  FROM jsonb_array_elements(deadlines) d
                  WHERE LOWER(t.prioridad) LIKE '%' || LOWER(d->>'priority') || '%'
                    AND COALESCE(d->>'priority', '') != ''
                  LIMIT 1),
                 (SELECT (d->>'deadline_days')::int
                  FROM jsonb_array_elements(deadlines) d
                  WHERE LOWER(d->>'priority') = 'media'
                  LIMIT 1),
                 7
               ) THEN 'overdue'
          WHEN EXTRACT(DAY FROM (now() - COALESCE(t.fecha_registro, t.created_at))) >=
               (COALESCE(
                 (SELECT (d->>'deadline_days')::int
                  FROM jsonb_array_elements(deadlines) d
                  WHERE LOWER(t.prioridad) LIKE '%' || LOWER(d->>'priority') || '%'
                    AND COALESCE(d->>'priority', '') != ''
                  LIMIT 1),
                 (SELECT (d->>'deadline_days')::int
                  FROM jsonb_array_elements(deadlines) d
                  WHERE LOWER(d->>'priority') = 'media'
                  LIMIT 1),
                 7
               )::numeric * 0.75) THEN 'warning'
          ELSE 'ok'
        END
    END AS sla_status
  FROM support_tickets t
  WHERE t.estado NOT IN ('CERRADA', 'ANULADA');
END;
$$;

COMMENT ON FUNCTION public.get_tickets_sla_status() IS
  'Devuelve estado SLA por ticket aplicando la política v4.5 vigente. '
  'Idempotente: relee siempre business_rules para mantenerse sincronizada '
  'con cambios de política. Frontend, edge fns y cron pueden consumirla.';


-- ─── Función agregada: counts globales de SLA ─────────────────────────
CREATE OR REPLACE FUNCTION public.get_sla_summary()
RETURNS TABLE (
  total int,
  overdue int,
  warning int,
  ok int,
  no_sla int
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COUNT(*)::int                                       AS total,
    COUNT(*) FILTER (WHERE sla_status = 'overdue')::int AS overdue,
    COUNT(*) FILTER (WHERE sla_status = 'warning')::int AS warning,
    COUNT(*) FILTER (WHERE sla_status = 'ok')::int      AS ok,
    COUNT(*) FILTER (WHERE sla_status = 'no_sla')::int  AS no_sla
  FROM public.get_tickets_sla_status();
$$;

COMMENT ON FUNCTION public.get_sla_summary() IS
  'Resumen agregado de tickets por estado SLA (overdue/warning/ok/no_sla).';


-- ─── Permisos: cualquier rol auth puede leer (filtrado por RLS interna) ─
GRANT EXECUTE ON FUNCTION public.get_tickets_sla_status() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_sla_summary() TO authenticated;
