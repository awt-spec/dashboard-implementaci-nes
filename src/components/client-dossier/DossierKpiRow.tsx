import { toneStyles, type DossierKpi } from "@/hooks/useClientDossier";
import { Sparkline } from "./Sparkline";

/**
 * Fila de 5 KPIs. Cada tarjeta: label truncado + chip de variación, y abajo el
 * valor con el sparkline a la derecha.
 *
 * El delta se calcula de la serie (últimos dos puntos) — no se escribe a mano —
 * y por eso puede faltar: cuando no hay serie con qué comparar, el chip no se
 * dibuja en vez de mostrar un cero que parecería "sin cambios".
 */
export function DossierKpiRow({ kpis }: { kpis: DossierKpi[] }) {
  return (
    <div className="flex flex-wrap gap-2.5">
      {kpis.map(k => {
        const t = toneStyles(k.tone);
        return (
          <div
            key={k.label}
            title={k.title}
            className="min-w-0 flex-1 basis-[176px] rounded-xl border border-border bg-card px-3 py-2.5"
          >
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="min-w-0 flex-1 truncate text-[9.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground">
                {k.label}
              </span>
              {k.delta && (
                <span className={`shrink-0 rounded border px-1 text-[9.5px] font-bold leading-[18px] tabular-nums ${t.chip}`}>
                  {k.delta}
                </span>
              )}
            </div>
            <div className="mt-1 flex items-end justify-between gap-2">
              <span className="min-w-0 truncate text-[21px] font-extrabold leading-none tabular-nums text-foreground">
                {k.value}
              </span>
              <Sparkline values={k.series} tone={k.tone} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
