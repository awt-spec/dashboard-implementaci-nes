/**
 * Incumplimientos y casos en riesgo, derivados de useSlaCompliance.
 *
 * Antes recalculaba la regla por su cuenta —tercera implementación de lo
 * mismo— con lo que podía discrepar de los KPIs de la pantalla de al lado.
 * Ahora sólo particiona lo que ya viene resuelto de la base.
 */
import { useMemo } from "react";
import { useSlaCompliance, type SlaCaseRow } from "@/hooks/useSlaCompliance";
import type { SupportTicket } from "@/hooks/useSupportTickets";

export interface SlaTicketStatus {
  ticket: SupportTicket;
  priorityLevel: string;
  elapsedHours: number;
  limitHours: number;
  /** Horas por encima del límite; 0 cuando todavía está dentro. */
  overageHours: number;
  level: "breached" | "at_risk";
  pct: number;
}

const toStatus = (r: SlaCaseRow, level: "breached" | "at_risk"): SlaTicketStatus => ({
  ticket: r.ticket,
  priorityLevel: r.priorityLevel,
  elapsedHours: r.elapsedHours,
  limitHours: r.limitHours,
  overageHours: level === "breached" ? r.elapsedHours - r.limitHours : 0,
  level,
  pct: r.pct,
});

export function useSlaAlerts(clientId?: string) {
  const { rows } = useSlaCompliance(clientId);

  return useMemo(() => {
    const breached = rows
      .filter(r => r.level === "breached")
      .map(r => toStatus(r, "breached"))
      .sort((a, b) => b.overageHours - a.overageHours);
    const atRisk = rows
      .filter(r => r.level === "at_risk")
      .map(r => toStatus(r, "at_risk"))
      .sort((a, b) => b.pct - a.pct);
    return { breached, atRisk, total: breached.length + atRisk.length };
  }, [rows]);
}
