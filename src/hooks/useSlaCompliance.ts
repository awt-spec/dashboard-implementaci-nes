/**
 * Estado de SLA de los casos, con UNA sola fuente: la función
 * get_tickets_sla_status() de la base.
 *
 * Antes esto se calculaba acá, en el navegador, leyendo client_slas en HORAS,
 * mientras el sidebar y la bandeja leían la RPC, que usaba business_rules en
 * DÍAS. La misma pantalla mostraba 318 vencidos arriba y 383 abajo. Y
 * useSlaAlerts era una tercera copia de la misma regla.
 *
 * La regla vive ahora en la migración 20260824120000_unify_sla_source.sql:
 * manda el SLA contractual del cliente si existe, si no la política v4.5.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupportTickets, type SupportTicket } from "@/hooks/useSupportTickets";

export type SlaLevel = "breached" | "at_risk" | "on_track";

/** Fila cruda que devuelve la RPC. */
export interface SlaStatusRow {
  ticket_id: string;
  client_id: string | null;
  estado: string | null;
  prioridad: string | null;
  limit_hours: number | null;
  elapsed_hours: number | null;
  sla_source: string | null;
  sla_status: "ok" | "warning" | "overdue" | "no_sla";
}

export interface SlaCaseRow {
  ticket: SupportTicket;
  /** Prioridad tal como la aplicó la regla. */
  priorityLevel: string;
  /** "contrato" | "politica" — de dónde salió el límite, para poder auditarlo. */
  slaSource: string;
  elapsedHours: number;
  limitHours: number;
  pct: number;
  level: SlaLevel;
}

export interface SlaComplianceResult {
  rows: SlaCaseRow[];
  summary: {
    withSla: number; breached: number; atRisk: number; onTrack: number;
    sinSla: number; compliancePct: number | null;
  };
}

const EMPTY: SlaComplianceResult = {
  rows: [],
  summary: { withSla: 0, breached: 0, atRisk: 0, onTrack: 0, sinSla: 0, compliancePct: null },
};

/** Una sola llamada para toda la app; se filtra por cliente en memoria. */
export function useSlaStatusRows() {
  return useQuery({
    queryKey: ["sla-status-rows"],
    queryFn: async (): Promise<SlaStatusRow[]> => {
      const { data, error } = await supabase.rpc("get_tickets_sla_status" as never);
      if (error) throw error;
      return (data ?? []) as unknown as SlaStatusRow[];
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    // Si la migración todavía no se aplicó, la vista queda vacía en vez de
    // reventar; el error se ve en la consola de red, no en la pantalla.
    retry: false,
  });
}

export function useSlaCompliance(clientId?: string): SlaComplianceResult {
  const { data: tickets = [] } = useSupportTickets(clientId);
  const { data: statusRows = [] } = useSlaStatusRows();

  return useMemo(() => {
    if (tickets.length === 0) return EMPTY;

    const byId = new Map(statusRows.map(r => [r.ticket_id, r]));
    const rows: SlaCaseRow[] = [];
    let sinSla = 0;

    for (const t of tickets) {
      const s = byId.get(t.id);
      // Sin fila de estado el caso no se cuenta: inventarle un SLA acá sería
      // reintroducir la segunda implementación que este cambio elimina.
      if (!s) continue;
      if (s.sla_status === "no_sla") { sinSla++; continue; }

      const limitHours = Number(s.limit_hours) || 0;
      const elapsedHours = Number(s.elapsed_hours) || 0;
      if (!limitHours) { sinSla++; continue; }

      rows.push({
        ticket: t,
        priorityLevel: s.prioridad ?? t.prioridad ?? "—",
        slaSource: s.sla_source ?? "—",
        elapsedHours,
        limitHours,
        pct: Math.round((elapsedHours / limitHours) * 100),
        level: s.sla_status === "overdue" ? "breached" : s.sla_status === "warning" ? "at_risk" : "on_track",
      });
    }

    rows.sort((a, b) => b.pct - a.pct);
    const breached = rows.filter(r => r.level === "breached").length;
    const atRisk = rows.filter(r => r.level === "at_risk").length;
    const onTrack = rows.filter(r => r.level === "on_track").length;
    const withSla = rows.length;
    const compliancePct = withSla > 0 ? Math.round(((withSla - breached) / withSla) * 100) : null;

    return { rows, summary: { withSla, breached, atRisk, onTrack, sinSla, compliancePct } };
  }, [tickets, statusRows]);
}
