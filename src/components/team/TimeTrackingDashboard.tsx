import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAllTimeEntries, useUpdateTimeEntry, entryHours, startOfWeek } from "@/hooks/useTimeTracking";
import { useSysdeTeamMembers } from "@/hooks/useTeamMembers";
import { Clock, DollarSign, Users, Download, CheckCircle2, Loader2 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, PieChart, Pie, Cell } from "recharts";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function TimeTrackingDashboard() {
  const { data: entries = [], isLoading } = useAllTimeEntries(30);
  const { data: members = [] } = useSysdeTeamMembers();
  const update = useUpdateTimeEntry();
  const [range, setRange] = useState<"week" | "month">("week");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filtered = useMemo(() => {
    const cutoff = range === "week" ? startOfWeek() : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
    return entries.filter(e => new Date(e.work_date || e.started_at) >= cutoff)
      .filter(e => statusFilter === "all" || e.approval_status === statusFilter);
  }, [entries, range, statusFilter]);

  const memberByUserId = useMemo(() => {
    const map = new Map<string, string>();
    members.forEach((m: any) => { if (m.user_id) map.set(m.user_id, m.name); });
    return map;
  }, [members]);

  const stats = useMemo(() => {
    const total = filtered.reduce((s, e) => s + entryHours(e), 0);
    const billable = filtered.filter(e => e.is_billable).reduce((s, e) => s + entryHours(e), 0);
    const pending = filtered.filter(e => e.approval_status === "pending").length;
    const activeUsers = new Set(filtered.map(e => e.user_id)).size;
    return { total, billable, pending, activeUsers };
  }, [filtered]);

  const byMember = useMemo(() => {
    const map = new Map<string, { hours: number; billable: number }>();
    filtered.forEach(e => {
      const name = memberByUserId.get(e.user_id) || e.user_id.slice(0, 8);
      const c = map.get(name) || { hours: 0, billable: 0 };
      c.hours += entryHours(e);
      if (e.is_billable) c.billable += entryHours(e);
      map.set(name, c);
    });
    return Array.from(map.entries()).map(([name, v]) => ({ name: name.split(" ")[0], ...v })).sort((a, b) => b.hours - a.hours).slice(0, 12);
  }, [filtered, memberByUserId]);

  const billableSplit = useMemo(() => [
    { name: "Facturable", value: stats.billable },
    { name: "No facturable", value: stats.total - stats.billable },
  ], [stats]);

  // Heatmap: members x days
  const heatmapDays = useMemo(() => {
    const days = range === "week" ? 7 : 30;
    return Array.from({ length: days }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      return d.toISOString().slice(0, 10);
    });
  }, [range]);

  const heatmap = useMemo(() => {
    const memberHours = new Map<string, Map<string, number>>();
    filtered.forEach(e => {
      const name = memberByUserId.get(e.user_id) || e.user_id.slice(0, 8);
      const k = e.work_date || e.started_at.slice(0, 10);
      if (!memberHours.has(name)) memberHours.set(name, new Map());
      const m = memberHours.get(name)!;
      m.set(k, (m.get(k) || 0) + entryHours(e));
    });
    return Array.from(memberHours.entries())
      .map(([name, m]) => ({ name, days: heatmapDays.map(d => m.get(d) || 0) }))
      .sort((a, b) => b.days.reduce((s, x) => s + x, 0) - a.days.reduce((s, x) => s + x, 0));
  }, [filtered, heatmapDays, memberByUserId]);

  const exportCSV = () => {
    const rows = filtered.map(e => ({
      fecha: e.work_date || e.started_at.slice(0, 10),
      colaborador: memberByUserId.get(e.user_id) || e.user_id,
      cliente: e.client_id || "",
      tipo: e.source,
      item_id: e.item_id,
      horas: entryHours(e).toFixed(2),
      facturable: e.is_billable ? "Sí" : "No",
      manual: e.is_manual ? "Sí" : "No",
      aprobacion: e.approval_status,
      descripcion: (e.description || "").replace(/[\r\n,]/g, " "),
    }));
    const headers = Object.keys(rows[0] || {});
    const csv = [headers.join(","), ...rows.map(r => headers.map(h => (r as any)[h]).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `horas_${range}_${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado");
  };

  const approveAll = async () => {
    const pending = filtered.filter(e => e.approval_status === "pending");
    for (const e of pending) await update.mutateAsync({ id: e.id, updates: { approval_status: "approved" } });
    toast.success(`${pending.length} entradas aprobadas`);
  };

  if (isLoading) return <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={range} onValueChange={(v: any) => setRange(v)}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="week">Esta semana</SelectItem>
            <SelectItem value="month">Últimos 30 días</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pending">Pendientes</SelectItem>
            <SelectItem value="approved">Aprobados</SelectItem>
            <SelectItem value="rejected">Rechazados</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        {stats.pending > 0 && (
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={approveAll}>
            <CheckCircle2 className="h-3 w-3 mr-1" /> Aprobar {stats.pending}
          </Button>
        )}
        <Button size="sm" variant="outline" className="h-8 text-xs" onClick={exportCSV}>
          <Download className="h-3 w-3 mr-1" /> CSV
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={Clock} label="Total horas" value={`${stats.total.toFixed(1)}h`} color="text-primary" />
        <KPI icon={DollarSign} label="Facturables" value={`${stats.billable.toFixed(1)}h`} sub={`${stats.total ? ((stats.billable / stats.total) * 100).toFixed(0) : 0}%`} color="text-success" />
        <KPI icon={Users} label="Activos" value={stats.activeUsers} sub="colaboradores" color="text-info" />
        <KPI icon={CheckCircle2} label="Por aprobar" value={stats.pending} color="text-warning" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Horas por colaborador</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byMember}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-25} textAnchor="end" height={50} />
                <YAxis tick={{ fontSize: 10 }} unit="h" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Bar dataKey="billable" stackId="a" fill="hsl(var(--success))" name="Facturable" />
                <Bar dataKey="hours" stackId="b" fill="hsl(var(--primary))" name="Total" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Facturable vs No facturable</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={billableSplit} dataKey="value" nameKey="name" innerRadius={50} outerRadius={80} label={(e: any) => `${e.value.toFixed(0)}h`}>
                  <Cell fill="hsl(var(--success))" />
                  <Cell fill="hsl(var(--muted-foreground))" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Heatmap de actividad</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="min-w-[600px]">
            <div className="flex items-center gap-1 mb-1 pl-32">
              {heatmapDays.map(d => (
                <div key={d} className="flex-1 text-center text-[8px] text-muted-foreground">
                  {new Date(d).getDate()}
                </div>
              ))}
            </div>
            {heatmap.length === 0 ? (
              <p className="text-xs text-center py-6 text-muted-foreground">Sin datos en el rango</p>
            ) : heatmap.map(row => (
              <div key={row.name} className="flex items-center gap-1 mb-0.5">
                <div className="w-32 text-[10px] truncate pr-2 font-medium">{row.name}</div>
                {row.days.map((h, i) => {
                  const intensity = Math.min(1, h / 8);
                  return (
                    <div key={i} className={cn("flex-1 h-5 rounded-sm border border-border/50 flex items-center justify-center text-[8px] font-mono")}
                      style={{ backgroundColor: h > 0 ? `hsl(var(--primary) / ${0.1 + intensity * 0.7})` : "transparent" }}
                      title={`${h.toFixed(1)}h`}>
                      {h > 0 ? h.toFixed(1) : ""}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Entradas recientes</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-1 max-h-[400px] overflow-auto">
            {filtered.slice(0, 50).map(e => (
              <div key={e.id} className="flex items-center gap-2 text-xs p-2 rounded border border-border/40 hover:bg-muted/30">
                <span className="font-mono text-muted-foreground w-20">{(e.work_date || e.started_at.slice(0, 10))}</span>
                <span className="font-medium truncate w-32">{memberByUserId.get(e.user_id) || e.user_id.slice(0, 8)}</span>
                <Badge variant="outline" className="text-[9px]">{e.source}</Badge>
                <span className="text-muted-foreground truncate flex-1">{e.description || "—"}</span>
                <span className="font-mono font-bold">{entryHours(e).toFixed(1)}h</span>
                {e.is_billable && <Badge className="text-[9px] bg-success/15 text-success border-success/30">Facturable</Badge>}
                {e.is_manual && <Badge variant="outline" className="text-[9px]">Manual</Badge>}
                <Select value={e.approval_status} onValueChange={(v) => update.mutate({ id: e.id, updates: { approval_status: v as any } })}>
                  <SelectTrigger className="h-6 w-24 text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pendiente</SelectItem>
                    <SelectItem value="approved">Aprobado</SelectItem>
                    <SelectItem value="rejected">Rechazado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-xs text-center py-6 text-muted-foreground">Sin entradas</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function KPI({ icon: Icon, label, value, sub, color }: any) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">{label}</span>
        </div>
        <p className="text-xl font-bold">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
