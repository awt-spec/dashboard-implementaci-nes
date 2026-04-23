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

  const owners = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => i.owner && i.owner !== "—" && set.add(i.owner));
    return Array.from(set).sort();
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(i => {
      if (filterSource !== "all" && i.source !== filterSource) return false;
      if (filterOwner !== "all" && i.owner !== filterOwner) return false;
      if (filterSprint !== "all") {
        if (filterSprint === "none" && i.sprint_id) return false;
        if (filterSprint !== "none" && i.sprint_id !== filterSprint) return false;
      }
      if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [items, filterSource, filterOwner, filterSprint, search]);

  const backlog = useMemo(() => {
    return [...filteredItems]
      .filter(i => !i.sprint_id || sprints.find(s => s.id === i.sprint_id)?.status !== "activo")
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
  };

  const hasActiveFilters = search || filterSource !== "all" || filterOwner !== "all" || filterSprint !== "all";

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* ─────────── KPIs ─────────── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPIStat label="Total Items"    value={kpis.total}         Icon={ListOrdered}    accent="text-foreground" />
        <KPIStat label="En Progreso"    value={kpis.inProgress}    Icon={Zap}            accent="text-info" />
        <KPIStat label="WSJF Promedio"  value={kpis.avgWsjf}       Icon={Trophy}         accent="text-success" />
        <KPIStat label="Sin Estimar"    value={kpis.noEstimate}    Icon={AlertTriangle}  accent="text-warning" hint={kpis.noEstimate > 0 ? "Requieren refinamiento" : undefined} />
        <KPIStat label="Sprints Activos" value={kpis.activeSprints} Icon={Target}         accent="text-primary" />
      </div>

      {/* ─────────── TOOLBAR ─────────── */}
      <Card className="glass-card">
        <CardContent className="p-3 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-[340px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por título…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="h-9 pl-8 text-sm"
            />
          </div>
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo origen</SelectItem>
              <SelectItem value="task">Tareas</SelectItem>
              <SelectItem value="ticket">Casos soporte</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterOwner} onValueChange={setFilterOwner}>
            <SelectTrigger className="h-9 w-[170px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todo el equipo</SelectItem>
              {owners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterSprint} onValueChange={setFilterSprint}>
            <SelectTrigger className="h-9 w-[170px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los sprints</SelectItem>
              <SelectItem value="none">Sin sprint</SelectItem>
              {sprints.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
            </SelectContent>
          </Select>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1 text-xs">
              <X className="h-3.5 w-3.5" /> Limpiar
            </Button>
          )}
          <Badge variant="outline" className="ml-auto text-xs font-normal">
            <Filter className="h-3 w-3 mr-1" /> {filteredItems.length} / {items.length}
          </Badge>
        </CardContent>
      </Card>

      {/* ─────────── TABS (5 top-level) ─────────── */}
      <Tabs defaultValue="strategy" className="w-full">
        <TabsList className="h-auto flex-wrap justify-start gap-1 bg-transparent p-0 border-b border-border/60 rounded-none w-full">
          <TabsTrigger value="strategy" className="gap-1.5 rounded-md data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm">
            <Sparkles className="h-3.5 w-3.5" /> Estrategia
          </TabsTrigger>
          <TabsTrigger value="sprint" className="gap-1.5 rounded-md">
            <Flame className="h-3.5 w-3.5" /> Sprint Activo
          </TabsTrigger>
          <TabsTrigger value="sprints" className="gap-1.5 rounded-md">
            <Target className="h-3.5 w-3.5" /> Sprints
          </TabsTrigger>
          <TabsTrigger value="backlog" className="gap-1.5 rounded-md">
            <ListOrdered className="h-3.5 w-3.5" /> Backlog
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5 rounded-md">
            <TrendingUp className="h-3.5 w-3.5" /> Analytics
          </TabsTrigger>
        </TabsList>

        {/* ─── 1. ESTRATEGIA ─── */}
        <TabsContent value="strategy" className="mt-4"><SVAStrategyPanel /></TabsContent>

        {/* ─── 2. SPRINT ACTIVO (4 sub-vistas) ─── */}
        <TabsContent value="sprint" className="mt-4">
          <Tabs defaultValue="resumen" className="w-full">
            <TabsList className="mb-3 h-9 bg-muted/40">
              <TabsTrigger value="resumen" className="gap-1.5 text-xs"><Flame className="h-3.5 w-3.5" /> Resumen</TabsTrigger>
              <TabsTrigger value="board"   className="gap-1.5 text-xs"><LayoutGrid className="h-3.5 w-3.5" /> Tablero</TabsTrigger>
              <TabsTrigger value="flujo"   className="gap-1.5 text-xs"><Workflow className="h-3.5 w-3.5" /> Flujo</TabsTrigger>
              <TabsTrigger value="daily"   className="gap-1.5 text-xs"><Sunrise className="h-3.5 w-3.5" /> Daily</TabsTrigger>
            </TabsList>

            <TabsContent value="resumen"><ActiveSprintHub /></TabsContent>
            <TabsContent value="board"><SprintBoard items={sprintItems} activeSprints={activeSprints} onMove={handleScrumStatusChange} /></TabsContent>
            <TabsContent value="flujo">
              <FordLineView items={filteredItems} onMove={(item, status) => handleScrumStatusChange(item, status)} title="Flujo del equipo" />
            </TabsContent>
            <TabsContent value="daily"><DailyStandupPanel /></TabsContent>
          </Tabs>
        </TabsContent>

        {/* ─── 3. SPRINTS ─── */}
        <TabsContent value="sprints" className="mt-4"><SprintManager /></TabsContent>

        {/* ─── 4. BACKLOG ─── */}
        <TabsContent value="backlog" className="mt-4">
          <BacklogView
            items={backlog}
            hasActiveFilters={!!hasActiveFilters}
            onChangeStatus={handleScrumStatusChange}
          />
        </TabsContent>

        {/* ─── 5. ANALYTICS (con 3 sub-vistas) ─── */}
        <TabsContent value="analytics" className="mt-4">
          <Tabs defaultValue="reportes" className="w-full">
            <TabsList className="mb-3 h-9 bg-muted/40">
              <TabsTrigger value="reportes"     className="gap-1.5 text-xs"><BarChart3 className="h-3.5 w-3.5" /> Reportes</TabsTrigger>
              <TabsTrigger value="sprint-stats" className="gap-1.5 text-xs"><TrendingUp className="h-3.5 w-3.5" /> Sprint Analytics</TabsTrigger>
              <TabsTrigger value="pm-ai"        className="gap-1.5 text-xs"><Brain className="h-3.5 w-3.5" /> PM IA</TabsTrigger>
            </TabsList>

            <TabsContent value="sprint-stats"><SprintAnalytics /></TabsContent>
            <TabsContent value="pm-ai"><PMAIPanel /></TabsContent>

            <TabsContent value="reportes" className="space-y-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4" />
                Carga del Equipo — Resumen
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {(["sobrecargado", "saludable", "subutilizado", "sin_carga"] as const).map((level) => {
                  const s = WORKLOAD_STYLES[level];
                  const count =
                    level === "sobrecargado" ? workloadStats.sobrecargados :
                    level === "saludable"    ? workloadStats.saludables :
                    level === "subutilizado" ? workloadStats.subutilizados :
                                               workloadStats.sin_carga;
                  return (
                    <div key={level} className={`p-3 rounded-lg border ${s.border} ${s.bg}`}>
                      <div className={`flex items-center gap-1.5 ${s.text}`}>
                        <s.Icon className="h-3.5 w-3.5" />
                        <p className="text-[11px] uppercase tracking-wide font-bold">{s.label}</p>
                      </div>
                      <p className={`mt-1 text-2xl font-bold tabular-nums ${s.text}`}>{count}</p>
                    </div>
                  );
                })}
              </div>
              {ownersWithoutLoad.length > 0 && (
                <div className="p-3 rounded-lg border border-border/60 bg-muted/30">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-2">
                    Sin items activos asignados ({ownersWithoutLoad.length})
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {ownersWithoutLoad.map(o => (
                      <Badge key={o} variant="outline" className="text-xs bg-background">{o}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Carga por Persona
                  <span className="ml-auto text-[11px] text-muted-foreground font-normal">
                    &gt;7 sobrecarga · 3-7 saludable · &lt;3 baja
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ownerLoad.slice(0, 12)} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis type="number" tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={90} />
                      <Tooltip
                        formatter={(v: any, _n, p: any) => [`${v} items (${p?.payload?.level})`, "Carga"]}
                        labelFormatter={(l) => `${l}`}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                        {ownerLoad.slice(0, 12).map((d, i) => (
                          <Cell key={i} fill={
                            d.level === "sobrecargado" ? "hsl(var(--destructive))" :
                            d.level === "saludable"    ? "hsl(var(--success))" :
                                                          "hsl(var(--warning))"
                          } />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Distribución por Origen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sourceDist} innerRadius={60} outerRadius={100} dataKey="value" nameKey="name" paddingAngle={2}>
                        {sourceDist.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                      </Pie>
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Velocity por Sprint
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={velocityData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="sprint" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="planned"   fill="hsl(var(--muted-foreground))" name="Planeados"   radius={[4, 4, 0, 0]} />
                      <Bar dataKey="completed" fill="hsl(var(--success))"          name="Completados" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Burndown Sprint Activo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  {burndown.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                      <EmptyState Icon={Calendar} title="Sin sprint activo con fechas" />
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={burndown}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line type="monotone" dataKey="ideal" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" name="Ideal" dot={false} />
                        <Line type="monotone" dataKey="real"  stroke="hsl(var(--primary))" name="Real" strokeWidth={2} dot={{ r: 2 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ListOrdered className="h-4 w-4" />
                  Distribución por Estado Scrum
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-[220px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scrumStatusDist}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
            </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>
    </div>
  );
}
