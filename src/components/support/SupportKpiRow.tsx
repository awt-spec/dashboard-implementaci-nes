import { useSlaCompliance } from "@/hooks/useSlaCompliance";

type Tone = "primary" | "destructive" | "warning" | "success" | "muted";

const DOT: Record<Tone, string> = {
  primary: "bg-primary",
  destructive: "bg-destructive",
  warning: "bg-warning",
  success: "bg-success",
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
 * Fila de 6 KPIs del centro de mando (§9).
 *
 * Se derivan de useSlaCompliance sobre los MISMOS casos que muestra la lista
 * de abajo. Antes salían de get_sla_summary(), que es global: en la vista de
 * un cliente la fila anunciaba 383 casos encima de una lista de 12. Los
 * números contradecían lo que el usuario tenía delante.
 *
 * "Cumplimiento" es el que trae el hook —no incumplidos sobre casos con SLA—,
 * la misma definición que usa el medidor de la ficha del cliente, para que la
 * app no tenga dos cumplimientos distintos.
 */
export function SupportKpiRow({ clientId }: SupportKpiRowProps) {
  const { summary } = useSlaCompliance(clientId);

  const overdue = summary.breached;
  const warning = summary.atRisk;
  const ok = summary.onTrack;
  const noSla = summary.sinSla;
  const conSla = summary.withSla;
  const total = conSla + noSla;
  const cumplimiento = summary.compliancePct;

  const kpis: Kpi[] = [
    { label: "Casos abiertos", value: String(total), tone: "primary", title: "Casos abiertos en total" },
    { label: "Vencidos", value: String(overdue), tone: "destructive", title: "Superaron el tiempo de resolución del SLA" },
    { label: "Por vencer", value: String(warning), tone: "warning", title: "Al 80% o más del SLA" },
    { label: "En plazo", value: String(ok), tone: "success", title: "Dentro del SLA" },
    { label: "Sin SLA", value: String(noSla), tone: "muted", title: "Ninguna regla de SLA les aplica" },
    {
      label: "Cumplimiento",
      value: cumplimiento === null ? "—" : `${cumplimiento}%`,
      tone: cumplimiento === null ? "muted" : cumplimiento >= 90 ? "success" : cumplimiento >= 75 ? "warning" : "destructive",
      title: cumplimiento === null
        ? "Sin casos con SLA aplicable"
        : `${conSla - overdue} sin incumplir de ${conSla} casos con SLA · meta 90%`,
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
          <div className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${DOT[k.tone]}`} />
            <span className="text-[9.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground truncate">
              {k.label}
            </span>
          </div>
          <p className="mt-1 text-[18px] font-bold leading-none tabular-nums text-foreground">{k.value}</p>
        </div>
      ))}
    </div>
  );
}
