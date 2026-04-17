import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useAllTimeEntries, entryHours, startOfWeek } from "@/hooks/useTimeTracking";
import { useSysdeTeamMembers } from "@/hooks/useTeamMembers";
import { AlertTriangle, TrendingDown, CheckCircle2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

export function TeamWorkloadDashboard() {
  const { data: entries = [] } = useAllTimeEntries(30);
  const { data: members = [] } = useSysdeTeamMembers();

  const workload = useMemo(() => {
    const ws = startOfWeek();
    const map = new Map<string, number>();
    entries.filter(e => new Date(e.work_date || e.started_at) >= ws).forEach(e => {
      map.set(e.user_id, (map.get(e.user_id) || 0) + entryHours(e));
    });
    return (members as any[])
      .filter(m => m.user_id || m.email)
      .map((m: any) => {
        const hours = map.get(m.user_id) || 0;
        const target = 40;
        const pct = (hours / target) * 100;
        let status: "over" | "healthy" | "under" | "none";
        if (hours > 45) status = "over";
        else if (hours >= 30) status = "healthy";
        else if (hours > 0) status = "under";
        else status = "none";
        return { ...m, hours, pct, status };
      })
      .sort((a, b) => b.hours - a.hours);
  }, [entries, members]);

  const stats = useMemo(() => ({
    over: workload.filter(w => w.status === "over").length,
    healthy: workload.filter(w => w.status === "healthy").length,
    under: workload.filter(w => w.status === "under").length,
    none: workload.filter(w => w.status === "none").length,
  }), [workload]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            <div><p className="text-xl font-bold">{stats.over}</p><p className="text-[10px] uppercase text-muted-foreground">Sobrecargado &gt;45h</p></div>
          </CardContent>
        </Card>
        <Card className="border-success/30 bg-success/5">
          <CardContent className="p-3 flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <div><p className="text-xl font-bold">{stats.healthy}</p><p className="text-[10px] uppercase text-muted-foreground">Saludable 30-45h</p></div>
          </CardContent>
        </Card>
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="p-3 flex items-center gap-3">
            <TrendingDown className="h-5 w-5 text-warning" />
            <div><p className="text-xl font-bold">{stats.under}</p><p className="text-[10px] uppercase text-muted-foreground">Subutilizado &lt;30h</p></div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-3 flex items-center gap-3">
            <Users className="h-5 w-5 text-muted-foreground" />
            <div><p className="text-xl font-bold">{stats.none}</p><p className="text-[10px] uppercase text-muted-foreground">Sin horas</p></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Carga por colaborador (semana actual vs 40h meta)</CardTitle></CardHeader>
        <CardContent className="space-y-2 max-h-[600px] overflow-auto">
          {workload.length === 0 ? (
            <p className="text-xs text-center py-6 text-muted-foreground">Sin datos</p>
          ) : workload.map(m => (
            <div key={m.id} className="flex items-center gap-3 p-2 rounded border border-border/40">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium truncate">{m.name}</p>
                  <Badge variant="outline" className="text-[9px]">{m.role || m.position || "—"}</Badge>
                </div>
                <Progress value={Math.min(100, m.pct)} className={cn("h-2", m.status === "over" && "[&>div]:bg-destructive", m.status === "healthy" && "[&>div]:bg-success", m.status === "under" && "[&>div]:bg-warning", m.status === "none" && "[&>div]:bg-muted-foreground")} />
              </div>
              <div className="text-right w-20">
                <p className="text-sm font-bold font-mono">{m.hours.toFixed(1)}h</p>
                <p className="text-[10px] text-muted-foreground">{m.pct.toFixed(0)}%</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
