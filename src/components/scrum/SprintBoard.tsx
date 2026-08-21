import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  PackageOpen, CheckCircle2, PlayCircle, Flame, Flag, Target,
  Building2, Calendar, X, type LucideIcon,
} from "lucide-react";
import { normalizePrioridad } from "@/lib/ticketStatus";
import type { ScrumWorkItem, UnifiedSprint } from "@/hooks/useTeamScrum";
import { useClients } from "@/hooks/useClients";
import { useUpdateWorkItemScrum } from "@/hooks/useTeamScrum";
import { ActivePolicyBar } from "@/components/policy/ActivePolicyBar";
import { toast } from "sonner";

// ─── Columnas del tablero ────────────────────────────────────────────────

// `wip` es el límite de trabajo en curso; null = sin límite. Backlog y Hecho
// no lo llevan: uno es la reserva y el otro el resultado, limitarlos no dice
// nada. El tablero no tiene columna "QA" — el equivalente en este modelo de
// datos es "En Sprint", y ahí va el límite de 4 del handoff.
const COLUMNS: Array<{ key: string; label: string; Icon: LucideIcon; accent: string; bg: string; dot: string; wip: number | null }> = [
  { key: "backlog",     label: "Backlog",     Icon: PackageOpen,  accent: "text-muted-foreground", bg: "bg-muted/30",    dot: "bg-muted-foreground/40", wip: null },
  { key: "ready",       label: "Listo",       Icon: CheckCircle2, accent: "text-info",             bg: "bg-info/5",      dot: "bg-info",                wip: 6 },
  { key: "in_progress", label: "En Progreso", Icon: PlayCircle,   accent: "text-warning",          bg: "bg-warning/5",   dot: "bg-warning",             wip: 3 },
  { key: "in_sprint",   label: "En Sprint",   Icon: Flame,        accent: "text-primary",          bg: "bg-primary/5",   dot: "bg-primary",             wip: 4 },
  { key: "done",        label: "Hecho",       Icon: Flag,         accent: "text-success",          bg: "bg-success/5",   dot: "bg-success",             wip: null },
];

// ─── Estilos por prioridad ───────────────────────────────────────────────

function priorityStyles(p: string | null | undefined) {
  const n = normalizePrioridad(p);
  switch (n) {
    case "critica": return { border: "border-l-destructive", dot: "bg-destructive ring-2 ring-destructive/30", text: "text-destructive", label: "Crítica" };
    case "alta":    return { border: "border-l-destructive/70", dot: "bg-destructive/70", text: "text-destructive/80", label: "Alta" };
    case "media":   return { border: "border-l-warning", dot: "bg-warning", text: "text-warning", label: "Media" };
    case "baja":    return { border: "border-l-muted-foreground/40", dot: "bg-muted-foreground/50", text: "text-muted-foreground", label: "Baja" };
    default:        return { border: "border-l-border", dot: "bg-muted-foreground/30", text: "text-muted-foreground", label: "—" };
  }
}

// ─── Utils ────────────────────────────────────────────────────────────────

function initials(name?: string | null) {
  if (!name || name === "—") return "?";
  return name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

/** "14 mar" — cabe en el ancho de columna del tablero, "14/03/2026" no. */
function fmtShortDate(dueDate: string) {
  const d = new Date(`${dueDate.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("es", { day: "numeric", month: "short" });
}

function isOverdue(dueDate: string | null | undefined) {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}

// ─── Card individual ─────────────────────────────────────────────────────

function ItemCard({ item, onMove, onRemoveFromSprint }: { item: ScrumWorkItem; onMove: (i: ScrumWorkItem, status: string) => void; onRemoveFromSprint?: (i: ScrumWorkItem) => void }) {
  const rawPriority = (item.raw?.prioridad as string) || item.priority;
  const p = priorityStyles(rawPriority);
  const overdue = isOverdue(item.due_date);

  return (
    <div className={`group p-3 rounded-lg border bg-card border-l-4 ${p.border} space-y-2 hover:border-primary/40 hover:shadow-sm transition-all relative`}>
      {/* Botón "Quitar del sprint" — visible al hover */}
      {onRemoveFromSprint && (
        <button
          onClick={() => {
            if (confirm(`Quitar "${item.title.slice(0, 60)}" del sprint y devolver al backlog?`)) {
              onRemoveFromSprint(item);
            }
          }}
          className="absolute top-1.5 right-1.5 h-5 w-5 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          title="Quitar del sprint (volver al backlog)"
        >
          <X className="h-3 w-3" />
        </button>
      )}

      {/* Fila 1: origen · prioridad en texto · fecha (roja si vencida) */}
      <div className="flex items-center gap-1.5 min-w-0 pr-5">
        <Badge variant="outline" className="text-[10px] h-5 font-semibold shrink-0">
          {item.source === "task" ? "T" : "C"}
        </Badge>
        <span className={`text-[10px] font-semibold truncate ${p.text}`}>{p.label}</span>
        {item.due_date && (
          <span className={`ml-auto shrink-0 text-[10px] font-semibold tabular-nums ${overdue ? "text-destructive" : "text-muted-foreground"}`}>
            {fmtShortDate(item.due_date)}
          </span>
        )}
      </div>

      <p className="text-[11.5px] font-medium leading-snug line-clamp-2 min-h-[2.2rem]">{item.title}</p>

      {/* El handoff dibuja aquí un chip "BLOQUEO", pero el modelo no tiene
          estado de bloqueo: scrum_status sólo va de backlog a done. Se omite
          en vez de derivarlo de algo que no significa lo mismo. */}
      {item.client_name && (
        <p className="text-[11px] text-muted-foreground truncate">{item.client_name}</p>
      )}

      {/* Pie: a ~140px de ancho de columna todo esto compite por el espacio,
          así que cada hijo va con shrink-0 y el contenedor recorta. El WSJF va
          sólo numérico: con el prefijo "WSJF" el pie desbordaba. */}
      <div className="flex items-center gap-1.5 overflow-hidden border-t border-border pt-1.5">
        <div
          className="h-5 w-5 shrink-0 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center"
          title={item.owner || "sin responsable"}
        >
          {initials(item.owner)}
        </div>
        <span
          className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.visibility === "externa" ? "bg-success" : "bg-info"}`}
          title={item.visibility === "externa" ? "Externa — el cliente la ve" : "Interna — sólo SVA"}
        />
        {item.story_points != null && (
          <span className="shrink-0 text-[10px] font-semibold tabular-nums text-muted-foreground">
            {item.story_points} SP
          </span>
        )}
        {item.wsjf != null && item.wsjf > 0 && (
          <span className="ml-auto shrink-0 text-[10px] font-bold tabular-nums text-primary" title={`WSJF ${item.wsjf}`}>
            {item.wsjf}
          </span>
        )}
      </div>

      <Select value={item.scrum_status || "backlog"} onValueChange={(v) => onMove(item, v)}>
        <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
        <SelectContent>
          {COLUMNS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

// ─── Board principal ─────────────────────────────────────────────────────

interface Props {
  items: ScrumWorkItem[];
  activeSprints: UnifiedSprint[];
  onMove: (item: ScrumWorkItem, status: string) => void;
}

export function SprintBoard({ items, activeSprints, onMove }: Props) {
  const { data: clients = [] } = useClients();
  const updateScrum = useUpdateWorkItemScrum();
  const removeFromSprint = async (item: ScrumWorkItem) => {
    try {
      await updateScrum.mutateAsync({
        id: item.id, source: item.source,
        updates: { sprint_id: null, scrum_status: "backlog" },
      });
      toast.success("Devuelto al backlog");
    } catch (e: any) {
      toast.error(e.message || "Error quitando del sprint");
    }
  };
  const clientMap = useMemo(() => {
    const m = new Map<string, string>();
    (clients as any[]).forEach(c => m.set(c.id, c.name));
    return m;
  }, [clients]);

  const sprintMeta = useMemo(() => {
    return activeSprints.map(s => {
      const sItems = items.filter(i => i.sprint_id === s.id);
      const done = sItems.filter(i => i.scrum_status === "done").length;
      const pct = sItems.length > 0 ? Math.round((done / sItems.length) * 100) : 0;
      const now = Date.now();
      const end = s.end_date ? new Date(s.end_date).getTime() : null;
      const daysLeft = end ? Math.ceil((end - now) / 86400000) : null;
      return {
        sprint: s,
        clientName: clientMap.get(s.client_id) || s.client_id,
        total: sItems.length,
        done,
        pct,
        daysLeft,
      };
    }).sort((a, b) => (b.total - a.total));
  }, [activeSprints, items, clientMap]);

  if (activeSprints.length === 0) {
    return (
      <Card>
        <CardContent className="py-14 flex flex-col items-center gap-3 text-center">
          <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
            <Target className="h-6 w-6 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">No hay sprints activos</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm">
              Inicia un sprint desde Estrategia SVA → Sincronización (Inicializar sprints) o desde el dashboard del cliente.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Política v4.5 — métricas + cierre semanal aplicables al sprint */}
      <ActivePolicyBar
        ruleTypes={["metric", "weekly", "checklist"]}
        compact
        title="Política v4.5 · reglas del sprint"
      />

      {/* Sprints activos — con cliente, progreso y días restantes */}
      <div className="space-y-1.5">
        <p className="text-[11px] uppercase tracking-wide font-bold text-muted-foreground flex items-center gap-1.5">
          <Target className="h-3.5 w-3.5" /> {sprintMeta.length} sprint(s) activo(s)
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {sprintMeta.map(({ sprint: s, clientName, total, done, pct, daysLeft }) => {
            const urgent = daysLeft !== null && daysLeft <= 2;
            const overdue = daysLeft !== null && daysLeft < 0;
            return (
              <div
                key={s.id}
                className={`p-2.5 rounded-lg border bg-card hover:border-primary/40 transition-colors ${
                  overdue ? "border-destructive/40" : urgent ? "border-warning/40" : "border-border/60"
                }`}
              >
                <div className="flex items-start gap-2">
                  <Building2 className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{clientName}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{s.name}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-[10px] tabular-nums shrink-0 ${
                      overdue ? "bg-destructive/15 text-destructive border-destructive/30" :
                      urgent  ? "bg-warning/15 text-warning border-warning/30" :
                      "bg-muted/40"
                    }`}
                  >
                    <Calendar className="h-3 w-3 mr-0.5" />
                    {overdue ? `+${Math.abs(daysLeft!)}d` : daysLeft !== null ? `${daysLeft}d` : "—"}
                  </Badge>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <Progress value={pct} className="h-1.5 flex-1" />
                  <span className="text-[11px] tabular-nums text-muted-foreground shrink-0">
                    {done}/{total}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid de columnas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {COLUMNS.map(col => {
          const colItems = items.filter(i => (i.scrum_status || "backlog") === col.key);
          const colPoints = colItems.reduce((sum, i) => sum + (i.story_points || 0), 0);
          // El límite se excede POR ENCIMA, no al alcanzarlo: 3 de 3 es el
          // tope permitido, 4 de 3 es el problema.
          const overWip = col.wip !== null && colItems.length > col.wip;
          return (
            <Card key={col.key} className="flex flex-col min-w-0">
              <CardHeader className={`pb-2 rounded-t-lg ${col.bg} space-y-1`}>
                <CardTitle className="text-xs flex items-center justify-between gap-1.5 min-w-0">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${col.dot}`} />
                    <span className="truncate">{col.label}</span>
                  </span>
                  <Badge variant="outline" className="tabular-nums text-[11px] shrink-0">
                    {colItems.length}
                  </Badge>
                </CardTitle>
                {/* Segunda línea: carga de la columna. */}
                <div className="flex items-center justify-between gap-1.5 min-w-0">
                  <span className="text-[10px] font-semibold tabular-nums text-muted-foreground shrink-0">
                    {colPoints} SP
                  </span>
                  {col.wip !== null && (
                    <span
                      title={overWip
                        ? `${colItems.length} en curso sobre un límite de ${col.wip}`
                        : `Límite de trabajo en curso: ${col.wip}`}
                      className={`shrink-0 rounded px-1 py-px text-[9.5px] font-bold tabular-nums ${
                        overWip
                          ? "bg-destructive/15 text-destructive"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      WIP {colItems.length}/{col.wip}
                    </span>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex-1 space-y-2 max-h-[540px] overflow-auto pr-1 pt-2">
                {colItems.length === 0 ? (
                  <p className="text-xs text-center text-muted-foreground/50 py-8 italic">—</p>
                ) : colItems.map(item => (
                  <ItemCard key={`${item.source}-${item.id}`} item={item} onMove={onMove} onRemoveFromSprint={removeFromSprint} />
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
