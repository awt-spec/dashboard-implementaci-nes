/**
 * useTicketsSLAStatus — devuelve el estado SLA por ticket con su fuente.
 *
 * Consume la Postgres function get_tickets_sla_status() que aplica la
 * jerarquía: client_override > política global v4.5
 *
 * Devuelve un Map<ticket_uuid, {deadlineDays, daysElapsed, status, source}>
 * con el origen del plazo para que el UI pueda etiquetar correctamente:
 *   - source = 'policy_v4.5'    → "Política"
 *   - source = 'client_override' → "SLA Cliente"
 */
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";

export type SLASource = "client_override" | "policy_v4.5" | null;

export interface TicketSLAStatus {
  deadlineDays: number;
  daysElapsed: number;
  status: "ok" | "warning" | "overdue" | "no_sla";
  source: SLASource;
}

export function useTicketsSLAStatus() {
  const query = useQuery({
    queryKey: ["tickets-sla-status"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_tickets_sla_status" as any);
      if (error) throw error;
      return (data || []) as Array<{
        ticket_id: string;
        ticket_code: string;
        client_id: string;
        estado: string;
        prioridad: string;
        fecha_registro: string;
        deadline_days: number | null;
        days_elapsed: number;
        sla_status: "ok" | "warning" | "overdue" | "no_sla";
        sla_source: SLASource;
      }>;
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    retry: false,
  });

  // Map por ticket.id (uuid) para lookup O(1) desde la lista
  const byId = useMemo(() => {
    const m = new Map<string, TicketSLAStatus>();
    (query.data || []).forEach(row => {
      m.set(row.ticket_id, {
        deadlineDays: row.deadline_days || 0,
        daysElapsed: row.days_elapsed,
        status: row.sla_status,
        source: row.sla_source,
      });
    });
    return m;
  }, [query.data]);

  return { ...query, byId };
}
