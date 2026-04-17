import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useMyTimeEntries, useCreateManualEntry, startOfWeek, entryHours } from "@/hooks/useTimeTracking";
import { ChevronLeft, ChevronRight, Plus, Loader2, CheckCircle2, AlertCircle, Sparkles } from "lucide-react";
import { ManualTimeEntryDialog } from "./ManualTimeEntryDialog";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { QuickItem } from "./QuickLogItems";

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export function TimesheetView() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dragOverDay, setDragOverDay] = useState<string | null>(null);
  const [dropContext, setDropContext] = useState<{ day: string; item: QuickItem } | null>(null);
  const [dropHours, setDropHours] = useState("1");
  const [dropDesc, setDropDesc] = useState("");
  const [dropBillable, setDropBillable] = useState(true);
  const { data: entries = [], isLoading } = useMyTimeEntries(60);
  const create = useCreateManualEntry();

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

  const handleDragOver = (e: React.DragEvent, key: string) => {
    if (!e.dataTransfer.types.includes("application/x-quick-item")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragOverDay(key);
  };

  const handleDrop = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    setDragOverDay(null);
    const raw = e.dataTransfer.getData("application/x-quick-item");
    if (!raw) return;
    try {
      const item: QuickItem = JSON.parse(raw);
      setDropContext({ day: key, item });
      setDropHours("1");
      setDropDesc("");
      setDropBillable(true);
    } catch {}
  };

  const confirmDrop = async () => {
    if (!dropContext) return;
    const h = parseFloat(dropHours);
    if (!h || h <= 0 || h > 24) return toast.error("Horas inválidas (0-24)");
    try {
      await create.mutateAsync({
        source: dropContext.item.source,
        item_id: dropContext.item.id,
        client_id: dropContext.item.client_id,
        work_date: dropContext.day,
        hours: h,
        description: dropDesc || dropContext.item.title,
        is_billable: dropBillable,
      });
      toast.success(`✓ ${h}h registradas en ${new Date(dropContext.day).toLocaleDateString("es", { weekday: "short", day: "2-digit", month: "short" })}`);
      setDropContext(null);
    } catch (e: any) { toast.error(e.message); }
  };

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
        <div className="mb-2 flex items-center gap-2 text-[11px] text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" />
          <span>Tip: arrastra una tarea desde "Mis pendientes" a un día para registrar horas rápido.</span>
        </div>
        {isLoading ? (
          <div className="py-12 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <div className="grid grid-cols-7 gap-1.5">
            {weekDays.map((d, i) => {
              const key = dayKey(d);
              const list = grouped[key] || [];
              const t = totals[i];
              const isToday = key === dayKey(new Date());
              const target = 8;
              const pct = Math.min(100, (t.total / target) * 100);
              const isOver = dragOverDay === key;
              return (
                <Popover key={key} open={dropContext?.day === key} onOpenChange={(o) => !o && setDropContext(null)}>
                  <PopoverTrigger asChild>
                    <div
                      onDragOver={e => handleDragOver(e, key)}
                      onDragLeave={() => setDragOverDay(null)}
                      onDrop={e => handleDrop(e, key)}
                      className={cn(
                        "rounded-lg border p-2 min-h-[160px] flex flex-col transition-all",
                        isToday ? "border-primary bg-primary/5" : "border-border bg-muted/20",
                        isOver && "ring-2 ring-primary border-transparent scale-[1.03] bg-primary/10 shadow-lg"
                      )}
                    >
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
                          <p className="text-[10px] text-muted-foreground/50 text-center pt-4 italic">
                            {isOver ? "✨ Soltar aquí" : "—"}
                          </p>
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
                  </PopoverTrigger>
                  <PopoverContent className="w-72" align="center">
                    {dropContext && (
                      <div className="space-y-3">
                        <div>
                          <p className="text-xs text-muted-foreground">Registrar en {new Date(dropContext.day).toLocaleDateString("es", { weekday: "long", day: "2-digit", month: "short" })}</p>
                          <p className="text-sm font-semibold line-clamp-2">{dropContext.item.title}</p>
                        </div>
                        <div>
                          <Label className="text-xs">Horas</Label>
                          <Input type="number" step="0.25" min="0.25" max="24" value={dropHours} onChange={e => setDropHours(e.target.value)} className="h-8" autoFocus />
                          <div className="flex gap-1 mt-1">
                            {[0.5, 1, 2, 4, 8].map(v => (
                              <Button key={v} size="sm" variant="outline" className="h-6 text-[10px] flex-1" onClick={() => setDropHours(String(v))}>{v}h</Button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <Label className="text-xs">Nota (opcional)</Label>
                          <Input value={dropDesc} onChange={e => setDropDesc(e.target.value)} placeholder="Qué hiciste..." className="h-8" />
                        </div>
                        <div className="flex items-center justify-between">
                          <Label className="text-xs">Facturable</Label>
                          <Switch checked={dropBillable} onCheckedChange={setDropBillable} />
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" className="flex-1" onClick={() => setDropContext(null)}>Cancelar</Button>
                          <Button size="sm" className="flex-1" onClick={confirmDrop} disabled={create.isPending}>
                            {create.isPending ? "..." : "Registrar"}
                          </Button>
                        </div>
                      </div>
                    )}
                  </PopoverContent>
                </Popover>
              );
            })}
          </div>
        )}
      </CardContent>
      <ManualTimeEntryDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </Card>
  );
}
