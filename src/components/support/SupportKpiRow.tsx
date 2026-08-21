import { useSLASummary } from "@/hooks/useSLASummary";

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

/**
 * Fila de 6 KPIs del centro de mando (§9).
 *
 * Los seis salen de get_sla_summary() — la RPC que recomputa el SLA
 * server-side leyendo las reglas vigentes. Ninguno está escrito a mano.
 *
 * "Cumplimiento" es el único derivado: en plazo sobre los casos que TIENEN
 * SLA. Meter los `no_sla` en el denominador haría bajar el porcentaje por
 * casos que ninguna regla cubre, que es exactamente lo contrario de lo que
 * mide un indicador de cumplimiento.
 */
export function SupportKpiRow() {
  const { data: sla } = useSLASummary();

  const total = sla?.total ?? 0;
  const overdue = sla?.overdue ?? 0;
  const warning = sla?.warning ?? 0;
  const ok = sla?.ok ?? 0;
  const noSla = sla?.no_sla ?? 0;

  const conSla = total - noSla;
  const cumplimiento = conSla > 0 ? Math.round((ok / conSla) * 100) : null;

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
        : `${ok} en plazo de ${conSla} casos con SLA · meta 90%`,
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
