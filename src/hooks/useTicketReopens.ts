import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Tipos de reincidencia. El backend valida vía CHECK constraint en
 * support_ticket_reopens.reopen_type. "historico" lo inyecta el backfill —
 * el front nunca lo manda.
 */
export type ReopenType =
  | "cliente_rechazo"        // Cliente devolvió por inconformidad
  | "qa_falla"               // QA detectó falla antes de cierre
  | "solicitud_relacionada"  // Caso volvió por algo relacionado
  | "otro"
  | "historico";             // Solo backfill — pre-instalación del sistema

export interface TicketReopen {
  id: string;
  ticket_id: string;
  iteration_number: number;
  reopened_from_state: string;
  reopened_to_state: string;
  reason: string;
  reopen_type: ReopenType;
  responsible_at_reopen: string | null;
  new_responsible: string | null;
  triggered_by_user_id: string | null;
  triggered_by_name: string | null;
  delivered_at: string | null;
  reopened_at: string;
  resolved_at: string | null;
  metadata: Record<string, any>;
}

/**
 * Lista de reincidencias de un ticket, ordenadas por iteración descendente
 * (la más reciente arriba).
 */
export function useTicketReopens(ticketId?: string) {
  return useQuery({
    queryKey: ["ticket-reopens", ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("support_ticket_reopens" as any)
        .select("*") as any)
        .eq("ticket_id", ticketId)
        .order("iteration_number", { ascending: false });
      if (error) throw error;
      return (data || []) as TicketReopen[];
    },
  });
}

/**
 * Agregado por cliente × responsable × producto desde la view
 * support_reopens_summary. Excluye `historico` del cálculo de tasa real.
 */
export interface ReopensSummaryRow {
  client_id: string;
  responsable: string | null;
  producto: string | null;
  total_reopens: number;
  tickets_reincidentes: number;     // tickets con reopen_count >= 2
  max_iter: number | null;
  avg_iter: number | null;
  reopens_real_90d: number;         // sin "historico"
  entregados_90d: number;
  reopen_rate_90d_pct: number;
}

export function useReopensSummary(filters?: {
  clientId?: string;
  responsable?: string;
  producto?: string;
}) {
  return useQuery({
    queryKey: ["reopens-summary", filters],
    queryFn: async () => {
      let query = (supabase.from("support_reopens_summary" as any).select("*") as any);
      if (filters?.clientId) query = query.eq("client_id", filters.clientId);
      if (filters?.responsable) query = query.eq("responsable", filters.responsable);
      if (filters?.producto) query = query.eq("producto", filters.producto);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as ReopensSummaryRow[];
    },
  });
}

/**
 * Top N reincidentes agrupados por la dimensión que pidamos. Útil para
 * `ReopensInsightsPanel`: por cliente, por técnico, por producto.
 */
export type ReopenScope = "cliente" | "tecnico" | "producto";

export interface TopReincidente {
  key: string;            // client_id | responsable | producto
  label: string;          // nombre legible (cliente.name o el campo crudo)
  total_reopens: number;
  tickets_reincidentes: number;
  reopens_real_90d: number;
  reopen_rate_90d_pct: number;
}

export function useTopReincidentes(scope: ReopenScope, limit: number = 10, clientId?: string) {
  return useQuery({
    queryKey: ["top-reincidentes", scope, limit, clientId ?? "all"],
    queryFn: async () => {
      // Necesitamos joinear con clients para mostrar nombre, no UUID
      // Si hay clientId, filtrar la summary view por ese cliente
      let summaryQuery = (supabase.from("support_reopens_summary" as any).select("*") as any);
      if (clientId) summaryQuery = summaryQuery.eq("client_id", clientId);
      const [{ data: rows, error }, { data: clients }] = await Promise.all([
        summaryQuery,
        (supabase.from("clients").select("id,name") as any),
      ]);
      if (error) throw error;
      const clientMap = new Map<string, string>(
        (clients || []).map((c: any) => [c.id, c.name])
      );

      // Agregar a la dimensión pedida
      const grouped = new Map<string, TopReincidente>();
      for (const r of (rows || []) as ReopensSummaryRow[]) {
        let key: string;
        let label: string;
        if (scope === "cliente") {
          key = r.client_id;
          label = clientMap.get(r.client_id) || r.client_id.slice(0, 8);
        } else if (scope === "tecnico") {
          key = r.responsable || "(sin asignar)";
          label = key;
        } else {
          key = r.producto || "(sin producto)";
          label = key;
        }

        const prev = grouped.get(key) || {
          key,
          label,
          total_reopens: 0,
          tickets_reincidentes: 0,
          reopens_real_90d: 0,
          reopen_rate_90d_pct: 0,
        };
        prev.total_reopens += r.total_reopens || 0;
        prev.tickets_reincidentes += r.tickets_reincidentes || 0;
        prev.reopens_real_90d += r.reopens_real_90d || 0;
        // tasa promedio ponderada: usar la del primer row para esta key.
        // Si hay múltiples (ej tecnico atiende a varios clientes) tomamos
        // el max para conservar el peor caso (visible para María).
        prev.reopen_rate_90d_pct = Math.max(prev.reopen_rate_90d_pct, r.reopen_rate_90d_pct || 0);
        grouped.set(key, prev);
      }

      return Array.from(grouped.values())
        .sort((a, b) => b.total_reopens - a.total_reopens)
        .slice(0, limit);
    },
  });
}

/**
 * Métrica: tasa de reapertura últimos 90 días.
 * Si se pasa clientId, scope al cliente. Si no, agrega global.
 */
export function useReopenRate90d(clientId?: string) {
  return useQuery({
    queryKey: ["reopen-rate-90d", clientId ?? "all"],
    queryFn: async () => {
      let q = (supabase
        .from("support_reopens_summary" as any)
        .select("reopens_real_90d, entregados_90d") as any);
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      const rows = (data || []) as Array<{
        reopens_real_90d: number;
        entregados_90d: number;
      }>;
      const reopens = rows.reduce((sum, r) => sum + (r.reopens_real_90d || 0), 0);
      const entregados = rows.reduce((sum, r) => sum + (r.entregados_90d || 0), 0);
      return {
        reopens_90d: reopens,
        entregados_90d: entregados,
        rate_pct: entregados > 0 ? Math.round((reopens / entregados) * 1000) / 10 : 0,
      };
    },
  });
}
