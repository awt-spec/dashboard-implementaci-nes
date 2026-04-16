import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Activity, Clock, Users, Zap } from "lucide-react";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDistanceToNow } from "date-fns";
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
}

interface ActivityRow {
  id: string;
  user_id: string;
  user_name?: string;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  metadata: any;
  created_at: string;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  login: { label: "Inicio sesión", color: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  timer_start: { label: "Inició timer", color: "bg-primary/15 text-primary border-primary/30" },
  timer_stop: { label: "Detuvo timer", color: "bg-muted text-muted-foreground border-border" },
  move_item: { label: "Movió item", color: "bg-info/15 text-info border-info/30" },
  pull_to_sprint: { label: "Pull a sprint", color: "bg-warning/15 text-warning border-warning/30" },
};

export function TeamActivityPanel({ compact = false }: { compact?: boolean }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const sinceDay = new Date(new Date().setHours(0, 0, 0, 0)).toISOString();
    const sinceWeek = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const [profilesRes, rolesRes, sessionsRes, timeDayRes, timeWeekRes, activeItemsRes, actsRes] = await Promise.all([
      supabase.from("profiles").select("user_id, full_name, email"),
      supabase.from("user_roles").select("user_id, role"),
      (supabase.from("user_sessions" as any).select("user_id, started_at, last_heartbeat, ended_at")
        .order("last_heartbeat", { ascending: false }) as any),
      (supabase.from("work_time_entries" as any).select("user_id, duration_seconds, started_at, ended_at")
        .gte("started_at", sinceDay) as any),
      (supabase.from("work_time_entries" as any).select("user_id, duration_seconds, started_at, ended_at")
        .gte("started_at", sinceWeek) as any),
      supabase.from("tasks").select("assigned_user_id, status").not("assigned_user_id", "is", null).neq("status", "completed"),
      (supabase.from("user_activity_log" as any).select("*").order("created_at", { ascending: false }).limit(80) as any),
    ]);

    const roleMap = new Map<string, string>();
    (rolesRes.data || []).forEach((r: any) => roleMap.set(r.user_id, r.role));

    // Latest session per user
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

    const now = Date.now();
    const built: Member[] = (profilesRes.data || []).map((p: any) => {
      const sess = latestSession.get(p.user_id);
      const lastBeat = sess?.last_heartbeat ? new Date(sess.last_heartbeat).getTime() : 0;
      const isOnline = !!sess && !sess.ended_at && (now - lastBeat < 5 * 60 * 1000);
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
      };
    });

    // Filter to colaborador role (and admin/pm if not compact)
    const filtered = compact
      ? built.filter(m => m.role === "colaborador")
      : built.filter(m => m.role && ["colaborador", "pm", "admin"].includes(m.role));

    // Sort: online first, then by minutes today desc
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
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compact]);

  const onlineCount = members.filter(m => m.is_online).length;

  if (loading) {
    return <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard icon={Users} label="Equipo" value={members.length} color="text-primary" bg="bg-primary/10" />
          <StatCard icon={Zap} label="Conectados" value={onlineCount} color="text-emerald-500" bg="bg-emerald-500/10" />
          <StatCard icon={Clock} label="Horas hoy" value={`${Math.round(members.reduce((s, m) => s + m.total_minutes_today, 0) / 60)}h`} color="text-info" bg="bg-info/10" />
          <StatCard icon={Activity} label="Eventos hoy" value={activities.filter(a => new Date(a.created_at).toDateString() === new Date().toDateString()).length} color="text-warning" bg="bg-warning/10" />
        </div>
      )}

      <Tabs defaultValue="members">
        <TabsList className="bg-muted/50">
          <TabsTrigger value="members">Miembros ({members.length})</TabsTrigger>
          {!compact && <TabsTrigger value="activity">Actividad reciente</TabsTrigger>}
        </TabsList>

        <TabsContent value="members" className="mt-4">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Miembro</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Última actividad</TableHead>
                    <TableHead className="text-right">Hoy</TableHead>
                    <TableHead className="text-right">Semana</TableHead>
                    <TableHead className="text-right">Items activos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Sin datos</TableCell></TableRow>
                  ) : members.map(m => (
                    <TableRow key={m.user_id}>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-medium text-sm">{m.full_name}</span>
                          <span className="text-xs text-muted-foreground">{m.email}</span>
                        </div>
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
                      <TableCell className="text-xs text-muted-foreground">
                        {m.last_heartbeat
                          ? formatDistanceToNow(new Date(m.last_heartbeat), { locale: es, addSuffix: true })
                          : "Nunca"}
                      </TableCell>
                      <TableCell className="text-right text-sm font-medium">{m.total_minutes_today}m</TableCell>
                      <TableCell className="text-right text-sm">{Math.round(m.total_minutes_week / 60)}h {m.total_minutes_week % 60}m</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">{m.active_items}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {!compact && (
          <TabsContent value="activity" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Últimos {activities.length} eventos</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-1.5">
                    {activities.map(a => {
                      const cfg = ACTION_LABELS[a.action] || { label: a.action, color: "bg-muted text-muted-foreground" };
                      const meta = a.metadata || {};
                      return (
                        <div key={a.id} className="flex items-start gap-3 text-xs py-2 border-b border-border/30 last:border-0">
                          <Badge className={`${cfg.color} text-[10px] shrink-0`}>{cfg.label}</Badge>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium">{a.user_name}</p>
                            {meta.title && <p className="text-muted-foreground truncate">{meta.title}</p>}
                            {meta.from && meta.to && <p className="text-muted-foreground">{meta.from} → {meta.to}</p>}
                            {meta.sprint && <p className="text-muted-foreground">Sprint: {meta.sprint}</p>}
                          </div>
                          <span className="text-muted-foreground whitespace-nowrap shrink-0">
                            {formatDistanceToNow(new Date(a.created_at), { locale: es, addSuffix: true })}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>
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
