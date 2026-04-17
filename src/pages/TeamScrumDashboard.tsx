import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Trophy, ListOrdered, Brain, BarChart3, Loader2, Sparkles,
  AlertTriangle, TrendingUp, Users, Target, Calendar, Filter, Zap,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  LineChart, Line, Legend, AreaChart, Area, PieChart, Pie, Cell,
} from "recharts";
import { toast } from "sonner";
import {
  useAllScrumWorkItems, useAllSprints, useUpdateWorkItemScrum,
  useTeamAIAnalysis, type ScrumWorkItem,
} from "@/hooks/useTeamScrum";
import { PMAIPanel } from "@/components/scrum/PMAIPanel";
import { TeamActivityPanel } from "@/components/admin/TeamActivityPanel";

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--warning))", "hsl(220,70%,55%)", "hsl(150,60%,50%)", "hsl(280,60%,60%)"];

const SCRUM_COLUMNS = [
  { key: "backlog", label: "Backlog", icon: "📋" },
  { key: "ready", label: "Listo", icon: "✓" },
  { key: "in_progress", label: "En Progreso", icon: "⚡" },
  { key: "in_sprint", label: "En Sprint", icon: "🏃" },
  { key: "done", label: "Hecho", icon: "🏁" },
];

const sourceColors: Record<string, string> = {
  task: "bg-info/15 text-info border-info/30",
  ticket: "bg-warning/15 text-warning border-warning/30",
};

export default function TeamScrumDashboard() {
  const { data: items = [], isLoading } = useAllScrumWorkItems();
  const { data: sprints = [] } = useAllSprints();
  const updateScrum = useUpdateWorkItemScrum();
  const aiAnalysis = useTeamAIAnalysis();

  const [search, setSearch] = useState("");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterOwner, setFilterOwner] = useState<string>("all");
  const [filterSprint, setFilterSprint] = useState<string>("all");
  const [aiResult, setAiResult] = useState<any>(null);

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

  // BACKLOG: items not in any active sprint, sorted by WSJF
  const backlog = useMemo(() => {
    return [...filteredItems]
      .filter(i => !i.sprint_id || sprints.find(s => s.id === i.sprint_id)?.status !== "activo")
      .sort((a, b) => b.wsjf - a.wsjf);
  }, [filteredItems, sprints]);

  const activeSprints = sprints.filter(s => s.status === "activo");
  const activeSprintIds = new Set(activeSprints.map(s => s.id));
  const sprintItems = filteredItems.filter(i => i.sprint_id && activeSprintIds.has(i.sprint_id));

  // KPIs
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

  // Charts data
  const ownerLoad = useMemo(() => {
    const map = new Map<string, number>();
    items.forEach(i => {
      if (i.owner && i.owner !== "—" && i.scrum_status !== "done") {
        map.set(i.owner, (map.get(i.owner) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .map(([name, value]) => ({ name: name.length > 15 ? name.slice(0, 13) + "…" : name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);
  }, [items]);

  const sourceDist = useMemo(() => {
    const tasks = items.filter(i => i.source === "task").length;
    const tickets = items.filter(i => i.source === "ticket").length;
    return [
      { name: "Tareas Implementación", value: tasks },
      { name: "Casos Soporte", value: tickets },
    ];
  }, [items]);

  const scrumStatusDist = useMemo(() => {
    return SCRUM_COLUMNS.map(col => ({
      name: col.label,
      value: items.filter(i => (i.scrum_status || "backlog") === col.key).length,
    }));
  }, [items]);

  // Velocity por sprint (story_points completados)
  const velocityData = useMemo(() => {
    return sprints
      .filter(s => s.status === "completado" || s.status === "activo")
      .slice(0, 8)
      .reverse()
      .map(s => {
        const sItems = items.filter(i => i.sprint_id === s.id);
        const planned = sItems.reduce((sum, i) => sum + (i.story_points || 0), 0);
        const completed = sItems.filter(i => i.scrum_status === "done")
          .reduce((sum, i) => sum + (i.story_points || 0), 0);
        return { sprint: s.name.slice(0, 12), planned, completed };
      });
  }, [sprints, items]);

  // Burndown del sprint activo
  const burndown = useMemo(() => {
    if (activeSprints.length === 0) return [];
    const sprint = activeSprints[0];
    const sItems = items.filter(i => i.sprint_id === sprint.id);
    const totalPoints = sItems.reduce((s, i) => s + (i.story_points || 0), 0);
    const completedPoints = sItems.filter(i => i.scrum_status === "done")
      .reduce((s, i) => s + (i.story_points || 0), 0);
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
      await updateScrum.mutateAsync({
        id: item.id,
        source: item.source,
        updates: { scrum_status: newStatus },
      });
      toast.success("Estado actualizado");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleAIAnalysis = async () => {
    try {
      const result = await aiAnalysis.mutateAsync({ items: filteredItems, sprints: activeSprints });
      setAiResult(result);
      toast.success("Análisis IA completado");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Total Items", value: kpis.total, icon: ListOrdered, color: "text-foreground" },
          { label: "En Progreso", value: kpis.inProgress, icon: Zap, color: "text-info" },
          { label: "WSJF Promedio", value: kpis.avgWsjf, icon: Trophy, color: "text-success" },
          { label: "Sin Estimar", value: kpis.noEstimate, icon: AlertTriangle, color: "text-warning" },
          { label: "Sprints Activos", value: kpis.activeSprints, icon: Target, color: "text-primary" },
        ].map(s => (
          <Card key={s.label}>
            <CardContent className="p-3 flex items-center gap-3">
              <s.icon className={`h-5 w-5 ${s.color}`} />
              <div>
                <p className="text-lg font-bold text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Filter className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Buscar..." value={search} onChange={e => setSearch(e.target.value)} className="h-8 pl-8 text-xs" />
        </div>
        <Select value={filterSource} onValueChange={setFilterSource}>
          <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo origen</SelectItem>
            <SelectItem value="task">Tareas</SelectItem>
            <SelectItem value="ticket">Casos Soporte</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterOwner} onValueChange={setFilterOwner}>
          <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo el equipo</SelectItem>
            {owners.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterSprint} onValueChange={setFilterSprint}>
          <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los sprints</SelectItem>
            <SelectItem value="none">Sin sprint</SelectItem>
            {sprints.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Tabs defaultValue="pm-ai" className="w-full">
        <TabsList>
          <TabsTrigger value="pm-ai"><Brain className="h-3.5 w-3.5 mr-1" />PM IA</TabsTrigger>
          <TabsTrigger value="backlog"><ListOrdered className="h-3.5 w-3.5 mr-1" />Backlog (WSJF)</TabsTrigger>
          <TabsTrigger value="sprint"><Target className="h-3.5 w-3.5 mr-1" />Sprint Activo</TabsTrigger>
          <TabsTrigger value="ai"><Sparkles className="h-3.5 w-3.5 mr-1" />Análisis Equipo</TabsTrigger>
          <TabsTrigger value="reports"><BarChart3 className="h-3.5 w-3.5 mr-1" />Reportes</TabsTrigger>
          <TabsTrigger value="audit"><Users className="h-3.5 w-3.5 mr-1" />Auditoría</TabsTrigger>
        </TabsList>

        <TabsContent value="pm-ai" className="mt-3">
          <PMAIPanel />
        </TabsContent>

        <TabsContent value="audit" className="mt-3">
          <TeamActivityPanel />
        </TabsContent>


        {/* BACKLOG */}
        <TabsContent value="backlog" className="mt-3 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Trophy className="h-4 w-4 text-warning" />
                Backlog Priorizado por WSJF
                <Badge variant="outline" className="ml-2 text-xs">{backlog.length} items</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1 max-h-[600px] overflow-auto">
                {backlog.map((item, idx) => (
                  <div key={`${item.source}-${item.id}`} className="flex items-center gap-2 p-2 rounded hover:bg-muted/30 border border-border/40 text-xs">
                    <span className="font-mono text-muted-foreground w-6 text-center font-bold">{idx + 1}</span>
                    <Badge variant="outline" className={`${sourceColors[item.source]} text-[10px]`}>
                      {item.source === "task" ? "Tarea" : "Caso"}
                    </Badge>
                    <span className="flex-1 truncate font-medium">{item.title}</span>
                    {item.client_name && <span className="text-muted-foreground text-[10px] truncate max-w-[120px]">{item.client_name}</span>}
                    <span className="text-muted-foreground text-[10px]">{item.owner}</span>
                    <Badge variant="outline" className="text-[10px]">V:{item.business_value || "—"}</Badge>
                    <Badge variant="outline" className="text-[10px]">E:{item.effort || "—"}</Badge>
                    <Badge className="bg-warning/20 text-warning border-warning/30 text-[10px] font-bold">
                      WSJF {item.wsjf || "—"}
                    </Badge>
                    <Select value={item.scrum_status || "backlog"} onValueChange={v => handleScrumStatusChange(item, v)}>
                      <SelectTrigger className="h-6 w-[110px] text-[10px]"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {SCRUM_COLUMNS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
                {backlog.length === 0 && (
                  <p className="text-center py-8 text-sm text-muted-foreground">Backlog vacío con los filtros actuales</p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* SPRINT KANBAN */}
        <TabsContent value="sprint" className="mt-3 space-y-3">
          {activeSprints.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              No hay sprints activos. Crea uno desde el dashboard de soporte por cliente.
            </CardContent></Card>
          ) : (
            <>
              {activeSprints.map(s => (
                <div key={s.id} className="text-xs flex items-center gap-2 px-3 py-2 rounded bg-primary/10 border border-primary/20">
                  <Target className="h-4 w-4 text-primary" />
                  <span className="font-bold">{s.name}</span>
                  {s.goal && <span className="text-muted-foreground">— {s.goal}</span>}
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    {s.start_date} → {s.end_date}
                  </Badge>
                </div>
              ))}
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                {SCRUM_COLUMNS.map(col => {
                  const colItems = sprintItems.filter(i => (i.scrum_status || "backlog") === col.key);
                  return (
                    <Card key={col.key} className="flex flex-col">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-xs flex items-center justify-between">
                          <span>{col.icon} {col.label}</span>
                          <Badge variant="outline" className="text-[10px]">{colItems.length}</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="flex-1 space-y-2 max-h-[500px] overflow-auto">
                        {colItems.map(item => (
                          <div key={`${item.source}-${item.id}`} className="p-2 rounded bg-muted/40 border border-border/40 space-y-1">
                            <div className="flex items-center gap-1">
                              <Badge variant="outline" className={`${sourceColors[item.source]} text-[9px]`}>
                                {item.source === "task" ? "T" : "C"}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground truncate flex-1">{item.client_name}</span>
                            </div>
                            <p className="text-xs font-medium line-clamp-2">{item.title}</p>
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="text-muted-foreground">{item.owner}</span>
                              {item.story_points && <Badge variant="outline" className="text-[9px]">SP {item.story_points}</Badge>}
                            </div>
                            <Select value={item.scrum_status || "backlog"} onValueChange={v => handleScrumStatusChange(item, v)}>
                              <SelectTrigger className="h-6 text-[10px]"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {SCRUM_COLUMNS.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        ))}
                        {colItems.length === 0 && (
                          <p className="text-[10px] text-center text-muted-foreground py-4">—</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </>
          )}
        </TabsContent>

        {/* AI ANALYSIS */}
        <TabsContent value="ai" className="mt-3 space-y-3">
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                Análisis IA del Equipo Scrum
              </CardTitle>
              <Button size="sm" onClick={handleAIAnalysis} disabled={aiAnalysis.isPending}>
                {aiAnalysis.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1" />}
                Analizar Equipo
              </Button>
            </CardHeader>
            <CardContent>
              {!aiResult && !aiAnalysis.isPending && (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Presiona "Analizar Equipo" para detectar cuellos de botella, riesgos y obtener recomendaciones.
                </p>
              )}
              {aiResult && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/30">
                    <span className="text-sm font-medium">Salud del Sprint:</span>
                    <Badge className={
                      aiResult.sprint_health === "saludable" ? "bg-success/20 text-success border-success/30" :
                      aiResult.sprint_health === "en_riesgo" ? "bg-warning/20 text-warning border-warning/30" :
                      "bg-destructive/20 text-destructive border-destructive/30"
                    }>
                      {aiResult.sprint_health.toUpperCase()}
                    </Badge>
                    {typeof aiResult.team_balance_score === "number" && (
                      <>
                        <span className="text-sm font-medium ml-4">Balance del Equipo:</span>
                        <Badge className={
                          aiResult.team_balance_score >= 75 ? "bg-success/20 text-success border-success/30" :
                          aiResult.team_balance_score >= 50 ? "bg-warning/20 text-warning border-warning/30" :
                          "bg-destructive/20 text-destructive border-destructive/30"
                        }>{aiResult.team_balance_score}/100</Badge>
                      </>
                    )}
                  </div>

                  {/* Carga del Equipo */}
                  {Array.isArray(aiResult.workload) && aiResult.workload.length > 0 && (
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-2"><Users className="h-3.5 w-3.5" />Carga del Equipo ({aiResult.workload.length})</CardTitle></CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                          {(["sobrecargado", "saludable", "subutilizado", "sin_carga"] as const).map(level => {
                            const group = aiResult.workload.filter((w: any) => w.level === level);
                            const colors: Record<string, string> = {
                              sobrecargado: "border-destructive/40 bg-destructive/5",
                              saludable: "border-success/40 bg-success/5",
                              subutilizado: "border-warning/40 bg-warning/5",
                              sin_carga: "border-muted-foreground/30 bg-muted/30",
                            };
                            const labels: Record<string, string> = {
                              sobrecargado: "🔥 Sobrecargados",
                              saludable: "✅ Saludables",
                              subutilizado: "⚠️ Subutilizados",
                              sin_carga: "💤 Sin Carga",
                            };
                            return (
                              <div key={level} className={`p-2 rounded border ${colors[level]} space-y-1.5`}>
                                <p className="text-[10px] font-bold uppercase">{labels[level]} ({group.length})</p>
                                {group.map((w: any, i: number) => (
                                  <div key={i} className="text-[10px] space-y-0.5">
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium truncate">{w.owner}</span>
                                      <Badge variant="outline" className="text-[9px] h-4">{w.items} it</Badge>
                                    </div>
                                    <p className="text-muted-foreground line-clamp-2">{w.reason}</p>
                                  </div>
                                ))}
                                {group.length === 0 && <p className="text-[10px] text-muted-foreground italic">—</p>}
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}


                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-2"><Users className="h-3.5 w-3.5" />Cuellos de Botella ({aiResult.bottlenecks.length})</CardTitle></CardHeader>
                      <CardContent className="space-y-2">
                        {aiResult.bottlenecks.map((b: any, i: number) => (
                          <div key={i} className="p-2 rounded bg-muted/40 text-xs space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="font-bold">{b.owner}</span>
                              <Badge variant="outline" className={
                                b.severity === "high" ? "text-destructive border-destructive/30" :
                                b.severity === "medium" ? "text-warning border-warning/30" :
                                "text-muted-foreground"
                              }>{b.severity} • {b.load} items</Badge>
                            </div>
                            <p className="text-muted-foreground">{b.reason}</p>
                          </div>
                        ))}
                        {aiResult.bottlenecks.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Sin cuellos de botella detectados.</p>}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5" />Riesgos ({aiResult.risks.length})</CardTitle></CardHeader>
                      <CardContent className="space-y-2 max-h-[300px] overflow-auto">
                        {aiResult.risks.map((r: any, i: number) => {
                          const item = items.find(it => it.id === r.item_id);
                          return (
                            <div key={i} className="p-2 rounded bg-muted/40 text-xs space-y-1">
                              <p className="font-medium truncate">{item?.title || r.item_id}</p>
                              <p className="text-destructive">⚠ {r.reason}</p>
                              <p className="text-success">→ {r.recommendation}</p>
                            </div>
                          );
                        })}
                        {aiResult.risks.length === 0 && <p className="text-xs text-muted-foreground text-center py-2">Sin riesgos detectados.</p>}
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-xs flex items-center gap-2"><Sparkles className="h-3.5 w-3.5" />Recomendaciones</CardTitle></CardHeader>
                    <CardContent>
                      <ul className="space-y-1.5 text-xs">
                        {aiResult.recommendations.map((r: string, i: number) => (
                          <li key={i} className="flex gap-2">
                            <span className="text-primary font-bold">{i + 1}.</span>
                            <span>{r}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* REPORTS */}
        <TabsContent value="reports" className="mt-3 space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" />Carga por Persona</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ownerLoad} layout="vertical" margin={{ left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={90} />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="h-4 w-4" />Distribución por Origen</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={sourceDist} innerRadius={60} outerRadius={100} dataKey="value" nameKey="name">
                        {sourceDist.map((_, i) => <Cell key={i} fill={CHART_COLORS[i]} />)}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" />Velocity por Sprint</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={velocityData}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="sprint" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="planned" fill="hsl(var(--muted-foreground))" name="Planeados" />
                      <Bar dataKey="completed" fill="hsl(var(--success))" name="Completados" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Calendar className="h-4 w-4" />Burndown Sprint Activo</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[280px]">
                  {burndown.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sin sprint activo con fechas.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={burndown}>
                        <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                        <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="ideal" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" name="Ideal" dot={false} />
                        <Line type="monotone" dataKey="real" stroke="hsl(var(--primary))" name="Real" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><ListOrdered className="h-4 w-4" />Distribución por Estado Scrum</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={scrumStatusDist}>
                      <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="value" fill="hsl(var(--primary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
