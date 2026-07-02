import { useMemo } from "react";
import { useSupportTickets, type SupportTicket } from "@/hooks/useSupportTickets";
import { useClientSLAs, type ClientSLA } from "@/hooks/useClientContracts";
import { isTicketClosed } from "@/lib/ticketStatus";

const norm = (s?: string | null) => (s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Normaliza la prioridad (ticket o SLA) a una clave común. */
function priorityKey(p?: string | null): "critica" | "alta" | "media" | "baja" | null {
  const n = norm(p);
  if (n.includes("critic")) return "critica";
  if (n.includes("alta")) return "alta";
  if (n.includes("media")) return "media";
  if (n.includes("baja")) return "baja";
  return null;
}

export interface SlaTicketStatus {
  ticket: SupportTicket;
  sla: ClientSLA;
  elapsedHours: number;
  limitHours: number;
  overageHours: number;
  level: "breached" | "at_risk";
  pct: number;
}

/**
 * Cruza los tickets abiertos con el SLA de su prioridad y detecta incumplimientos
 * de tiempo de resolución: "breached" (superó el límite) y "at_risk" (≥80%).
 */
export function useSlaAlerts(clientId?: string) {
  const { data: tickets = [] } = useSupportTickets(clientId);
  const { data: slas = [] } = useClientSLAs(clientId);

  return useMemo(() => {
    const slaByKey = new Map<string, ClientSLA>();
    for (const s of slas) {
      if (!s.is_active) continue;
      const k = priorityKey(s.priority_level);
      if (k && !slaByKey.has(k)) slaByKey.set(k, s);
    }

    const open = tickets.filter((t) => !isTicketClosed(t.estado));
    const statuses: SlaTicketStatus[] = [];
    const now = Date.now();

    for (const t of open) {
      const k = priorityKey(t.prioridad);
      if (!k) continue;
      const sla = slaByKey.get(k);
      if (!sla) continue;
      const limit = Number(sla.resolution_time_hours) || 0;
      if (!limit) continue;

      const start = t.fecha_registro ? new Date(t.fecha_registro).getTime() : null;
      const elapsed = start && !Number.isNaN(start)
        ? (now - start) / 3_600_000
        : (t.dias_antiguedad ?? 0) * 24;
      const pct = Math.round((elapsed / limit) * 100);

      if (elapsed > limit) {
        statuses.push({ ticket: t, sla, elapsedHours: elapsed, limitHours: limit, overageHours: elapsed - limit, level: "breached", pct });
      } else if (pct >= 80) {
        statuses.push({ ticket: t, sla, elapsedHours: elapsed, limitHours: limit, overageHours: 0, level: "at_risk", pct });
      }
    }

    const breached = statuses.filter((s) => s.level === "breached").sort((a, b) => b.overageHours - a.overageHours);
    const atRisk = statuses.filter((s) => s.level === "at_risk").sort((a, b) => b.pct - a.pct);
    return { breached, atRisk, total: statuses.length };
  }, [tickets, slas]);
}
