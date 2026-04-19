import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useMyTimeEntries, useMyTimeGoal, startOfWeek, entryHours } from "@/hooks/useTimeTracking";
import { Clock, Target, TrendingUp, DollarSign, Plus, Calendar, Settings2 } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { ManualTimeEntryDialog } from "./ManualTimeEntryDialog";
import { TimesheetView } from "./TimesheetView";
import { QuickLogItems } from "./QuickLogItems";
import { TimeGoalDialog } from "./TimeGoalDialog";
import { WeeklyDigestCard } from "./WeeklyDigestCard";
import { useMyTeamMember } from "@/hooks/useMyTeamMember";

export function MyProductivityDashboard() {
  const { data: entries = [] } = useMyTimeEntries(30);
  const { data: goal } = useMyTimeGoal();
  const { data: myMember } = useMyTeamMember();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [goalOpen, setGoalOpen] = useState(false);

  const target = goal?.weekly_target_hours ?? 40;
  const billableTarget = goal?.billable_target_pct ?? 80;

  const stats = useMemo(() => {
    const ws = startOfWeek();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const weekEntries = entries.filter(e => new Date(e.work_date || e.started_at) >= ws);
    const todayEntries = entries.filter(e => new Date(e.work_date || e.started_at) >= today);
    const weekHours = weekEntries.reduce((s, e) => s + entryHours(e), 0);
    const weekBillable = weekEntries.filter(e => e.is_billable).reduce((s, e) => s + entryHours(e), 0);
    const todayHours = todayEntries.reduce((s, e) => s + entryHours(e), 0);
    const billablePct = weekHours ? (weekBillable / weekHours) * 100 : 0;
    return { weekHours, weekBillable, todayHours, billablePct };
  }, [entries]);

  const dailyData = useMemo(() => {
    const days = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (13 - i));
      return d.toISOString().slice(0, 10);
    });
    return days.map(d => {
      const dayEntries = entries.filter(e => (e.work_date || e.started_at.slice(0, 10)) === d);
      return {
        day: new Date(d).toLocaleDateString("es", { day: "numeric", month: "short" }),
        billable: dayEntries.filter(e => e.is_billable).reduce((s, e) => s + entryHours(e), 0),
        nonBillable: dayEntries.filter(e => !e.is_billable).reduce((s, e) => s + entryHours(e), 0),
      };
    });
  }, [entries]);

  const clientBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    const ws = startOfWeek();
    entries.filter(e => new Date(e.work_date || e.started_at) >= ws).forEach(e => {
      const k = e.client_id || "Sin cliente";
      map.set(k, (map.get(k) || 0) + entryHours(e));
    });
    return Array.from(map.entries()).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 5);
  }, [entries]);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI icon={Clock} label="Hoy" value={`${stats.todayHours.toFixed(1)}h`} sub="registradas" color="text-primary" />
        <KPI icon={Calendar} label="Esta semana" value={`${stats.weekHours.toFixed(1)}h`} sub={`Meta ${target}h`} color="text-info" progress={(stats.weekHours / target) * 100} />
        <KPI icon={DollarSign} label="Facturable" value={`${stats.weekBillable.toFixed(1)}h`} sub={`${stats.billablePct.toFixed(0)}% del total`} color="text-success" />
        <Card className="cursor-pointer hover:border-primary/50 transition-colors group" onClick={() => setGoalOpen(true)}>
          <CardContent className="p-3">
            <div className="flex items-center gap-2 mb-1">
              <Target className={`h-4 w-4 ${stats.billablePct >= billableTarget ? "text-success" : "text-warning"}`} />
              <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider flex-1">Meta facturable</span>
              <Settings2 className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <p className="text-xl font-bold">{billableTarget}%</p>
            <p className="text-[10px] text-muted-foreground">{stats.billablePct >= billableTarget ? "✓ Alcanzada" : `Faltan ${(billableTarget - stats.billablePct).toFixed(0)}%`}</p>
            <Progress value={Math.min(100, (stats.billablePct / billableTarget) * 100)} className="h-1 mt-1.5" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4 text-primary" /> Últimas 2 semanas</CardTitle>
            <Button size="sm" className="h-7 text-xs" onClick={() => setDialogOpen(true)}>
              <Plus className="h-3 w-3 mr-1" /> Registrar horas
            </Button>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dailyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} unit="h" />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", fontSize: 11 }} />
                <Bar dataKey="billable" stackId="a" fill="hsl(var(--success))" name="Facturable" radius={[0, 0, 0, 0]} />
                <Bar dataKey="nonBillable" stackId="a" fill="hsl(var(--muted-foreground))" name="No facturable" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Por cliente (semana)</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {clientBreakdown.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">Sin horas registradas esta semana</p>
            ) : clientBreakdown.map(c => {
              const pct = (c.value / Math.max(...clientBreakdown.map(x => x.value))) * 100;
              return (
                <div key={c.name}>
                  <div className="flex items-center justify-between mb-1 text-xs">
                    <span className="truncate font-medium">{c.name}</span>
                    <Badge variant="outline" className="text-[10px] h-4">{c.value.toFixed(1)}h</Badge>
                  </div>
                  <Progress value={pct} className="h-1.5" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        <div className="lg:col-span-1">
          <QuickLogItems />
        </div>
        <div className="lg:col-span-3">
          <TimesheetView />
        </div>
      </div>

      <ManualTimeEntryDialog open={dialogOpen} onOpenChange={setDialogOpen} />
      <TimeGoalDialog open={goalOpen} onOpenChange={setGoalOpen} />
    </div>
  );
}

function KPI({ icon: Icon, label, value, sub, color, progress }: any) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-4 w-4 ${color}`} />
          <span className="text-[10px] uppercase text-muted-foreground font-bold tracking-wider">{label}</span>
        </div>
        <p className="text-xl font-bold">{value}</p>
        <p className="text-[10px] text-muted-foreground">{sub}</p>
        {progress !== undefined && <Progress value={Math.min(100, progress)} className="h-1 mt-1.5" />}
      </CardContent>
    </Card>
  );
}
