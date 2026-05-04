import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, Activity, Clock, Users, Zap, Search, RefreshCw, ArrowRight,
  LogIn, Play, Square, Move, Upload, FileText, MessageSquare, CheckSquare,
  PlusCircle, Trash2, Edit3, Eye, Filter, Sparkles, TrendingUp, AlertTriangle,
  Calendar, Target, Coffee, Sun,
} from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

interface Member {
  user_id: string;
  full_name: string;
  email: string;
  role: string | null;
  last_session_start: string | null;
  last_heartbeat: string | null;
  is_online: boolean;
  total_minutes_today: number;
  total_minutes_week: number;
  active_items: number;
  events_today: number;
  last_action_label: string | null;
  last_action_at: string | null;
}

interface ActivityRow {
  id: string;
  user_id: string;
  user_name?: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  client_id: string | null;
  metadata: any;
  created_at: string;
}

interface AIAnalysis {
  summary: string;
  patterns: string[];
  recommendations: string[];
  productivity_score: number;
  focus_assessment: { level: string; reason: string };
  risk_flags: string[];
  working_hours: { start: string; end: string } | null;
  total_events: number;
  total_session_hours: number;
  active_days: number;
  hourly_distribution: number[];
  top_actions: { action: string; count: number }[];
  top_clients: { client: string; count: number }[];
  daily_activity: Record<string, number>;
}

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }>; category: string }> = {
  login: { label: "Inicio de sesión", color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", icon: LogIn, category: "Sesión" },
  logout: { label: "Cerró sesión", color: "bg-muted text-muted-foreground border-border", icon: LogIn, category: "Sesión" },
  timer_start: { label: "Inició timer", color: "bg-primary/15 text-primary border-primary/30", icon: Play, category: "Tiempo" },
  timer_stop: { label: "Detuvo timer", color: "bg-muted text-muted-foreground border-border", icon: Square, category: "Tiempo" },
  move_item: { label: "Movió item", color: "bg-blue-500/15 text-blue-500 border-blue-500/30", icon: Move, category: "Gestión" },
  pull_to_sprint: { label: "Pull a sprint", color: "bg-amber-500/15 text-amber-500 border-amber-500/30", icon: ArrowRight, category: "Scrum" },
  task_create: { label: "Creó tarea", color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", icon: PlusCircle, category: "Tareas" },
  task_update: { label: "Editó tarea", color: "bg-blue-500/15 text-blue-500 border-blue-500/30", icon: Edit3, category: "Tareas" },
  task_delete: { label: "Eliminó tarea", color: "bg-destructive/15 text-destructive border-destructive/30", icon: Trash2, category: "Tareas" },
  ticket_create: { label: "Creó ticket", color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", icon: PlusCircle, category: "Soporte" },
  ticket_update: { label: "Editó ticket", color: "bg-blue-500/15 text-blue-500 border-blue-500/30", icon: Edit3, category: "Soporte" },
  comment_add: { label: "Comentario", color: "bg-violet-500/15 text-violet-500 border-violet-500/30", icon: MessageSquare, category: "Colaboración" },
  upload: { label: "Subió archivo", color: "bg-cyan-500/15 text-cyan-500 border-cyan-500/30", icon: Upload, category: "Archivos" },
  view: { label: "Visualizó", color: "bg-muted text-muted-foreground border-border", icon: Eye, category: "Navegación" },
  presentation_share: { label: "Compartió minuta", color: "bg-pink-500/15 text-pink-500 border-pink-500/30", icon: FileText, category: "Documentos" },
  subtask_toggle: { label: "Subtarea", color: "bg-teal-500/15 text-teal-500 border-teal-500/30", icon: CheckSquare, category: "Tareas" },
};

function getActionConfig(action: string) {
  return ACTION_CONFIG[action] || { label: action, color: "bg-muted text-muted-foreground border-border", icon: Activity, category: "Otros" };
}

function describeMetadata(a: ActivityRow): string {
  const m = a.metadata || {};
  if (m.title) return String(m.title);
  if (m.from && m.to) return `${m.from} → ${m.to}`;
  if (m.sprint) return `Sprint: ${m.sprint}`;
  if (m.client) return `Cliente: ${m.client}`;
  if (m.ticket_id) return `Ticket: ${m.ticket_id}`;
  if (a.entity_type && a.entity_id) return `${a.entity_type}: ${String(a.entity_id).slice(0, 8)}…`;
  return "";
}

// Infiere horario aproximado a partir de actividades (percentiles 10 y 90)
function inferWorkingHours(activities: ActivityRow[]): { start: string; end: string; lunchHour: number | null } | null {
  if (activities.length < 3) return null;
  const hours = activities.map(a => new Date(a.created_at).getHours()).sort((a, b) => a - b);
  const start = hours[Math.floor(hours.length * 0.1)];
  const end = hours[Math.floor(hours.length * 0.9)];
  // Detecta hora con menos actividad entre 11-15 (almuerzo)
  const counts = new Array(24).fill(0);
  hours.forEach(h => counts[h]++);
  let lunchHour: number | null = null;
  let minCount = Infinity;
  for (let h = 12; h <= 14; h++) {
    if (counts[h] < minCount && counts[h] < (counts[h - 1] || 0)) {
      minCount = counts[h];
      lunchHour = h;
    }
  }
  return { start: `${String(start).padStart(2, "0")}:00`, end: `${String(end).padStart(2, "0")}:00`, lunchHour };
}

export function TeamActivityPanel({ compact = false }: { compact?: boolean }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [clientsMap, setClientsMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [detailUser, setDetailUser] = useState<Member | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<AIAnalysis | null>(null);
  const [aiPeriod, setAiPeriod] = useState<number>(7);

  const load = async (silent = false) => {
    if (silent) setRefreshing(true); else setLoading(true);
    const sinceDay = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const sinceWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [profilesRes, rolesRes, sessionsRes, timeDayRes, timeWeekRes, activeItemsRes, actsRes, clientsRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, email"),
      supabase.from("user_roles").select("user_id, role"),
      (supabase.from("user_sessions" as any).select("user_id, started_at, last_heartbeat, ended_at")
        .order("last_heartbeat", { ascending: false }) as any),
      (supabase.from("work_time_entries" as any).select("user_id, duration_seconds, started_at, ended_at")
        .gte("started_at", sinceDay) as any),
      (supabase.from("work_time_entries" as any).select("user_id, duration_seconds, started_at, ended_at")
        .gte("started_at", sinceWeek) as any),
      supabase.from("tasks").select("assigned_user_id, status").not("assigned_user_id", "is", null).neq("status", "completed"),
      (supabase.from("user_activity_log" as any).select("*").order("created_at", { ascending: false }).limit(500) as any),
      supabase.from("clients").select("id, name"),
    ]);

    const roleMap = new Map<string, string>();
    (rolesRes.data || []).forEach((r: any) => roleMap.set(r.user_id, r.role));

    const cMap = new Map<string, string>();
    (clientsRes.data || []).forEach((c: any) => cMap.set(c.id, c.name));
    setClientsMap(cMap);

    const latestSession = new Map<string, any>();
    ((sessionsRes.data as any[]) || []).forEach((s) => {
      if (!latestSession.has(s.user_id)) latestSession.set(s.user_id, s);
    });

    const sumDuration = (rows: any[]): Map<string, number> => {
      const m = new Map<string, number>();
      rows.forEach(r => {
        const sec = r.duration_seconds ?? (r.ended_at ? Math.round((new Date(r.ended_at).getTime() - new Date(r.started_at).getTime()) / 1000) : 0);
        m.set(r.user_id, (m.get(r.user_id) || 0) + sec);
      });
      return m;
    };
    const dayMap = sumDuration((timeDayRes.data as any[]) || []);
    const weekMap = sumDuration((timeWeekRes.data as any[]) || []);

    const activeItemsMap = new Map<string, number>();
    ((activeItemsRes.data as any[]) || []).forEach((t: any) => {
      activeItemsMap.set(t.assigned_user_id, (activeItemsMap.get(t.assigned_user_id) || 0) + 1);
    });

    const todayStr = new Date().toDateString();
    const eventsTodayMap = new Map<string, number>();
    const lastActionMap = new Map<string, ActivityRow>();
    ((actsRes.data as any[]) || []).forEach((a: any) => {
      if (new Date(a.created_at).toDateString() === todayStr) {
        eventsTodayMap.set(a.user_id, (eventsTodayMap.get(a.user_id) || 0) + 1);
      }
      if (!lastActionMap.has(a.user_id)) lastActionMap.set(a.user_id, a);
    });

    const now = Date.now();
    const built: Member[] = (profilesRes.data || []).map((p: any) => {
      const sess = latestSession.get(p.user_id);
      const lastBeat = sess?.last_heartbeat ? new Date(sess.last_heartbeat).getTime() : 0;
      const isOnline = !!sess && !sess.ended_at && (now - lastBeat < 5 * 60 * 1000);
      const lastAct = lastActionMap.get(p.user_id);
      return {
        user_id: p.user_id,
        full_name: p.full_name || p.email,
        email: p.email,
        role: roleMap.get(p.user_id) || null,
        last_session_start: sess?.started_at || null,
        last_heartbeat: sess?.last_heartbeat || null,
        is_online: isOnline,
        total_minutes_today: Math.round((dayMap.get(p.user_id) || 0) / 60),
        total_minutes_week: Math.round((weekMap.get(p.user_id) || 0) / 60),
        active_items: activeItemsMap.get(p.user_id) || 0,
        events_today: eventsTodayMap.get(p.user_id) || 0,
        last_action_label: lastAct ? getActionConfig(lastAct.action).label : null,
        last_action_at: lastAct?.created_at || null,
      };
    });

    const filtered = compact
      ? built.filter(m => m.role === "colaborador")
      : built.filter(m => m.role && ["colaborador", "pm", "admin", "gerente"].includes(m.role));

    filtered.sort((a, b) => {
      if (a.is_online !== b.is_online) return a.is_online ? -1 : 1;
      return b.events_today - a.events_today;
    });

    const nameMap = new Map<string, string>();
    built.forEach(m => nameMap.set(m.user_id, m.full_name));
    const acts = ((actsRes.data as any[]) || []).map((a: any) => ({
      ...a,
      user_name: nameMap.get(a.user_id) || a.user_id.slice(0, 8),
    }));

    setMembers(filtered);
    setActivities(acts);
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    load();
    const t = setInterval(() => load(true), 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact]);

  const visibleMembers = useMemo(() => {
    return members.filter(m => {
      if (roleFilter !== "all" && m.role !== roleFilter) return false;
      if (search && !`${m.full_name} ${m.email}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [members, search, roleFilter]);

  const visibleActivities = useMemo(() => {
    return activities.filter(a => {
      if (actionFilter !== "all") {
        const cat = getActionConfig(a.action).category;
        if (a.action !== actionFilter && cat !== actionFilter) return false;
      }
      if (search && !(a.user_name || "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [activities, search, actionFilter]);

  const onlineCount = members.filter(m => m.is_online).length;
  const totalEventsToday = activities.filter(a => new Date(a.created_at).toDateString() === new Date().toDateString()).length;

  const userActivities = detailUser ? activities.filter(a => a.user_id === detailUser.user_id) : [];
  const inferredHours = useMemo(() => inferWorkingHours(userActivities), [userActivities]);

  // Breakdown por categoría del usuario actual
  const userBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    userActivities.forEach(a => {
      const cat = getActionConfig(a.action).category;
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [userActivities]);

  // Heatmap por hora del usuario
  const userHourlyHeatmap = useMemo(() => {
    const counts = new Array(24).fill(0);
    userActivities.forEach(a => counts[new Date(a.created_at).getHours()]++);
    const max = Math.max(...counts, 1);
    return { counts, max };
  }, [userActivities]);

  // Clientes en los que trabajó
  const userClients = useMemo(() => {
    const map: Record<string, number> = {};
    userActivities.forEach(a => {
      if (a.client_id) {
        const name = clientsMap.get(a.client_id) || a.client_id;
        map[name] = (map[name] || 0) + 1;
      }
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [userActivities, clientsMap]);

  const runAIAnalysis = async () => {
    if (!detailUser) return;
    setAiLoading(true);
    setAiAnalysis(null);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-team-activity", {
        body: { user_id: detailUser.user_id, user_name: detailUser.full_name, role: detailUser.role, days: aiPeriod },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAiAnalysis(data);
      toast.success("Análisis IA completado");
    } catch (e: any) {
      toast.error(e.message || "Error al analizar");
    } finally {
      setAiLoading(false);
    }
  };

  const closeDetail = () => {
    setDetailUser(null);
    setAiAnalysis(null);
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  // Categorías únicas para el filtro
  const categories = Array.from(new Set(Object.values(ACTION_CONFIG).map(c => c.category)));

  return (
    <div className="space-y-4">
      {!compact && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard icon={Users} label="Equipo" value={members.length} color="text-primary" bg="bg-primary/10" />
            <StatCard icon={Zap} label="Conectados ahora" value={onlineCount} color="text-emerald-500" bg="bg-emerald-500/10" />
            <StatCard icon={Clock} label="Horas hoy" value={`${Math.round(members.reduce((s, m) => s + m.total_minutes_today, 0) / 60)}h`} color="text-blue-500" bg="bg-blue-500/10" />
            <StatCard icon={Activity} label="Eventos hoy" value={totalEventsToday} color="text-amber-500" bg="bg-amber-500/10" />
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar miembro o acción…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger className="w-[160px] h-9"><Filter className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los roles</SelectItem>
                <SelectItem value="admin">Admin</SelectItem>
                <SelectItem value="pm">PM</SelectItem>
                <SelectItem value="colaborador">Colaborador</SelectItem>
                <SelectItem value="gerente">Gerente</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => load(true)} disabled={refreshing} className="gap-2">
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
          </div>
        </>
      )}

      <Tabs defaultValue="members">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="members">Miembros ({visibleMembers.length})</TabsTrigger>
          {!compact && <TabsTrigger value="activity">Actividad reciente ({visibleActivities.length})</TabsTrigger>}
        </TabsList>

        <TabsContent value="members" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Miembro</TableHead>
                    <TableHead>Rol</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Última acción</TableHead>
                    <TableHead className="text-right">Hoy</TableHead>
                    <TableHead className="text-right">Semana</TableHead>
                    <TableHead className="text-right">Eventos</TableHead>
                    <TableHead className="text-right">Items</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleMembers.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">Sin resultados</TableCell></TableRow>
                  ) : visibleMembers.map(m => (
                    <TableRow key={m.user_id} className="cursor-pointer hover:bg-muted/30" onClick={() => setDetailUser(m)}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{m.full_name}</span>
                          <span className="text-xs text-muted-foreground">{m.email}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px] capitalize">{m.role || "—"}</Badge>
                      </TableCell>
                      <TableCell>
                        {m.is_online ? (
                          <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> En línea
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground">Offline</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {m.last_action_label ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-foreground">{m.last_action_label}</span>
                            <span className="text-muted-foreground">
                              {m.last_action_at ? formatDistanceToNow(new Date(m.last_action_at), { locale: es, addSuffix: true }) : ""}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">Sin actividad</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">{m.total_minutes_today}m</TableCell>
                      <TableCell className="text-right text-sm">{Math.round(m.total_minutes_week / 60)}h {m.total_minutes_week % 60}m</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="text-[10px]">{m.events_today}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{m.active_items}</Badge>
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                          <Sparkles className="h-3 w-3" /> Detalle
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {!compact && (
          <TabsContent value="activity" className="mt-4 space-y-3">
            <div className="flex flex-wrap gap-2 items-center">
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[200px] h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las acciones</SelectItem>
                  <div className="px-2 py-1 text-[10px] text-muted-foreground uppercase">Categorías</div>
                  {categories.map(cat => (
                    <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                  ))}
                  <div className="px-2 py-1 text-[10px] text-muted-foreground uppercase">Específicas</div>
                  {Object.entries(ACTION_CONFIG).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">{visibleActivities.length} eventos</span>
            </div>
            <Card>
              <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                  <div className="divide-y divide-border/40">
                    {visibleActivities.map(a => {
                      const cfg = getActionConfig(a.action);
                      const Icon = cfg.icon;
                      const detail = describeMetadata(a);
                      const clientName = a.client_id ? clientsMap.get(a.client_id) : null;
                      return (
                        <div key={a.id} className="flex items-start gap-3 px-4 py-3 hover:bg-muted/30 text-xs">
                          <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${cfg.color.split(" ")[0]} ${cfg.color.split(" ")[1]}`}>
                            <Icon className="h-3.5 w-3.5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-medium text-foreground">{a.user_name}</span>
                              <span className="text-muted-foreground">·</span>
                              <span className="text-foreground">{cfg.label.toLowerCase()}</span>
                              <Badge variant="outline" className="text-[9px] py-0 px-1">{cfg.category}</Badge>
                              {clientName && (
                                <>
                                  <span className="text-muted-foreground">en</span>
                                  <Badge variant="outline" className="text-[10px] py-0 px-1.5">{clientName}</Badge>
                                </>
                              )}
                            </div>
                            {detail && <p className="text-muted-foreground mt-0.5 truncate">{detail}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-muted-foreground">{formatDistanceToNow(new Date(a.created_at), { locale: es, addSuffix: true })}</p>
                            <p className="text-[10px] text-muted-foreground/70">{format(new Date(a.created_at), "HH:mm:ss")}</p>
                          </div>
                        </div>
                      );
                    })}
                    {visibleActivities.length === 0 && (
                      <div className="text-center text-muted-foreground py-12 text-sm">Sin eventos para este filtro</div>
                    )}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      <Sheet open={!!detailUser} onOpenChange={(o) => !o && closeDetail()}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {detailUser && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center text-primary-foreground font-bold text-base shadow-lg">
                    {detailUser.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="text-base">{detailUser.full_name}</p>
                    <p className="text-xs text-muted-foreground font-normal">{detailUser.email}</p>
                  </div>
                  {detailUser.is_online && (
                    <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 gap-1 mr-6">
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> En línea
                    </Badge>
                  )}
                </SheetTitle>
                <SheetDescription>Análisis completo de actividad y productividad</SheetDescription>
              </SheetHeader>

              {/* KPIs principales */}
              <div className="grid grid-cols-4 gap-2 mt-4">
                <MiniStat icon={Clock} label="Hoy" value={`${detailUser.total_minutes_today}m`} color="text-blue-500" />
                <MiniStat icon={Calendar} label="Semana" value={`${Math.round(detailUser.total_minutes_week / 60)}h`} color="text-violet-500" />
                <MiniStat icon={Activity} label="Eventos hoy" value={detailUser.events_today} color="text-amber-500" />
                <MiniStat icon={Target} label="Items" value={detailUser.active_items} color="text-emerald-500" />
              </div>

              {/* Horario inferido */}
              {inferredHours && (
                <Card className="mt-3 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Sun className="h-4 w-4 text-amber-500" />
                      <span className="text-xs font-semibold uppercase tracking-wide">Horario laboral inferido</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <div>
                        <span className="text-2xl font-bold text-foreground">{inferredHours.start}</span>
                        <span className="text-muted-foreground mx-2">→</span>
                        <span className="text-2xl font-bold text-foreground">{inferredHours.end}</span>
                      </div>
                      {inferredHours.lunchHour !== null && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Coffee className="h-3 w-3" />
                          Almuerzo ~{inferredHours.lunchHour}:00
                        </div>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">Calculado a partir de la actividad registrada (P10–P90)</p>
                  </CardContent>
                </Card>
              )}

              {/* Heatmap por hora */}
              {userHourlyHeatmap.counts.some(c => c > 0) && (
                <Card className="mt-3">
                  <CardContent className="p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2">Distribución por hora</p>
                    <div className="flex items-end gap-0.5 h-16">
                      {userHourlyHeatmap.counts.map((count, h) => {
                        const heightPct = (count / userHourlyHeatmap.max) * 100;
                        const intensity = count === 0 ? "bg-muted/30" : count > userHourlyHeatmap.max * 0.6 ? "bg-primary" : "bg-primary/50";
                        return (
                          <div key={h} className="flex-1 flex flex-col items-center justify-end h-full" title={`${h}:00 · ${count} eventos`}>
                            <div className={`w-full ${intensity} rounded-sm transition-all`} style={{ height: `${Math.max(heightPct, count > 0 ? 8 : 2)}%` }} />
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
                      <span>0h</span><span>6h</span><span>12h</span><span>18h</span><span>23h</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Breakdown por categoría */}
              {userBreakdown.length > 0 && (
                <Card className="mt-3">
                  <CardContent className="p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2">Tipo de trabajo</p>
                    <div className="space-y-1.5">
                      {userBreakdown.slice(0, 6).map(([cat, count]) => {
                        const total = userBreakdown.reduce((s, [, n]) => s + n, 0);
                        const pct = (count / total) * 100;
                        return (
                          <div key={cat} className="space-y-1">
                            <div className="flex justify-between text-xs">
                              <span>{cat}</span>
                              <span className="text-muted-foreground">{count} · {pct.toFixed(0)}%</span>
                            </div>
                            <Progress value={pct} className="h-1.5" />
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Clientes principales */}
              {userClients.length > 0 && (
                <Card className="mt-3">
                  <CardContent className="p-3">
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2">Clientes con más interacción</p>
                    <div className="flex flex-wrap gap-1.5">
                      {userClients.map(([name, count]) => (
                        <Badge key={name} variant="outline" className="gap-1.5">
                          {name}
                          <span className="text-[9px] bg-muted px-1.5 rounded">{count}</span>
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Análisis IA */}
              <Card className="mt-3 border-violet-500/30 bg-gradient-to-br from-violet-500/5 to-pink-500/5">
                <CardContent className="p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-violet-500" />
                      <span className="text-xs font-semibold uppercase tracking-wide">Análisis IA</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Select value={String(aiPeriod)} onValueChange={(v) => setAiPeriod(Number(v))}>
                        <SelectTrigger className="h-7 text-xs w-[100px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">Último día</SelectItem>
                          <SelectItem value="7">7 días</SelectItem>
                          <SelectItem value="14">14 días</SelectItem>
                          <SelectItem value="30">30 días</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button size="sm" onClick={runAIAnalysis} disabled={aiLoading} className="h-7 text-xs gap-1">
                        {aiLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                        {aiAnalysis ? "Re-analizar" : "Analizar"}
                      </Button>
                    </div>
                  </div>

                  {!aiAnalysis && !aiLoading && (
                    <p className="text-xs text-muted-foreground italic">
                      Genera un análisis inteligente de patrones, productividad y recomendaciones basadas en la actividad reciente.
                    </p>
                  )}

                  {aiLoading && (
                    <div className="flex items-center gap-2 py-4 justify-center text-xs text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-violet-500" />
                      Analizando patrones de comportamiento…
                    </div>
                  )}

                  {aiAnalysis && (
                    <div className="space-y-3 mt-2">
                      {/* Score y focus */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-background/50 rounded-lg p-2.5 border border-border/50">
                          <p className="text-[10px] text-muted-foreground uppercase">Productividad</p>
                          <div className="flex items-baseline gap-1">
                            <p className="text-2xl font-bold text-violet-500">{aiAnalysis.productivity_score}</p>
                            <p className="text-xs text-muted-foreground">/100</p>
                          </div>
                          <Progress value={aiAnalysis.productivity_score} className="h-1 mt-1" />
                        </div>
                        <div className="bg-background/50 rounded-lg p-2.5 border border-border/50">
                          <p className="text-[10px] text-muted-foreground uppercase">Foco</p>
                          <p className="text-lg font-bold capitalize">{aiAnalysis.focus_assessment.level}</p>
                          <p className="text-[10px] text-muted-foreground line-clamp-2">{aiAnalysis.focus_assessment.reason}</p>
                        </div>
                      </div>

                      {/* Resumen */}
                      <div className="bg-background/50 rounded-lg p-2.5 border border-border/50">
                        <p className="text-[10px] text-muted-foreground uppercase mb-1">Resumen</p>
                        <p className="text-xs leading-relaxed">{aiAnalysis.summary}</p>
                      </div>

                      {/* Patrones */}
                      {aiAnalysis.patterns.length > 0 && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
                            <TrendingUp className="h-3 w-3" /> Patrones observados
                          </p>
                          <ul className="space-y-1">
                            {aiAnalysis.patterns.map((p, i) => (
                              <li key={i} className="text-xs flex items-start gap-1.5">
                                <span className="text-violet-500 mt-0.5">▸</span>
                                <span>{p}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Recomendaciones */}
                      {aiAnalysis.recommendations.length > 0 && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase mb-1.5">Recomendaciones</p>
                          <ul className="space-y-1">
                            {aiAnalysis.recommendations.map((r, i) => (
                              <li key={i} className="text-xs flex items-start gap-1.5 bg-emerald-500/5 p-1.5 rounded border border-emerald-500/20">
                                <span className="text-emerald-500 mt-0.5">✓</span>
                                <span>{r}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Alertas */}
                      {aiAnalysis.risk_flags.length > 0 && (
                        <div>
                          <p className="text-[10px] text-muted-foreground uppercase mb-1.5 flex items-center gap-1">
                            <AlertTriangle className="h-3 w-3 text-amber-500" /> Alertas
                          </p>
                          <ul className="space-y-1">
                            {aiAnalysis.risk_flags.map((r, i) => (
                              <li key={i} className="text-xs flex items-start gap-1.5 bg-amber-500/5 p-1.5 rounded border border-amber-500/20">
                                <AlertTriangle className="h-3 w-3 text-amber-500 mt-0.5 shrink-0" />
                                <span>{r}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Historial completo */}
              <div className="mt-4">
                <h4 className="text-xs font-semibold uppercase tracking-wide mb-2">Historial detallado ({userActivities.length})</h4>
                <ScrollArea className="h-[350px] pr-2 border rounded-lg">
                  <div className="divide-y divide-border/40">
                    {userActivities.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">Sin actividad registrada</p>
                    ) : userActivities.slice(0, 150).map(a => {
                      const cfg = getActionConfig(a.action);
                      const Icon = cfg.icon;
                      const detail = describeMetadata(a);
                      const clientName = a.client_id ? clientsMap.get(a.client_id) : null;
                      return (
                        <div key={a.id} className="flex items-start gap-2 px-3 py-2 text-xs hover:bg-muted/30">
                          <div className={`h-7 w-7 rounded-md flex items-center justify-center shrink-0 ${cfg.color.split(" ")[0]} ${cfg.color.split(" ")[1]}`}>
                            <Icon className="h-3 w-3" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-medium">{cfg.label}</span>
                              <Badge variant="outline" className="text-[9px] py-0 px-1">{cfg.category}</Badge>
                              {clientName && <Badge variant="outline" className="text-[9px] py-0 px-1">{clientName}</Badge>}
                            </div>
                            {detail && <p className="text-muted-foreground truncate mt-0.5">{detail}</p>}
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[10px] text-muted-foreground">{format(new Date(a.created_at), "dd MMM", { locale: es })}</p>
                            <p className="text-[10px] text-muted-foreground/70">{format(new Date(a.created_at), "HH:mm:ss")}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }: any) {
  return (
    <Card className="border-border/30">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl ${bg} flex items-center justify-center ${color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ icon: Icon, label, value, color }: any) {
  return (
    <div className="bg-muted/30 rounded-lg p-2.5 border border-border/30">
      <div className="flex items-center gap-1 mb-1">
        <Icon className={`h-3 w-3 ${color}`} />
        <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
