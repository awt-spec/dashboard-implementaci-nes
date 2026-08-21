import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MobileCard } from "@/components/mobile/MobileScreen";
import { cn } from "@/lib/utils";
import type { ScrumWorkItem } from "@/hooks/useTeamScrum";
import { fmtShortDate, isOverdue, itemInitials, priorityMeta, shortId, shortName } from "@/lib/scrumItem";

function MicroChip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("shrink-0 rounded border px-1 py-px text-[9px] font-bold uppercase tracking-wide", className)}>
      {children}
    </span>
  );
}

/* ── Componente ──────────────────────────────────────────────────────── */

export interface ScrumItemCardProps {
  item: ScrumWorkItem;
  /**
   * `compact` = teléfono (una columna, hay ancho para etiquetas escritas).
   * `desk` = tablero de 5 columnas (~140px: todo compite por el espacio).
   */
  variant: "compact" | "desk";
  /** Sólo `desk`: mover de columna. */
  onMove?: (item: ScrumWorkItem, status: string) => void;
  /** Sólo `desk`: devolver al backlog. */
  onRemoveFromSprint?: (item: ScrumWorkItem) => void;
  /** Columnas disponibles para el selector de `desk`. */
  columns?: Array<{ key: string; label: string }>;
}

/**
 * Tarjeta de un item de Scrum. Única definición para teléfono y escritorio:
 * antes vivía duplicada en MobileScrum y SprintBoard, y las dos copias ya
 * habían divergido (una mostraba la visibilidad como chip escrito y la otra
 * ni la mostraba).
 *
 * Lo que cambia entre variantes es el ANCHO disponible, no la información:
 * en `desk` la visibilidad es un punto de 6px y el WSJF va sólo numérico
 * porque el prefijo desborda la columna; en `compact` ambos van escritos.
 */
export function ScrumItemCard({ item, variant, onMove, onRemoveFromSprint, columns = [] }: ScrumItemCardProps) {
  const p = priorityMeta((item.raw as { prioridad?: string } | null)?.prioridad ?? item.priority);
  const overdue = isOverdue(item.due_date);
  const due = fmtShortDate(item.due_date);
  const owner = item.owner && item.owner !== "—" ? item.owner : null;
  const estimated = item.story_points != null && item.story_points > 0;
  const hasWsjf = item.wsjf > 0;
  const id = shortId(item);

  /* ── Teléfono ── */
  if (variant === "compact") {
    return (
      <MobileCard className={cn("border-l-[3px] p-[11px] pl-[13px]", p.border)}>
        <div className="flex items-center gap-1.5">
          <MicroChip className={item.source === "ticket"
            ? "border-info/30 bg-info/10 text-info"
            : "border-primary/30 bg-primary/10 text-primary"}>
            {item.source === "ticket" ? "Soporte" : "Impl."}
          </MicroChip>
          {id && <span className="truncate text-[9.5px] font-bold tabular-nums text-muted-foreground">{id}</span>}
          <MicroChip className={item.visibility === "interna"
            ? "border-border bg-muted text-muted-foreground"
            : "border-success/30 bg-success/10 text-success"}>
            {item.visibility === "interna" ? "Interna" : "Externa"}
          </MicroChip>
          <span className={cn("ml-auto shrink-0 text-[10px] font-semibold tabular-nums",
            overdue ? "text-destructive" : "text-muted-foreground")}>
            {due ?? "Sin fecha"}
          </span>
        </div>

        <p className="mt-1.5 text-[12.5px] font-semibold leading-[1.35] text-foreground">{item.title}</p>

        <div className="mt-2 flex items-center gap-[7px]">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-muted-foreground">
            {itemInitials(owner)}
          </span>
          <span className="min-w-0 truncate text-[10.5px] font-medium text-muted-foreground">
            {owner ? shortName(owner) : "Sin asignar"}
          </span>
          <span className="ml-auto shrink-0 whitespace-nowrap text-[10px] font-semibold tabular-nums text-muted-foreground">
            {estimated ? `${item.story_points} SP` : "sin estimar"}
          </span>
          <span className="shrink-0 whitespace-nowrap text-[10px] font-semibold tabular-nums text-destructive">
            {hasWsjf ? `WSJF ${item.wsjf.toFixed(1)}` : "WSJF —"}
          </span>
        </div>
      </MobileCard>
    );
  }

  /* ── Tablero de escritorio ── */
  return (
    <div className={cn(
      "group relative space-y-2 rounded-lg border border-l-4 bg-card p-3 transition-all hover:border-primary/40 hover:shadow-sm",
      p.border,
    )}>
      {onRemoveFromSprint && (
        <button
          onClick={() => {
            if (confirm(`Quitar "${item.title.slice(0, 60)}" del sprint y devolver al backlog?`)) {
              onRemoveFromSprint(item);
            }
          }}
          className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/15 hover:text-destructive group-hover:opacity-100"
          title="Quitar del sprint (volver al backlog)"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      <div className="flex min-w-0 items-center gap-1.5 pr-5">
        <Badge variant="outline" className="h-5 shrink-0 text-[10px] font-semibold">
          {item.source === "task" ? "T" : "C"}
        </Badge>
        <span className={cn("truncate text-[10px] font-semibold", p.text)}>{p.label}</span>
        {due && (
          <span className={cn("ml-auto shrink-0 text-[10px] font-semibold tabular-nums",
            overdue ? "text-destructive" : "text-muted-foreground")}>
            {due}
          </span>
        )}
      </div>

      <p className="line-clamp-2 min-h-[2.2rem] text-[11.5px] font-medium leading-snug">{item.title}</p>

      {item.client_name && (
        <p className="truncate text-[11px] text-muted-foreground">{item.client_name}</p>
      )}

      {/* A ~140px de columna todo esto compite por el espacio: cada hijo va
          con shrink-0 y el contenedor recorta. */}
      <div className="flex items-center gap-1.5 overflow-hidden border-t border-border pt-1.5">
        <div
          className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[9px] font-bold text-primary"
          title={owner || "sin responsable"}
        >
          {itemInitials(owner)}
        </div>
        <span
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", item.visibility === "externa" ? "bg-success" : "bg-info")}
          title={item.visibility === "externa" ? "Externa — el cliente la ve" : "Interna — sólo SVA"}
        />
        {estimated && (
          <span className="shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground">
            {item.story_points} SP
          </span>
        )}
        {hasWsjf && (
          <span className="ml-auto shrink-0 text-[10px] font-bold tabular-nums text-primary" title={`WSJF ${item.wsjf}`}>
            {item.wsjf}
          </span>
        )}
      </div>

      {onMove && columns.length > 0 && (
        <Select value={item.scrum_status || "backlog"} onValueChange={v => onMove(item, v)}>
          <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            {columns.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
