import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMyTimeEntries, entryHours } from "@/hooks/useTimeTracking";
import { ManualTimeEntryDialog } from "./ManualTimeEntryDialog";
import { cn } from "@/lib/utils";

const HOURS = Array.from({ length: 13 }, (_, i) => i + 7); // 7am - 7pm

const CATEGORY_COLORS: Record<string, string> = {
  desarrollo: "bg-blue-500/30 border-l-blue-500",
  soporte: "bg-amber-500/30 border-l-amber-500",
  reunion: "bg-purple-500/30 border-l-purple-500",
  documentacion: "bg-emerald-500/30 border-l-emerald-500",
  testing: "bg-pink-500/30 border-l-pink-500",
  consultoria: "bg-cyan-500/30 border-l-cyan-500",
  otros: "bg-slate-400/30 border-l-slate-400",
};

export function DailyCalendarView() {
  const [date, setDate] = useState(new Date());
  const [open, setOpen] = useState(false);
  const { data: entries = [] } = useMyTimeEntries(60);

  const dayEntries = useMemo(() => {
    const k = date.toISOString().slice(0, 10);
    return entries.filter(e => (e.work_date || e.started_at.slice(0, 10)) === k);
  }, [entries, date]);

  const total = dayEntries.reduce((s, e) => s + entryHours(e), 0);
  const billable = dayEntries.filter(e => e.is_billable).reduce((s, e) => s + entryHours(e), 0);

  // Place entries on the timeline by started_at hour
  const entriesByHour = useMemo(() => {
    const map = new Map<number, typeof dayEntries>();
    dayEntries.forEach(e => {
      const h = new Date(e.started_at).getHours();
      const slot = Math.max(7, Math.min(19, h));
      if (!map.has(slot)) map.set(slot, []);
      map.get(slot)!.push(e);
    });
    return map;
  }, [dayEntries]);

  const isToday = date.toDateString() === new Date().toDateString();
  const dateLabel = date.toLocaleDateString("es", { weekday: "long", day: "2-digit", month: "long" });

  return (
    <>
      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0 pb-3">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { const d = new Date(date); d.setDate(d.getDate() - 1); setDate(d); }}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-sm capitalize">{dateLabel}</CardTitle>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { const d = new Date(date); d.setDate(d.getDate() + 1); setDate(d); }}>
              <ChevronRight className="h-4 w-4" />
            </Button>
            {!isToday && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setDate(new Date())}>Hoy</Button>}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">{total.toFixed(1)}h</Badge>
            <Badge className="text-xs bg-success/15 text-success border-success/30">{billable.toFixed(1)}h facturable</Badge>
            <Button size="sm" className="h-7 text-xs" onClick={() => setOpen(true)}>
              <Plus className="h-3 w-3 mr-1" /> Registrar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="border rounded-lg overflow-hidden">
            {HOURS.map(h => {
              const entries = entriesByHour.get(h) || [];
              return (
                <div key={h} className="flex border-b last:border-b-0 min-h-[44px]">
                  <div className="w-16 shrink-0 px-2 py-1.5 text-[11px] font-mono text-muted-foreground border-r bg-muted/20">
                    {String(h).padStart(2, "0")}:00
                  </div>
                  <div className="flex-1 p-1.5 space-y-1">
                    {entries.length === 0 ? (
                      <div className="h-8 rounded border border-dashed border-border/40" />
                    ) : entries.map(e => {
                      const cat = (e as any).category || "otros";
                      const colors = CATEGORY_COLORS[cat] || CATEGORY_COLORS.otros;
                      return (
                        <div key={e.id} className={cn("rounded p-1.5 border-l-4 text-xs", colors)}>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold">{entryHours(e).toFixed(1)}h</span>
                            <Badge variant="outline" className="text-[9px] h-4 capitalize">{cat}</Badge>
                            {e.is_billable && <Badge className="text-[9px] h-4 bg-success/20 text-success border-success/30">Fact.</Badge>}
                            {e.is_locked && <Badge variant="outline" className="text-[9px] h-4">🔒</Badge>}
                          </div>
                          {e.description && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{e.description}</p>}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
          {dayEntries.length === 0 && (
            <p className="text-xs text-center py-4 text-muted-foreground">Sin registros este día</p>
          )}
        </CardContent>
      </Card>
      <ManualTimeEntryDialog open={open} onOpenChange={setOpen} />
    </>
  );
}
