import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Play, Square, Clock, Sparkles } from "lucide-react";
import { useMyQuickItems, type QuickItem } from "./QuickLogItems";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface ActiveTimer {
  entry_id: string;
  item: QuickItem;
  started_at: number;
}

const STORAGE_KEY = "sysde_quick_timer";

export function QuickTimer() {
  const { user } = useAuth();
  const items = useMyQuickItems();
  const [active, setActive] = useState<ActiveTimer | null>(null);
  const [selected, setSelected] = useState<string>("");
  const [elapsed, setElapsed] = useState(0);
  const [category, setCategory] = useState<string>("desarrollo");

  // Restore from sessionStorage
  useEffect(() => {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      try {
        const a = JSON.parse(raw) as ActiveTimer;
        setActive(a);
      } catch {}
    }
  }, []);

  // Tick every second
  useEffect(() => {
    if (!active) return;
    const i = setInterval(() => setElapsed(Math.floor((Date.now() - active.started_at) / 1000)), 1000);
    return () => clearInterval(i);
  }, [active]);

  const start = async () => {
    if (!user || !selected) return toast.error("Elige una tarea primero");
    const item = items.find(it => `${it.source}-${it.id}` === selected);
    if (!item) return;
    const { data, error } = await (supabase.from("work_time_entries" as any).insert([{
      user_id: user.id,
      source: item.source,
      item_id: item.id,
      client_id: item.client_id,
      category,
      is_manual: false,
    }] as any).select("id").single() as any);
    if (error || !data) return toast.error(error?.message || "No se pudo iniciar");
    const a: ActiveTimer = { entry_id: (data as any).id, item, started_at: Date.now() };
    setActive(a);
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(a));
    toast.success(`▶️ Cronómetro iniciado para ${item.title}`);
  };

  const stop = async () => {
    if (!active) return;
    const seconds = Math.floor((Date.now() - active.started_at) / 1000);
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await (supabase.from("work_time_entries" as any)
      .update({
        ended_at: new Date().toISOString(),
        duration_seconds: seconds,
        work_date: today,
      } as any)
      .eq("id", active.entry_id) as any);
    if (error) return toast.error(error.message);
    sessionStorage.removeItem(STORAGE_KEY);
    setActive(null);
    setElapsed(0);
    toast.success(`✓ Registradas ${(seconds / 3600).toFixed(2)}h`);
  };

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  };

  return (
    <Card className={cn(
      "border-l-4 transition-all",
      active ? "border-l-success bg-success/5" : "border-l-primary"
    )}>
      <CardContent className="p-4 space-y-3">
        {active ? (
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
                  <span className="text-[10px] uppercase font-bold tracking-wider text-success">En curso</span>
                  <Badge variant="outline" className="text-[9px] capitalize">{category}</Badge>
                </div>
                <p className="text-sm font-semibold line-clamp-1">{active.item.title}</p>
                {active.item.client_name && <p className="text-[11px] text-muted-foreground">{active.item.client_name}</p>}
              </div>
              <div className="text-right shrink-0">
                <p className="text-3xl font-mono font-bold tabular-nums">{formatTime(elapsed)}</p>
                <p className="text-[10px] text-muted-foreground">≈ {(elapsed / 3600).toFixed(2)}h</p>
              </div>
            </div>
            <Button onClick={stop} size="sm" variant="destructive" className="w-full">
              <Square className="h-3.5 w-3.5 mr-2" /> Detener y guardar
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-2 mb-1">
              <Clock className="h-4 w-4 text-primary" />
              <span className="text-xs font-bold">Cronómetro rápido</span>
              <Sparkles className="h-3 w-3 text-warning ml-auto" />
            </div>
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="¿En qué vas a trabajar?" />
              </SelectTrigger>
              <SelectContent>
                {items.length === 0 ? (
                  <div className="px-2 py-3 text-xs text-muted-foreground">Sin tareas asignadas</div>
                ) : items.map(it => (
                  <SelectItem key={`${it.source}-${it.id}`} value={`${it.source}-${it.id}`}>
                    <span className="truncate">[{it.source === "task" ? "T" : "#"}] {it.title}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="grid grid-cols-2 gap-2">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="desarrollo">💻 Desarrollo</SelectItem>
                  <SelectItem value="soporte">🛠 Soporte</SelectItem>
                  <SelectItem value="reunion">👥 Reunión</SelectItem>
                  <SelectItem value="documentacion">📝 Documentación</SelectItem>
                  <SelectItem value="testing">🧪 Testing</SelectItem>
                  <SelectItem value="consultoria">💡 Consultoría</SelectItem>
                  <SelectItem value="otros">📌 Otros</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={start} size="sm" disabled={!selected}>
                <Play className="h-3.5 w-3.5 mr-1.5" /> Iniciar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
