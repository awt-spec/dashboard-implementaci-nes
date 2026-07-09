import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Histórico de cumplimiento SLA (casos cerrados) ──────────────────────────
// Vía RPC get_sla_history: mide resolución (fecha_registro→fecha_entrega) y
// primera respuesta (primera nota) contra el SLA. Solo mide casos con fecha de
// entrega; `closed_total` expone la cobertura real.

export interface SlaHistory {
  closed_total: number;
  overall: { measured: number; met: number; avg_resolution_hours: number | null };
  response: { measured: number; met: number };
  by_month: { month: string; total: number; met: number }[];
  by_priority: { priority: string; total: number; met: number; avg_resolution_hours: number | null }[];
}

export function useSlaHistory(clientId?: string) {
  return useQuery({
    queryKey: ["sla-history", clientId],
    enabled: !!clientId,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SlaHistory> => {
      const { data, error } = await (supabase.rpc as any)("get_sla_history", { _client_id: clientId });
      if (error) throw error;
      const d = (data || {}) as any;
      return {
        closed_total: Number(d.closed_total) || 0,
        overall: {
          measured: Number(d.overall?.measured) || 0,
          met: Number(d.overall?.met) || 0,
          avg_resolution_hours: d.overall?.avg_resolution_hours != null ? Number(d.overall.avg_resolution_hours) : null,
        },
        response: { measured: Number(d.response?.measured) || 0, met: Number(d.response?.met) || 0 },
        by_month: Array.isArray(d.by_month) ? d.by_month : [],
        by_priority: Array.isArray(d.by_priority) ? d.by_priority : [],
      };
    },
  });
}
