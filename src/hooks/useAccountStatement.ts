import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AccountStatementContract {
  id: string;
  contract_type: string;
  monthly_value: number;
  hourly_rate: number;
  included_hours: number;
  currency: string;
  start_date: string | null;
  end_date: string | null;
}

export interface AccountStatementUserConsumption {
  user_id: string;
  user_name: string;
  hours: number;
  entries_count: number;
}

export interface AccountStatementItemConsumption {
  source: "ticket" | "task";
  item_id: string;
  hours: number;
  entries_count: number;
  ticket_info: {
    ticket_id: string;
    asunto: string;
    estado: string;
  } | null;
}

export interface AccountStatementDayConsumption {
  day: string;
  hours: number;
}

export interface AccountStatementApprovedQuote {
  id: string;
  quote_number: string;
  title: string;
  total_amount: number;
  currency: string;
  approved_at: string;
  ticket_id: string | null;
}

export interface AccountStatementFinancials {
  contract_value: number;
  billed: number;
  paid: number;
  pending: number;
  hours_estimated: number;
  hours_used: number;
  balance: number;
}

export interface AccountStatement {
  client: { id: string; name: string; country: string | null };
  period: { start: string; end: string; days: number };
  contract: AccountStatementContract | null;
  consumption: {
    total_hours: number;
    included_hours: number;
    overage_hours: number;
    utilization_pct: number | null;
    by_user: AccountStatementUserConsumption[];
    by_item: AccountStatementItemConsumption[];
    by_day: AccountStatementDayConsumption[];
  };
  quotes: {
    approved_in_period: AccountStatementApprovedQuote[];
    pending_count: number;
    pending_total: number;
  };
  financials: AccountStatementFinancials | null;
  currency: string;
  generated_at: string;
  generated_by: string;
}

/**
 * Período pre-definido para selección rápida.
 * `from`/`to` se calculan al momento del query.
 */
export type StatementPeriod =
  | "current_month"
  | "previous_month"
  | "last_30_days"
  | "current_quarter"
  | "year_to_date"
  | "custom";

export function getPeriodDates(p: StatementPeriod, custom?: { from: string; to: string }) {
  const today = new Date();
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  const fmt = (date: Date) => date.toISOString().slice(0, 10);

  switch (p) {
    case "current_month":
      return { from: fmt(new Date(y, m, 1)), to: fmt(new Date(y, m + 1, 0)) };
    case "previous_month":
      return { from: fmt(new Date(y, m - 1, 1)), to: fmt(new Date(y, m, 0)) };
    case "last_30_days":
      return { from: fmt(new Date(y, m, d - 29)), to: fmt(today) };
    case "current_quarter": {
      const q = Math.floor(m / 3);
      return { from: fmt(new Date(y, q * 3, 1)), to: fmt(new Date(y, q * 3 + 3, 0)) };
    }
    case "year_to_date":
      return { from: fmt(new Date(y, 0, 1)), to: fmt(today) };
    case "custom":
      return { from: custom?.from ?? fmt(new Date(y, m, 1)), to: custom?.to ?? fmt(today) };
  }
}

export function useAccountStatement(
  clientId: string | undefined,
  period: { from: string; to: string },
) {
  return useQuery({
    queryKey: ["account-statement", clientId, period.from, period.to],
    enabled: !!clientId && !!period.from && !!period.to,
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await supabase.rpc(
        "get_client_account_statement" as any,
        {
          p_client_id: clientId,
          p_period_start: period.from,
          p_period_end: period.to,
        } as any,
      );
      if (error) throw error;
      return data as unknown as AccountStatement;
    },
    // Estado de cuenta = instrumento de OUTPUT en vivo (S2-05): se actualiza
    // solo, disponible a cualquier hora, sin sumas/Excel.
    staleTime: 20_000,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}
