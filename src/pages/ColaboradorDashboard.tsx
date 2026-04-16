import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  ListTodo, Headset, FileText, Loader2, Calendar, Building2, AlertCircle,
  Target, Play, Square, Clock, Zap, TrendingUp, Trophy,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAllScrumWorkItems, useAllSprints, useUpdateWorkItemScrum, type ScrumWorkItem } from "@/hooks/useTeamScrum";
import { useWorkTimer, useActivityTracker } from "@/hooks/useActivityTracker";
import { toast } from "sonner";

const SCRUM_COLUMNS = [
  { key: "ready", label: "Por Hacer", color: "bg-muted/40 border-muted" },
  { key: "in_progress", label: "En Progreso", color: "bg-primary/10 border-primary/30" },
  { key: "done", label: "Hecho", color: "bg-emerald-500/10 border-emerald-500/30" },
];

interface MyMinute { id: string; title: string; date: string; client_id: string; summary: string; }

export default function ColaboradorDashboard() {
  const { user, profile } = useAuth();
  const { logActivity } = useActivityTracker();
  const { start: startTimer, stop: stopTimer, getActive } = useWorkTimer();

  const { data: allItems = [], isLoading: loadingItems, refetch } = useAllScrumWorkItems();
  const { data: allSprints = [], isLoading: loadingSprints } = useAllSprints();
  const updateScrum = useUpdateWorkItemScrum();

  const [minutes, setMinutes] = useState<MyMinute[]>([]);
  const [clientNames, setClientNames] = useState<Record<string, string>>({});
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [activeTimer, setActiveTimer] = useState<string | null>(null);

  // Filter items assigned to me (by user_id or owner-name match)
  const fullName = profile?.full_name || "";
  const myItems = useMemo(() => {
    return allItems.filter((i: ScrumWorkItem) => {
      const raw = i.raw || {};
      if (raw.assigned_user_id === user?.id) return true;
      if (i.owner && fullName && i.owner.toLowerCase() === fullName.toLowerCase()) return true;
      return false;
    });
  }, [allItems, user?.id, fullName]);

  // Active sprint for any of my items
  const mySprintIds = new Set(myItems.map(i => i.sprint_id).filter(Boolean));
  const activeSprint = allSprints.find(s => s.status === "activo" && mySprintIds.has(s.id))
    || allSprints.find(s => s.status === "activo");

  const sprintItems = useMemo(
    () => myItems.filter(i => activeSprint && i.sprint_id === activeSprint.id),
    [myItems, activeSprint]
  );
  const backlogItems = useMemo(
    () => myItems
      .filter(i => !i.sprint_id || (activeSprint && i.sprint_id !== activeSprint.id))
      .sort((a, b) => b.wsjf - a.wsjf)
      .slice(0, 30),
    [myItems, activeSprint]
  );

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [minutesRes, clientsRes, todayTime] = await Promise.all([
        supabase.from("meeting_minutes").select("id, title, date, client_id, summary, attendees")
          .order("date", { ascending: false }).limit(50),
        supabase.from("clients").select("id, name"),
        supabase.from("work_time_entries" as any).select("duration_seconds")
          .eq("user_id", user.id)
          .gte("started_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
      ]);
      const myMinutes = (minutesRes.data || []).filter((m: any) =>
        Array.isArray(m.attendees) && m.attendees.some((a: string) => a?.toLowerCase().includes(fullName.toLowerCase()))
      );
      setMinutes(myMinutes);
      setClientNames(Object.fromEntries((clientsRes.data || []).map((c) => [c.id, c.name])));
      const totalSec = ((todayTime.data as any[]) || []).reduce((s, r) => s + (r.duration_seconds || 0), 0);
      setTodayMinutes(Math.round(totalSec / 60));
    })();
  }, [user, fullName]);

  // Sync active timer state from session
  useEffect(() => {
    const stored = sessionStorage.getItem("sysde_active_timer");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setActiveTimer(parsed?.item?.id ?? null);
      } catch { /* noop */ }
    }
  }, []);

  const handleMoveItem = async (item: ScrumWorkItem, newStatus: string) => {
    await updateScrum.mutateAsync({ id: item.id, source: item.source, updates: { scrum_status: newStatus } });
    await logActivity("move_item", {
      entity_type: item.source,
      entity_id: item.id,
      client_id: item.client_id,
      metadata: { from: item.scrum_status, to: newStatus, title: item.title },
    });
    toast.success(`Movido a ${SCRUM_COLUMNS.find(c => c.key === newStatus)?.label}`);
    refetch();
  };

  const handleTimerToggle = async (item: ScrumWorkItem) => {
    if (activeTimer === item.id) {
      await stopTimer();
      setActiveTimer(null);
      await logActivity("timer_stop", { entity_type: item.source, entity_id: item.id, client_id: item.client_id });
      toast.success("Timer detenido");
    } else {
      if (activeTimer) await stopTimer();
      await startTimer({ source: item.source, id: item.id, client_id: item.client_id });
      setActiveTimer(item.id);
      await logActivity("timer_start", { entity_type: item.source, entity_id: item.id, client_id: item.client_id });
      toast.success("Timer iniciado");
    }
  };

  const handlePullToSprint = async (item: ScrumWorkItem) => {
    if (!activeSprint) {
      toast.error("No hay sprint activo");
      return;
    }
    await updateScrum.mutateAsync({
      id: item.id, source: item.source,
      updates: { sprint_id: activeSprint.id, scrum_status: "ready" },
    });
    await logActivity("pull_to_sprint", { entity_type: item.source, entity_id: item.id, metadata: { sprint: activeSprint.name } });
    toast.success(`Movido a sprint ${activeSprint.name}`);
    refetch();
  };

  if (loadingItems || loadingSprints) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  // Sprint metrics
  const totalPoints = sprintItems.reduce((s, i) => s + (i.story_points || 0), 0);
  const donePoints = sprintItems.filter(i => i.scrum_status === "done").reduce((s, i) => s + (i.story_points || 0), 0);
  const sprintProgress = totalPoints > 0 ? (donePoints / totalPoints) * 100 : 0;
  const daysLeft = activeSprint?.end_date
    ? Math.max(0, Math.ceil((new Date(activeSprint.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  const stats = [
    { label: "En sprint", value: sprintItems.length, icon: Target, color: "text-primary", bg: "bg-primary/10" },
    { label: "En progreso", value: sprintItems.filter(i => i.scrum_status === "in_progress").length, icon: Zap, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "Hoy trabajado", value: `${todayMinutes}m`, icon: Clock, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Backlog", value: backlogItems.length, icon: ListTodo, color: "text-info", bg: "bg-info/10" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">Hola, {profile?.full_name?.split(" ")[0] || "Colaborador"} 👋</h2>
          <p className="text-sm text-muted-foreground">Tu sprint actual y backlog priorizado</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s, idx) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.05 }}>
            <Card className="border-border/30">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={`h-10 w-10 rounded-xl ${s.bg} flex items-center justify-center ${s.color}`}>
                  <s.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Active Sprint banner */}
      {activeSprint && (
        <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
          <CardContent className="p-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/15 flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{activeSprint.name}</p>
                  <p className="text-xs text-muted-foreground">{activeSprint.goal || "Sin objetivo definido"}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 text-xs">
                {daysLeft !== null && (
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" /> {daysLeft}d restantes
                  </span>
                )}
                <span className="flex items-center gap-1 font-medium">
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-500" /> {donePoints}/{totalPoints} pts
                </span>
              </div>
            </div>
            <Progress value={sprintProgress} className="h-2 mt-3" />
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="sprint">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="sprint" className="gap-2"><Target className="h-4 w-4" /> Mi Sprint ({sprintItems.length})</TabsTrigger>
          <TabsTrigger value="backlog" className="gap-2"><ListTodo className="h-4 w-4" /> Backlog ({backlogItems.length})</TabsTrigger>
          <TabsTrigger value="minutes" className="gap-2"><FileText className="h-4 w-4" /> Minutas ({minutes.length})</TabsTrigger>
        </TabsList>

        {/* SPRINT KANBAN */}
        <TabsContent value="sprint" className="mt-4">
          {sprintItems.length === 0 ? (
            <EmptyState message={activeSprint ? "No tienes items asignados en este sprint" : "No hay sprint activo"} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {SCRUM_COLUMNS.map(col => {
                const colItems = sprintItems.filter(i => (i.scrum_status || "ready") === col.key);
                return (
                  <div key={col.key} className={`rounded-lg border ${col.color} p-3 min-h-[300px]`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-xs font-bold uppercase tracking-wide">{col.label}</h3>
                      <Badge variant="outline" className="text-[10px]">{colItems.length}</Badge>
                    </div>
                    <div className="space-y-2">
                      {colItems.map(item => (
                        <ScrumCard
                          key={item.id}
                          item={item}
                          clientName={clientNames[item.client_id]}
                          isTimerActive={activeTimer === item.id}
                          onMove={handleMoveItem}
                          onTimer={handleTimerToggle}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* BACKLOG */}
        <TabsContent value="backlog" className="mt-4 space-y-2">
          {backlogItems.length === 0 ? (
            <EmptyState message="No tienes items en backlog" />
          ) : backlogItems.map(item => (
            <Card key={item.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-[9px] uppercase">{item.source === "task" ? "Tarea" : "Ticket"}</Badge>
                      {item.wsjf > 0 && <Badge className="bg-primary/15 text-primary border-primary/30 text-[9px]">WSJF {item.wsjf}</Badge>}
                      <p className="text-sm font-semibold truncate">{item.title}</p>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                      <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {clientNames[item.client_id] || item.client_id}</span>
                      {item.story_points != null && <span>{item.story_points} pts</span>}
                      {item.due_date && <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {item.due_date}</span>}
                      <Badge variant="outline" className="text-[9px]">{item.priority}</Badge>
                    </div>
                  </div>
                  {activeSprint && (
                    <Button size="sm" variant="outline" onClick={() => handlePullToSprint(item)} className="gap-1">
                      <Target className="h-3 w-3" /> Al sprint
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* MINUTES */}
        <TabsContent value="minutes" className="mt-4 space-y-2">
          {minutes.length === 0 ? (
            <EmptyState message="No has participado en minutas recientes" />
          ) : minutes.map((m) => (
            <Card key={m.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <p className="text-sm font-semibold">{m.title}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{m.summary}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {clientNames[m.client_id] || m.client_id}</span>
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {m.date}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ScrumCard({
  item, clientName, isTimerActive, onMove, onTimer,
}: {
  item: ScrumWorkItem;
  clientName?: string;
  isTimerActive: boolean;
  onMove: (i: ScrumWorkItem, status: string) => void;
  onTimer: (i: ScrumWorkItem) => void;
}) {
  const next = item.scrum_status === "ready" ? "in_progress"
    : item.scrum_status === "in_progress" ? "done" : null;
  return (
    <Card className="bg-background/80 hover:shadow-md transition-shadow">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start gap-1.5">
          <Badge variant="outline" className="text-[9px] uppercase shrink-0">{item.source === "task" ? "T" : "B"}</Badge>
          <p className="text-xs font-semibold leading-snug">{item.title}</p>
        </div>
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1 truncate"><Building2 className="h-2.5 w-2.5" /> {clientName || item.client_id}</span>
          {item.story_points != null && <span>{item.story_points}pt</span>}
        </div>
        <div className="flex items-center gap-1 pt-1">
          <Button
            size="sm"
            variant={isTimerActive ? "default" : "outline"}
            className="h-7 px-2 text-[10px] flex-1"
            onClick={() => onTimer(item)}
          >
            {isTimerActive ? <><Square className="h-3 w-3 mr-1" /> Stop</> : <><Play className="h-3 w-3 mr-1" /> Timer</>}
          </Button>
          {next && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => onMove(item, next)}>
              →
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <AlertCircle className="h-8 w-8 mb-2 opacity-30" />
        <p className="text-sm">{message}</p>
      </CardContent>
    </Card>
  );
}
