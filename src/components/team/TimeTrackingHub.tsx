import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, Calendar as CalIcon, LayoutGrid, Wand2, Target, TrendingUp, Award } from "lucide-react";
import { QuickTimer } from "./QuickTimer";
import { AITimeCapture } from "./AITimeCapture";
import { DailyCalendarView } from "./DailyCalendarView";
import { TimesheetView } from "./TimesheetView";
import { QuickLogItems } from "./QuickLogItems";
import { useMyTimeEntries, useMyTimeGoal, entryHours, startOfWeek } from "@/hooks/useTimeTracking";

export function TimeTrackingHub() {
  const { data: entries = [] } = useMyTimeEntries(60);
  const { data: goal } = useMyTimeGoal();

  const stats = useMemo(() => {
    const ws = startOfWeek();
    const todayKey = new Date().toISOString().slice(0, 10);
    const weekEntries = entries.filter(e => new Date(e.work_date || e.started_at) >= ws);
    const todayEntries = entries.filter(e => (e.work_date || e.started_at.slice(0, 10)) === todayKey);

    const weekTotal = weekEntries.reduce((s, e) => s + entryHours(e), 0);
    const weekBillable = weekEntries.filter(e => e.is_billable).reduce((s, e) => s + entryHours(e), 0);
    const todayTotal = todayEntries.reduce((s, e) => s + entryHours(e), 0);

    const target = goal?.weekly_target_hours ?? 40;
    const billPctTarget = goal?.billable_target_pct ?? 80;
    const weekProgress = Math.min(100, (weekTotal / target) * 100);
    const billPct = weekTotal > 0 ? (weekBillable / weekTotal) * 100 : 0;

    // streak: días consecutivos hasta hoy con al menos 1 registro
    let streak = 0;
    for (let i = 0; i < 30; i++) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = d.toISOString().slice(0, 10);
      if (entries.some(e => (e.work_date || e.started_at.slice(0, 10)) === k)) streak++;
      else if (i > 0) break;
    }

    return { weekTotal, weekBillable, todayTotal, target, billPctTarget, weekProgress, billPct, streak };
  }, [entries, goal]);

  return (
    <div className="space-y-4">
      {/* KPIs hero */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiHero
          icon={Clock}
          label="Hoy"
          value={`${stats.todayTotal.toFixed(1)}h`}
          color="text-primary"
          gradient="from-primary/15 to-primary/5"
        />
        <KpiHero
          icon={Target}
          label="Esta semana"
          value={`${stats.weekTotal.toFixed(1)}h`}
          sub={`${stats.target}h meta`}
          progress={stats.weekProgress}
          color="text-info"
          gradient="from-info/15 to-info/5"
        />
        <KpiHero
          icon={TrendingUp}
          label="Facturable"
          value={`${stats.billPct.toFixed(0)}%`}
          sub={`${stats.billPctTarget}% meta`}
          progress={Math.min(100, (stats.billPct / stats.billPctTarget) * 100)}
          color="text-success"
          gradient="from-success/15 to-success/5"
        />
        <KpiHero
          icon={Award}
          label="Racha"
          value={`${stats.streak}d`}
          sub="consecutivos"
          color="text-warning"
          gradient="from-warning/15 to-warning/5"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-4">
        <Tabs defaultValue="timer" className="space-y-3">
          <TabsList className="bg-muted/50 p-1 h-auto">
            <TabsTrigger value="timer" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-3 text-xs">
              <Clock className="h-3.5 w-3.5" /> Cronómetro
            </TabsTrigger>
            <TabsTrigger value="week" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-3 text-xs">
              <LayoutGrid className="h-3.5 w-3.5" /> Semana
            </TabsTrigger>
            <TabsTrigger value="day" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-3 text-xs">
              <CalIcon className="h-3.5 w-3.5" /> Día
            </TabsTrigger>
            <TabsTrigger value="ai" className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 px-3 text-xs">
              <Wand2 className="h-3.5 w-3.5" /> IA
              <Badge className="ml-1 text-[8px] h-3.5 px-1 bg-primary/20 text-primary-foreground border-0">Beta</Badge>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="timer" className="space-y-3 mt-0">
            <QuickTimer />
            <DailyCalendarView />
          </TabsContent>

          <TabsContent value="week" className="mt-0">
            <TimesheetView />
          </TabsContent>

          <TabsContent value="day" className="mt-0">
            <DailyCalendarView />
          </TabsContent>

          <TabsContent value="ai" className="space-y-3 mt-0">
            <AITimeCapture />
            <Card>
              <CardContent className="p-4 text-xs text-muted-foreground space-y-2">
                <p className="font-semibold text-foreground">💡 Cómo funciona</p>
                <p>Escribe en lenguaje natural lo que hiciste. La IA identifica automáticamente:</p>
                <ul className="space-y-1 ml-4 list-disc">
                  <li>El cliente y la tarea/ticket relacionado</li>
                  <li>La fecha (hoy, ayer, lunes...)</li>
                  <li>Las horas trabajadas</li>
                  <li>Si es facturable y la categoría</li>
                </ul>
                <p className="pt-1">Después puedes confirmar o ajustar antes de guardar.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="space-y-3">
          <QuickLogItems />
        </div>
      </div>
    </div>
  );
}

function KpiHero({ icon: Icon, label, value, sub, progress, color, gradient }: any) {
  return (
    <Card className={`relative overflow-hidden bg-gradient-to-br ${gradient}`}>
      <CardContent className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <Icon className={`h-3.5 w-3.5 ${color}`} />
          <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">{label}</span>
        </div>
        <p className="text-2xl font-bold tabular-nums">{value}</p>
        {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
        {progress !== undefined && <Progress value={progress} className="h-1 mt-2" />}
      </CardContent>
    </Card>
  );
}
