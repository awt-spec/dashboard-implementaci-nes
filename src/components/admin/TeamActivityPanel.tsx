import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2, Activity, Clock, Users, Zap, Search, RefreshCw, ArrowRight,
  LogIn, Play, Square, Move, Upload, FileText, MessageSquare, CheckSquare,
  PlusCircle, Trash2, Edit3, Eye, Filter,
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
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";

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

const ACTION_CONFIG: Record<string, { label: string; color: string; icon: React.ComponentType<{ className?: string }> }> = {
  login: { label: "Inicio sesión", color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", icon: LogIn },
  logout: { label: "Cerró sesión", color: "bg-muted text-muted-foreground border-border", icon: LogIn },
  timer_start: { label: "Inició timer", color: "bg-primary/15 text-primary border-primary/30", icon: Play },
  timer_stop: { label: "Detuvo timer", color: "bg-muted text-muted-foreground border-border", icon: Square },
  move_item: { label: "Movió item", color: "bg-blue-500/15 text-blue-500 border-blue-500/30", icon: Move },
  pull_to_sprint: { label: "Pull a sprint", color: "bg-amber-500/15 text-amber-500 border-amber-500/30", icon: ArrowRight },
  task_create: { label: "Creó tarea", color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", icon: PlusCircle },
  task_update: { label: "Editó tarea", color: "bg-blue-500/15 text-blue-500 border-blue-500/30", icon: Edit3 },
  task_delete: { label: "Eliminó tarea", color: "bg-destructive/15 text-destructive border-destructive/30", icon: Trash2 },
  ticket_create: { label: "Creó ticket", color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30", icon: PlusCircle },
  ticket_update: { label: "Editó ticket", color: "bg-blue-500/15 text-blue-500 border-blue-500/30", icon: Edit3 },
  comment_add: { label: "Comentario", color: "bg-violet-500/15 text-violet-500 border-violet-500/30", icon: MessageSquare },
  upload: { label: "Subió archivo", color: "bg-cyan-500/15 text-cyan-500 border-cyan-500/30", icon: Upload },
  view: { label: "Visualizó", color: "bg-muted text-muted-foreground border-border", icon: Eye },
  presentation_share: { label: "Compartió minuta", color: "bg-pink-500/15 text-pink-500 border-pink-500/30", icon: FileText },
  subtask_toggle: { label: "Subtarea", color: "bg-teal-500/15 text-teal-500 border-teal-500/30", icon: CheckSquare },
};

function getActionConfig(action: string) {
  return ACTION_CONFIG[action] || { label: action, color: "bg-muted text-muted-foreground border-border", icon: Activity };
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
      (supabase.from("user_activity_log" as any).select("*").order("created_at", { ascending: false }).limit(300) as any),
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
      return b.total_minutes_today - a.total_minutes_today;
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
      if (actionFilter !== "all" && a.action !== actionFilter) return false;
      if (search && !(a.user_name || "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [activities, search, actionFilter]);

  const onlineCount = members.filter(m => m.is_online).length;
  const totalEventsToday = activities.filter(a => new Date(a.created_at).toDateString() === new Date().toDateString()).length;

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  const userActivities = detailUser ? activities.filter(a => a.user_id === detailUser.user_id).slice(0, 100) : [];

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
                        <Button variant="ghost" size="sm" className="h-7 text-xs">Ver</Button>
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
                            <p className="text-[10px] text-muted-foreground/70">{format(new Date(a.created_at), "HH:mm")}</p>
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

      <Sheet open={!!detailUser} onOpenChange={(o) => !o && setDetailUser(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {detailUser && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                    {detailUser.full_name.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-base">{detailUser.full_name}</p>
                    <p className="text-xs text-muted-foreground font-normal">{detailUser.email}</p>
                  </div>
                </SheetTitle>
                <SheetDescription>Detalle de actividad y tiempo trabajado</SheetDescription>
              </SheetHeader>

              <div className="grid grid-cols-3 gap-2 mt-4">
                <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">HOY</p><p className="text-lg font-bold">{detailUser.total_minutes_today}m</p></CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">SEMANA</p><p className="text-lg font-bold">{Math.round(detailUser.total_minutes_week / 60)}h</p></CardContent></Card>
                <Card><CardContent className="p-3"><p className="text-[10px] text-muted-foreground">EVENTOS HOY</p><p className="text-lg font-bold">{detailUser.events_today}</p></CardContent></Card>
              </div>

              <div className="mt-4 space-y-2 text-xs">
                <div className="flex justify-between"><span className="text-muted-foreground">Estado</span>
                  {detailUser.is_online
                    ? <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30">En línea</Badge>
                    : <Badge variant="outline">Offline</Badge>}
                </div>
                <div className="flex justify-between"><span className="text-muted-foreground">Última sesión</span>
                  <span>{detailUser.last_session_start ? format(new Date(detailUser.last_session_start), "dd MMM HH:mm", { locale: es }) : "—"}</span>
                </div>
                <div className="flex justify-between"><span className="text-muted-foreground">Último heartbeat</span>
                  <span>{detailUser.last_heartbeat ? formatDistanceToNow(new Date(detailUser.last_heartbeat), { locale: es, addSuffix: true }) : "—"}</span>
                </div>
                <div className="flex justify-between"><span className="text-muted-foreground">Items activos</span>
                  <Badge variant="outline">{detailUser.active_items}</Badge>
                </div>
              </div>

              <div className="mt-6">
                <h4 className="text-sm font-semibold mb-2">Historial de acciones</h4>
                <ScrollArea className="h-[400px] pr-2">
                  <div className="space-y-2">
                    {userActivities.length === 0 ? (
                      <p className="text-xs text-muted-foreground text-center py-8">Sin actividad registrada</p>
                    ) : userActivities.map(a => {
                      const cfg = getActionConfig(a.action);
                      const Icon = cfg.icon;
                      const detail = describeMetadata(a);
                      const clientName = a.client_id ? clientsMap.get(a.client_id) : null;
                      return (
                        <div key={a.id} className="flex items-start gap-2 text-xs border-l-2 pl-3 py-1.5" style={{ borderColor: "hsl(var(--border))" }}>
                          <Icon className="h-3.5 w-3.5 mt-0.5 text-muted-foreground shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p><span className="font-medium">{cfg.label}</span>{clientName && <span className="text-muted-foreground"> · {clientName}</span>}</p>
                            {detail && <p className="text-muted-foreground truncate">{detail}</p>}
                            <p className="text-[10px] text-muted-foreground/70">{format(new Date(a.created_at), "dd MMM HH:mm:ss", { locale: es })}</p>
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
