import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toCsv, downloadCsv } from "@/lib/exportCsv";
import { toneStyles, type DossierRow, type DossierTab } from "@/hooks/useClientDossier";
import { cn } from "@/lib/utils";

/** Mismo reparto para los 6 conjuntos: cambiar de tab no mueve las columnas. */
const GRID = "84px minmax(0,1fr) 100px 122px 74px";

export interface DossierTableProps {
  tabs: DossierTab[];
  active: string;
  onActiveChange: (key: string) => void;
  /** Nombre base del CSV; se le agrega el tab y la fecha. */
  exportName: string;
  onRowClick?: (row: DossierRow) => void;
  /** Fila resaltada al llegar desde el otro contexto. */
  highlightId?: string | null;
}

/**
 * Tabla del expediente: una sola definición para los seis conjuntos (tres de
 * soporte, tres de implementación). Las columnas cambian de rótulo, no de
 * estructura, así que duplicar la tabla por conjunto sólo habría multiplicado
 * los lugares donde arreglar un ancho.
 */
export function DossierTable({
  tabs, active, onActiveChange, exportName, onRowClick, highlightId,
}: DossierTableProps) {
  const tab = tabs.find(t => t.key === active) ?? tabs[0];
  if (!tab) return null;

  const exportVisible = () => {
    const [c1, c2, c3, c4, c5] = tab.cols;
    downloadCsv(
      `${exportName}-${tab.key}-${new Date().toLocaleDateString("en-CA")}.csv`,
      toCsv(tab.rows, [
        { key: "c1", header: c1, get: r => r.c1 },
        { key: "c2", header: c2, get: r => r.c2 },
        { key: "c3", header: c3, get: r => r.c3 },
        { key: "chip", header: c4, get: r => r.chip },
        { key: "c5", header: c5, get: r => r.c5 },
      ]),
    );
  };

  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-border bg-card">
      {/* Tabs + exportación */}
      <div className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border px-3 py-2.5">
        {tabs.map(t => {
          const isActive = t.key === tab.key;
          return (
            <button
              key={t.key}
              type="button"
              onClick={() => onActiveChange(t.key)}
              aria-current={isActive ? "true" : undefined}
              className={cn(
                "h-[30px] shrink-0 rounded-lg px-2.5 text-[11.5px] font-semibold transition-colors",
                isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
              )}
            >
              {t.label}
              <span className="ml-1 text-[10px] font-bold tabular-nums opacity-65">{t.count}</span>
            </button>
          );
        })}
        <Button variant="outline" size="sm" className="ml-auto h-[30px] shrink-0 gap-1.5 text-xs" onClick={exportVisible}>
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </Button>
      </div>

      {/* Cabecera de columnas, pegada */}
      <div
        className="sticky top-0 z-10 grid shrink-0 items-center gap-2 border-b border-border bg-muted/60 px-3 py-2 text-[9.5px] font-bold uppercase tracking-[0.07em] text-muted-foreground"
        style={{ gridTemplateColumns: GRID }}
      >
        {tab.cols.map((c, i) => (
          <span key={c} className={cn("min-w-0 truncate", i === 4 && "text-right")}>{c}</span>
        ))}
      </div>

      {/* Cuerpo: es lo único que scrollea de este lado */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {tab.rows.length === 0 ? (
          <p className="py-10 text-center text-xs text-muted-foreground">Sin registros.</p>
        ) : tab.rows.map(r => {
          const chip = toneStyles(r.chipTone);
          const val = toneStyles(r.valTone);
          const rail = toneStyles(r.rail);
          return (
            <div
              key={r.id}
              role={onRowClick ? "button" : undefined}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={() => onRowClick?.(r)}
              onKeyDown={e => { if (onRowClick && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); onRowClick(r); } }}
              className={cn(
                "relative grid items-center gap-2 border-b border-border/60 px-3 py-2 last:border-0",
                onRowClick && "cursor-pointer hover:bg-accent/40",
                highlightId === r.id && "bg-primary/[0.07] ring-1 ring-inset ring-primary/25",
              )}
              style={{ gridTemplateColumns: GRID }}
            >
              <span className={cn("absolute bottom-2 left-0 top-2 w-[3px] rounded-r-[3px]", rail.bar)} />
              <span className="min-w-0 truncate text-[10.5px] font-bold tabular-nums text-muted-foreground">{r.c1}</span>
              <span className="min-w-0 truncate text-[12px] font-medium text-foreground" title={r.c2}>{r.c2}</span>
              <span className="min-w-0 truncate text-[11px] font-medium text-muted-foreground" title={r.c3}>{r.c3}</span>
              <span className={cn("w-fit shrink-0 truncate rounded border px-1.5 py-px text-[10px] font-semibold", chip.chip)}>
                {r.chip}
              </span>
              <span className={cn("shrink-0 truncate text-right text-[11px] font-bold tabular-nums", val.text)}>{r.c5}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
