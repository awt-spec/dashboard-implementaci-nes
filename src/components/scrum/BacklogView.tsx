import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Trophy, Inbox, List, Users, Building2, Table as TableIcon,
  ChevronDown, ChevronRight, Target, ArrowRightCircle, type LucideIcon,
} from "lucide-react";
import type { ScrumWorkItem, UnifiedSprint } from "@/hooks/useTeamScrum";
import { useUpdateWorkItemScrum } from "@/hooks/useTeamScrum";
import { toast } from "sonner";

const SCRUM_COLUMNS = [
  { key: "backlog",     label: "Backlog" },
  { key: "ready",       label: "Listo" },
  { key: "in_progress", label: "En Progreso" },
  { key: "in_sprint",   label: "En Sprint" },
  { key: "done",        label: "Hecho" },
];

const SOURCE_STYLES: Record<string, string> = {
  task:   "bg-info/10 text-info border-info/30",
  ticket: "bg-warning/10 text-warning border-warning/30",
};

const VISIBILITY_STYLES: Record<string, string> = {
  interna: "bg-violet-500/10 text-violet-500 border-violet-500/30",
  externa: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
};

type ViewMode = "list" | "by-client" | "by-owner" | "table";

interface Props {
  items: ScrumWorkItem[];
  hasActiveFilters: boolean;
  onChangeStatus: (item: ScrumWorkItem, status: string) => void;
  /** Sprints activos para el dropdown "Asignar a sprint". Si no se pasa, no se muestra el botón. */
  activeSprints?: UnifiedSprint[];
  /** Si se pasa, el área izquierda de cada row (título + metadata) abre el detalle. */
  onItemClick?: (item: ScrumWorkItem) => void;
}

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

function EmptyBacklog({ hasActiveFilters }: { hasActiveFilters: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
      <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
        <Inbox className="h-6 w-6 text-primary" />
      </div>
      <div>
        <p className="text-sm font-semibold">Backlog vacío</p>
        <p className="mt-1 text-xs text-muted-foreground max-w-sm">
          {hasActiveFilters
            ? "Ajusta los filtros para ver más items."
            : "Crea tareas o casos para que aparezcan aquí priorizados por WSJF."}
        </p>
      </div>
    </div>
  );
}

function ItemRow({
  item, idx, onChangeStatus, activeSprints, onItemClick,
}: {
  item: ScrumWorkItem;
  idx?: number;
  onChangeStatus: (i: ScrumWorkItem, s: string) => void;
  activeSprints?: UnifiedSprint[];
  onItemClick?: (item: ScrumWorkItem) => void;
}) {
  const updateScrum = useUpdateWorkItemScrum();
  // Filtra sprints del cliente del item (o todos si no hay match)
  const eligibleSprints = (activeSprints || []).filter(
    s => !item.client_id || s.client_id === item.client_id
  );

  const assignToSprint = async (sprintId: string) => {
    try {
      await updateScrum.mutateAsync({
        id: item.id,
        source: item.source,
        updates: { sprint_id: sprintId, scrum_status: "in_sprint" },
      });
      const sprintName = eligibleSprints.find(s => s.id === sprintId)?.name || "sprint";
      toast.success(`Asignado a ${sprintName}`);
    } catch (e: any) {
      toast.error(e.message || "Error asignando a sprint");
    }
  };

  // Área izquierda (idx + tipo + título + meta + badges): clickable si hay handler.
  // Los Selects de la derecha permanecen interactivos sin bubbling — viven fuera del button.
  const leftContent = (
    <>
      {idx !== undefined && (
        <span className="font-mono text-xs text-muted-foreground w-6 text-center font-semibold shrink-0">{idx + 1}</span>
      )}
      <Badge variant="outline" className={`${SOURCE_STYLES[item.source]} text-[11px] shrink-0`}>
        {item.source === "task" ? "Tarea" : "Caso"}
      </Badge>
      <Badge
        variant="outline"
        className={`${VISIBILITY_STYLES[item.visibility]} text-[10px] shrink-0 hidden md:inline-flex`}
        title={item.visibility === "interna" ? "Interna · solo equipo SVA" : "Externa · cliente puede ver"}
      >
        {item.visibility === "interna" ? "Int" : "Ext"}
      </Badge>
      <span className="flex-1 truncate text-sm font-medium">{item.title}</span>
      {item.client_name && (
        <span className="text-xs text-muted-foreground truncate max-w-[140px] shrink-0 hidden md:inline">
          {item.client_name}
        </span>
      )}
      <span className="text-xs text-muted-foreground shrink-0 hidden lg:inline">{item.owner || "—"}</span>
      <div className="flex items-center gap-1 shrink-0">
        <Badge variant="outline" className="text-[11px] tabular-nums">V:{item.business_value ?? "—"}</Badge>
        <Badge variant="outline" className="text-[11px] tabular-nums">E:{item.effort ?? "—"}</Badge>
        <Badge className="bg-warning/15 text-warning border-warning/30 text-[11px] font-bold tabular-nums">
          WSJF {item.wsjf || "—"}
        </Badge>
      </div>
    </>
  );

  return (
    <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg hover:bg-muted/40 border border-border/40 transition-colors">
      {onItemClick ? (
        <button
          type="button"
          onClick={() => onItemClick(item)}
          className="flex flex-1 items-center gap-2 text-left min-w-0 cursor-pointer focus:outline-none focus:ring-2 focus:ring-primary/40 rounded"
          aria-label={`Ver detalle: ${item.title}`}
        >
          {leftContent}
        </button>
      ) : (
        <>{leftContent}</>
      )}
      <Select value={item.scrum_status || "backlog"} onValueChange={v => onChangeStatus(item, v)}>
        <SelectTrigger className="h-7 w-[120px] text-[11px] shrink-0"><SelectValue /></SelectTrigger>
        <SelectContent>
          {SCRUM_COLUMNS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
        </SelectContent>
      </Select>
      {/* Asignar a sprint (sólo si hay sprints elegibles del mismo cliente) */}
      {eligibleSprints.length > 0 && (
        <Select value={item.sprint_id ?? "__none"} onValueChange={(v) => v !== "__none" && assignToSprint(v)}>
          <SelectTrigger className="h-7 w-[150px] text-[11px] shrink-0 border-primary/30 text-primary">
            <Target className="h-3 w-3 mr-1" />
            <SelectValue placeholder="→ Sprint" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none" disabled className="text-xs text-muted-foreground">
              {item.sprint_id ? "Ya en sprint" : "Asignar a sprint…"}
            </SelectItem>
            {eligibleSprints.map(s => (
              <SelectItem key={s.id} value={s.id} className="text-xs">
                {s.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Vistas
// ─────────────────────────────────────────────────────────────────────────

function ListView({ items, onChangeStatus, activeSprints, onItemClick }: { items: ScrumWorkItem[]; onChangeStatus: Props["onChangeStatus"]; activeSprints?: UnifiedSprint[]; onItemClick?: Props["onItemClick"] }) {
  return (
    <div className="space-y-1 max-h-[640px] overflow-auto pr-1">
      {items.map((item, idx) => <ItemRow key={`${item.source}-${item.id}`} item={item} idx={idx} onChangeStatus={onChangeStatus} activeSprints={activeSprints} onItemClick={onItemClick} />)}
    </div>
  );
}

function GroupedView({
  items, groupBy, onChangeStatus, activeSprints, onItemClick,
}: {
  items: ScrumWorkItem[];
  groupBy: (item: ScrumWorkItem) => string;
  onChangeStatus: Props["onChangeStatus"];
  activeSprints?: UnifiedSprint[];
  onItemClick?: Props["onItemClick"];
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const groups = useMemo(() => {
    const m = new Map<string, ScrumWorkItem[]>();
    items.forEach(i => {
      const k = groupBy(i) || "—";
      if (!m.has(k)) m.set(k, []);
      m.get(k)!.push(i);
    });
    return Array.from(m.entries())
      .map(([k, arr]) => ({
        key: k,
        items: arr,
        totalWsjf: arr.reduce((s, i) => s + (i.wsjf || 0), 0),
        avgWsjf: arr.length > 0 ? Math.round((arr.reduce((s, i) => s + (i.wsjf || 0), 0) / arr.length) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.totalWsjf - a.totalWsjf);
  }, [items, groupBy]);

  const toggle = (k: string) => {
    const n = new Set(collapsed);
    if (n.has(k)) n.delete(k); else n.add(k);
    setCollapsed(n);
  };

  return (
    <div className="space-y-2 max-h-[640px] overflow-auto pr-1">
      {groups.map(g => {
        const isCollapsed = collapsed.has(g.key);
        return (
          <div key={g.key} className="border border-border/50 rounded-lg overflow-hidden">
            <button
              onClick={() => toggle(g.key)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              {isCollapsed
                ? <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                : <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
              <span className="text-sm font-semibold truncate">{g.key}</span>
              <Badge variant="outline" className="text-[11px] tabular-nums ml-auto">
                {g.items.length}
              </Badge>
              <Badge className="bg-warning/10 text-warning border-warning/30 text-[11px] font-bold tabular-nums">
                WSJF Σ {Math.round(g.totalWsjf)}
              </Badge>
            </button>
            {!isCollapsed && (
              <div className="p-2 space-y-1 bg-card">
                {g.items.map((item, idx) => (
                  <ItemRow key={`${item.source}-${item.id}`} item={item} idx={idx} onChangeStatus={onChangeStatus} activeSprints={activeSprints} onItemClick={onItemClick} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TableView({ items, onChangeStatus, onItemClick }: { items: ScrumWorkItem[]; onChangeStatus: Props["onChangeStatus"]; onItemClick?: Props["onItemClick"] }) {
  return (
    <div className="overflow-auto max-h-[640px] border border-border/40 rounded-lg">
      <table className="w-full text-xs">
        <thead className="bg-muted/50 sticky top-0 z-10">
          <tr className="text-left">
            <th className="px-2 py-2 font-semibold w-8">#</th>
            <th className="px-2 py-2 font-semibold w-14">Tipo</th>
            <th className="px-2 py-2 font-semibold">Título</th>
            <th className="px-2 py-2 font-semibold">Cliente</th>
            <th className="px-2 py-2 font-semibold">Owner</th>
            <th className="px-2 py-2 font-semibold text-right">V</th>
            <th className="px-2 py-2 font-semibold text-right">E</th>
            <th className="px-2 py-2 font-semibold text-right">WSJF</th>
            <th className="px-2 py-2 font-semibold w-28">Estado</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr
              key={`${item.source}-${item.id}`}
              className={`border-t border-border/30 hover:bg-muted/30 transition-colors ${onItemClick ? "cursor-pointer" : ""}`}
              onClick={onItemClick ? () => onItemClick(item) : undefined}
            >
              <td className="px-2 py-1.5 font-mono text-muted-foreground">{idx + 1}</td>
              <td className="px-2 py-1.5">
                <Badge variant="outline" className={`${SOURCE_STYLES[item.source]} text-[10px]`}>
                  {item.source === "task" ? "T" : "C"}
                </Badge>
              </td>
              <td className="px-2 py-1.5 font-medium truncate max-w-[320px]">{item.title}</td>
              <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[120px]">{item.client_name || "—"}</td>
              <td className="px-2 py-1.5 text-muted-foreground truncate max-w-[100px]">{item.owner || "—"}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{item.business_value ?? "—"}</td>
              <td className="px-2 py-1.5 text-right tabular-nums">{item.effort ?? "—"}</td>
              <td className="px-2 py-1.5 text-right">
                <Badge className="bg-warning/15 text-warning border-warning/30 text-[10px] font-bold tabular-nums">
                  {item.wsjf || "—"}
                </Badge>
              </td>
              <td className="px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                <Select value={item.scrum_status || "backlog"} onValueChange={v => onChangeStatus(item, v)}>
                  <SelectTrigger className="h-6 text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SCRUM_COLUMNS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Principal
// ─────────────────────────────────────────────────────────────────────────

const VIEWS: Array<{ value: ViewMode; label: string; Icon: LucideIcon; title: string }> = [
  { value: "list",      label: "Lista",          Icon: List,       title: "Priorizada por WSJF" },
  { value: "by-client", label: "Por cliente",    Icon: Building2,  title: "Agrupado por cliente" },
  { value: "by-owner",  label: "Por responsable", Icon: Users,     title: "Agrupado por persona" },
  { value: "table",     label: "Tabla",          Icon: TableIcon,  title: "Vista compacta" },
];

export function BacklogView({ items, hasActiveFilters, onChangeStatus, activeSprints, onItemClick }: Props) {
  const [view, setView] = useState<ViewMode>("list");
  const current = VIEWS.find(v => v.value === view)!;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <CardTitle className="text-sm flex items-center gap-2">
            <Trophy className="h-4 w-4 text-warning" />
            Backlog
            <Badge variant="outline">{items.length}</Badge>
            <span className="text-[11px] text-muted-foreground font-normal hidden sm:inline">
              · {current.title}
            </span>
          </CardTitle>
          <ToggleGroup
            type="single"
            value={view}
            onValueChange={(v) => v && setView(v as ViewMode)}
            className="gap-0.5"
          >
            {VIEWS.map(v => (
              <ToggleGroupItem
                key={v.value}
                value={v.value}
                className="h-8 px-2.5 gap-1.5 text-xs data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                aria-label={v.label}
              >
                <v.Icon className="h-3.5 w-3.5" />
                <span className="hidden md:inline">{v.label}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <EmptyBacklog hasActiveFilters={hasActiveFilters} />
        ) : view === "list" ? (
          <ListView items={items} onChangeStatus={onChangeStatus} activeSprints={activeSprints} onItemClick={onItemClick} />
        ) : view === "by-client" ? (
          <GroupedView items={items} groupBy={(i) => i.client_name || "Sin cliente"} onChangeStatus={onChangeStatus} activeSprints={activeSprints} onItemClick={onItemClick} />
        ) : view === "by-owner" ? (
          <GroupedView items={items} groupBy={(i) => (i.owner && i.owner !== "—") ? i.owner : "Sin responsable"} onChangeStatus={onChangeStatus} activeSprints={activeSprints} onItemClick={onItemClick} />
        ) : (
          <TableView items={items} onChangeStatus={onChangeStatus} onItemClick={onItemClick} />
        )}
      </CardContent>
    </Card>
  );
}
