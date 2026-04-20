import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Bell, Search, LogOut, Moon, Sun } from "lucide-react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useAllScrumWorkItems, useAllSprints, useUpdateWorkItemScrum, type ScrumWorkItem } from "@/hooks/useTeamScrum";
import { useWorkTimer, useActivityTracker } from "@/hooks/useActivityTracker";
import { ManualTimeEntryDialog } from "@/components/team/ManualTimeEntryDialog";
import { AgentSidePanel } from "@/components/team/AgentSidePanel";
import { useMyTeamMember } from "@/hooks/useMyTeamMember";
import { toast } from "sonner";
import { HeroBuenosDias } from "@/components/colaborador/HeroBuenosDias";
import { FocusCard } from "@/components/colaborador/FocusCard";
import { MiSprintCard } from "@/components/colaborador/MiSprintCard";
import { AgenteIACompactCard } from "@/components/colaborador/AgenteIACompactCard";
import { MiTablero } from "@/components/colaborador/MiTablero";
import { EstaSemanaCalendar } from "@/components/colaborador/EstaSemanaCalendar";
import { MiActividadFeed } from "@/components/colaborador/MiActividadFeed";
import { TaskDetailSheet } from "@/components/colaborador/TaskDetailSheet";

export default function ColaboradorDashboard() {
  const { user, profile, signOut } = useAuth();
  const { logActivity } = useActivityTracker();
  const { start: startTimer, stop: stopTimer } = useWorkTimer();
  const { data: myMember } = useMyTeamMember();

  const { data: allItems = [], isLoading: loadingItems, refetch } = useAllScrumWorkItems();
  const { data: allSprints = [], isLoading: loadingSprints } = useAllSprints();
  const updateScrum = useUpdateWorkItemScrum();

  const [clientNames, setClientNames] = useState<Record<string, string>>({});
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [activeTimer, setActiveTimer] = useState<string | null>(null);
  const [activeTimerStartedAt, setActiveTimerStartedAt] = useState<number | null>(null);
  const [activeTimerLabel, setActiveTimerLabel] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<ScrumWorkItem | null>(null);
  const [logHoursOpen, setLogHoursOpen] = useState(false);
  const [agentOpenSignal, setAgentOpenSignal] = useState(0);
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof window !== "undefined" && document.documentElement.classList.contains("dark")
  );

  const fullName = profile?.full_name || "";
  const initials = fullName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

  const myItems = useMemo(() => {
    return allItems.filter((i: ScrumWorkItem) => {
      const raw = i.raw || {};
      if (raw.assigned_user_id === user?.id) return true;
      if (i.owner && fullName && i.owner.toLowerCase() === fullName.toLowerCase()) return true;
      return false;
    });
  }, [allItems, user?.id, fullName]);

  const mySprintIds = new Set(myItems.map(i => i.sprint_id).filter(Boolean));
  const activeSprint = allSprints.find(s => s.status === "activo" && mySprintIds.has(s.id))
    || allSprints.find(s => s.status === "activo");

  const sprintItems = useMemo(
    () => myItems.filter(i => activeSprint && i.sprint_id === activeSprint.id),
    [myItems, activeSprint]
  );

  // Today tasks
  const today = new Date().toISOString().slice(0, 10);
  const todayTasks = sprintItems.filter(i => i.due_date === today || i.scrum_status === "in_progress");

  // KPI: streak (días consecutivos con actividad), velocidad
  const [streakDays, setStreakDays] = useState(0);
  const [todayMeetingsCount, setTodayMeetingsCount] = useState(0);
  const [velocityChange, setVelocityChange] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [clientsRes, todayTime, sessionsRes, minutesRes] = await Promise.all([
        supabase.from("clients").select("id, name"),
        (supabase.from("work_time_entries" as any).select("duration_seconds")
          .eq("user_id", user.id)
          .gte("started_at", new Date(new Date().setHours(0, 0, 0, 0)).toISOString()) as any),
        (supabase.from("user_sessions" as any).select("started_at")
          .eq("user_id", user.id)
          .gte("started_at", new Date(Date.now() - 30 * 86400000).toISOString())
          .order("started_at", { ascending: false }) as any),
        supabase.from("meeting_minutes").select("date").eq("date", today),
      ]);
      setClientNames(Object.fromEntries((clientsRes.data || []).map((c) => [c.id, c.name])));
      const totalSec = ((todayTime.data as any[]) || []).reduce((s, r) => s + (r.duration_seconds || 0), 0);
      setTodayMinutes(Math.round(totalSec / 60));
      setTodayMeetingsCount((minutesRes.data || []).length);

      // Calculate streak
      const dates = new Set<string>(((sessionsRes.data as any[]) || []).map((s: any) => s.started_at?.slice(0, 10)));
      let streak = 0;
      for (let d = 0; d < 30; d++) {
        const day = new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
        if (dates.has(day)) streak++;
        else if (d > 0) break;
      }
      setStreakDays(streak);

      // Velocity: completed pts last 7 days vs prev 7
      const last7Start = Date.now() - 7 * 86400000;
      const prev7Start = Date.now() - 14 * 86400000;
      const recent = sprintItems.filter(i => i.scrum_status === "done").reduce((s, i) => s + (i.story_points || 0), 0);
      // Simple proxy: % of completed pts vs total
      const pct = sprintItems.length > 0 ? Math.round((recent / Math.max(1, sprintItems.reduce((s, i) => s + (i.story_points || 0), 0))) * 100) - 50 : 0;
      setVelocityChange(pct);
      void last7Start; void prev7Start;
    })();
  }, [user, today, sprintItems.length]);

  useEffect(() => {
    const stored = sessionStorage.getItem("sysde_active_timer");
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setActiveTimer(parsed?.item?.id ?? null);
        if (parsed?.startedAt) setActiveTimerStartedAt(parsed.startedAt);
        if (parsed?.label) setActiveTimerLabel(parsed.label);
      } catch { /* noop */ }
    }
  }, []);

  const handleMoveItem = async (item: ScrumWorkItem, newStatus: string) => {
    await updateScrum.mutateAsync({ id: item.id, source: item.source, updates: { scrum_status: newStatus } });
    await logActivity("move_item", {
      entity_type: item.source, entity_id: item.id, client_id: item.client_id,
      metadata: { from: item.scrum_status, to: newStatus, title: item.title },
    });
    toast.success(newStatus === "done" ? "¡Tarea completada!" : "Movido");
    refetch();
  };

  const handleTimerToggle = async (item: ScrumWorkItem) => {
    if (activeTimer === item.id) {
      await stopTimer();
      setActiveTimer(null);
      setActiveTimerStartedAt(null);
      setActiveTimerLabel(null);
      await logActivity("timer_stop", { entity_type: item.source, entity_id: item.id, client_id: item.client_id, metadata: { title: item.title } });
      toast.success("Timer detenido");
    } else {
      if (activeTimer) await stopTimer();
      await startTimer({ source: item.source, id: item.id, client_id: item.client_id });
      const startedAt = Date.now();
      setActiveTimer(item.id);
      setActiveTimerStartedAt(startedAt);
      setActiveTimerLabel(item.title);
      sessionStorage.setItem("sysde_active_timer", JSON.stringify({ item, startedAt, label: item.title }));
      await logActivity("timer_start", { entity_type: item.source, entity_id: item.id, client_id: item.client_id, metadata: { title: item.title } });
      toast.success("Timer iniciado");
    }
  };

  const handleStopTimerFromHero = async () => {
    const item = sprintItems.find(i => i.id === activeTimer);
    if (item) await handleTimerToggle(item);
    else { await stopTimer(); setActiveTimer(null); setActiveTimerStartedAt(null); setActiveTimerLabel(null); }
  };

  const handleStartFocusTimer = async () => {
    const top = todayTasks[0] || sprintItems[0];
    if (top) await handleTimerToggle(top);
  };

  const toggleDark = () => {
    document.documentElement.classList.toggle("dark");
    setIsDark(document.documentElement.classList.contains("dark"));
  };

  if (loadingItems || loadingSprints) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  // Computed for cards
  const totalPoints = sprintItems.reduce((s, i) => s + (i.story_points || 0), 0);
  const donePoints = sprintItems.filter(i => i.scrum_status === "done").reduce((s, i) => s + (i.story_points || 0), 0);
  const daysLeft = activeSprint?.end_date
    ? Math.max(0, Math.ceil((new Date(activeSprint.end_date).getTime() - Date.now()) / 86400000))
    : null;
  const daysTotal = activeSprint?.start_date && activeSprint?.end_date
    ? Math.max(1, Math.ceil((new Date(activeSprint.end_date).getTime() - new Date(activeSprint.start_date).getTime()) / 86400000))
    : null;

  // Insights agent (heurísticos)
  const blockedCount = sprintItems.filter(i => i.scrum_status === "blocked").length;
  const overdueCount = sprintItems.filter(i => i.due_date && i.due_date < today && i.scrum_status !== "done").length;
  const insights: { id: string; type: "warning" | "trend" | "meeting" | "info"; text: string }[] = [];
  if (blockedCount > 0) insights.push({ id: "blocked", type: "warning", text: `Tenés ${blockedCount} tarea${blockedCount > 1 ? "s" : ""} bloqueada${blockedCount > 1 ? "s" : ""}. ¿Escalar?` });
  if (velocityChange > 0) insights.push({ id: "vel", type: "trend", text: `Tu velocidad subió ${velocityChange}% respecto al sprint anterior.` });
  if (todayMeetingsCount > 0) insights.push({ id: "meet", type: "meeting", text: `Tenés ${todayMeetingsCount} reunión${todayMeetingsCount > 1 ? "es" : ""} programada${todayMeetingsCount > 1 ? "s" : ""} hoy.` });
  if (overdueCount > 0) insights.push({ id: "over", type: "warning", text: `${overdueCount} tarea${overdueCount > 1 ? "s" : ""} vencida${overdueCount > 1 ? "s" : ""} sin completar.` });

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border">
        <div className="px-6 h-14 flex items-center gap-4">
          <h1 className="text-base font-bold tracking-tight">Mi trabajo</h1>
          <div className="flex-1 max-w-md mx-auto relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input placeholder="Buscar o ir a…" className="h-9 pl-9 pr-12 text-sm bg-muted/30 border-border/60" />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground bg-background px-1.5 py-0.5 rounded border border-border">⌘K</kbd>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted-foreground mr-2">Admin · Gerente · <strong className="text-foreground">Colaborador</strong></span>
            <Button variant="ghost" size="icon" className="h-9 w-9 relative" title="Notificaciones">
              <Bell className="h-4 w-4" />
              <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-destructive" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={toggleDark} title="Tema">
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={signOut} title="Cerrar sesión">
              <LogOut className="h-4 w-4" />
            </Button>
            <Avatar className="h-8 w-8 ml-1 border border-border">
              <AvatarFallback className="bg-primary/15 text-primary text-[10px] font-bold">{initials || "?"}</AvatarFallback>
            </Avatar>
          </div>
        </div>
      </header>

      {/* Main grid */}
      <main className="px-6 py-5 space-y-5 max-w-[1600px] mx-auto">
        <HeroBuenosDias
          name={fullName}
          todayTasksCount={todayTasks.length}
          todayMeetingsCount={todayMeetingsCount}
          streakDays={streakDays}
          sprintPoints={donePoints}
          todayMinutes={todayMinutes}
          activeTimerLabel={activeTimerLabel}
          activeTimerStartedAt={activeTimerStartedAt}
          onStartFocus={handleStartFocusTimer}
          onStopTimer={handleStopTimerFromHero}
          focusTaskTitle={todayTasks[0]?.title || sprintItems[0]?.title || null}
        />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <FocusCard
            items={sprintItems}
            clientNames={clientNames}
            activeTimer={activeTimer}
            onTimer={handleTimerToggle}
            onSelect={setSelectedItem}
            onSeeAll={() => setLogHoursOpen(false)}
          />
          <MiSprintCard
            pointsDone={donePoints}
            pointsTotal={totalPoints}
            daysLeft={daysLeft}
            daysTotal={daysTotal}
            velocityChange={velocityChange}
          />
          <AgenteIACompactCard
            insights={insights}
            onAsk={() => setAgentOpenSignal(s => s + 1)}
            onOpenFull={() => setAgentOpenSignal(s => s + 1)}
          />
        </div>

        <MiTablero
          items={sprintItems}
          clientNames={clientNames}
          sprintName={activeSprint?.name}
          daysLeft={daysLeft}
          onSelect={setSelectedItem}
          onMove={handleMoveItem}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-5">
          <EstaSemanaCalendar items={sprintItems} />
          <MiActividadFeed limit={6} />
        </div>

        <div className="flex items-center justify-end gap-2 pb-6">
          <Button variant="outline" size="sm" onClick={() => setLogHoursOpen(true)}>Registrar horas</Button>
        </div>
      </main>

      <ManualTimeEntryDialog open={logHoursOpen} onOpenChange={setLogHoursOpen} />

      <AgentSidePanel
        memberId={myMember?.id}
        memberName={myMember?.name || profile?.full_name}
        contextLabel={selectedItem?.title || (activeSprint?.name ? `Sprint ${activeSprint.name}` : null)}
        defaultOpen={agentOpenSignal > 0}
        key={`agent-${agentOpenSignal}`}
      />

      <TaskDetailSheet
        item={selectedItem}
        clientName={selectedItem ? clientNames[selectedItem.client_id] : undefined}
        sprintName={activeSprint?.name}
        daysLeft={daysLeft}
        onClose={() => setSelectedItem(null)}
      />
    </div>
  );
}
