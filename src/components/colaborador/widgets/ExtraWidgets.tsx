import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Clock } from "lucide-react";
import type { ScrumWorkItem } from "@/hooks/useTeamScrum";

export function OverdueTasksWidget({ items }: { items: ScrumWorkItem[] }) {
  const today = new Date().toISOString().slice(0, 10);
  const overdue = items
    .filter(i => i.due_date && i.due_date < today && i.scrum_status !== "done")
    .sort((a, b) => (a.due_date || "").localeCompare(b.due_date || ""));

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <AlertTriangle className="h-4 w-4 text-destructive" />
        <h3 className="text-sm font-bold">Vencidas</h3>
        <Badge variant="outline" className="text-[10px]">{overdue.length}</Badge>
      </div>
      <div className="flex-1 overflow-auto space-y-1.5">
        {overdue.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-6">Sin tareas vencidas 🎉</p>
        )}
        {overdue.map(i => {
          const days = Math.floor((Date.now() - new Date(i.due_date!).getTime()) / 86400000);
          return (
            <div key={`${i.source}-${i.id}`} className="p-2 rounded border border-destructive/30 bg-destructive/5 text-xs space-y-1">
              <p className="font-semibold line-clamp-2">{i.title}</p>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1 text-destructive font-bold">
                  <Clock className="h-3 w-3" />{days}d atrás
                </span>
                <span>{i.owner}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TopClientsWidget({ items, clientNames }: { items: ScrumWorkItem[]; clientNames: Record<string, string> }) {
  const counts = new Map<string, number>();
  items.filter(i => i.scrum_status !== "done").forEach(i => {
    counts.set(i.client_id, (counts.get(i.client_id) || 0) + 1);
  });
  const top = Array.from(counts.entries())
    .map(([id, count]) => ({ id, name: clientNames[id] || id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);
  const max = Math.max(1, ...top.map(t => t.count));

  return (
    <div className="p-4 h-full flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-bold">🏢 Top clientes</h3>
        <Badge variant="outline" className="text-[10px]">{top.length}</Badge>
      </div>
      <div className="flex-1 overflow-auto space-y-2">
        {top.length === 0 && <p className="text-xs text-muted-foreground text-center py-6">Sin actividad</p>}
        {top.map(c => (
          <div key={c.id} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium truncate">{c.name}</span>
              <span className="font-bold text-foreground">{c.count}</span>
            </div>
            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${(c.count / max) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PersonalKpiWidget({
  todayMinutes, streakDays, donePoints, totalPoints,
}: { todayMinutes: number; streakDays: number; donePoints: number; totalPoints: number }) {
  const pct = totalPoints > 0 ? Math.round((donePoints / totalPoints) * 100) : 0;
  const hours = (todayMinutes / 60).toFixed(1);
  return (
    <div className="p-4 h-full flex flex-col">
      <h3 className="text-sm font-bold mb-3">📊 Mi KPI personal</h3>
      <div className="grid grid-cols-2 gap-2 flex-1">
        <div className="rounded-lg border border-border/50 p-3 flex flex-col justify-center">
          <p className="text-[10px] uppercase text-muted-foreground">Hoy</p>
          <p className="text-2xl font-bold text-foreground">{hours}<span className="text-sm text-muted-foreground">h</span></p>
        </div>
        <div className="rounded-lg border border-border/50 p-3 flex flex-col justify-center">
          <p className="text-[10px] uppercase text-muted-foreground">Racha</p>
          <p className="text-2xl font-bold text-foreground">{streakDays}<span className="text-sm text-muted-foreground">d</span></p>
        </div>
        <div className="rounded-lg border border-border/50 p-3 flex flex-col justify-center col-span-2">
          <p className="text-[10px] uppercase text-muted-foreground">Sprint</p>
          <p className="text-xl font-bold text-foreground">{donePoints}/{totalPoints} pts <span className="text-xs text-success font-semibold">{pct}%</span></p>
          <div className="h-1.5 rounded-full bg-muted overflow-hidden mt-1">
            <div className="h-full bg-success" style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    </div>
  );
}
