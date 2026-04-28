-- ════════════════════════════════════════════════════════════════════════════
-- SLA con jerarquía: cliente override > política global v4.5
--
-- Antes la función solo leía business_rules (política global). Si un cliente
-- tenía un override en client_rule_overrides, no se respetaba.
-- Ahora aplica jerarquía:
--   1) ¿Tiene el cliente un override activo para la regla SLA? → usa esos deadlines
--   2) Si no → usa la política global v4.5
-- ════════════════════════════════════════════════════════════════════════════

-- DROP requerido porque agregamos columna sla_source al RETURNS TABLE
DROP FUNCTION IF EXISTS public.get_tickets_sla_status();

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
  sla_status text,         -- 'ok' | 'warning' | 'overdue' | 'no_sla'
  sla_source text          -- 'client_override' | 'policy_v4.5' | null
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  global_sla_id uuid;
  global_deadlines jsonb;
BEGIN
  -- Obtener regla SLA global activa de la política vigente
  SELECT id, COALESCE(content->'deadlines', '[]'::jsonb)
  INTO global_sla_id, global_deadlines
  FROM business_rules
  WHERE rule_type = 'sla' AND policy_version = 'v4.5' AND is_active = true
  LIMIT 1;

  IF global_sla_id IS NULL THEN
    RAISE NOTICE 'No hay regla SLA activa para v4.5';
    RETURN;
  END IF;

  RETURN QUERY
  WITH ticket_with_deadlines AS (
    SELECT
      t.id,
      t.ticket_id AS code,
      t.client_id,
      t.estado,
      t.prioridad,
      t.tipo,
      COALESCE(t.fecha_registro, t.created_at) AS reg,
      -- Deadlines aplicables: override del cliente si existe, si no global
      COALESCE(
        (SELECT cro.override_content->'deadlines'
         FROM client_rule_overrides cro
         WHERE cro.client_id = t.client_id
           AND cro.rule_id   = global_sla_id
           AND cro.is_active = true
           AND cro.override_content ? 'deadlines'
         LIMIT 1),
        global_deadlines
      ) AS effective_deadlines,
      -- Marcar la fuente para que el frontend lo muestre
      CASE
        WHEN EXISTS (
          SELECT 1 FROM client_rule_overrides cro
          WHERE cro.client_id = t.client_id
            AND cro.rule_id   = global_sla_id
            AND cro.is_active = true
            AND cro.override_content ? 'deadlines'
        ) THEN 'client_override'
        ELSE 'policy_v4.5'
      END AS source
    FROM support_tickets t
    WHERE t.estado NOT IN ('CERRADA', 'ANULADA')
  ),
  with_match AS (
    SELECT
      twd.*,
      -- BEST MATCH: priority+case_type → priority → case_type → media
      COALESCE(
        (SELECT (d->>'deadline_days')::int
         FROM jsonb_array_elements(twd.effective_deadlines) d
         WHERE COALESCE(d->>'priority', '') != ''
           AND COALESCE(d->>'case_type', '') != ''
           AND LOWER(COALESCE(twd.prioridad, '')) LIKE '%' || LOWER(d->>'priority') || '%'
           AND LOWER(COALESCE(twd.tipo, '')) LIKE '%' || LOWER(d->>'case_type') || '%'
         LIMIT 1),
        (SELECT (d->>'deadline_days')::int
         FROM jsonb_array_elements(twd.effective_deadlines) d
         WHERE COALESCE(d->>'priority', '') != ''
           AND LOWER(COALESCE(twd.prioridad, '')) LIKE '%' || LOWER(d->>'priority') || '%'
         ORDER BY (d->>'deadline_days')::int ASC
         LIMIT 1),
        (SELECT (d->>'deadline_days')::int
         FROM jsonb_array_elements(twd.effective_deadlines) d
         WHERE COALESCE(d->>'case_type', '') != ''
           AND LOWER(COALESCE(twd.tipo, '')) LIKE '%' || LOWER(d->>'case_type') || '%'
         LIMIT 1),
        (SELECT (d->>'deadline_days')::int
         FROM jsonb_array_elements(twd.effective_deadlines) d
         WHERE LOWER(d->>'priority') = 'media'
         LIMIT 1)
      ) AS dl_days
    FROM ticket_with_deadlines twd
  )
  SELECT
    wm.id,
    wm.code,
    wm.client_id,
    wm.estado,
    wm.prioridad,
    wm.reg,
    wm.dl_days,
    GREATEST(0, EXTRACT(DAY FROM (now() - wm.reg))::int),
    CASE
      WHEN wm.estado IN ('CERRADA','ANULADA','ENTREGADA','APROBADA') THEN 'no_sla'
      WHEN wm.dl_days IS NULL THEN 'no_sla'
      WHEN EXTRACT(DAY FROM (now() - wm.reg)) >= wm.dl_days THEN 'overdue'
      WHEN EXTRACT(DAY FROM (now() - wm.reg)) >= (wm.dl_days::numeric * 0.75) THEN 'warning'
      ELSE 'ok'
    END,
    wm.source
  FROM with_match wm;
END;
$$;

COMMENT ON FUNCTION public.get_tickets_sla_status() IS
  'BEST-MATCH SLA por ticket con jerarquía: client_override > política global v4.5. '
  'Devuelve sla_source para que el frontend distinga origen del plazo.';

-- get_sla_summary no cambia — sigue agregando ok/warning/overdue/no_sla
