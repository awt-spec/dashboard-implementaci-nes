import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Trophy, Target, ArrowRight, ArrowLeft, GripVertical, Inbox, Flame, X,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  type ScrumWorkItem, type UnifiedSprint, useUpdateWorkItemScrum,
} from "@/hooks/useTeamScrum";

interface Props {
  /** Items del backlog (sin sprint o con sprint inactivo). */
  backlog: ScrumWorkItem[];
  /** Items que YA están en un sprint activo. */
  sprintItems: ScrumWorkItem[];
  /** Sprints activos para elegir el target. */
  activeSprints: UnifiedSprint[];
}

const SOURCE_STYLES: Record<string, string> = {
  task:   "bg-info/10 text-info border-info/30",
  ticket: "bg-warning/10 text-warning border-warning/30",
};

export function SprintPlanner({ backlog, sprintItems, activeSprints }: Props) {
  const updateScrum = useUpdateWorkItemScrum();
  const [targetSprintId, setTargetSprintId] = useState<string>(activeSprints[0]?.id || "");
  const [draggedItem, setDraggedItem] = useState<ScrumWorkItem | null>(null);
  const [hoverZone, setHoverZone] = useState<"backlog" | "sprint" | null>(null);

  const targetSprint = activeSprints.find(s => s.id === targetSprintId);
  const targetClientId = targetSprint?.client_id;

  // Filtra backlog al cliente del sprint seleccionado (sino, casos de otros clientes no tienen sentido)
  const backlogForTarget = useMemo(() => {
    if (!targetClientId) return backlog;
    return backlog.filter(i => i.client_id === targetClientId);
  }, [backlog, targetClientId]);

  const sprintItemsCurrent = useMemo(
    () => sprintItems.filter(i => i.sprint_id === targetSprintId),
    [sprintItems, targetSprintId]
  );

  const totalSpSprint = sprintItemsCurrent.reduce((s, i) => s + (i.story_points || 0), 0);
  const totalSpBacklog = backlogForTarget.reduce((s, i) => s + (i.story_points || 0), 0);

  // ─── Mutations ──
  const moveToSprint = async (item: ScrumWorkItem) => {
    if (!targetSprintId) return toast.error("Seleccioná un sprint primero");
    try {
      await updateScrum.mutateAsync({
        id: item.id, source: item.source,
        updates: { sprint_id: targetSprintId, scrum_status: "in_sprint" },
      });
      toast.success("Movido al sprint");
    } catch (e: any) {
      toast.error(e.message || "Error moviendo al sprint");
    }
  };

  const removeFromSprint = async (item: ScrumWorkItem) => {
    try {
      await updateScrum.mutateAsync({
        id: item.id, source: item.source,
        updates: { sprint_id: null, scrum_status: "backlog" },
      });
      toast.success("Devuelto al backlog");
    } catch (e: any) {
      toast.error(e.message || "Error devolviendo al backlog");
    }
  };

  // ─── Empty state ──
  if (activeSprints.length === 0) {
    return (
      <Card>
        <CardContent className="py-14 text-center space-y-2">
          <div className="h-14 w-14 rounded-full bg-warning/10 flex items-center justify-center mx-auto">
            <Target className="h-6 w-6 text-warning" />
          </div>
          <p className="text-base font-bold">No hay sprints activos</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            Iniciá un sprint desde "Gestión de sprints" para empezar a planificar.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Selector de sprint target + métricas */}
      <Card className="border-primary/20">
        <CardContent className="p-4 flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Target className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">Sprint destino</p>
              <Select value={targetSprintId} onValueChange={setTargetSprintId}>
                <SelectTrigger className="h-7 w-[260px] text-xs mt-0.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {activeSprints.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-xs">{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-4">
            <Stat label="Backlog disponible" value={backlogForTarget.length} sub={`${totalSpBacklog} SP`} />
            <div className="h-8 w-px bg-border" />
            <Stat label="En el sprint" value={sprintItemsCurrent.length} sub={`${totalSpSprint} SP`} tone="text-primary" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ── BACKLOG ── */}
        <Card
          className={cn(
            "transition-all",
            hoverZone === "backlog" && draggedItem?.sprint_id ? "ring-2 ring-primary/50 border-primary/50" : ""
          )}
          onDragOver={(e) => {
            e.preventDefault();
            if (draggedItem?.sprint_id) setHoverZone("backlog");
          }}
          onDragLeave={() => setHoverZone(null)}
          onDrop={async (e) => {
            e.preventDefault();
            setHoverZone(null);
            if (draggedItem?.sprint_id) await removeFromSprint(draggedItem);
            setDraggedItem(null);
          }}
        >
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Trophy className="h-4 w-4 text-warning" />
              <h3 className="text-sm font-bold">Backlog</h3>
              <Badge variant="outline" className="text-[10px]">{backlogForTarget.length}</Badge>
              <p className="ml-auto text-[10px] text-muted-foreground">
                Arrastrá → al sprint
              </p>
            </div>

            <div className="space-y-1.5 max-h-[560px] overflow-auto pr-1">
              <AnimatePresence>
                {backlogForTarget.map((item) => (
                  <motion.div
                    key={`${item.source}-${item.id}`}
                    layout
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    draggable
                    onDragStart={() => setDraggedItem(item)}
                    onDragEnd={() => { setDraggedItem(null); setHoverZone(null); }}
                    className={cn(
                      "group flex items-center gap-2 p-2 rounded-lg border bg-card hover:border-primary/40 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing",
                      draggedItem?.id === item.id && "opacity-40"
                    )}
                  >
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                    <Badge variant="outline" className={cn(SOURCE_STYLES[item.source], "text-[10px] shrink-0")}>
                      {item.source === "task" ? "T" : "C"}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{item.title}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {item.client_name || "—"} · {item.owner || "sin owner"}
                      </p>
                    </div>
                    <Badge className="bg-warning/15 text-warning border-warning/30 text-[10px] tabular-nums shrink-0">
                      WSJF {item.wsjf || "—"}
                    </Badge>
                    <button
                      onClick={() => moveToSprint(item)}
                      className="h-6 w-6 rounded hover:bg-primary/15 text-muted-foreground hover:text-primary flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      title="Mover al sprint"
                    >
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </motion.div>
                ))}
              </AnimatePresence>
              {backlogForTarget.length === 0 && (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  <Inbox className="h-6 w-6 mx-auto mb-2 opacity-40" />
                  Sin items en backlog para este cliente
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── SPRINT ── */}
        <Card
          className={cn(
            "transition-all",
            hoverZone === "sprint" && draggedItem && !draggedItem.sprint_id ? "ring-2 ring-primary/50 border-primary/50" : ""
          )}
          onDragOver={(e) => {
            e.preventDefault();
            if (draggedItem && !draggedItem.sprint_id) setHoverZone("sprint");
          }}
          onDragLeave={() => setHoverZone(null)}
          onDrop={async (e) => {
            e.preventDefault();
            setHoverZone(null);
            if (draggedItem && !draggedItem.sprint_id) await moveToSprint(draggedItem);
            setDraggedItem(null);
          }}
        >
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center gap-2 mb-2">
              <Flame className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold">{targetSprint?.name || "Sprint"}</h3>
              <Badge variant="outline" className="text-[10px]">{sprintItemsCurrent.length}</Badge>
              <p className="ml-auto text-[10px] text-muted-foreground">
                ← arrastrá al backlog para quitar
              </p>
            </div>

            <div className="space-y-1.5 max-h-[560px] overflow-auto pr-1">
              <AnimatePresence>
                {sprintItemsCurrent.map((item) => (
                  <motion.div
                    key={`${item.source}-${item.id}`}
                    layout
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    draggable
                    onDragStart={() => setDraggedItem(item)}
                    onDragEnd={() => { setDraggedItem(null); setHoverZone(null); }}
                    className={cn(
                      "group flex items-center gap-2 p-2 rounded-lg border bg-card hover:border-primary/40 hover:shadow-sm transition-all cursor-grab active:cursor-grabbing",
                      draggedItem?.id === item.id && "opacity-40"
                    )}
                  >
                    <button
                      onClick={() => removeFromSprint(item)}
                      className="h-6 w-6 rounded hover:bg-destructive/15 text-muted-foreground hover:text-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      title="Devolver al backlog"
                    >
                      <ArrowLeft className="h-3.5 w-3.5" />
                    </button>
                    <Badge variant="outline" className={cn(SOURCE_STYLES[item.source], "text-[10px] shrink-0")}>
                      {item.source === "task" ? "T" : "C"}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{item.title}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {item.owner || "sin owner"} · {item.scrum_status || "in_sprint"}
                      </p>
                    </div>
                    {item.story_points != null && (
                      <Badge variant="outline" className="text-[10px] tabular-nums shrink-0">
                        {item.story_points} SP
                      </Badge>
                    )}
                    <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                  </motion.div>
                ))}
              </AnimatePresence>
              {sprintItemsCurrent.length === 0 && (
                <div className="py-12 text-center text-xs text-muted-foreground border-2 border-dashed border-border rounded-lg">
                  <Target className="h-6 w-6 mx-auto mb-2 opacity-40" />
                  Sprint vacío — arrastrá items del backlog
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value, sub, tone = "text-foreground" }: { label: string; value: number | string; sub?: string; tone?: string }) {
  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className={cn("text-xl font-black tabular-nums leading-tight", tone)}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
