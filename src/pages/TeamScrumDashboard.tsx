import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Trophy, ListOrdered, Brain, BarChart3, Sparkles,
  AlertTriangle, TrendingUp, Users, Target, Calendar, Filter, Zap, Flame,
  PackageOpen, CheckCircle2, PlayCircle, Flag, Search, X,
  LucideIcon, Inbox, Workflow, LayoutGrid, Sunrise,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Legend, PieChart, Pie, Cell,
} from "recharts";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  useAllScrumWorkItems, useAllSprints, useUpdateWorkItemScrum,
  type ScrumWorkItem,
} from "@/hooks/useTeamScrum";
import { PMAIPanel } from "@/components/scrum/PMAIPanel";
import { SprintManager } from "@/components/scrum/SprintManager";
import { DailyStandupPanel } from "@/components/scrum/DailyStandupPanel";
import { SprintAnalytics } from "@/components/scrum/SprintAnalytics";
import { ActiveSprintHub } from "@/components/scrum/ActiveSprintHub";
import { FordLineView } from "@/components/scrum/FordLineView";
import { SVAStrategyPanel } from "@/components/scrum/SVAStrategyPanel";
import { SprintBoard } from "@/components/scrum/SprintBoard";
import { BacklogView } from "@/components/scrum/BacklogView";
import { TeamScrumGuidedView } from "@/components/scrum/TeamScrumGuidedView";
import { TicketDetailSheet } from "@/components/support/TicketDetailSheet";
import { TaskDetailSheet } from "@/components/colaborador/TaskDetailSheet";
import type { SupportTicket } from "@/hooks/useSupportTickets";

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--info))",
  "hsl(var(--warning))",
  "hsl(var(--success))",
  "hsl(280,60%,60%)",
  "hsl(150,60%,50%)",
];

const SCRUM_COLUMNS: Array<{
  key: string;
  label: string;
  Icon: LucideIcon;
  accent: string;
}> = [
  { key: "backlog",     label: "Backlog",     Icon: PackageOpen,   accent: "text-muted-foreground" },
  { key: "ready",       label: "Listo",       Icon: CheckCircle2,  accent: "text-info" },
  { key: "in_progress", label: "En Progreso", Icon: PlayCircle,    accent: "text-warning" },
  { key: "in_sprint",   label: "En Sprint",   Icon: Flame,         accent: "text-primary" },
  { key: "done",        label: "Hecho",       Icon: Flag,          accent: "text-success" },
];

const SOURCE_STYLES: Record<string, string> = {
  task:   "bg-info/10 text-info border-info/30",
  ticket: "bg-warning/10 text-warning border-warning/30",
};

const WORKLOAD_STYLES: Record<string, { border: string; bg: string; text: string; dot: string; label: string; Icon: LucideIcon }> = {
  sobrecargado:  { border: "border-destructive/40", bg: "bg-destructive/5", text: "text-destructive",     dot: "bg-destructive",     label: "Sobrecargados",  Icon: Flame },
  saludable:     { border: "border-success/40",     bg: "bg-success/5",     text: "text-success",         dot: "bg-success",         label: "Saludables",     Icon: CheckCircle2 },
  subutilizado:  { border: "border-warning/40",     bg: "bg-warning/5",     text: "text-warning",         dot: "bg-warning",         label: "Subutilizados",  Icon: AlertTriangle },
  sin_carga:     { border: "border-muted-foreground/25", bg: "bg-muted/30", text: "text-muted-foreground",dot: "bg-muted-foreground/50", label: "Sin Carga",  Icon: Inbox },
};

// ---------- helpers ----------

function KPIStat({
  label, value, Icon, accent = "text-foreground", hint,
}: {
  label: string;
  value: string | number;
  Icon: LucideIcon;
  accent?: string;
  hint?: string;
}) {
  return (
    <Card className="animate-fade-in">
      <CardContent className="p-4 flex items-start gap-3">
        <div className={`h-9 w-9 rounded-lg bg-secondary flex items-center justify-center shrink-0 ${accent}`}>
          <Icon className="h-4.5 w-4.5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-2xl font-bold tabular-nums leading-none text-foreground">{value}</p>
          <p className="mt-1 text-[11px] uppercase tracking-wide font-semibold text-muted-foreground">{label}</p>
          {hint && <p className="mt-0.5 text-[11px] text-muted-foreground/80 truncate">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ Icon, title, subtitle }: { Icon: LucideIcon; title: string; subtitle?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 text-center gap-3">
      <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
        <Icon className="h-6 w-6 text-primary" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {subtitle && <p className="mt-1 text-xs text-muted-foreground max-w-sm">{subtitle}</p>}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-5 animate-fade-in">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4 flex items-start gap-3">
              <Skeleton className="h-9 w-9 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-12" />
                <Skeleton className="h-3 w-20" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Skeleton className="h-12 w-full" />
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-60" />)}
      </div>
    </div>
  );
}

// ---------- main ----------

export default function TeamScrumDashboard() {
  const { data: items = [], isLoading } = useAllScrumWorkItems();
  const { data: sprints = [] } = useAllSprints();
  const updateScrum = useUpdateWorkItemScrum();

  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterOwner, setFilterOwner] = useState<string>("all");
  const [filterSprint, setFilterSprint] = useState<string>("all");
  const [filterVisibility, setFilterVisibility] = useState<"all" | "interna" | "externa">("all");
  // Detail sheets: source='ticket' → TicketDetailSheet (con tabs Detalle/Notas/
  // Subtareas/Estrategia/Reincidencias); source='task' → TaskDetailSheet (vista
  // de tarea de implementación con checklist).
  const [selectedItem, setSelectedItem] = useState<ScrumWorkItem | null>(null);
  const [activeTab, setActiveTab] = useState<string>("sprint");

  const owners = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => i.owner && i.owner !== "—" && set.add(i.owner));
    return Array.from(set).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(i => {
      if (filterSource !== "all" && i.source !== filterSource) return false;
      if (filterOwner !== "all" && i.owner !== filterOwner) return false;
      if (filterVisibility !== "all" && i.visibility !== filterVisibility) return false;
      if (filterSprint !== "all") {
        if (filterSprint === "none" && i.sprint_id) return false;
        if (filterSprint !== "none" && i.sprint_id !== filterSprint) return false;
      }
      if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, filterSource, filterOwner, filterVisibility, filterSprint, search]);

  // Backlog activo = items sin sprint activo Y NO terminados.
  // Los items de sprints viejos (cerrados via migración) tienen scrum_status='done'
  // y status='completada' — NO ensucian el backlog operativo. Quedan accesibles
  // en SprintAnalytics + el detalle del cliente como histórico.
  const backlog = useMemo(() => {
    return [...filteredItems]
      .filter(i => !i.sprint_id || sprints.find(s => s.id === i.sprint_id)?.status !== "activo")
      .filter(i => i.scrum_status !== "done" && i.status !== "completada")
      .sort((a, b) => b.wsjf - a.wsjf);
  }, [filteredItems, sprints]);

  const activeSprints = sprints.filter(s => s.status === "activo");
  const activeSprintIds = new Set(activeSprints.map(s => s.id));
  const sprintItems = filteredItems.filter(i => i.sprint_id && activeSprintIds.has(i.sprint_id));

  const kpis = useMemo(() => {
    const inProgress = items.filter(i => i.scrum_status === "in_progress").length;
    const totalWsjf = items.reduce((s, i) => s + i.wsjf, 0);
    const noEstimate = items.filter(i => !i.story_points && !i.effort).length;
    return {
      total: items.length,
      inProgress,
      avgWsjf: items.length ? Math.round((totalWsjf / items.length) * 100) / 100 : 0,
      noEstimate,
      activeSprints: activeSprints.length,
    };
  }, [items, activeSprints]);

  const ownerLoad = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach(i => {
      if (i.owner && i.owner !== "—" && i.scrum_status !== "done") {
        map.set(i.owner, (map.get(i.owner) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({
        name: name.length > 15 ? name.slice(0, 13) + "…" : name,
        fullName: name,
        value,
        level: value > 7 ? "sobrecargado" : value >= 3 ? "saludable" : value >= 1 ? "subutilizado" : "sin_carga",
      }))
      .sort((a, b) => b.value - a.value);
  }, [items]);

  const allOwnersEver = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => i.owner && i.owner !== "—" && set.add(i.owner));
    return Array.from(set);
  }, [items]);

  const ownersWithoutLoad = useMemo(() => {
    const withLoad = new Set(ownerLoad.map(o => o.fullName));
    return allOwnersEver.filter(o => !withLoad.has(o));
  }, [allOwnersEver, ownerLoad]);

  const workloadStats = useMemo(() => ({
    sobrecargados: ownerLoad.filter(o => o.level === "sobrecargado").length,
    saludables:    ownerLoad.filter(o => o.level === "saludable").length,
    subutilizados: ownerLoad.filter(o => o.level === "subutilizado").length,
    sin_carga:     ownersWithoutLoad.length,
  }), [ownerLoad, ownersWithoutLoad]);

  const sourceDist = useMemo(() => [
    { name: "Tareas Implementación", value: items.filter(i => i.source === "task").length },
    { name: "Casos Soporte",         value: items.filter(i => i.source === "ticket").length },
  ], [items]);

  const scrumStatusDist = useMemo(() => SCRUM_COLUMNS.map(col => ({
    name: col.label,
    value: items.filter(i => (i.scrum_status || "backlog") === col.key).length,
  })), [items]);

  const velocityData = useMemo(() => {
    return sprints
      .filter(s => s.status === "completado" || s.status === "activo")
      .slice(0, 8)
      .reverse()
      .map(s => {
        const sItems = items.filter(i => i.sprint_id === s.id);
        const planned = sItems.reduce((sum, i) => sum + (i.story_points || 0), 0);
        const completed = sItems.filter(i => i.scrum_status === "done").reduce((sum, i) => sum + (i.story_points || 0), 0);
        return { sprint: s.name.slice(0, 12), planned, completed };
      });
  }, [sprints, items]);

  const burndown = useMemo(() => {
    if (activeSprints.length === 0) return [];
    const sprint = activeSprints[0];
    const sItems = items.filter(i => i.sprint_id === sprint.id);
    const totalPoints = sItems.reduce((s, i) => s + (i.story_points || 0), 0);
    const completedPoints = sItems.filter(i => i.scrum_status === "done").reduce((s, i) => s + (i.story_points || 0), 0);
    if (!sprint.start_date || !sprint.end_date) return [];
    const start = new Date(sprint.start_date).getTime();
    const end = new Date(sprint.end_date).getTime();
    const now = Date.now();
    const totalDays = Math.max(1, Math.ceil((end - start) / 86400000));
    const days = [];
    for (let d = 0; d <= totalDays; d++) {
      const ideal = totalPoints - (totalPoints * d / totalDays);
      const elapsed = (now - start) / 86400000;
      const real = d <= elapsed ? totalPoints - (completedPoints * (d / Math.max(1, elapsed))) : null;
      days.push({ day: `D${d}`, ideal: Math.round(ideal * 10) / 10, real: real !== null ? Math.round(real * 10) / 10 : null });
    }
    return days;
  }, [activeSprints, items]);

  const handleScrumStatusChange = async (item: ScrumWorkItem, newStatus: string) => {
    try {
      await updateScrum.mutateAsync({ id: item.id, source: item.source, updates: { scrum_status: newStatus } });
      toast.success("Estado actualizado");
    } catch (e: any) { toast.error(e.message); }
  };

  const clearFilters = () => {
    setSearch("");
    setFilterSource("all");
    setFilterOwner("all");
    setFilterSprint("all");
    setFilterVisibility("all");
  };

  const hasActiveFilters = search || filterSource !== "all" || filterOwner !== "all" || filterSprint !== "all" || filterVisibility !== "all";

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Sin KPIs ni toolbar global — el wizard se autocontiene. Los filtros
          que se necesiten viven dentro de cada preset. Las métricas globales
          aparecen integradas en el header del picker como chips. */}
      {/* Toggle de visibility — Interna (solo SVA) / Externa (cliente puede ver) / Todas.
          Heurística aplicada en migración 20260430200000:
            DevOps "Task" → interna (sub-pasos de implementación)
            DevOps "Product Backlog Item" / "Bug" → externa (cliente las ve) */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Visibilidad:</span>
        {([
          { v: "all" as const,     label: "Todas",    count: items.length },
          { v: "interna" as const, label: "Internas", count: items.filter(i => i.visibility === "interna").length },
          { v: "externa" as const, label: "Externas", count: items.filter(i => i.visibility === "externa").length },
        ]).map(opt => (
          <button
            key={opt.v}
            onClick={() => setFilterVisibility(opt.v)}
            className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full border text-xs font-medium transition-colors ${
              filterVisibility === opt.v
                ? opt.v === "interna"
                  ? "bg-violet-500/10 text-violet-500 border-violet-500/40"
                  : opt.v === "externa"
                  ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/40"
                  : "bg-primary text-primary-foreground border-primary"
                : "bg-card hover:bg-muted/50 text-muted-foreground border-border"
            }`}
          >
            {opt.label}
            <span className="text-[10px] tabular-nums opacity-70">{opt.count}</span>
          </button>
        ))}
      </div>

      <TeamScrumGuidedView
        filteredItems={filteredItems}
        backlog={backlog}
        sprintItems={sprintItems}
        activeSprints={activeSprints}
        hasActiveFilters={!!hasActiveFilters}
        onScrumStatusChange={handleScrumStatusChange}
        workloadStats={workloadStats}
        ownerLoad={ownerLoad}
        ownersWithoutLoad={ownersWithoutLoad}
        sourceDist={sourceDist}
        velocityData={velocityData}
        burndown={burndown}
        scrumStatusDist={scrumStatusDist}
        kpis={kpis}
        onItemClick={setSelectedItem}
      />

      {/* Detalle del item seleccionado: usa TicketDetailSheet para casos (source='ticket')
          y TaskDetailSheet para tareas de implementación (source='task'). */}
      {selectedItem?.source === "ticket" && (
        <TicketDetailSheet
          ticket={selectedItem.raw as SupportTicket}
          open={!!selectedItem}
          onOpenChange={(o) => { if (!o) setSelectedItem(null); }}
          canEditInternal={true}
        />
      )}
      {selectedItem?.source === "task" && (
        <TaskDetailSheet
          item={selectedItem}
          clientName={selectedItem.client_name}
          sprintName={sprints.find(s => s.id === selectedItem.sprint_id)?.name}
          onClose={() => setSelectedItem(null)}
        />
      )}
    </div>
  );
}
