import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Factory, GaugeCircle, Workflow, AlertTriangle, ChevronRight, Clock, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ScrumWorkItem } from "@/hooks/useTeamScrum";

const STATIONS = [
  { key: "backlog",     label: "Backlog",     color: "bg-slate-500", text: "text-slate-50" },
  { key: "ready",       label: "Listo",       color: "bg-sky-500",   text: "text-sky-50" },
  { key: "in_progress", label: "En curso",    color: "bg-amber-500", text: "text-amber-50" },
  { key: "in_sprint",   label: "Review",      color: "bg-violet-500",text: "text-violet-50" },
  { key: "done",        label: "Terminado",   color: "bg-emerald-500",text: "text-emerald-50" },
];

const PRIORITY_DOT: Record<string, string> = {
  alta: "bg-red-500",
  critica: "bg-red-600 ring-2 ring-red-400/40",
  media: "bg-amber-500",
  baja: "bg-slate-400",
};

function initials(n: string) {
  return n.split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
}

function daysSinceUpdate(item: ScrumWorkItem): number {
  const raw = item.raw || {};
  const updated = raw.updated_at || raw.created_at;
  if (!updated) return 0;
  return Math.floor((Date.now() - new Date(updated).getTime()) / 86400000);
}

interface Props {
  items: ScrumWorkItem[];
  onSelect?: (item: ScrumWorkItem) => void;
  onMove?: (item: ScrumWorkItem, status: string) => void;
  defaultMode?: "pipeline" | "swimlanes";
  showToggle?: boolean;
  title?: string;
}

export function FordLineView({ items, onSelect, onMove, defaultMode = "pipeline", showToggle = true, title = "Flujo de trabajo" }: Props) {
  const [mode, setMode] = useState<"pipeline" | "swimlanes">(defaultMode);

  const itemsByStation = useMemo(() => {
    const map = new Map<string, ScrumWorkItem[]>();
    STATIONS.forEach(s => map.set(s.key, []));
    items.forEach(i => {
      const k = i.scrum_status || "backlog";
      map.get(k)?.push(i);
    });
    return map;
  }, [items]);

  const owners = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => i.owner && i.owner !== "—" && set.add(i.owner));
    return Array.from(set).sort();
  }, [items]);

  // bottleneck = station with > 30% of items in progress (not done/backlog)
  const bottleneck = useMemo(() => {
    const active = items.filter(i => i.scrum_status && !["done", "backlog"].includes(i.scrum_status));
    let max = 0; let key: string | null = null;
    STATIONS.forEach(s => {
      if (s.key === "done" || s.key === "backlog") return;
      const c = itemsByStation.get(s.key)?.length || 0;
      if (c > max) { max = c; key = s.key; }
    });
    if (active.length > 0 && max / active.length > 0.4) return key;
    return null;
  }, [items, itemsByStation]);

  const handleDrop = (e: React.DragEvent, status: string, _owner?: string) => {
    e.preventDefault();
    const raw = e.dataTransfer.getData("application/json");
    if (!raw || !onMove) return;
    try {
      const { id, source } = JSON.parse(raw);
      const item = items.find(i => i.id === id && i.source === source);
      if (item && item.scrum_status !== status) onMove(item, status);
    } catch { /* noop */ }
  };

  const handleDragStart = (e: React.DragEvent, item: ScrumWorkItem) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ id: item.id, source: item.source }));
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <Factory className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold">{title}</h3>
            <Badge variant="outline" className="text-[10px]">{items.length} ítems</Badge>
            {bottleneck && (
              <Badge className="bg-destructive/15 text-destructive border-destructive/30 text-[10px] gap-1">
                <AlertTriangle className="h-3 w-3" />
                Cuello de botella: {STATIONS.find(s => s.key === bottleneck)?.label}
              </Badge>
            )}
          </div>
          {showToggle && (
            <ToggleGroup type="single" value={mode} onValueChange={(v) => v && setMode(v as any)} size="sm">
              <ToggleGroupItem value="pipeline" className="h-7 px-2 text-[11px]">
                <Workflow className="h-3 w-3 mr-1" /> Pipeline
              </ToggleGroupItem>
              <ToggleGroupItem value="swimlanes" className="h-7 px-2 text-[11px]">
                <GaugeCircle className="h-3 w-3 mr-1" /> Swimlanes
              </ToggleGroupItem>
            </ToggleGroup>
          )}
        </div>

        {mode === "pipeline" && (
          <PipelineView
            items={items}
            stations={STATIONS}
            itemsByStation={itemsByStation}
            onSelect={onSelect}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
          />
        )}

        {mode === "swimlanes" && (
          <SwimlanesView
            owners={owners}
            items={items}
            stations={STATIONS}
            onSelect={onSelect}
            onDragStart={handleDragStart}
            onDrop={handleDrop}
          />
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- Pipeline (assembly line) ---------- */
function PipelineView({
  stations, itemsByStation, onSelect, onDragStart, onDrop,
}: any) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative">
        {/* Conveyor belt strip */}
        <div className="absolute top-[58px] left-0 right-0 h-2 bg-gradient-to-r from-slate-300 via-slate-400 to-slate-300 dark:from-slate-700 dark:via-slate-600 dark:to-slate-700 rounded-full opacity-70" />
        <div className="absolute top-[60px] left-0 right-0 flex justify-between px-8 pointer-events-none">
          {stations.slice(0, -1).map((_: any, i: number) => (
            <ChevronRight key={i} className="h-3 w-3 text-muted-foreground/60" style={{ marginTop: -6 }} />
          ))}
        </div>

        <div className="grid grid-cols-5 gap-2 relative">
          {stations.map((st: any) => {
            const stItems = itemsByStation.get(st.key) || [];
            return (
              <div
                key={st.key}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => onDrop(e, st.key)}
                className="flex flex-col"
              >
                {/* Station header */}
                <div className={cn("rounded-t-md px-3 py-2 flex items-center justify-between", st.color, st.text)}>
                  <span className="text-[10px] font-bold uppercase tracking-wider">{st.label}</span>
                  <span className="bg-white/25 px-1.5 rounded text-[10px] font-bold">{stItems.length}</span>
                </div>

                {/* Station bay */}
                <div className="flex-1 bg-muted/20 border border-t-0 border-border/50 rounded-b-md p-2 space-y-2 min-h-[280px] max-h-[460px] overflow-auto">
                  {stItems.length === 0 && (
                    <p className="text-[10px] text-muted-foreground/60 text-center py-4 italic">Estación libre</p>
                  )}
                  {stItems.map((item: ScrumWorkItem) => {
                    const days = daysSinceUpdate(item);
                    const stale = days > 5 && st.key !== "done";
                    return (
                      <Tooltip key={`${item.source}-${item.id}`}>
                        <TooltipTrigger asChild>
                          <div
                            draggable
                            onDragStart={(e) => onDragStart(e, item)}
                            onClick={() => onSelect?.(item)}
                            className={cn(
                              "group rounded-md bg-background border-l-4 border-y border-r border-border/50 p-2 cursor-pointer hover:shadow-md transition",
                              stale ? "border-l-destructive" : "border-l-primary"
                            )}
                          >
                            <div className="flex items-start gap-1.5 mb-1">
                              <span className={cn("h-2 w-2 rounded-full mt-1 shrink-0", PRIORITY_DOT[item.priority?.toLowerCase()] || PRIORITY_DOT.media)} />
                              <p className="text-[11px] font-semibold leading-tight line-clamp-2 flex-1">{item.title}</p>
                            </div>
                            <div className="flex items-center justify-between gap-1">
                              {item.owner && item.owner !== "—" ? (
                                <span className="h-4 w-4 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[8px] font-bold border border-primary/20">
                                  {initials(item.owner)}
                                </span>
                              ) : (
                                <User className="h-3 w-3 text-muted-foreground" />
                              )}
                              <div className="flex items-center gap-1">
                                {item.story_points != null && (
                                  <Badge variant="outline" className="h-3.5 px-1 text-[8px] font-mono">{item.story_points}</Badge>
                                )}
                                <span className={cn("flex items-center gap-0.5 text-[9px]", stale ? "text-destructive font-bold" : "text-muted-foreground")}>
                                  <Clock className="h-2.5 w-2.5" />{days}d
                                </span>
                              </div>
                            </div>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs max-w-xs">
                          <p className="font-semibold">{item.title}</p>
                          <p className="text-muted-foreground text-[11px]">{item.client_name} · {item.owner}</p>
                          {stale && <p className="text-destructive text-[11px]">⚠ {days} días en estación</p>}
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </TooltipProvider>
  );
}

/* ---------- Swimlanes ---------- */
function SwimlanesView({ owners, items, stations, onSelect, onDragStart, onDrop }: any) {
  return (
    <div className="overflow-auto">
      <div className="min-w-[900px]">
        {/* Header */}
        <div className="grid grid-cols-[160px_repeat(5,1fr)] gap-1 mb-1 sticky top-0 z-10 bg-background">
          <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground px-2 py-1">Operador</div>
          {stations.map((s: any) => (
            <div key={s.key} className={cn("text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-t-md", s.color, s.text)}>
              {s.label}
            </div>
          ))}
        </div>

        {/* Lanes */}
        {owners.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">Sin operadores asignados</p>
        )}
        {owners.map((owner: string, idx: number) => {
          const ownerItems = items.filter((i: ScrumWorkItem) => i.owner === owner);
          return (
            <div key={owner} className={cn("grid grid-cols-[160px_repeat(5,1fr)] gap-1 mb-1", idx % 2 === 0 && "bg-muted/10")}>
              <div className="flex items-center gap-2 px-2 py-2 border-r border-border/50">
                <div className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-[10px] font-bold border border-primary/20">
                  {initials(owner)}
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold truncate">{owner}</p>
                  <p className="text-[9px] text-muted-foreground">{ownerItems.length} ítems</p>
                </div>
              </div>
              {stations.map((st: any) => {
                const cellItems = ownerItems.filter((i: ScrumWorkItem) => (i.scrum_status || "backlog") === st.key);
                return (
                  <div
                    key={st.key}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => onDrop(e, st.key, owner)}
                    className="bg-muted/20 border border-border/40 rounded p-1.5 space-y-1 min-h-[60px]"
                  >
                    {cellItems.map((item: ScrumWorkItem) => (
                      <div
                        key={`${item.source}-${item.id}`}
                        draggable
                        onDragStart={(e) => onDragStart(e, item)}
                        onClick={() => onSelect?.(item)}
                        className="rounded bg-background border border-border/50 p-1.5 cursor-pointer hover:border-primary/40 group"
                      >
                        <div className="flex items-start gap-1">
                          <span className={cn("h-1.5 w-1.5 rounded-full mt-1 shrink-0", PRIORITY_DOT[item.priority?.toLowerCase()] || PRIORITY_DOT.media)} />
                          <p className="text-[10px] font-medium leading-tight line-clamp-2">{item.title}</p>
                        </div>
                        {item.story_points != null && (
                          <Badge variant="outline" className="h-3.5 px-1 text-[8px] font-mono mt-1">{item.story_points}p</Badge>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
