/**
 * useSLASummary — agregado global de SLA según política v4.5.
 *
 * Consume la Postgres function get_sla_summary() (migración 20260428140000)
 * que recomputa server-side leyendo business_rules vigentes.
 *
 * Devuelve: { total, overdue, warning, ok, no_sla }
 *
 * OJO: estos son números de INVENTARIO — todo lo abierto, de cualquier fecha.
 * No sirven para calcular cumplimiento: `ok / total` daría el porcentaje sobre
 * los 293 casos viejos que ya rompieron su plazo y que la migración
 * 20260825140000 sacó a propósito de la medición. El porcentaje sale de
 * useSlaCompliance().summary.compliancePct o de get_sla_summary().compliance_pct.
 *
 * Refresco: 60s. Suficiente para que un casos vencidos aparezcan en el sidebar
 * casi en tiempo real sin saturar el servidor.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface SLASummary {
  total: number;
  overdue: number;
  warning: number;
  ok: number;
  no_sla: number;
}

export function useSLASummary() {
  return useQuery<SLASummary>({
    queryKey: ["sla-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sla_summary" as any);
      if (error) throw error;
      // La RPC devuelve un array con una sola fila
      const row = Array.isArray(data) ? data[0] : data;
      return {
        total: row?.total ?? 0,
        overdue: row?.overdue ?? 0,
        warning: row?.warning ?? 0,
        ok: row?.ok ?? 0,
        no_sla: row?.no_sla ?? 0,
      };
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    // Si la migración no está aplicada, devolvemos summary vacío sin reventar
    retry: false,
  });
}
