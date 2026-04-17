import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
  AreaChart, Area, Legend, LineChart, Line,
} from "recharts";
import { Sparkles, TrendingUp, Loader2, Activity, Target, Zap } from "lucide-react";
import { toast } from "sonner";
import { useAllSprints, useAllScrumWorkItems } from "@/hooks/useTeamScrum";
import { useSprintForecast } from "@/hooks/useSprintCeremonies";

const SCRUM_STATUSES = ["backlog", "ready", "in_progress", "in_sprint", "done"];
const STATUS_COLORS: Record<string, string> = {
  backlog: "hsl(var(--muted-foreground))",
  ready: "hsl(220, 70%, 55%)",
  in_progress: "hsl(var(--info))",
  in_sprint: "hsl(var(--warning))",
  done: "hsl(var(--success))",
};

export function SprintAnalytics() {
  const { data: sprints = [] } = useAllSprints();
  const { data: items = [] } = useAllScrumWorkItems();
  const forecast = useSprintForecast();
  const [forecastResult, setForecastResult] = useState<any>(null);

  // Velocity histórica
  const velocityData = useMemo(() => {
    return sprints
      .filter(s => s.status === "completado" || s.status === "activo")
      .slice(0, 10)
      .reverse()
      .map(s => {
        const sItems = items.filter(i => i.sprint_id === s.id);
        const planned = sItems.reduce((sum, i) => sum + (i.story_points || 0), 0);
        const completed = sItems.filter(i => i.scrum_status === "done").reduce((sum, i) => sum + (i.story_points || 0), 0);
        return { sprint: s.name.slice(0, 14), planned, completed };
      });
  }, [sprints, items]);

  // CFD: cumulative count per status (snapshot actual)
  const cfdData = useMemo(() => {
    // Simulación basada en sprints completados consecutivos
    const completedSprints = sprints
      .filter(s => s.status === "completado" || s.status === "activo")
      .slice(0, 8)
      .reverse();
    return completedSprints.map(s => {
      const sItems = items.filter(i => i.sprint_id === s.id);
      const out: any = { sprint: s.name.slice(0, 12) };
      SCRUM_STATUSES.forEach(st => {
        out[st] = sItems.filter(i => (i.scrum_status || "backlog") === st).length;
      });
      return out;
    });
  }, [sprints, items]);

  // Cycle time: avg days from in_progress → done por miembro
  const throughput = useMemo(() => {
    // proxy: items "done" creados en últimas 8 semanas, agrupados por semana
    const now = Date.now();
    const weeks: Record<string, number> = {};
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now - i * 7 * 86400000);
      const key = `S${d.toISOString().slice(5, 10)}`;
      weeks[key] = 0;
    }
    items.filter(i => i.scrum_status === "done").forEach(i => {
      const d = new Date(i.raw?.updated_at || i.raw?.created_at || now);
      const key = `S${d.toISOString().slice(5, 10)}`;
      if (weeks[key] !== undefined) weeks[key]++;
    });
    return Object.entries(weeks).map(([week, count]) => ({ week, items: count }));
  }, [items]);

  // KPIs
  const avgVelocity = velocityData.length > 0
    ? Math.round(velocityData.reduce((s, v) => s + v.completed, 0) / velocityData.length)
    : 0;
  const totalThroughput = throughput.reduce((s, t) => s + t.items, 0);
  const backlogPoints = items
    .filter(i => !i.sprint_id && i.scrum_status !== "done")
    .reduce((s, i) => s + (i.story_points || 0), 0);
  const predictability = velocityData.length > 0
    ? Math.round(
      velocityData.reduce((s, v) => s + (v.planned > 0 ? v.completed / v.planned : 0), 0) /
      velocityData.length * 100
    )
    : 0;

  const handleForecast = async () => {
    try {
      const res = await forecast.mutateAsync({
        velocity_history: velocityData,
        backlog_points: backlogPoints,
      });
      setForecastResult(res);
      toast.success("Forecast IA generado");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-3">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: "Velocity Promedio", value: `${avgVelocity} SP`, icon: Zap, color: "text-primary" },
          { label: "Predictibilidad", value: `${predictability}%`, icon: Target, color: predictability >= 80 ? "text-success" : predictability >= 50 ? "text-warning" : "text-destructive" },
          { label: "Throughput 8 sem", value: totalThroughput, icon: Activity, color: "text-info" },
          { label: "Backlog pendiente", value: `${backlogPoints} SP`, icon: TrendingUp, color: "text-warning" },
        ].map(k => (
          <Card key={k.label}>
            <CardContent className="p-3 flex items-center gap-3">
              <k.icon className={`h-5 w-5 ${k.color}`} />
              <div>
                <p className="text-base font-bold">{k.value}</p>
                <p className="text-[10px] uppercase text-muted-foreground">{k.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Forecast IA */}
      <Card className="border-primary/30">
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="h-4 w-4 text-primary" />Forecast IA del Backlog</CardTitle>
          <Button size="sm" onClick={handleForecast} disabled={forecast.isPending || velocityData.length === 0}>
            {forecast.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 mr-1" />}
            Predecir fin
          </Button>
        </CardHeader>
        <CardContent>
          {!forecastResult && (
            <p className="text-xs text-muted-foreground text-center py-4">
              Presiona "Predecir fin" para que la IA estime cuándo terminarán el backlog actual ({backlogPoints} SP) basándose en velocity histórica.
            </p>
          )}
          {forecastResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <div className="p-2 rounded bg-primary/5 border border-primary/20">
                  <p className="text-[10px] uppercase text-muted-foreground">Velocity esperada</p>
                  <p className="text-base font-bold text-primary">{forecastResult.avg_velocity} SP</p>
                </div>
                <div className="p-2 rounded bg-info/5 border border-info/20">
                  <p className="text-[10px] uppercase text-muted-foreground">Sprints faltantes</p>
                  <p className="text-base font-bold text-info">{forecastResult.sprints_to_complete}</p>
                </div>
                <div className="p-2 rounded bg-success/5 border border-success/20">
                  <p className="text-[10px] uppercase text-muted-foreground">Fecha estimada</p>
                  <p className="text-sm font-bold text-success">{forecastResult.estimated_end_date}</p>
                </div>
                <div className="p-2 rounded bg-muted/40 border border-border/40">
                  <p className="text-[10px] uppercase text-muted-foreground">Confianza</p>
                  <Badge className={
                    forecastResult.confidence === "alta" ? "bg-success/20 text-success border-success/30" :
                    forecastResult.confidence === "media" ? "bg-warning/20 text-warning border-warning/30" :
                    "bg-destructive/20 text-destructive border-destructive/30"
                  }>{forecastResult.confidence}</Badge>
                </div>
              </div>
              {forecastResult.risk_factors?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase mb-1 text-destructive">⚠ Factores de riesgo</p>
                  <ul className="text-xs space-y-0.5 list-disc list-inside text-muted-foreground">
                    {forecastResult.risk_factors.map((r: string, i: number) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
              {forecastResult.recommendations?.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase mb-1 text-success">→ Recomendaciones</p>
                  <ul className="text-xs space-y-0.5 list-disc list-inside text-muted-foreground">
                    {forecastResult.recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="h-4 w-4" />Velocity Histórica</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={velocityData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="sprint" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="planned" fill="hsl(var(--muted-foreground))" name="Planeados" />
                  <Bar dataKey="completed" fill="hsl(var(--success))" name="Completados" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" />Throughput Semanal</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={throughput}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="items" stroke="hsl(var(--primary))" strokeWidth={2} name="Items completados" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" />Cumulative Flow Diagram (CFD)</CardTitle></CardHeader>
          <CardContent>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={cfdData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="sprint" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  {SCRUM_STATUSES.map(st => (
                    <Area key={st} type="monotone" dataKey={st} stackId="1" stroke={STATUS_COLORS[st]} fill={STATUS_COLORS[st]} fillOpacity={0.6} />
                  ))}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
