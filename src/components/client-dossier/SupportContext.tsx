import { useState } from "react";
import { AlertTriangle, ArrowRight } from "lucide-react";
import { toneStyles, type ClientDossier, type DossierRow } from "@/hooks/useClientDossier";
import { DossierTable } from "./DossierTable";
import { cn } from "@/lib/utils";

export interface SupportContextProps {
  dossier: ClientDossier;
  onOpenCase?: (ticketId: string) => void;
  /** Cruce al riesgo del proyecto desde la tarjeta de reincidencia. */
  onGoToRisk?: (riskId: string) => void;
  highlightId?: string | null;
}

export function SupportContext({ dossier, onOpenCase, onGoToRisk, highlightId }: SupportContextProps) {
  const [tab, setTab] = useState(dossier.supportTabs[0]?.key ?? "abiertos");
  const totalHours = dossier.hoursBySpecialist.reduce((s, h) => s + h.hours, 0);

  // El cruce sale del dato: sólo aparece si hay reincidencia Y un riesgo abierto
  // que la pueda explicar. Si no, la tarjeta no se dibuja en vez de afirmar una
  // relación que nadie comprobó.
  const linkedRisk = dossier.reopenCount > 0 ? dossier.openRisks[0] ?? null : null;

  return (
    <div className="grid grid-cols-1 gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_340px]">
      {/* Izquierda */}
      <div className="flex flex-col gap-3 lg:min-h-0">
        <DossierTable
          tabs={dossier.supportTabs}
          active={tab}
          onActiveChange={setTab}
          exportName={`soporte-${dossier.client?.id ?? "cliente"}`}
          onRowClick={onOpenCase ? (r: DossierRow) => onOpenCase(r.id) : undefined}
          highlightId={highlightId}
        />

        <div className="grid shrink-0 grid-cols-1 gap-3 xl:grid-cols-2">
          {/* Horas por especialista */}
          <div className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[9.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
                Horas por especialista
              </p>
              <span className="shrink-0 text-[11px] font-bold tabular-nums text-foreground">
                {Math.round(totalHours * 10) / 10} h
              </span>
            </div>
            <div className="mt-2 space-y-1.5">
              {dossier.hoursBySpecialist.length === 0 ? (
                <p className="text-[10.5px] text-muted-foreground">Sin horas registradas este mes.</p>
              ) : dossier.hoursBySpecialist.map(h => (
                <div key={h.name} className="flex items-center gap-2">
                  <span className="w-[98px] shrink-0 truncate text-[10.5px] font-medium text-muted-foreground" title={h.name}>
                    {h.name}
                  </span>
                  <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${h.pct}%`, opacity: 0.4 + (h.pct / 100) * 0.6 }} />
                  </div>
                  <span className="shrink-0 text-[10.5px] font-bold tabular-nums text-foreground">{h.hours}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Temas recurrentes */}
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
              Temas recurrentes
            </p>
            <div className="mt-2 space-y-1.5">
              {dossier.recurringTopics.length === 0 ? (
                <p className="text-[10.5px] text-muted-foreground">Sin casos agrupables por producto.</p>
              ) : dossier.recurringTopics.map(t => (
                <div key={t.topic} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-[11px] text-foreground" title={t.topic}>{t.topic}</span>
                  <span className={cn("shrink-0 rounded border px-1.5 text-[10px] font-bold tabular-nums", toneStyles(t.tone).chip)}>
                    {t.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Derecha — scrollea sola */}
      <aside className="flex flex-col gap-2.5 lg:min-h-0 lg:overflow-y-auto">
        {/* SLA por mes */}
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground">SLA por mes</p>
          {dossier.slaByMonth.length === 0 ? (
            <p className="mt-2 text-[10.5px] text-muted-foreground">Sin historial de SLA.</p>
          ) : (
            <div className="mt-2.5 flex items-end justify-between gap-1.5">
              {dossier.slaByMonth.map(m => (
                <div key={m.month} className="flex min-w-0 flex-1 flex-col items-center gap-1">
                  <span className={cn("text-[9.5px] font-bold tabular-nums", toneStyles(m.tone).text)}>{m.pct}%</span>
                  <div className="flex h-12 w-full items-end">
                    <div className={cn("w-full rounded-t-[2px]", toneStyles(m.tone).bar)} style={{ height: `${Math.max(4, m.pct * 0.48)}px` }} />
                  </div>
                  <span className="w-full truncate text-center text-[9px] font-medium text-muted-foreground">{m.month}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contrato */}
        <div className="rounded-xl border border-border bg-card p-3">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground">Contrato</p>
          <div className="mt-1.5 space-y-1">
            {[
              ["Contacto", dossier.client?.contactName || "—"],
              ["Correo", dossier.client?.contactEmail || "—"],
              ["Inicio", dossier.client?.contractStart || "—"],
              ["Fin", dossier.client?.contractEnd || "—"],
              ["Core", dossier.client?.coreVersion || "—"],
            ].map(([k, v]) => (
              <div key={k} className="flex items-baseline justify-between gap-2">
                <span className="shrink-0 text-[10.5px] text-muted-foreground">{k}</span>
                <span className="min-w-0 truncate text-right text-[11px] font-semibold text-foreground" title={v}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Reincidencia cruzada con el riesgo del proyecto */}
        {dossier.reopenCount > 0 && (
          <div className="rounded-xl border border-warning/35 bg-warning/[0.06] p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-warning">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Patrón de reincidencia
            </p>
            <p className="mt-1 text-[10.5px] leading-snug text-muted-foreground">
              {dossier.reopenCount} reapertura{dossier.reopenCount === 1 ? "" : "s"} en 90 días
              {dossier.reincidenceModule ? `, con ${dossier.reincidenceModule} como módulo de mayor incidencia` : ""}.
            </p>
            {linkedRisk && (
              <button
                type="button"
                onClick={() => onGoToRisk?.(linkedRisk.id)}
                className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-bold text-primary hover:underline"
              >
                Ver {linkedRisk.id} en el proyecto <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
