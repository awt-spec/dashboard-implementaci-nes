import { useMemo } from "react";
import { useSlaCompliance } from "@/hooks/useSlaCompliance";
import { useSupportTickets } from "@/hooks/useSupportTickets";
import { useReopenRate90d } from "@/hooks/useTicketReopens";

type Tone = "primary" | "destructive" | "warning" | "success" | "muted" | "info";

const DOT: Record<Tone, string> = {
  primary: "bg-primary",
  destructive: "bg-destructive",
  warning: "bg-warning",
  success: "bg-success",
  info: "bg-info",
  muted: "bg-muted-foreground/40",
};

interface Kpi {
  label: string;
  value: string;
  tone: Tone;
  title: string;
}

export interface SupportKpiRowProps {
  /** Acota los indicadores al cliente en pantalla. Sin valor, toda la cola. */
  clientId?: string;
}

/**
 * Fila de 6 KPIs del centro de mando (§9), en el orden del diseño.
 *
 * Se derivan de useSlaCompliance sobre los MISMOS casos que muestra la cola de
 * abajo. Antes salían de get_sla_summary(), que es global: en la vista de un
 * cliente la fila anunciaba 383 casos encima de una lista de 12.
 *
 * El diseño pide "Respuesta P50" en el sexto lugar. No se puede calcular: los
 * tickets no guardan marca de primera respuesta —`response_time_hours` es la
 * META del SLA, no lo medido— así que ese hueco lo ocupa Cumplimiento, que sí
 * sale de datos reales.
 */
export function SupportKpiRow({ clientId }: SupportKpiRowProps) {
  const { summary } = useSlaCompliance(clientId);
  const { data: tickets = [] } = useSupportTickets(clientId);
  const { data: reopen } = useReopenRate90d(clientId);

  // Fecha local, no UTC: en UTC-6 lo cerrado por la tarde caía en "mañana".
  const closedToday = useMemo(() => {
    const today = new Date().toLocaleDateString("en-CA");
    return tickets.filter(t => (t.fecha_entrega || "").slice(0, 10) === today).length;
  }, [tickets]);

  const abiertos = summary.withSla + summary.sinSla;
  const cumplimiento = summary.compliancePct;

  const kpis: Kpi[] = [
    { label: "Vencidos", value: String(summary.breached), tone: "destructive", title: "Superaron el tiempo de resolución del SLA" },
    { label: "En riesgo", value: String(summary.atRisk), tone: "warning", title: "Al 80% o más del SLA" },
    { label: "Abiertos", value: String(abiertos), tone: "info", title: "Casos abiertos en total" },
    {
      label: "Reincidencias",
      value: reopen ? String(reopen.reopens_90d) : "—",
      tone: reopen && reopen.reopens_90d > 0 ? "warning" : "muted",
      title: reopen
        ? `${reopen.reopens_90d} reaperturas sobre ${reopen.entregados_90d} entregados en 90 días (${reopen.rate_pct}%)`
        : "Sin datos de reaperturas",
    },
    { label: "Cerrados hoy", value: String(closedToday), tone: "success", title: "Con fecha de entrega de hoy" },
    {
      label: "Cumplimiento",
      value: cumplimiento === null ? "—" : `${cumplimiento}%`,
      tone: cumplimiento === null ? "muted" : cumplimiento >= 90 ? "success" : cumplimiento >= 75 ? "warning" : "destructive",
      title: cumplimiento === null
        ? "Sin casos con SLA aplicable"
        : `${summary.withSla - summary.breached} sin incumplir de ${summary.withSla} casos con SLA · meta 90%`,
    },
  ];

  return (
    <div className="flex flex-wrap gap-2.5">
      {kpis.map(k => (
        <div
          key={k.label}
          title={k.title}
          className="flex-1 min-w-[132px] rounded-xl border border-border bg-card px-3 py-2.5"
        >
          <span className={`block h-1.5 w-1.5 rounded-full ${DOT[k.tone]}`} />
          <p className="mt-1.5 text-[18px] font-bold leading-none tabular-nums text-foreground">{k.value}</p>
          <p className="mt-1.5 text-[9.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground truncate">
            {k.label}
          </p>
        </div>
      ))}
    </div>
  );
}
