import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Target, Zap, Trophy, AlertTriangle, Calendar, Users, TrendingDown,
  Flame, Clock, CheckCircle2, AlertCircle, PlayCircle, Sparkles,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend, ReferenceLine,
} from "recharts";
import { toast } from "sonner";
import {
  useAllScrumWorkItems, useAllSprints, useUpdateWorkItemScrum, type ScrumWorkItem, type UnifiedSprint,
} from "@/hooks/useTeamScrum";
import { useClients } from "@/hooks/useClients";

const COLUMNS = [
  { key: "backlog", label: "Backlog", icon: "📋", color: "bg-muted/40" },
  { key: "ready", label: "Listo", icon: "✓", color: "bg-info/10" },
  { key: "in_progress", label: "En Progreso", icon: "⚡", color: "bg-warning/10" },
  { key: "in_sprint", label: "En Sprint", icon: "🏃", color: "bg-primary/10" },
  { key: "done", label: "Hecho", icon: "🏁", color: "bg-success/10" },
];

interface Props {
  onGoToSprintsTab?: () => void;
  onOpenDaily?: (sprintId: string) => void;
  onOpenRetro?: (sprintId: string) => void;
}

export function ActiveSprintHub({ onGoToSprintsTab, onOpenDaily, onOpenRetro }: Props) {
  const { data: items = [], isLoading } = useAllScrumWorkItems();
  const { data: sprints = [] } = useAllSprints();
  const { data: clients = [] } = useClients();
  const updateScrum = useUpdateWorkItemScrum();

  const clientMap = useMemo(() => {
    const m = new Map<string, string>();
    (clients as any[]).forEach(c => m.set(c.id, c.name));
    return m;
  }, [clients]);

  const activeSprints = useMemo(() => sprints.filter(s => s.status === "activo"), [sprints]);
  const [selectedSprintId, setSelectedSprintId] = useState<string | null>(null);
  const [draggedItem, setDraggedItem] = useState<ScrumWorkItem | null>(null);

  const currentSprint = useMemo(() => {
    if (!activeSprints.length) return null;
    return activeSprints.find(s => s.id === selectedSprintId) || activeSprints[0];
  }, [activeSprints, selectedSprintId]);

  // ===== EMPTY STATE =====
  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><div className="animate-pulse text-muted-foreground">Cargando sprint…</div></div>;
  }

  if (!currentSprint) {
    return (
      <Card className="border-dashed border-2">
        <CardContent className="py-16 text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
            <Target className="h-8 w-8 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold">No hay sprints activos</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Inicia un sprint para coordinar al equipo, planificar capacidad y dar seguimiento al avance.
            </p>
          </div>
          <Button onClick={onGoToSprintsTab} size="lg" className="gap-2">
            <PlayCircle className="h-4 w-4" />
            Ir a gestión de sprints
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selector si hay múltiples sprints activos (cliente es lo que distingue) */}
      {activeSprints.length > 1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground shrink-0">Sprint activo de:</span>
          {activeSprints.map(s => {
            const clientName = clientMap.get(s.client_id) || s.client_id;
            const sItems = items.filter(i => i.sprint_id === s.id);
            const done = sItems.filter(i => i.scrum_status === "done").length;
            const isActive = s.id === currentSprint.id;
            return (
              <Button
                key={s.id}
                size="sm"
                variant={isActive ? "default" : "outline"}
                onClick={() => setSelectedSprintId(s.id)}
                className="h-8 text-xs gap-1.5"
              >
                <span className="font-semibold">{clientName}</span>
                <span className={`text-[10px] tabular-nums ${isActive ? "opacity-80" : "text-muted-foreground"}`}>
                  {done}/{sItems.length}
                </span>
              </Button>
            );
          })}
        </div>
      )}

      <SprintHubContent
        sprint={currentSprint}
        items={items}
        draggedItem={draggedItem}
        setDraggedItem={setDraggedItem}
        onChangeStatus={async (item, newStatus) => {
          try {
            await updateScrum.mutateAsync({ id: item.id, source: item.source, updates: { scrum_status: newStatus } });
            toast.success("Estado actualizado");
          } catch (e: any) {
            toast.error(e.message);
          }
        }}
        onOpenDaily={onOpenDaily}
        onOpenRetro={onOpenRetro}
      />
    </div>
  );
}

// =================== CONTENT ===================
function SprintHubContent({
  sprint, items, draggedItem, setDraggedItem, onChangeStatus, onOpenDaily, onOpenRetro,
}: {
  sprint: UnifiedSprint;
  items: ScrumWorkItem[];
  draggedItem: ScrumWorkItem | null;
  setDraggedItem: (i: ScrumWorkItem | null) => void;
  onChangeStatus: (item: ScrumWorkItem, newStatus: string) => Promise<void>;
  onOpenDaily?: (sprintId: string) => void;
  onOpenRetro?: (sprintId: string) => void;
}) {
  const sprintItems = useMemo(() => items.filter(i => i.sprint_id === sprint.id), [items, sprint.id]);

  // ===== TIME =====
  const time = useMemo(() => {
    if (!sprint.start_date || !sprint.end_date) {
      return { totalDays: 0, daysElapsed: 0, daysRemaining: 0, pctTime: 0, vibe: "neutral" as const };
    }
    const start = new Date(sprint.start_date).getTime();
    const end = new Date(sprint.end_date).getTime();
    const now = Date.now();
    const totalDays = Math.max(1, Math.ceil((end - start) / 86400000));
    const daysElapsed = Math.max(0, Math.min(totalDays, Math.ceil((now - start) / 86400000)));
    const daysRemaining = Math.max(0, totalDays - daysElapsed);
    const pctTime = Math.round((daysElapsed / totalDays) * 100);
    const overdue = now > end;
    const vibe = overdue ? "overdue" : pctTime >= 80 ? "danger" : pctTime >= 50 ? "warn" : "ok";
    return { totalDays, daysElapsed, daysRemaining, pctTime, vibe, overdue };
  }, [sprint]);

  // ===== POINTS =====
  const points = useMemo(() => {
    const planned = sprintItems.reduce((s, i) => s + (i.story_points || 0), 0);
    const completed = sprintItems.filter(i => i.scrum_status === "done")
      .reduce((s, i) => s + (i.story_points || 0), 0);
    const inProgress = sprintItems.filter(i => i.scrum_status === "in_progress").length;
    const blocked = sprintItems.filter(i => !i.owner || i.owner === "—" || (!i.story_points && !i.effort)).length;
    const pct = planned > 0 ? Math.round((completed / planned) * 100) : 0;
    const idealCompleted = planned * (time.pctTime / 100);
    const variance = Math.round((completed - idealCompleted) * 10) / 10;
    return { planned, completed, inProgress, blocked, pct, idealCompleted: Math.round(idealCompleted * 10) / 10, variance };
  }, [sprintItems, time.pctTime]);

  // ===== BURNDOWN =====
  const burndown = useMemo(() => {
    if (!sprint.start_date || !sprint.end_date) return [];
    const start = new Date(sprint.start_date).getTime();
    const totalDays = time.totalDays;
    const days: Array<{ day: string; ideal: number; real: number | null }> = [];
    for (let d = 0; d <= totalDays; d++) {
      const ideal = Math.round((points.planned - (points.planned * d / totalDays)) * 10) / 10;
      let real: number | null = null;
      if (d <= time.daysElapsed) {
        // proyección lineal del avance real hasta el día
        const ratio = time.daysElapsed > 0 ? d / time.daysElapsed : 0;
        real = Math.round((points.planned - points.completed * ratio) * 10) / 10;
      }
      days.push({ day: `D${d}`, ideal, real });
    }
    return days;
  }, [sprint, points, time]);

  // ===== TEAM LOAD =====
  const teamLoad = useMemo(() => {
    const map = new Map<string, { assigned: number; done: number; items: number }>();
    sprintItems.forEach(i => {
      const owner = i.owner && i.owner !== "—" ? i.owner : "Sin asignar";
      const cur = map.get(owner) || { assigned: 0, done: 0, items: 0 };
      cur.items += 1;
      cur.assigned += i.story_points || 0;
      if (i.scrum_status === "done") cur.done += i.story_points || 0;
      map.set(owner, cur);
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({
        name,
        ...v,
        pct: v.assigned > 0 ? Math.round((v.done / v.assigned) * 100) : 0,
        level: v.assigned > 13 ? "sobrecargado" : v.assigned >= 5 ? "saludable" : "ligero",
      }))
      .sort((a, b) => b.assigned - a.assigned);
  }, [sprintItems]);

  // ===== RISKS =====
  const risks = useMemo(() => {
    const today = new Date();
    return sprintItems.filter(i => {
      if (i.scrum_status === "done") return false;
      if (!i.owner || i.owner === "—") return true;
      if (!i.story_points && !i.effort) return true;
      if (i.due_date && new Date(i.due_date) < today) return true;
      return false;
    }).slice(0, 8);
  }, [sprintItems]);

  // ===== UI HELPERS =====
  const vibeColor = time.vibe === "overdue" ? "bg-destructive text-destructive-foreground"
    : time.vibe === "danger" ? "bg-destructive/15 text-destructive border-destructive/30"
    : time.vibe === "warn" ? "bg-warning/15 text-warning border-warning/30"
    : "bg-success/15 text-success border-success/30";

  const varianceColor = points.variance >= 0 ? "text-success" : "text-destructive";

  // ─── Estado simplificado del sprint para mensaje principal ──
  const heroStatus = (() => {
    if (time.overdue) return { label: "Sprint vencido", tone: "text-destructive", Icon: AlertTriangle };
    if (points.pct >= 100) return { label: "Sprint completado", tone: "text-success", Icon: CheckCircle2 };
    if (points.variance >= 0) return { label: "En track", tone: "text-success", Icon: CheckCircle2 };
    if (Math.abs(points.variance) > points.planned * 0.15) return { label: "Atrás del ideal", tone: "text-destructive", Icon: AlertTriangle };
    return { label: "Atención", tone: "text-warning", Icon: AlertCircle };
  })();

  return (
    <div className="space-y-4">
      {/* ════════════ HERO UNIFICADO ════════════ */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card"
      >
        <div className="absolute -top-20 -right-20 h-56 w-56 rounded-full bg-primary/15 blur-3xl pointer-events-none" />

        <div className="relative p-5 md:p-6">
          {/* Top: title + status + actions */}
          <div className="flex items-start justify-between gap-3 flex-wrap mb-5">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Flame className="h-4 w-4 text-primary" />
                <p className="text-[10px] uppercase tracking-[0.18em] font-bold text-primary">Sprint activo</p>
              </div>
              <h2 className="text-xl md:text-2xl font-black truncate">{sprint.name}</h2>
              {sprint.goal && (
                <p className="text-sm text-muted-foreground mt-1 line-clamp-1">🎯 {sprint.goal}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => onOpenDaily?.(sprint.id)} className="gap-1.5 h-8">
                ☀️ Daily
              </Button>
              <Button size="sm" variant="outline" onClick={() => onOpenRetro?.(sprint.id)} className="gap-1.5 h-8">
                <Sparkles className="h-3.5 w-3.5" /> Retro
              </Button>
            </div>
          </div>

          {/* Main: big circular progress + key info */}
          <div className="grid grid-cols-1 md:grid-cols-[auto_1fr] gap-6 items-center">
            {/* Donut progress */}
            <div className="flex items-center justify-center md:justify-start">
              <div className="relative h-32 w-32">
                <svg viewBox="0 0 100 100" className="transform -rotate-90 h-full w-full">
                  <circle cx="50" cy="50" r="42" stroke="hsl(var(--muted))" strokeWidth="10" fill="none" />
                  <motion.circle
                    cx="50" cy="50" r="42" stroke="hsl(var(--primary))" strokeWidth="10" fill="none" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 42}`}
                    initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - points.pct / 100) }}
                    transition={{ duration: 1, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-black tabular-nums leading-none">{points.pct}%</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">avance</span>
                </div>
              </div>
            </div>

            {/* Key data */}
            <div className="space-y-3">
              {/* Status pill + day */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className={`inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-card border ${heroStatus.tone === "text-success" ? "border-success/30" : heroStatus.tone === "text-warning" ? "border-warning/30" : "border-destructive/30"}`}>
                  <heroStatus.Icon className={`h-3.5 w-3.5 ${heroStatus.tone}`} />
                  <span className={`text-xs font-bold ${heroStatus.tone}`}>{heroStatus.label}</span>
                </div>
                <Badge variant="outline" className="h-7 px-2.5 text-xs gap-1">
                  <Clock className="h-3 w-3" /> Día {time.daysElapsed} / {time.totalDays}
                </Badge>
                <Badge variant="outline" className="h-7 px-2.5 text-xs">
                  {time.overdue ? "Vencido" : `${time.daysRemaining} días restantes`}
                </Badge>
              </div>

              {/* Mini stats horizontal — la vista principal */}
              <div className="grid grid-cols-3 gap-3 pt-1">
                <HeroStat
                  label="Story Points"
                  value={`${points.completed}/${points.planned}`}
                  hint={points.variance >= 0 ? `+${points.variance} vs ideal` : `${points.variance} vs ideal`}
                  hintTone={points.variance >= 0 ? "text-success" : "text-destructive"}
                />
                <HeroStat label="En progreso" value={points.inProgress} tone="text-info" hint={`${points.inProgress} casos activos`} />
                <HeroStat label="Sin owner / estimación" value={points.blocked} tone={points.blocked > 0 ? "text-warning" : "text-muted-foreground"} hint={points.blocked > 0 ? "Requieren refinamiento" : "Todo listo"} />
              </div>
            </div>
          </div>
        </div>

        {/* Confetti al 100% */}
        <AnimatePresence>
          {points.pct === 100 && points.planned > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="absolute top-3 right-3 text-3xl"
            >
              🎉
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ════════════ ATENCIÓN REQUERIDA — ALERTA PROMINENTE ════════════ */}
      {risks.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl border-2 border-warning/40 bg-warning/5 p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-4 w-4 text-warning" />
            <p className="text-sm font-bold text-warning">Necesita atención hoy</p>
            <Badge className="bg-warning text-warning-foreground text-[10px] h-5">{risks.length}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {risks.slice(0, 4).map(r => {
              const reasons: string[] = [];
              if (!r.owner || r.owner === "—") reasons.push("Sin owner");
              if (!r.story_points && !r.effort) reasons.push("Sin estimación");
              if (r.due_date && new Date(r.due_date) < new Date()) reasons.push("Vencido");
              return (
                <div key={`${r.source}-${r.id}`} className="flex items-start gap-2 p-2 rounded-lg bg-card border border-warning/20 hover:border-warning/50 transition-colors">
                  <div className="h-7 w-7 rounded-md bg-warning/15 flex items-center justify-center shrink-0">
                    <AlertCircle className="h-3.5 w-3.5 text-warning" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold line-clamp-1">{r.title}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {reasons.map(reason => (
                        <Badge key={reason} variant="outline" className="text-[9px] h-4 bg-warning/10 text-warning border-warning/30">{reason}</Badge>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          {risks.length > 4 && (
            <p className="text-[10px] text-muted-foreground mt-2 text-center">
              +{risks.length - 4} ítems más con riesgo. Revisá el tablero abajo.
            </p>
          )}
        </motion.div>
      )}

      {/* ============ BURNDOWN ============ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-primary" />
            Burndown — {points.variance >= 0 ? (
              <span className="text-success">vas {points.variance} SP por encima del ideal 🚀</span>
            ) : (
              <span className="text-destructive">vas {Math.abs(points.variance)} SP por debajo del ideal ⚠️</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={burndown}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" style={{ fontSize: 11 }} />
                <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 6, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <ReferenceLine x={`D${time.daysElapsed}`} stroke="hsl(var(--primary))" strokeDasharray="2 2" label={{ value: "Hoy", fontSize: 10, fill: "hsl(var(--primary))" }} />
                <Line type="monotone" dataKey="ideal" stroke="hsl(var(--muted-foreground))" strokeDasharray="5 5" name="Ideal" dot={false} />
                <Line type="monotone" dataKey="real" stroke="hsl(var(--primary))" strokeWidth={2} name="Real" connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* ============ MINI KANBAN ============ */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Tablero del Sprint
            <Badge variant="outline" className="ml-2 text-[10px]">arrastra para cambiar estado</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
            {COLUMNS.map(col => {
              const colItems = sprintItems.filter(i => (i.scrum_status || "backlog") === col.key);
              return (
                <div
                  key={col.key}
                  onDragOver={e => e.preventDefault()}
                  onDrop={async e => {
                    e.preventDefault();
                    if (draggedItem && (draggedItem.scrum_status || "backlog") !== col.key) {
                      await onChangeStatus(draggedItem, col.key);
                    }
                    setDraggedItem(null);
                  }}
                  className={`rounded-lg ${col.color} border border-border/40 p-2 min-h-[200px] space-y-1.5`}
                >
                  <div className="flex items-center justify-between text-[11px] font-semibold mb-1.5 px-1">
                    <span>{col.icon} {col.label}</span>
                    <Badge variant="outline" className="text-[9px] h-4">{colItems.length}</Badge>
                  </div>
                  <div className="space-y-1.5 max-h-[420px] overflow-auto">
                    <AnimatePresence>
                      {colItems.map(item => (
                        <motion.div
                          key={`${item.source}-${item.id}`}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          draggable
                          onDragStart={() => setDraggedItem(item)}
                          onDragEnd={() => setDraggedItem(null)}
                          className="p-2 rounded bg-card border border-border/60 cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                        >
                          <div className="flex items-center gap-1 mb-1">
                            <Badge variant="outline" className={`text-[8px] h-4 ${item.source === "task" ? "bg-info/15 text-info border-info/30" : "bg-warning/15 text-warning border-warning/30"}`}>
                              {item.source === "task" ? "T" : "C"}
                            </Badge>
                            {item.story_points ? (
                              <Badge variant="outline" className="text-[8px] h-4">{item.story_points} SP</Badge>
                            ) : (
                              <Badge variant="outline" className="text-[8px] h-4 text-warning border-warning/30">?</Badge>
                            )}
                          </div>
                          <p className="text-[11px] font-medium leading-tight line-clamp-2">{item.title}</p>
                          <div className="flex items-center justify-between mt-1.5 text-[9px] text-muted-foreground">
                            <span className="truncate max-w-[80px]">{item.owner}</span>
                            {item.client_name && <span className="truncate max-w-[60px] italic">{item.client_name}</span>}
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {colItems.length === 0 && (
                      <div className="text-center text-[10px] text-muted-foreground py-4 italic">vacío</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ============ EQUIPO ============ */}
      <div className="grid md:grid-cols-1 gap-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Carga del Equipo en el Sprint
            </CardTitle>
          </CardHeader>
          <CardContent>
            {teamLoad.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Sin items asignados todavía</p>
            ) : (
              <div className="space-y-2">
                {teamLoad.map(m => {
                  const semColor = m.level === "sobrecargado" ? "bg-destructive" : m.level === "saludable" ? "bg-success" : "bg-info";
                  return (
                    <div key={m.name} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${semColor}`} />
                          <span className="font-medium">{m.name}</span>
                          <Badge variant="outline" className="text-[9px] h-4">{m.items} items</Badge>
                        </div>
                        <span className="text-muted-foreground">{m.done}/{m.assigned} SP · {m.pct}%</span>
                      </div>
                      <Progress value={m.pct} className="h-1.5" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

function HeroStat({ label, value, hint, tone, hintTone }: { label: string; value: number | string; hint?: string; tone?: string; hintTone?: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className={`text-2xl font-black tabular-nums leading-tight mt-0.5 ${tone || ""}`}>{value}</p>
      {hint && <p className={`text-[10px] mt-0.5 ${hintTone || "text-muted-foreground"}`}>{hint}</p>}
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, color, sub }: { icon: any; label: string; value: any; color: string; sub?: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <Icon className={`h-4 w-4 ${color}`} />
            <p className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</p>
          </div>
          <p className="text-xl font-bold">{value}</p>
          {sub && <p className="text-[10px] mt-0.5">{sub}</p>}
        </CardContent>
      </Card>
    </motion.div>
  );
}
