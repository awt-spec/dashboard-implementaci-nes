import { useState } from "react";
import { ArrowRight, ShieldAlert } from "lucide-react";
import { toneStyles, type ClientDossier, type Tone } from "@/hooks/useClientDossier";
import { DossierTable } from "./DossierTable";
import { cn } from "@/lib/utils";

function phaseTone(status: string): Tone {
  if (status === "completado") return "green";
  if (status === "en-progreso") return "amber";
  return "grey";
}

export interface ImplContextProps {
  dossier: ClientDossier;
  /** Cruce a soporte desde un riesgo. */
  onGoToSupport?: () => void;
  highlightId?: string | null;
}

export function ImplContext({ dossier, onGoToSupport, highlightId }: ImplContextProps) {
  const [tab, setTab] = useState(dossier.implTabs[0]?.key ?? "entregables");
  const { phases, activePhaseIndex, client } = dossier;

  // Atraso = avance real contra el esperado si las fases avanzaran parejo.
  // Es una aproximación explícita: el modelo no guarda una línea base de plan.
  const expected = phases.length > 0 ? Math.round(((activePhaseIndex + 1) / phases.length) * 100) : 0;
  const real = client?.progress ?? 0;
  const gap = real - expected;

  return (
    <div className="grid grid-cols-1 gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-3 lg:min-h-0">
        {/* Stepper de fases */}
        {phases.length > 0 && (
          <div className="flex shrink-0 gap-2 overflow-x-auto">
            {phases.map((p, i) => {
              const t = toneStyles(phaseTone(p.status));
              const isActive = i === activePhaseIndex;
              return (
                <div
                  key={`${p.name}-${i}`}
                  className={cn(
                    "min-w-[128px] flex-1 rounded-[11px] border p-2",
                    isActive ? "border-primary/45 bg-primary/5" : "border-border bg-card",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", t.dot)} />
                    <span className="min-w-0 truncate text-[10.5px] font-bold text-foreground" title={p.name}>{p.name}</span>
                  </div>
                  <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full rounded-full", t.bar)} style={{ width: `${Math.min(100, Math.max(0, p.progress))}%` }} />
                  </div>
                  <div className="mt-1 flex items-baseline justify-between gap-1">
                    <span className="min-w-0 truncate text-[9.5px] font-semibold text-muted-foreground">
                      {p.endDate || "—"}
                    </span>
                    <span className="shrink-0 text-[9.5px] font-bold tabular-nums text-foreground">{p.progress}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <DossierTable
          tabs={dossier.implTabs}
          active={tab}
          onActiveChange={setTab}
          exportName={`implementacion-${client?.id ?? "cliente"}`}
          onRowClick={tab === "riesgos" ? () => onGoToSupport?.() : undefined}
          highlightId={highlightId}
        />
      </div>

      {/* Derecha — scrollea sola */}
      <aside className="flex flex-col gap-2.5 lg:min-h-0 lg:overflow-y-auto">
        {/* Avance vs plan */}
        <div className="rounded-xl border border-border bg-card p-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground">Avance vs. plan</p>
            <span className={cn(
              "shrink-0 rounded border px-1.5 text-[10px] font-bold tabular-nums",
              toneStyles(gap >= 0 ? "green" : gap >= -10 ? "amber" : "red").chip,
            )}>
              {gap >= 0 ? `+${gap}` : gap} pts
            </span>
          </div>
          <div className="mt-2.5 space-y-2">
            {[
              { label: "Plan", value: expected, cls: "bg-muted-foreground/30" },
              { label: "Real", value: real, cls: "bg-primary" },
            ].map(b => (
              <div key={b.label} className="flex items-center gap-2">
                <span className="w-9 shrink-0 text-[10px] font-semibold text-muted-foreground">{b.label}</span>
                <div className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className={cn("h-full rounded-full", b.cls)} style={{ width: `${Math.min(100, Math.max(0, b.value))}%` }} />
                </div>
                <span className="w-9 shrink-0 text-right text-[10.5px] font-bold tabular-nums text-foreground">{b.value}%</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[9.5px] leading-snug text-muted-foreground">
            El plan se estima repartiendo el avance entre las {phases.length} fases: el modelo no guarda una línea base.
          </p>
        </div>

        {/* Equipo del proyecto */}
        {(client?.teamAssigned?.length ?? 0) > 0 && (
          <div className="rounded-xl border border-border bg-card p-3">
            <p className="text-[9.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground">Equipo del proyecto</p>
            <div className="mt-2 space-y-1.5">
              {client!.teamAssigned.map(m => (
                <div key={m} className="flex items-center gap-2">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9.5px] font-bold text-primary">
                    {m.split(/\s+/).map(w => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[11px] font-medium text-foreground" title={m}>{m}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Riesgos altos abiertos */}
        {dossier.openRisks.filter(r => r.impact === "alto").length > 0 && (
          <div className="rounded-xl border border-destructive/35 bg-destructive/[0.05] p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-destructive">
              <ShieldAlert className="h-3.5 w-3.5 shrink-0" /> Riesgos de impacto alto
            </p>
            <div className="mt-1.5 space-y-1.5">
              {dossier.openRisks.filter(r => r.impact === "alto").slice(0, 3).map(r => (
                <div key={r.id}>
                  <p className="text-[10.5px] font-semibold leading-snug text-foreground">{r.id} · {r.description}</p>
                  {r.mitigation && (
                    <p className="text-[10px] leading-snug text-muted-foreground">{r.mitigation}</p>
                  )}
                </div>
              ))}
            </div>
            {dossier.reopenCount > 0 && (
              <button
                type="button"
                onClick={onGoToSupport}
                className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-bold text-primary hover:underline"
              >
                Ver la reincidencia en soporte <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
