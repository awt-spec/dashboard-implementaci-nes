-- ════════════════════════════════════════════════════════════════════════════
-- FIX SLA: agregar prioridad CRITICA + mejorar matching de la función
--
-- Problema detectado: la regla SLA v4.5 solo tenía plazos para alta/media/baja
-- pero los tickets reales tienen "Critica, Impacto Negocio" que no matcheaba
-- ningún deadline → se computaba como ok por fallback equivocado.
-- Resultado: los casos vencidos no aparecían en el sidebar/topbar/banner.
--
-- Cambios:
--   1) UPDATE business_rules con plazos para 'critica' (más cortos: 1d)
--   2) REPLACE get_tickets_sla_status() con matching BEST-MATCH:
--      a) (priority + case_type) → más específico
--      b) priority solo
--      c) case_type solo
--      d) fallback "media"
-- ════════════════════════════════════════════════════════════════════════════

-- ─── 1) Agregar plazos para prioridad CRÍTICA en la regla activa ────
UPDATE public.business_rules
SET content = jsonb_set(
  content,
  '{deadlines}',
  '[
    {"case_type":"correccion",   "priority":"critica", "deadline_days":1, "notices":4, "interval_hours":6},
    {"case_type":"correccion",   "priority":"alta",    "deadline_days":3, "notices":3, "interval_hours":24},
    {"case_type":"correccion",   "priority":"media",   "deadline_days":5, "notices":2, "interval_hours":48},
    {"case_type":"correccion",   "priority":"baja",    "deadline_days":10,"notices":1, "interval_hours":72},
    {"case_type":"requerimiento","priority":"critica", "deadline_days":2, "notices":4, "interval_hours":12},
    {"case_type":"requerimiento","priority":"alta",    "deadline_days":5, "notices":3, "interval_hours":24},
    {"case_type":"requerimiento","priority":"media",   "deadline_days":10,"notices":2, "interval_hours":48},
    {"case_type":"requerimiento","priority":"baja",    "deadline_days":15,"notices":1, "interval_hours":72},
    {"case_type":"consulta",     "priority":"critica", "deadline_days":1, "notices":3, "interval_hours":6},
    {"case_type":"consulta",     "priority":"alta",    "deadline_days":2, "notices":2, "interval_hours":12},
    {"case_type":"consulta",     "priority":"media",   "deadline_days":3, "notices":1, "interval_hours":24},
    {"case_type":"consulta",     "priority":"baja",    "deadline_days":5, "notices":1, "interval_hours":48}
  ]'::jsonb,
  true
),
updated_at = now()
WHERE rule_type = 'sla'
  AND policy_version = 'v4.5'
  AND is_active = true;


-- ─── 2) Mejorar la función con BEST-MATCH ──────────────────────────────
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
  WITH deadline_lookup AS (
    SELECT
      t.id,
      t.ticket_id AS code,
      t.client_id,
      t.estado,
      t.prioridad,
      COALESCE(t.fecha_registro, t.created_at) AS reg,
      -- BEST MATCH: priority+case_type → priority → case_type → fallback media
      COALESCE(
        -- 1) Both priority AND case_type match (most specific)
        (SELECT (d->>'deadline_days')::int
         FROM jsonb_array_elements(deadlines) d
         WHERE COALESCE(d->>'priority', '') != ''
           AND COALESCE(d->>'case_type', '') != ''
           AND LOWER(COALESCE(t.prioridad, '')) LIKE '%' || LOWER(d->>'priority') || '%'
           AND LOWER(COALESCE(t.tipo, '')) LIKE '%' || LOWER(d->>'case_type') || '%'
         LIMIT 1),
        -- 2) priority only (any case_type)
        (SELECT (d->>'deadline_days')::int
         FROM jsonb_array_elements(deadlines) d
         WHERE COALESCE(d->>'priority', '') != ''
           AND LOWER(COALESCE(t.prioridad, '')) LIKE '%' || LOWER(d->>'priority') || '%'
         ORDER BY (d->>'deadline_days')::int ASC  -- más estricto primero
         LIMIT 1),
        -- 3) case_type only
        (SELECT (d->>'deadline_days')::int
         FROM jsonb_array_elements(deadlines) d
         WHERE COALESCE(d->>'case_type', '') != ''
           AND LOWER(COALESCE(t.tipo, '')) LIKE '%' || LOWER(d->>'case_type') || '%'
         LIMIT 1),
        -- 4) fallback to "media" priority
        (SELECT (d->>'deadline_days')::int
         FROM jsonb_array_elements(deadlines) d
         WHERE LOWER(d->>'priority') = 'media'
         LIMIT 1)
      ) AS dl_days
    FROM support_tickets t
    WHERE t.estado NOT IN ('CERRADA', 'ANULADA')
  )
  SELECT
    dl.id,
    dl.code,
    dl.client_id,
    dl.estado,
    dl.prioridad,
    dl.reg,
    dl.dl_days,
    GREATEST(0, EXTRACT(DAY FROM (now() - dl.reg))::int) AS days_elapsed,
    CASE
      WHEN dl.estado IN ('CERRADA','ANULADA','ENTREGADA','APROBADA') THEN 'no_sla'
      WHEN dl.dl_days IS NULL THEN 'no_sla'
      WHEN EXTRACT(DAY FROM (now() - dl.reg)) >= dl.dl_days THEN 'overdue'
      WHEN EXTRACT(DAY FROM (now() - dl.reg)) >= (dl.dl_days::numeric * 0.75) THEN 'warning'
      ELSE 'ok'
    END AS sla_status
  FROM deadline_lookup dl;
END;
$$;

COMMENT ON FUNCTION public.get_tickets_sla_status() IS
  'BEST-MATCH SLA por ticket: priority+case_type → priority → case_type → media. '
  'Lee business_rules vivas. Devuelve sla_status: ok|warning|overdue|no_sla.';
