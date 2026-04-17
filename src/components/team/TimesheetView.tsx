import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useMyTimeEntries, startOfWeek, entryHours } from "@/hooks/useTimeTracking";
import { ChevronLeft, ChevronRight, Plus, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { ManualTimeEntryDialog } from "./ManualTimeEntryDialog";
import { cn } from "@/lib/utils";

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function TimesheetView() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { data: entries = [], isLoading } = useMyTimeEntries(60);

  const weekStart = useMemo(() => {
    const d = startOfWeek();
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }, [weekOffset]);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  }), [weekStart]);

  const dayKey = (d: Date) => d.toISOString().slice(0, 10);

  const grouped = useMemo(() => {
    const map: Record<string, typeof entries> = {};
    weekDays.forEach(d => { map[dayKey(d)] = []; });
    entries.forEach(e => {
      const k = e.work_date || e.started_at.slice(0, 10);
      if (map[k]) map[k].push(e);
    });
    return map;
  }, [entries, weekDays]);

  const totals = useMemo(() => weekDays.map(d => {
    const list = grouped[dayKey(d)] || [];
    const total = list.reduce((s, e) => s + entryHours(e), 0);
    const billable = list.filter(e => e.is_billable).reduce((s, e) => s + entryHours(e), 0);
    return { total, billable };
  }), [weekDays, grouped]);

  const weekTotal = totals.reduce((s, t) => s + t.total, 0);
  const weekBillable = totals.reduce((s, t) => s + t.billable, 0);

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekOffset(w => w - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <CardTitle className="text-sm">
            Semana del {weekStart.toLocaleDateString("es", { day: "2-digit", month: "short" })}
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setWeekOffset(w => w + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          {weekOffset !== 0 && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setWeekOffset(0)}>Hoy</Button>}
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs">{weekTotal.toFixed(1)}h total</Badge>
          <Badge className="text-xs bg-success/15 text-success border-success/30">{weekBillable.toFixed(1)}h facturable</Badge>
          <Button size="sm" className="h-7 text-xs" onClick={() => setDialogOpen(true)}>
            <Plus className="h-3 w-3 mr-1" /> Registrar
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {weekDays.map((d, i) => {
              const list = grouped[dayKey(d)] || [];
              const t = totals[i];
              const isToday = dayKey(d) === dayKey(new Date());
              const target = 8;
              const pct = Math.min(100, (t.total / target) * 100);
              return (
                <div key={dayKey(d)} className={cn("rounded-lg border p-2 min-h-[160px] flex flex-col", isToday ? "border-primary bg-primary/5" : "border-border bg-muted/20")}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div>
                      <p className="text-[10px] font-bold uppercase text-muted-foreground">{DAYS[i]}</p>
                      <p className="text-sm font-bold">{d.getDate()}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px] h-5">{t.total.toFixed(1)}h</Badge>
                  </div>
                  <div className="h-1 rounded-full bg-muted overflow-hidden mb-2">
                    <div className={cn("h-full transition-all", t.total >= target ? "bg-success" : t.total >= target * 0.7 ? "bg-warning" : "bg-primary")} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="space-y-1 flex-1 overflow-y-auto">
                    {list.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground/50 text-center pt-4 italic">—</p>
                    ) : list.map(e => (
                      <div key={e.id} className="text-[10px] p-1.5 rounded bg-background border border-border/50">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono font-bold">{entryHours(e).toFixed(1)}h</span>
                          {e.is_billable ? <CheckCircle2 className="h-2.5 w-2.5 text-success" /> : <AlertCircle className="h-2.5 w-2.5 text-muted-foreground" />}
                        </div>
                        {e.description && <p className="truncate text-muted-foreground mt-0.5">{e.description}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
      <ManualTimeEntryDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </Card>
  );
}
