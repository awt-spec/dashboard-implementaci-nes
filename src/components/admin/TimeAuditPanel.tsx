import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Search, Download, AlertTriangle, History, Lock, Unlock, FileText,
  TrendingUp, Activity, Loader2, CheckCircle2,
} from "lucide-react";
import { useAllTimeEntries, useUpdateTimeEntry, entryHours, startOfWeek } from "@/hooks/useTimeTracking";
import { useTimeAuditLog, useWeeklyLocks } from "@/hooks/useTimeAudit";
import { useSysdeTeamMembers } from "@/hooks/useTeamMembers";
import { TimeTrackingDashboard } from "@/components/team/TimeTrackingDashboard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { cn } from "@/lib/utils";

const ACTION_COLORS: Record<string, string> = {
  created: "bg-info/15 text-info border-info/30",
  updated: "bg-warning/15 text-warning border-warning/30",
  deleted: "bg-destructive/15 text-destructive border-destructive/30",
  approved: "bg-success/15 text-success border-success/30",
  rejected: "bg-destructive/15 text-destructive border-destructive/30",
  locked: "bg-muted text-muted-foreground border-border",
  unlocked: "bg-muted text-muted-foreground border-border",
};

export function TimeAuditPanel() {
  const { user } = useAuth();
  const { data: entries = [], isLoading: loadingEntries } = useAllTimeEntries(60);
  const { data: members = [] } = useSysdeTeamMembers();
  const { data: auditLog = [] } = useTimeAuditLog(60);
  const { data: locks = [], refetch: refetchLocks } = useWeeklyLocks();
  const update = useUpdateTimeEntry();

  const [search, setSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState("all");
  const [clientFilter, setClientFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [billableFilter, setBillableFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [rangeDays, setRangeDays] = useState("30");

  const memberByUserId = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m: any) => { if (m.user_id) map.set(m.user_id, m.name); });
    return map;
  }, [members]);

  const cutoff = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - parseInt(rangeDays));
    return d;
  }, [rangeDays]);

  const filtered = useMemo(() => {
    return entries
      .filter(e => new Date(e.work_date || e.started_at) >= cutoff)
      .filter(e => memberFilter === "all" || e.user_id === memberFilter)
      .filter(e => clientFilter === "all" || e.client_id === clientFilter)
      .filter(e => statusFilter === "all" || e.approval_status === statusFilter)
      .filter(e => billableFilter === "all" || (billableFilter === "yes" ? e.is_billable : !e.is_billable))
      .filter(e => categoryFilter === "all" || (e as any).category === categoryFilter)
      .filter(e => {
        if (!search) return true;
        const s = search.toLowerCase();
        return (e.description || "").toLowerCase().includes(s)
          || (memberByUserId.get(e.user_id) || "").toLowerCase().includes(s)
          || e.item_id.toLowerCase().includes(s);
      });
  }, [entries, cutoff, memberFilter, clientFilter, statusFilter, billableFilter, categoryFilter, search, memberByUserId]);

  // Anomaly detection
  const anomalies = useMemo(() => {
    const list: { entry: any; reason: string; severity: "high" | "medium" | "low" }[] = [];
    // Group by user+date
    const byUserDay = new Map<string, typeof filtered>();
    filtered.forEach(e => {
      const k = `${e.user_id}|${e.work_date || e.started_at.slice(0, 10)}`;
      if (!byUserDay.has(k)) byUserDay.set(k, []);
      byUserDay.get(k)!.push(e);
    });
    byUserDay.forEach((dayEntries, _key) => {
      const total = dayEntries.reduce((s, e) => s + entryHours(e), 0);
      if (total > 14) list.push({ entry: dayEntries[0], reason: `Jornada extrema: ${total.toFixed(1)}h en un día`, severity: "high" });
      else if (total > 12) list.push({ entry: dayEntries[0], reason: `Jornada larga: ${total.toFixed(1)}h en un día`, severity: "medium" });
      // Detect overlapping entries
      const sorted = [...dayEntries].sort((a, b) => new Date(a.started_at).getTime() - new Date(b.started_at).getTime());
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        if (prev.ended_at && new Date(prev.ended_at) > new Date(curr.started_at)) {
          list.push({ entry: curr, reason: "Solapa con otro registro", severity: "medium" });
        }
      }
    });
    // Detect 0h or near-0 entries
    filtered.forEach(e => {
      const h = entryHours(e);
      if (h > 0 && h < 0.05) list.push({ entry: e, reason: `Duración mínima: ${(h * 60).toFixed(1)}min`, severity: "low" });
    });
    return list.slice(0, 50);
  }, [filtered]);

  // Utilization by member
  const utilization = useMemo(() => {
    const map = new Map<string, { total: number; billable: number }>();
    const ws = startOfWeek();
    filtered.filter(e => new Date(e.work_date || e.started_at) >= ws).forEach(e => {
      const name = memberByUserId.get(e.user_id) || e.user_id.slice(0, 8);
      const c = map.get(name) || { total: 0, billable: 0 };
      c.total += entryHours(e);
      if (e.is_billable) c.billable += entryHours(e);
      map.set(name, c);
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({
        name: name.split(" ")[0],
        utilization: Math.min(100, (v.total / 40) * 100),
        billable: Math.min(100, (v.billable / 40) * 100),
        hours: v.total,
      }))
      .sort((a, b) => b.utilization - a.utilization)
      .slice(0, 15);
  }, [filtered, memberByUserId]);

  const exportFullCSV = () => {
    const rows = filtered.map(e => ({
      fecha: e.work_date || e.started_at.slice(0, 10),
      colaborador: memberByUserId.get(e.user_id) || e.user_id,
      cliente: e.client_id || "",
      tipo: e.source,
      item_id: e.item_id,
      categoria: (e as any).category || "",
      horas: entryHours(e).toFixed(2),
      facturable: e.is_billable ? "Sí" : "No",
      manual: e.is_manual ? "Sí" : "No",
      bloqueado: (e as any).is_locked ? "Sí" : "No",
      aprobacion: e.approval_status,
      descripcion: (e.description || "").replace(/[\r\n,]/g, " "),
    }));
    if (rows.length === 0) return toast.error("Sin datos");
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => (r as any)[h]).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `auditoria_horas_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`${rows.length} registros exportados`);
  };

  const lockWeek = async (weekStartDate: string) => {
    if (!user) return;
    const { error } = await (supabase.from("time_weekly_locks" as any).insert([{
      week_start: weekStartDate,
      locked_by: user.id,
      notes: "Cierre semanal",
    }] as any) as any);
    if (error) return toast.error(error.message);
    // Mark entries in that week as locked
    const ws = new Date(weekStartDate);
    const we = new Date(ws); we.setDate(we.getDate() + 7);
    const toLock = entries.filter(e => {
      const d = new Date(e.work_date || e.started_at);
      return d >= ws && d < we;
    });
    for (const e of toLock) await update.mutateAsync({ id: e.id, updates: { is_locked: true as any } as any });
    toast.success(`Semana cerrada — ${toLock.length} entradas bloqueadas`);
    refetchLocks();
  };

  const unlockWeek = async (lockId: string, weekStartDate: string) => {
    const { error } = await (supabase.from("time_weekly_locks" as any).delete().eq("id", lockId) as any);
    if (error) return toast.error(error.message);
    const ws = new Date(weekStartDate);
    const we = new Date(ws); we.setDate(we.getDate() + 7);
    const toUnlock = entries.filter(e => {
      const d = new Date(e.work_date || e.started_at);
      return d >= ws && d < we && (e as any).is_locked;
    });
    for (const e of toUnlock) await update.mutateAsync({ id: e.id, updates: { is_locked: false as any } as any });
    toast.success("Semana reabierta");
    refetchLocks();
  };

  const clients = useMemo(() => Array.from(new Set(entries.map(e => e.client_id).filter(Boolean))) as string[], [entries]);
  const lastWeekStart = useMemo(() => {
    const d = startOfWeek(); d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }, []);
  const lastWeekLocked = locks.some(l => l.week_start === lastWeekStart);

  if (loadingEntries) return <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList className="bg-muted/50 p-1 h-auto">
        <TabsTrigger value="overview" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-3 text-xs">
          <Activity className="h-3.5 w-3.5" /> Resumen
        </TabsTrigger>
        <TabsTrigger value="entries" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-3 text-xs">
          <FileText className="h-3.5 w-3.5" /> Registros
          <Badge variant="secondary" className="text-[9px] h-4 px-1">{filtered.length}</Badge>
        </TabsTrigger>
        <TabsTrigger value="anomalies" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-3 text-xs">
          <AlertTriangle className="h-3.5 w-3.5" /> Anomalías
          {anomalies.length > 0 && <Badge className="text-[9px] h-4 px-1 bg-warning/30 text-warning border-warning/50">{anomalies.length}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="utilization" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-3 text-xs">
          <TrendingUp className="h-3.5 w-3.5" /> Utilización
        </TabsTrigger>
        <TabsTrigger value="audit" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-3 text-xs">
          <History className="h-3.5 w-3.5" /> Bitácora
        </TabsTrigger>
        <TabsTrigger value="locks" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-3 text-xs">
          <Lock className="h-3.5 w-3.5" /> Cierres
        </TabsTrigger>
      </TabsList>

      <TabsContent value="overview" className="space-y-4 mt-0">
        <TimeTrackingDashboard />
      </TabsContent>

      <TabsContent value="entries" className="space-y-3 mt-0">
        <Card>
          <CardContent className="p-3 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar descripción, persona, ID..." className="h-8 pl-7 text-xs" />
              </div>
              <Select value={memberFilter} onValueChange={setMemberFilter}>
                <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Colaborador" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los colaboradores</SelectItem>
                  {Array.from(memberByUserId.entries()).map(([uid, name]) => (
                    <SelectItem key={uid} value={uid}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={clientFilter} onValueChange={setClientFilter}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los clientes</SelectItem>
                  {clients.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Estado" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  <SelectItem value="approved">Aprobados</SelectItem>
                  <SelectItem value="rejected">Rechazados</SelectItem>
                </SelectContent>
              </Select>
              <Select value={billableFilter} onValueChange={setBillableFilter}>
                <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Facturable" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="yes">Facturable</SelectItem>
                  <SelectItem value="no">No facturable</SelectItem>
                </SelectContent>
              </Select>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Categoría" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="desarrollo">Desarrollo</SelectItem>
                  <SelectItem value="soporte">Soporte</SelectItem>
                  <SelectItem value="reunion">Reunión</SelectItem>
                  <SelectItem value="documentacion">Documentación</SelectItem>
                  <SelectItem value="testing">Testing</SelectItem>
                  <SelectItem value="consultoria">Consultoría</SelectItem>
                  <SelectItem value="otros">Otros</SelectItem>
                </SelectContent>
              </Select>
              <Select value={rangeDays} onValueChange={setRangeDays}>
                <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 días</SelectItem>
                  <SelectItem value="14">14 días</SelectItem>
                  <SelectItem value="30">30 días</SelectItem>
                  <SelectItem value="60">60 días</SelectItem>
                  <SelectItem value="90">90 días</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" variant="outline" className="h-8 text-xs" onClick={exportFullCSV}>
                <Download className="h-3 w-3 mr-1" /> CSV
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            <div className="overflow-auto max-h-[600px]">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/80 backdrop-blur z-10">
                  <tr className="text-left border-b">
                    <th className="px-3 py-2 font-bold uppercase text-[10px] tracking-wider">Fecha</th>
                    <th className="px-3 py-2 font-bold uppercase text-[10px] tracking-wider">Colaborador</th>
                    <th className="px-3 py-2 font-bold uppercase text-[10px] tracking-wider">Cliente</th>
                    <th className="px-3 py-2 font-bold uppercase text-[10px] tracking-wider">Tipo</th>
                    <th className="px-3 py-2 font-bold uppercase text-[10px] tracking-wider">Cat.</th>
                    <th className="px-3 py-2 font-bold uppercase text-[10px] tracking-wider text-right">Horas</th>
                    <th className="px-3 py-2 font-bold uppercase text-[10px] tracking-wider">Estado</th>
                    <th className="px-3 py-2 font-bold uppercase text-[10px] tracking-wider"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.slice(0, 200).map(e => (
                    <tr key={e.id} className="border-b hover:bg-muted/30">
                      <td className="px-3 py-1.5 font-mono text-[10px]">{e.work_date || e.started_at.slice(0, 10)}</td>
                      <td className="px-3 py-1.5 font-medium">{memberByUserId.get(e.user_id) || e.user_id.slice(0, 8)}</td>
                      <td className="px-3 py-1.5 text-muted-foreground">{e.client_id || "—"}</td>
                      <td className="px-3 py-1.5"><Badge variant="outline" className="text-[9px]">{e.source}</Badge></td>
                      <td className="px-3 py-1.5 text-[10px] capitalize text-muted-foreground">{(e as any).category || "—"}</td>
                      <td className="px-3 py-1.5 text-right font-mono font-bold">{entryHours(e).toFixed(2)}h</td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center gap-1">
                          {e.is_billable && <Badge className="text-[9px] h-4 bg-success/15 text-success border-success/30">$</Badge>}
                          {(e as any).is_locked && <Badge variant="outline" className="text-[9px] h-4">🔒</Badge>}
                          <Badge variant="outline" className={cn("text-[9px] h-4 capitalize",
                            e.approval_status === "approved" && "bg-success/15 text-success border-success/30",
                            e.approval_status === "rejected" && "bg-destructive/15 text-destructive border-destructive/30",
                          )}>{e.approval_status}</Badge>
                        </div>
                      </td>
                      <td className="px-3 py-1.5">
                        <Select value={e.approval_status} onValueChange={(v) => update.mutate({ id: e.id, updates: { approval_status: v as any } })}>
                          <SelectTrigger className="h-6 w-20 text-[9px]"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pend.</SelectItem>
                            <SelectItem value="approved">Aprob.</SelectItem>
                            <SelectItem value="rejected">Rech.</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filtered.length === 0 && <p className="text-xs text-center py-12 text-muted-foreground">Sin registros con esos filtros</p>}
              {filtered.length > 200 && <p className="text-[10px] text-center py-2 text-muted-foreground">Mostrando 200 de {filtered.length}. Refina filtros o exporta a CSV.</p>}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="anomalies" className="space-y-3 mt-0">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-warning" />
              Anomalías detectadas
              <Badge variant="outline" className="ml-auto">{anomalies.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {anomalies.length === 0 ? (
              <div className="py-8 text-center">
                <CheckCircle2 className="h-8 w-8 mx-auto text-success mb-2" />
                <p className="text-xs text-muted-foreground">Todo en orden — sin anomalías detectadas en el período</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {anomalies.map((a, i) => (
                  <div key={i} className={cn(
                    "p-2 rounded border-l-4 flex items-start gap-2",
                    a.severity === "high" ? "bg-destructive/5 border-l-destructive" : a.severity === "medium" ? "bg-warning/5 border-l-warning" : "bg-info/5 border-l-info"
                  )}>
                    <AlertTriangle className={cn("h-3.5 w-3.5 mt-0.5 shrink-0",
                      a.severity === "high" ? "text-destructive" : a.severity === "medium" ? "text-warning" : "text-info")} />
                    <div className="flex-1 min-w-0 text-xs">
                      <p className="font-semibold">{a.reason}</p>
                      <p className="text-muted-foreground text-[11px]">
                        {memberByUserId.get(a.entry.user_id) || a.entry.user_id.slice(0, 8)} · {a.entry.work_date || a.entry.started_at.slice(0, 10)} · {a.entry.client_id || "sin cliente"}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[9px] capitalize">{a.severity}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="utilization" className="space-y-3 mt-0">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Utilización semanal por colaborador (40h base)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={utilization} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" unit="%" domain={[0, 120]} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={80} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Bar dataKey="billable" fill="hsl(var(--success))" name="Facturable %" />
                <Bar dataKey="utilization" fill="hsl(var(--primary))" name="Total %" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="audit" className="space-y-3 mt-0">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4" /> Bitácora de cambios
              <Badge variant="outline" className="ml-auto">{auditLog.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {auditLog.length === 0 ? (
              <p className="text-xs text-center py-8 text-muted-foreground">Sin actividad en el período</p>
            ) : (
              <div className="space-y-1 max-h-[500px] overflow-auto">
                {auditLog.slice(0, 200).map(log => (
                  <div key={log.id} className="flex items-center gap-2 text-xs p-1.5 rounded hover:bg-muted/30 border-b border-border/30">
                    <span className="font-mono text-[10px] text-muted-foreground w-32 shrink-0">
                      {new Date(log.created_at).toLocaleString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                    </span>
                    <Badge variant="outline" className={cn("text-[9px] capitalize shrink-0", ACTION_COLORS[log.action])}>
                      {log.action}
                    </Badge>
                    <span className="text-muted-foreground truncate w-40 shrink-0">{log.changed_by_email || log.changed_by.slice(0, 8)}</span>
                    {log.field_changed && (
                      <span className="text-[10px] text-muted-foreground">
                        <span className="font-bold">{log.field_changed}</span>: {log.old_value || "—"} → <span className="font-semibold text-foreground">{log.new_value || "—"}</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="locks" className="space-y-3 mt-0">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Lock className="h-4 w-4" /> Cierres semanales
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!lastWeekLocked && (
              <div className="p-3 rounded-lg border border-dashed border-warning/40 bg-warning/5 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold">Semana del {lastWeekStart} aún abierta</p>
                  <p className="text-[10px] text-muted-foreground">Cierra para impedir más ediciones de los colaboradores</p>
                </div>
                <Button size="sm" onClick={() => lockWeek(lastWeekStart)}>
                  <Lock className="h-3 w-3 mr-1.5" /> Cerrar semana
                </Button>
              </div>
            )}
            {locks.length === 0 ? (
              <p className="text-xs text-center py-8 text-muted-foreground">Sin semanas cerradas</p>
            ) : (
              <div className="space-y-1.5">
                {locks.map(l => (
                  <div key={l.id} className="flex items-center gap-2 p-2 rounded border border-border bg-muted/20">
                    <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-xs font-semibold">Semana del {l.week_start}</p>
                      <p className="text-[10px] text-muted-foreground">Cerrada {new Date(l.locked_at).toLocaleString("es")}</p>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => unlockWeek(l.id, l.week_start)}>
                      <Unlock className="h-3 w-3 mr-1" /> Reabrir
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
