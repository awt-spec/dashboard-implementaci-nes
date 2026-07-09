import { useMemo } from "react";
import { useSupportTickets, type SupportTicket } from "@/hooks/useSupportTickets";
import { useClientSLAs, type ClientSLA } from "@/hooks/useClientContracts";
import { isTicketClosed } from "@/lib/ticketStatus";

// ── Cumplimiento SLA por caso ────────────────────────────────────────────────
// Cruza TODOS los casos abiertos del cliente con el SLA de su prioridad y
// clasifica: vencido / en riesgo / a tiempo, más los casos sin SLA aplicable.

const norm = (s?: string | null) => (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function priorityKey(p?: string | null): "critica" | "alta" | "media" | "baja" | null {
  const n = norm(p);
  if (n.includes("critic")) return "critica";
  if (n.includes("alta")) return "alta";
  if (n.includes("media")) return "media";
  if (n.includes("baja")) return "baja";
  return null;
}

export type SlaLevel = "breached" | "at_risk" | "on_track";
export interface SlaCaseRow {
  ticket: SupportTicket;
  sla: ClientSLA;
  elapsedHours: number;
  limitHours: number;
  responseHours: number;
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

export function useSlaCompliance(clientId?: string): SlaComplianceResult {
  const { data: tickets = [] } = useSupportTickets(clientId);
  const { data: slas = [] } = useClientSLAs(clientId);

  return useMemo(() => {
    // Un SLA por prioridad; se prefiere el de case_type "all".
    const byKey = new Map<string, ClientSLA>();
    for (const s of slas) {
      if (!s.is_active) continue;
      const k = priorityKey(s.priority_level);
      if (!k) continue;
      const cur = byKey.get(k);
      if (!cur || ((s.case_type || "all") === "all" && cur.case_type !== "all")) byKey.set(k, s);
    }

    const open = tickets.filter((t) => !isTicketClosed(t.estado));
    const now = Date.now();
    const rows: SlaCaseRow[] = [];
    let sinSla = 0;

    for (const t of open) {
      const k = priorityKey(t.prioridad);
      const sla = k ? byKey.get(k) : undefined;
      const limit = Number(sla?.resolution_time_hours) || 0;
      if (!sla || !limit) { sinSla++; continue; }

      const start = t.fecha_registro ? new Date(t.fecha_registro).getTime() : NaN;
      const elapsed = !Number.isNaN(start) ? (now - start) / 3_600_000 : (t.dias_antiguedad ?? 0) * 24;
      const pct = Math.round((elapsed / limit) * 100);
      const level: SlaLevel = elapsed > limit ? "breached" : pct >= 80 ? "at_risk" : "on_track";
      rows.push({ ticket: t, sla, elapsedHours: elapsed, limitHours: limit, responseHours: Number(sla.response_time_hours) || 0, pct, level });
    }

    rows.sort((a, b) => b.pct - a.pct);
    const breached = rows.filter((r) => r.level === "breached").length;
    const atRisk = rows.filter((r) => r.level === "at_risk").length;
    const onTrack = rows.filter((r) => r.level === "on_track").length;
    const withSla = rows.length;
    const compliancePct = withSla > 0 ? Math.round(((withSla - breached) / withSla) * 100) : null;

    return { rows, summary: { withSla, breached, atRisk, onTrack, sinSla, compliancePct } };
  }, [tickets, slas]);
}
