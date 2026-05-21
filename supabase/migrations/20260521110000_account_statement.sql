-- ============================================================================
-- Estado de cuenta del cliente — gap P2 Story Mapping (ERP-071)
-- Calcula el statement on-the-fly desde fuentes de verdad (no snapshots).
-- Función SECURITY DEFINER porque agrega work_time_entries que el cliente
-- no puede leer directamente vía RLS.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_client_account_statement(
  p_client_id text,
  p_period_start date,
  p_period_end date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_client_row record;
  v_active_contract record;
  v_total_hours numeric;
  v_total_minutes numeric;
  v_consumption_by_user jsonb;
  v_consumption_by_item jsonb;
  v_consumption_by_day jsonb;
  v_approved_quotes jsonb;
  v_pending_quotes_count int;
  v_pending_quotes_total numeric;
  v_financials record;
  v_currency text;
  v_result jsonb;
BEGIN
  -- ── Auth ──────────────────────────────────────────────────────────────────
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;
  IF NOT public.user_can_see_client(p_client_id, v_user_id) THEN
    RAISE EXCEPTION 'Sin acceso a este cliente';
  END IF;
  IF p_period_start IS NULL OR p_period_end IS NULL OR p_period_end < p_period_start THEN
    RAISE EXCEPTION 'Período inválido';
  END IF;

  -- ── Cliente ────────────────────────────────────────────────────────────────
  SELECT c.id, c.name, c.country
  INTO v_client_row
  FROM public.clients c
  WHERE c.id = p_client_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cliente no encontrado';
  END IF;

  -- ── Contrato activo ───────────────────────────────────────────────────────
  SELECT cc.id, cc.contract_type, cc.monthly_value, cc.hourly_rate,
         cc.included_hours, cc.currency, cc.start_date, cc.end_date
  INTO v_active_contract
  FROM public.client_contracts cc
  WHERE cc.client_id = p_client_id
    AND cc.is_active = true
    AND (cc.end_date IS NULL OR cc.end_date >= p_period_start)
  ORDER BY cc.start_date DESC NULLS LAST
  LIMIT 1;

  v_currency := COALESCE(v_active_contract.currency, 'USD');

  -- ── Consumo total del período (horas) ─────────────────────────────────────
  SELECT COALESCE(SUM(duration_seconds), 0) / 60.0
  INTO v_total_minutes
  FROM public.work_time_entries
  WHERE client_id = p_client_id
    AND started_at >= p_period_start
    AND started_at < (p_period_end + INTERVAL '1 day')
    AND duration_seconds IS NOT NULL
    AND duration_seconds > 0;

  v_total_hours := ROUND(v_total_minutes / 60.0, 2);

  -- ── Desglose por colaborador SYSDE ────────────────────────────────────────
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb)
  INTO v_consumption_by_user
  FROM (
    SELECT
      wte.user_id,
      COALESCE(p.full_name, p.email, 'Usuario') AS user_name,
      ROUND(SUM(wte.duration_seconds) / 3600.0, 2) AS hours,
      COUNT(*) AS entries_count
    FROM public.work_time_entries wte
    LEFT JOIN public.profiles p ON p.user_id = wte.user_id
    WHERE wte.client_id = p_client_id
      AND wte.started_at >= p_period_start
      AND wte.started_at < (p_period_end + INTERVAL '1 day')
      AND wte.duration_seconds IS NOT NULL
      AND wte.duration_seconds > 0
    GROUP BY wte.user_id, p.full_name, p.email
    ORDER BY hours DESC
  ) row;

  -- ── Desglose por ticket/tarea ─────────────────────────────────────────────
  SELECT COALESCE(jsonb_agg(row), '[]'::jsonb)
  INTO v_consumption_by_item
  FROM (
    SELECT
      wte.source,
      wte.item_id,
      ROUND(SUM(wte.duration_seconds) / 3600.0, 2) AS hours,
      COUNT(*) AS entries_count,
      -- Si es ticket, traemos el código y asunto
      (
        SELECT jsonb_build_object('ticket_id', st.ticket_id, 'asunto', st.asunto, 'estado', st.estado)
        FROM public.support_tickets st
        WHERE wte.source = 'ticket' AND st.id::text = wte.item_id
        LIMIT 1
      ) AS ticket_info
    FROM public.work_time_entries wte
    WHERE wte.client_id = p_client_id
      AND wte.started_at >= p_period_start
      AND wte.started_at < (p_period_end + INTERVAL '1 day')
      AND wte.duration_seconds IS NOT NULL
      AND wte.duration_seconds > 0
    GROUP BY wte.source, wte.item_id
    ORDER BY hours DESC
    LIMIT 50
  ) row;

  -- ── Desglose por día (para sparkline) ─────────────────────────────────────
  SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'day')::date ASC), '[]'::jsonb)
  INTO v_consumption_by_day
  FROM (
    SELECT
      to_char(date_trunc('day', wte.started_at), 'YYYY-MM-DD') AS day,
      ROUND(SUM(wte.duration_seconds) / 3600.0, 2) AS hours
    FROM public.work_time_entries wte
    WHERE wte.client_id = p_client_id
      AND wte.started_at >= p_period_start
      AND wte.started_at < (p_period_end + INTERVAL '1 day')
      AND wte.duration_seconds IS NOT NULL
      AND wte.duration_seconds > 0
    GROUP BY date_trunc('day', wte.started_at)
  ) row;

  -- ── Cotizaciones aprobadas en el período ──────────────────────────────────
  SELECT COALESCE(jsonb_agg(row ORDER BY (row->>'approved_at')::timestamptz DESC), '[]'::jsonb)
  INTO v_approved_quotes
  FROM (
    SELECT
      id, quote_number, title, total_amount, currency, approved_at, ticket_id
    FROM public.quotes
    WHERE client_id = p_client_id
      AND status = 'approved'
      AND approved_at IS NOT NULL
      AND approved_at >= p_period_start
      AND approved_at < (p_period_end + INTERVAL '1 day')
  ) row;

  -- ── Cotizaciones pendientes (status=sent) — acumulado total ───────────────
  SELECT COUNT(*), COALESCE(SUM(total_amount), 0)
  INTO v_pending_quotes_count, v_pending_quotes_total
  FROM public.quotes
  WHERE client_id = p_client_id
    AND status = 'sent'
    AND (valid_until IS NULL OR valid_until >= CURRENT_DATE);

  -- ── Estado financiero general (snapshot agregado) ─────────────────────────
  SELECT contract_value, billed, paid, pending, hours_estimated, hours_used
  INTO v_financials
  FROM public.client_financials
  WHERE client_id = p_client_id;

  -- ── Resultado ─────────────────────────────────────────────────────────────
  v_result := jsonb_build_object(
    'client', jsonb_build_object(
      'id', v_client_row.id,
      'name', v_client_row.name,
      'country', v_client_row.country
    ),
    'period', jsonb_build_object(
      'start', to_char(p_period_start, 'YYYY-MM-DD'),
      'end',   to_char(p_period_end, 'YYYY-MM-DD'),
      'days',  (p_period_end - p_period_start + 1)
    ),
    'contract', CASE WHEN v_active_contract.id IS NULL THEN NULL ELSE jsonb_build_object(
      'id',             v_active_contract.id,
      'contract_type',  v_active_contract.contract_type,
      'monthly_value',  v_active_contract.monthly_value,
      'hourly_rate',    v_active_contract.hourly_rate,
      'included_hours', v_active_contract.included_hours,
      'currency',       v_active_contract.currency,
      'start_date',     v_active_contract.start_date,
      'end_date',       v_active_contract.end_date
    ) END,
    'consumption', jsonb_build_object(
      'total_hours',     v_total_hours,
      'included_hours',  COALESCE(v_active_contract.included_hours, 0),
      'overage_hours',   GREATEST(v_total_hours - COALESCE(v_active_contract.included_hours, 0), 0),
      'utilization_pct', CASE WHEN COALESCE(v_active_contract.included_hours, 0) > 0
                              THEN ROUND((v_total_hours / v_active_contract.included_hours) * 100, 1)
                              ELSE NULL END,
      'by_user',         v_consumption_by_user,
      'by_item',         v_consumption_by_item,
      'by_day',          v_consumption_by_day
    ),
    'quotes', jsonb_build_object(
      'approved_in_period', v_approved_quotes,
      'pending_count',      v_pending_quotes_count,
      'pending_total',      v_pending_quotes_total
    ),
    'financials', CASE WHEN v_financials.contract_value IS NULL THEN NULL ELSE jsonb_build_object(
      'contract_value',  v_financials.contract_value,
      'billed',          v_financials.billed,
      'paid',            v_financials.paid,
      'pending',         v_financials.pending,
      'hours_estimated', v_financials.hours_estimated,
      'hours_used',      v_financials.hours_used,
      'balance',         (COALESCE(v_financials.paid, 0) - COALESCE(v_financials.billed, 0))
    ) END,
    'currency', v_currency,
    'generated_at', to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS"Z"'),
    'generated_by', v_user_id
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_client_account_statement(text, date, date) TO authenticated;

COMMENT ON FUNCTION public.get_client_account_statement IS
  'Estado de cuenta consolidado del cliente para un período. SECURITY DEFINER porque agrega work_time_entries que el cliente no lee directamente. Auth check vía user_can_see_client. Gap P2 Story Mapping (ERP-071).';
