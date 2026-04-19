import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ListTodo, Loader2, Calendar, Building2, AlertCircle, Search, Filter,
  Target, Play, Square, Clock, Zap, TrendingUp, Trophy, ArrowRight,
  CheckCircle2, Circle, GitBranch, MoreHorizontal, FileText, Flame, Bug, Wrench, LogOut, Mail, Bot, Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAllScrumWorkItems, useAllSprints, useUpdateWorkItemScrum, type ScrumWorkItem } from "@/hooks/useTeamScrum";
import { useWorkTimer, useActivityTracker } from "@/hooks/useActivityTracker";
import { ManualTimeEntryDialog } from "@/components/team/ManualTimeEntryDialog";
import { AgentSidePanel } from "@/components/team/AgentSidePanel";
import { MemberAIAgentPanel } from "@/components/team/MemberAIAgentPanel";
import { useMyTeamMember } from "@/hooks/useMyTeamMember";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SCRUM_COLUMNS = [
  { key: "ready", label: "TO DO", icon: Circle, accent: "border-t-slate-400" },
  { key: "in_progress", label: "IN PROGRESS", icon: Zap, accent: "border-t-blue-500" },
  { key: "done", label: "DONE", icon: CheckCircle2, accent: "border-t-emerald-500" },
];

const PRIORITY_CONFIG: Record<string, { color: string; icon: any; label: string }> = {
  alta: { color: "text-red-500 bg-red-500/10 border-red-500/30", icon: Flame, label: "Alta" },
  critica: { color: "text-red-600 bg-red-600/10 border-red-600/30", icon: Flame, label: "Crítica" },
  media: { color: "text-amber-500 bg-amber-500/10 border-amber-500/30", icon: ArrowRight, label: "Media" },
  baja: { color: "text-slate-500 bg-slate-500/10 border-slate-500/30", icon: ArrowRight, label: "Baja" },
};

interface MyMinute { id: string; title: string; date: string; client_id: string; summary: string; }

export default function ColaboradorDashboard() {
  const { user, profile, signOut } = useAuth();
  const { logActivity } = useActivityTracker();
  const { start: startTimer, stop: stopTimer } = useWorkTimer();
  const { data: myMember } = useMyTeamMember();

  const { data: allItems = [], isLoading: loadingItems, refetch } = useAllScrumWorkItems();
  const { data: allSprints = [], isLoading: loadingSprints } = useAllSprints();
  const updateScrum = useUpdateWorkItemScrum();

  const [minutes, setMinutes] = useState<MyMinute[]>([]);
  const [clientNames, setClientNames] = useState<Record<string, string>>({});
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [activeTimer, setActiveTimer] = useState<string | null>(null);
  const [view, setView] = useState<"board" | "backlog" | "minutes" | "agent">("board");
  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [selectedItem, setSelectedItem] = useState<ScrumWorkItem | null>(null);
  const [logHoursOpen, setLogHoursOpen] = useState(false);

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

  const filterItem = (i: ScrumWorkItem) => {
    if (clientFilter !== "all" && i.client_id !== clientFilter) return false;
    if (search && !i.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  };

  const sprintItems = useMemo(
    () => myItems.filter(i => activeSprint && i.sprint_id === activeSprint.id).filter(filterItem),
    [myItems, activeSprint, search, clientFilter]
  );
  const backlogItems = useMemo(
    () => myItems
      .filter(i => !i.sprint_id || (activeSprint && i.sprint_id !== activeSprint.id))
      .filter(filterItem)
      .sort((a, b) => b.wsjf - a.wsjf),
    [myItems, activeSprint, search, clientFilter]
  );

  const myClients = useMemo(() => {
    const ids = new Set(myItems.map(i => i.client_id));
    return Array.from(ids).map(id => ({ id, name: clientNames[id] || id }));
  }, [myItems, clientNames]);

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
      entity_type: item.source, entity_id: item.id, client_id: item.client_id,
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
    if (!activeSprint) { toast.error("No hay sprint activo"); return; }
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

  const totalPoints = sprintItems.reduce((s, i) => s + (i.story_points || 0), 0);
  const donePoints = sprintItems.filter(i => i.scrum_status === "done").reduce((s, i) => s + (i.story_points || 0), 0);
  const sprintProgress = totalPoints > 0 ? (donePoints / totalPoints) * 100 : 0;
  const daysLeft = activeSprint?.end_date
    ? Math.max(0, Math.ceil((new Date(activeSprint.end_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  return (
    <div className="flex h-[calc(100vh-4rem)] bg-background">
      {/* LEFT SIDEBAR — Jira-style navigation */}
      <aside className="w-60 border-r border-border bg-muted/20 flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <Avatar className="h-9 w-9 border border-border">
              <AvatarFallback className="bg-primary/15 text-primary text-xs font-bold">{initials || "?"}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold truncate">{fullName.split(" ").slice(0, 2).join(" ") || "Colaborador"}</p>
              <p className="text-[10px] text-muted-foreground truncate flex items-center gap-1">
                <Mail className="h-2.5 w-2.5" /> {profile?.email || user?.email}
              </p>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <p className="text-[9px] font-medium text-muted-foreground uppercase tracking-wider">Sysde Support</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
          <p className="text-[10px] font-bold uppercase text-muted-foreground px-2 py-2 tracking-wider">Mi trabajo</p>
          <NavBtn icon={Target} label="Sprint activo" count={sprintItems.length} active={view === "board"} onClick={() => setView("board")} />
          <NavBtn icon={ListTodo} label="Mi backlog" count={backlogItems.length} active={view === "backlog"} onClick={() => setView("backlog")} />
          <NavBtn icon={FileText} label="Minutas" count={minutes.length} active={view === "minutes"} onClick={() => setView("minutes")} />

          <p className="text-[10px] font-bold uppercase text-muted-foreground px-2 pt-4 pb-2 tracking-wider flex items-center gap-1">
            <Sparkles className="h-2.5 w-2.5" /> Inteligencia
          </p>
          <button
            onClick={() => setView("agent")}
            className={cn(
              "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors group",
              view === "agent"
                ? "bg-gradient-to-r from-primary to-primary/80 text-primary-foreground font-semibold shadow-sm"
                : "bg-primary/5 text-primary hover:bg-primary/10 font-medium border border-primary/15"
            )}
          >
            <Bot className="h-3.5 w-3.5" />
            <span className="flex-1 text-left">Mi Agente IA</span>
            <Sparkles className={cn("h-3 w-3", view === "agent" ? "animate-pulse" : "text-primary/70")} />
          </button>

          <p className="text-[10px] font-bold uppercase text-muted-foreground px-2 pt-4 pb-2 tracking-wider">Métricas hoy</p>
          <div className="px-2 space-y-2">
            <StatRow icon={Clock} label="Horas registradas" value={`${todayMinutes}m`} />
            <StatRow icon={Zap} label="En progreso" value={sprintItems.filter(i => i.scrum_status === "in_progress").length} />
            <StatRow icon={CheckCircle2} label="Completadas" value={sprintItems.filter(i => i.scrum_status === "done").length} />
          </div>

          {myClients.length > 0 && (
            <>
              <p className="text-[10px] font-bold uppercase text-muted-foreground px-2 pt-4 pb-2 tracking-wider">Projects</p>
              <div className="px-2 space-y-0.5">
                {myClients.slice(0, 8).map(c => (
                  <div key={c.id} className="flex items-center gap-2 px-2 py-1 rounded text-xs hover:bg-muted/50 cursor-pointer" onClick={() => setClientFilter(c.id === clientFilter ? "all" : c.id)}>
                    <div className={cn("h-1.5 w-1.5 rounded-full", clientFilter === c.id ? "bg-primary" : "bg-muted-foreground/40")} />
                    <span className="truncate flex-1">{c.name}</span>
                    <span className="text-[9px] text-muted-foreground">{myItems.filter(i => i.client_id === c.id).length}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        <div className="p-2 border-t border-border space-y-1">
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start h-8"
            onClick={() => setLogHoursOpen(true)}
          >
            <Clock className="h-3.5 w-3.5 mr-2" />
            <span className="text-xs">Registrar horas</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-muted-foreground hover:text-foreground hover:bg-destructive/10 hover:text-destructive h-8"
            onClick={signOut}
          >
            <LogOut className="h-3.5 w-3.5 mr-2" />
            <span className="text-xs">Cerrar sesión</span>
          </Button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top toolbar */}
        <div className="border-b border-border px-6 py-3 flex items-center justify-between gap-4 bg-background">
          <div className="flex items-center gap-3 min-w-0">
            <h1 className="text-lg font-bold truncate flex items-center gap-2">
              {view === "board" && (<><Target className="h-4 w-4 text-primary" /> {activeSprint?.name || "Sprint activo"}</>)}
              {view === "backlog" && (<><ListTodo className="h-4 w-4 text-primary" /> Mi backlog</>)}
              {view === "minutes" && (<><FileText className="h-4 w-4 text-primary" /> Minutas</>)}
              {view === "agent" && (<><Bot className="h-4 w-4 text-primary" /> Mi Agente IA <Sparkles className="h-3.5 w-3.5 text-warning animate-pulse" /></>)}
            </h1>
            {view === "board" && activeSprint && (
              <div className="hidden md:flex items-center gap-3 text-xs">
                {daysLeft !== null && (
                  <Badge variant="outline" className="gap-1 font-mono">
                    <Calendar className="h-3 w-3" /> {daysLeft}d restantes
                  </Badge>
                )}
                <Badge variant="outline" className="gap-1 font-mono">
                  <TrendingUp className="h-3 w-3" /> {donePoints}/{totalPoints} pts
                </Badge>
              </div>
            )}
          </div>
          {view !== "agent" && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..." className="h-8 pl-8 w-48 text-xs" />
              </div>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="h-8 w-36 text-xs"><Filter className="h-3 w-3 mr-1" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los clientes</SelectItem>
                  {myClients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {view === "board" && activeSprint && (
          <div className="px-6 py-2 border-b border-border bg-muted/10">
            <div className="flex items-center gap-2">
              <Trophy className="h-3.5 w-3.5 text-amber-500" />
              <span className="text-xs text-muted-foreground italic flex-1 truncate">{activeSprint.goal || "Sin objetivo"}</span>
              <Progress value={sprintProgress} className="h-1.5 w-32" />
              <span className="text-[10px] font-mono text-muted-foreground">{Math.round(sprintProgress)}%</span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-auto p-6">
          {/* BOARD VIEW — Kanban */}
          {view === "board" && (
            <>
              {sprintItems.length === 0 ? (
                <EmptyState message={activeSprint ? "No items assigned in this sprint" : "No active sprint"} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
                  {SCRUM_COLUMNS.map(col => {
                    const colItems = sprintItems.filter(i => (i.scrum_status || "ready") === col.key);
                    const Icon = col.icon;
                    return (
                      <div key={col.key} className={cn("rounded-lg bg-muted/30 border border-border border-t-2 flex flex-col", col.accent)}>
                        <div className="px-3 py-2.5 border-b border-border flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[11px] font-bold tracking-wider text-muted-foreground">{col.label}</span>
                            <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{colItems.length}</Badge>
                          </div>
                        </div>
                        <div className="p-2 space-y-2 flex-1 overflow-y-auto min-h-[200px]">
                          {colItems.length === 0 && (
                            <p className="text-[10px] text-muted-foreground/60 text-center py-4 italic">Drop items here</p>
                          )}
                          {colItems.map((item, idx) => (
                            <motion.div key={item.id} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}>
                              <JiraCard
                                item={item}
                                clientName={clientNames[item.client_id]}
                                isTimerActive={activeTimer === item.id}
                                onMove={handleMoveItem}
                                onTimer={handleTimerToggle}
                                onClick={() => setSelectedItem(item)}
                              />
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* BACKLOG VIEW — table-like list */}
          {view === "backlog" && (
            <Card className="overflow-hidden">
              <div className="grid grid-cols-[80px_1fr_120px_80px_80px_100px_120px] gap-2 px-4 py-2.5 bg-muted/40 border-b border-border text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <span>Type</span><span>Summary</span><span>Project</span><span>Pts</span><span>WSJF</span><span>Priority</span><span></span>
              </div>
              {backlogItems.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No items in backlog</div>
              ) : backlogItems.map((item, idx) => (
                <BacklogRow
                  key={item.id}
                  item={item}
                  clientName={clientNames[item.client_id]}
                  onPull={handlePullToSprint}
                  onClick={() => setSelectedItem(item)}
                  hasSprint={!!activeSprint}
                  alt={idx % 2 === 1}
                />
              ))}
            </Card>
          )}

          {/* MINUTES VIEW */}
          {view === "minutes" && (
            <div className="space-y-2 max-w-4xl">
              {minutes.length === 0 ? (
                <EmptyState message="No has participado en minutas recientes" />
              ) : minutes.map((m) => (
                <Card key={m.id} className="hover:border-primary/40 transition-colors cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-1.5">
                      <p className="text-sm font-semibold">{m.title}</p>
                      <Badge variant="outline" className="text-[10px] gap-1"><Calendar className="h-3 w-3" />{m.date}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{m.summary}</p>
                    <Badge variant="secondary" className="text-[10px] gap-1"><Building2 className="h-3 w-3" />{clientNames[m.client_id] || m.client_id}</Badge>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* AGENT VIEW — full immersive */}
          {view === "agent" && myMember?.id && (
            <div className="max-w-6xl mx-auto h-full">
              <MemberAIAgentPanel
                memberId={myMember.id}
                memberName={myMember.name || profile?.full_name || "Colaborador"}
              />
            </div>
          )}
          {view === "agent" && !myMember?.id && (
            <EmptyState message="Tu perfil de colaborador aún no está vinculado. Contacta a un admin." />
          )}
        </div>
      </main>

      <ManualTimeEntryDialog open={logHoursOpen} onOpenChange={setLogHoursOpen} />

      {/* Persistent immersive agent panel — Cursor-style */}
      {view !== "agent" && (
        <AgentSidePanel
          memberId={myMember?.id}
          memberName={myMember?.name || profile?.full_name}
          contextLabel={selectedItem?.title || (activeSprint?.name ? `Sprint ${activeSprint.name}` : null)}
        />
      )}

      {/* DETAIL PANEL — Jira-style right sheet */}
      <Sheet open={!!selectedItem} onOpenChange={(o) => !o && setSelectedItem(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {selectedItem && (
            <>
              <SheetHeader>
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="gap-1 text-[10px] font-mono">
                    {selectedItem.source === "task" ? <GitBranch className="h-3 w-3" /> : <Bug className="h-3 w-3" />}
                    {selectedItem.source === "task" ? "TASK" : "TICKET"}-{String(selectedItem.id).slice(0, 6).toUpperCase()}
                  </Badge>
                  {selectedItem.priority && (() => {
                    const p = PRIORITY_CONFIG[selectedItem.priority?.toLowerCase()] || PRIORITY_CONFIG.media;
                    const PIcon = p.icon;
                    return <Badge variant="outline" className={cn("gap-1 text-[10px]", p.color)}><PIcon className="h-3 w-3" />{p.label}</Badge>;
                  })()}
                </div>
                <SheetTitle className="text-left text-lg leading-tight">{selectedItem.title}</SheetTitle>
              </SheetHeader>

              <div className="space-y-5 mt-6">
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <DetailRow label="Status" value={SCRUM_COLUMNS.find(c => c.key === selectedItem.scrum_status)?.label || "TO DO"} />
                  <DetailRow label="Project" value={clientNames[selectedItem.client_id] || selectedItem.client_id} />
                  <DetailRow label="Story points" value={selectedItem.story_points ?? "—"} />
                  <DetailRow label="WSJF score" value={selectedItem.wsjf?.toFixed(1) || "—"} />
                  <DetailRow label="Business value" value={selectedItem.business_value ?? "—"} />
                  <DetailRow label="Effort" value={selectedItem.effort ?? "—"} />
                  <DetailRow label="Assignee" value={selectedItem.owner || "Unassigned"} />
                  <DetailRow label="Due date" value={selectedItem.due_date || "—"} />
                </div>

                {(selectedItem.raw as any)?.description && (
                  <div>
                    <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-2">Description</p>
                    <p className="text-sm whitespace-pre-wrap text-foreground/80">{(selectedItem.raw as any).description}</p>
                  </div>
                )}

                <div className="border-t border-border pt-4 space-y-2">
                  <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Actions</p>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={activeTimer === selectedItem.id ? "default" : "outline"}
                      onClick={() => handleTimerToggle(selectedItem)}
                      className="gap-1.5"
                    >
                      {activeTimer === selectedItem.id ? <><Square className="h-3.5 w-3.5" /> Stop timer</> : <><Play className="h-3.5 w-3.5" /> Start timer</>}
                    </Button>
                    {SCRUM_COLUMNS.filter(c => c.key !== selectedItem.scrum_status).map(c => (
                      <Button key={c.key} size="sm" variant="outline" onClick={() => { handleMoveItem(selectedItem, c.key); setSelectedItem({ ...selectedItem, scrum_status: c.key }); }} className="gap-1.5">
                        <ArrowRight className="h-3.5 w-3.5" /> {c.label}
                      </Button>
                    ))}
                    {!selectedItem.sprint_id && activeSprint && (
                      <Button size="sm" variant="outline" onClick={() => handlePullToSprint(selectedItem)} className="gap-1.5">
                        <Target className="h-3.5 w-3.5" /> Add to sprint
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function NavBtn({ icon: Icon, label, count, active, onClick }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs transition-colors",
        active ? "bg-primary/15 text-primary font-semibold" : "text-foreground/70 hover:bg-muted/60"
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="flex-1 text-left">{label}</span>
      <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">{count}</Badge>
    </button>
  );
}

function StatRow({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center gap-2 px-2 py-1 text-xs">
      <Icon className="h-3 w-3 text-muted-foreground" />
      <span className="text-muted-foreground flex-1">{label}</span>
      <span className="font-mono font-semibold">{value}</span>
    </div>
  );
}

function JiraCard({ item, clientName, isTimerActive, onMove, onTimer, onClick }: {
  item: ScrumWorkItem; clientName?: string; isTimerActive: boolean;
  onMove: (i: ScrumWorkItem, status: string) => void; onTimer: (i: ScrumWorkItem) => void; onClick: () => void;
}) {
  const next = item.scrum_status === "ready" ? "in_progress" : item.scrum_status === "in_progress" ? "done" : null;
  const pCfg = PRIORITY_CONFIG[item.priority?.toLowerCase()] || PRIORITY_CONFIG.media;
  const PIcon = pCfg.icon;
  return (
    <Card
      className={cn(
        "bg-background border-border hover:border-primary/50 hover:shadow-md transition-all cursor-pointer group",
        isTimerActive && "ring-2 ring-primary/40 border-primary/40"
      )}
      onClick={onClick}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium leading-snug line-clamp-2 flex-1">{item.title}</p>
          <button
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            onClick={(e) => { e.stopPropagation(); onClick(); }}
          >
            <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </div>

        <div className="flex items-center gap-1 flex-wrap">
          <Badge variant="outline" className="text-[9px] gap-0.5 font-mono py-0 h-4">
            {item.source === "task" ? <GitBranch className="h-2.5 w-2.5" /> : <Bug className="h-2.5 w-2.5" />}
            {item.source === "task" ? "T" : "B"}-{String(item.id).slice(0, 4).toUpperCase()}
          </Badge>
          <Badge variant="outline" className={cn("text-[9px] gap-0.5 py-0 h-4", pCfg.color)}>
            <PIcon className="h-2.5 w-2.5" />
          </Badge>
        </div>

        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1 truncate"><Building2 className="h-2.5 w-2.5" /> {clientName || item.client_id}</span>
          {item.story_points != null && (
            <span className="font-mono font-semibold bg-muted px-1.5 py-0.5 rounded">{item.story_points}</span>
          )}
        </div>

        <div className="flex items-center gap-1 pt-1 border-t border-border/50">
          <Button
            size="sm"
            variant={isTimerActive ? "default" : "ghost"}
            className="h-6 px-2 text-[10px] flex-1"
            onClick={(e) => { e.stopPropagation(); onTimer(item); }}
          >
            {isTimerActive ? <><Square className="h-2.5 w-2.5 mr-1" /> Stop</> : <><Play className="h-2.5 w-2.5 mr-1" /> Track</>}
          </Button>
          {next && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-[10px]"
              onClick={(e) => { e.stopPropagation(); onMove(item, next); }}
            >
              <ArrowRight className="h-3 w-3" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function BacklogRow({ item, clientName, onPull, onClick, hasSprint, alt }: {
  item: ScrumWorkItem; clientName?: string; onPull: (i: ScrumWorkItem) => void;
  onClick: () => void; hasSprint: boolean; alt: boolean;
}) {
  const pCfg = PRIORITY_CONFIG[item.priority?.toLowerCase()] || PRIORITY_CONFIG.media;
  const PIcon = pCfg.icon;
  return (
    <div
      className={cn(
        "grid grid-cols-[80px_1fr_120px_80px_80px_100px_120px] gap-2 px-4 py-2.5 items-center border-b border-border/50 hover:bg-muted/40 cursor-pointer text-xs",
        alt && "bg-muted/10"
      )}
      onClick={onClick}
    >
      <Badge variant="outline" className="text-[9px] gap-1 font-mono w-fit">
        {item.source === "task" ? <GitBranch className="h-2.5 w-2.5" /> : <Bug className="h-2.5 w-2.5" />}
        {item.source === "task" ? "TASK" : "BUG"}
      </Badge>
      <span className="font-medium truncate">{item.title}</span>
      <span className="text-muted-foreground truncate flex items-center gap-1"><Building2 className="h-3 w-3" /> {clientName || item.client_id}</span>
      <span className="font-mono">{item.story_points ?? "—"}</span>
      <Badge variant="secondary" className="font-mono text-[10px] w-fit">{item.wsjf?.toFixed(1) || "0.0"}</Badge>
      <Badge variant="outline" className={cn("text-[10px] gap-1 w-fit", pCfg.color)}>
        <PIcon className="h-3 w-3" />{pCfg.label}
      </Badge>
      {hasSprint && (
        <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 w-fit" onClick={(e) => { e.stopPropagation(); onPull(item); }}>
          <Target className="h-3 w-3" /> To sprint
        </Button>
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider mb-1">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <AlertCircle className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">{message}</p>
      </CardContent>
    </Card>
  );
}
