import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  PackageOpen, CheckCircle2, PlayCircle, Flame, Flag, Target,
  AlertTriangle, Building2, Calendar, type LucideIcon,
} from "lucide-react";
import { normalizePrioridad } from "@/lib/ticketStatus";
import type { ScrumWorkItem, UnifiedSprint } from "@/hooks/useTeamScrum";
import { useClients } from "@/hooks/useClients";

// ─── Columnas del tablero ────────────────────────────────────────────────

const COLUMNS: Array<{ key: string; label: string; Icon: LucideIcon; accent: string; bg: string }> = [
  { key: "backlog",     label: "Backlog",     Icon: PackageOpen,  accent: "text-muted-foreground", bg: "bg-muted/30" },
  { key: "ready",       label: "Listo",       Icon: CheckCircle2, accent: "text-info",             bg: "bg-info/5" },
  { key: "in_progress", label: "En Progreso", Icon: PlayCircle,   accent: "text-warning",          bg: "bg-warning/5" },
  { key: "in_sprint",   label: "En Sprint",   Icon: Flame,        accent: "text-primary",          bg: "bg-primary/5" },
  { key: "done",        label: "Hecho",       Icon: Flag,         accent: "text-success",          bg: "bg-success/5" },
];

// ─── Estilos por prioridad ───────────────────────────────────────────────

function priorityStyles(p: string | null | undefined) {
  const n = normalizePrioridad(p);
  switch (n) {
    case "critica": return { border: "border-l-destructive", dot: "bg-destructive ring-2 ring-destructive/30", label: "Crítica" };
    case "alta":    return { border: "border-l-destructive/70", dot: "bg-destructive/70", label: "Alta" };
    case "media":   return { border: "border-l-warning", dot: "bg-warning", label: "Media" };
    case "baja":    return { border: "border-l-muted-foreground/40", dot: "bg-muted-foreground/50", label: "Baja" };
    default:        return { border: "border-l-border", dot: "bg-muted-foreground/30", label: "—" };
  }
}

// ─── Utils ────────────────────────────────────────────────────────────────

function initials(name?: string | null) {
  if (!name || name === "—") return "?";
  return name.split(/\s+/).map(s => s[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

function isOverdue(dueDate: string | null | undefined) {
  if (!dueDate) return false;
  return new Date(dueDate).getTime() < Date.now();
}

// ─── Card individual ─────────────────────────────────────────────────────

function ItemCard({ item, onMove }: { item: ScrumWorkItem; onMove: (i: ScrumWorkItem, status: string) => void }) {
  const rawPriority = (item.raw?.prioridad as string) || item.priority;
  const p = priorityStyles(rawPriority);
  const overdue = isOverdue(item.due_date);

  return (
    <div className={`p-3 rounded-lg border bg-card border-l-4 ${p.border} space-y-2 hover:border-primary/40 hover:shadow-sm transition-all`}>
      <div className="flex items-start gap-2">
        <div className="flex flex-col gap-1 items-start shrink-0">
          <Badge variant="outline" className="text-[10px] h-5 font-semibold">
            {item.source === "task" ? "T" : "C"}
          </Badge>
        </div>
        <p className="flex-1 text-sm font-medium leading-snug line-clamp-2 min-h-[2.5rem]">{item.title}</p>
      </div>

      {item.client_name && (
        <p className="text-[11px] text-muted-foreground truncate">{item.client_name}</p>
      )}

      <div className="flex items-center justify-between gap-2">
        {/* Avatar owner */}
        <div className="flex items-center gap-1.5 min-w-0">
          <div
            className="h-6 w-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center shrink-0"
            title={item.owner || "sin responsable"}
          >
            {initials(item.owner)}
          </div>
          <span className="text-[11px] text-muted-foreground truncate">
            {item.owner && item.owner !== "—" ? item.owner.split(" ")[0] : "—"}
          </span>
        </div>

        {/* Metadata derecha: SP + prioridad dot + overdue */}
        <div className="flex items-center gap-1 shrink-0">
          {overdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive" aria-label="Vencido" />}
          {item.story_points != null && (
            <Badge variant="outline" className="text-[10px] tabular-nums h-5 px-1.5">
              {item.story_points} SP
            </Badge>
          )}
          <div className={`h-2.5 w-2.5 rounded-full ${p.dot}`} title={`Prioridad ${p.label}`} />
        </div>
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
          const isOverloaded = col.key === "in_progress" && colItems.length > 8;
          return (
            <Card key={col.key} className="flex flex-col">
              <CardHeader className={`pb-2 rounded-t-lg ${col.bg}`}>
                <CardTitle className="text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <col.Icon className={`h-3.5 w-3.5 ${col.accent}`} />
                    {col.label}
                  </span>
                  <Badge
                    variant="outline"
                    className={`tabular-nums text-[11px] ${isOverloaded ? "bg-destructive/10 text-destructive border-destructive/30" : ""}`}
                  >
                    {colItems.length}
                    {isOverloaded && " ⚠"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex-1 space-y-2 max-h-[540px] overflow-auto pr-1 pt-2">
                {colItems.length === 0 ? (
                  <p className="text-xs text-center text-muted-foreground/50 py-8 italic">—</p>
                ) : colItems.map(item => (
                  <ItemCard key={`${item.source}-${item.id}`} item={item} onMove={onMove} />
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
