import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { TrendingDown, Users, AlertTriangle } from "lucide-react";
import type { ScrumWorkItem, UnifiedSprint } from "@/hooks/useTeamScrum";

interface Props {
  sprint: UnifiedSprint;
  items: ScrumWorkItem[];
}

export function SprintInsightsPanel({ sprint, items }: Props) {
  const totalSP = items.reduce((s, i) => s + (i.story_points || 0), 0);
  const doneSP = items.filter(i => i.scrum_status === "done").reduce((s, i) => s + (i.story_points || 0), 0);

  // Burndown synthetic curve (ideal vs current snapshot)
  const burndown = useMemo(() => {
    if (!sprint.start_date || !sprint.end_date) return null;
    const start = new Date(sprint.start_date).getTime();
    const end = new Date(sprint.end_date).getTime();
    const now = Math.min(end, Math.max(start, Date.now()));
    const totalDays = Math.max(1, Math.round((end - start) / 86400000));
    const elapsed = Math.max(0, Math.round((now - start) / 86400000));
    const points: { x: number; ideal: number; actual: number }[] = [];
    for (let d = 0; d <= totalDays; d++) {
      const ideal = totalSP - (totalSP / totalDays) * d;
      // Linear interpolation of actual: assume completed pts spread over elapsed days
      const actual = d <= elapsed ? totalSP - (doneSP / Math.max(1, elapsed)) * d : totalSP - doneSP;
      points.push({ x: d, ideal: Math.max(0, ideal), actual: Math.max(0, actual) });
    }
    return { points, totalDays, elapsed };
  }, [sprint.start_date, sprint.end_date, totalSP, doneSP]);

  // Capacity per person
  const perPerson = useMemo(() => {
    const map = new Map<string, { total: number; done: number; count: number }>();
    items.forEach(i => {
      const owner = i.owner || "Sin asignar";
      const m = map.get(owner) || { total: 0, done: 0, count: 0 };
      m.total += i.story_points || 0;
      m.count += 1;
      if (i.scrum_status === "done") m.done += i.story_points || 0;
      map.set(owner, m);
    });
    return Array.from(map.entries())
      .map(([owner, v]) => ({ owner, ...v, pct: v.total > 0 ? Math.round((v.done / v.total) * 100) : 0 }))
      .sort((a, b) => b.total - a.total);
  }, [items]);

  const blockedCount = items.filter(i => i.scrum_status === "blocked").length;
  const initials = (n: string) => n.split(" ").map(p => p[0]).slice(0, 2).join("").toUpperCase();

  // Build SVG burndown
  const W = 320, H = 90, P = 6;
  const svgIdeal = burndown
    ? burndown.points.map((p, i) => {
        const x = P + (p.x / burndown.totalDays) * (W - P * 2);
        const y = P + (1 - p.ideal / Math.max(1, totalSP)) * (H - P * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ")
    : "";
  const svgActual = burndown
    ? burndown.points.slice(0, burndown.elapsed + 1).map((p, i) => {
        const x = P + (p.x / burndown.totalDays) * (W - P * 2);
        const y = P + (1 - p.actual / Math.max(1, totalSP)) * (H - P * 2);
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(" ")
    : "";

  // Risk: actual above ideal => behind schedule
  const lastIdeal = burndown ? burndown.points[burndown.elapsed]?.ideal ?? 0 : 0;
  const lastActual = burndown ? burndown.points[burndown.elapsed]?.actual ?? 0 : 0;
  const behind = lastActual > lastIdeal + 1;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
      {/* Burndown */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-info" />
              <span className="text-[11px] font-bold uppercase tracking-wide">Burndown</span>
            </div>
            {burndown && (
              <span className={`text-[10px] font-bold ${behind ? "text-destructive" : "text-success"}`}>
                {behind ? `↑ Atrasado ${Math.round(lastActual - lastIdeal)} SP` : "✓ En camino"}
              </span>
            )}
          </div>
          {burndown ? (
            <>
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-[90px]">
                {/* Grid */}
                <line x1={P} y1={H - P} x2={W - P} y2={H - P} stroke="hsl(var(--border))" strokeWidth="0.5" />
                <line x1={P} y1={P} x2={P} y2={H - P} stroke="hsl(var(--border))" strokeWidth="0.5" />
                {/* Ideal */}
                <path d={svgIdeal} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1" strokeDasharray="3,2" opacity="0.5" />
                {/* Actual */}
                <path d={svgActual} fill="none" stroke={behind ? "hsl(var(--destructive))" : "hsl(var(--success))"} strokeWidth="1.8" />
                {/* Today marker */}
                <line
                  x1={P + (burndown.elapsed / burndown.totalDays) * (W - P * 2)}
                  y1={P}
                  x2={P + (burndown.elapsed / burndown.totalDays) * (W - P * 2)}
                  y2={H - P}
                  stroke="hsl(var(--primary))"
                  strokeWidth="0.8"
                  strokeDasharray="2,2"
                  opacity="0.6"
                />
              </svg>
              <div className="flex items-center justify-between text-[9px] text-muted-foreground mt-1">
                <span>Día {burndown.elapsed} / {burndown.totalDays}</span>
                <span className="flex items-center gap-2">
                  <span className="flex items-center gap-1"><span className="w-2 h-0.5 bg-muted-foreground inline-block" /> Ideal</span>
                  <span className="flex items-center gap-1"><span className={`w-2 h-0.5 inline-block ${behind ? "bg-destructive" : "bg-success"}`} /> Real</span>
                </span>
              </div>
            </>
          ) : (
            <p className="text-[10px] text-muted-foreground italic text-center py-6">Sin fechas — añade inicio/fin para ver burndown</p>
          )}
        </CardContent>
      </Card>

      {/* Capacity per person */}
      <Card>
        <CardContent className="p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-primary" />
              <span className="text-[11px] font-bold uppercase tracking-wide">Carga por persona</span>
            </div>
            {blockedCount > 0 && (
              <span className="text-[10px] font-bold text-destructive flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {blockedCount} bloq.
              </span>
            )}
          </div>
          {perPerson.length === 0 ? (
            <p className="text-[10px] text-muted-foreground italic text-center py-6">Sin items asignados aún</p>
          ) : (
            <div className="space-y-1.5 max-h-[100px] overflow-auto">
              {perPerson.slice(0, 5).map(p => (
                <div key={p.owner} className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-[9px] font-bold flex items-center justify-center border border-primary/20 shrink-0">
                    {initials(p.owner)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between text-[10px] mb-0.5">
                      <span className="font-medium truncate">{p.owner}</span>
                      <span className="text-muted-foreground shrink-0">{p.done}/{p.total} SP · {p.count}</span>
                    </div>
                    <div className="h-1 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full ${p.pct >= 80 ? "bg-success" : p.pct >= 40 ? "bg-info" : "bg-warning"}`}
                        style={{ width: `${p.pct}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))}
              {perPerson.length > 5 && (
                <p className="text-[9px] text-muted-foreground text-center pt-1">+{perPerson.length - 5} más…</p>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
