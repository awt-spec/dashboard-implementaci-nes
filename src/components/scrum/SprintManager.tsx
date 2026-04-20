import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  Plus, Play, Square, Target, Calendar, Trophy, Trash2, ArrowRight, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  useAllSprints, useCreateUnifiedSprint, useUpdateUnifiedSprint,
  useAllScrumWorkItems, useUpdateWorkItemScrum, type UnifiedSprint, type ScrumWorkItem,
} from "@/hooks/useTeamScrum";
import { useClients } from "@/hooks/useClients";
import { SprintReviewDialog } from "./SprintReviewDialog";
import { SprintRetroDialog } from "./SprintRetroDialog";
import { SprintInsightsPanel } from "./SprintInsightsPanel";

const STATUS_COLORS: Record<string, string> = {
  planificado: "bg-muted text-muted-foreground border-border",
  activo: "bg-success/15 text-success border-success/30",
  completado: "bg-info/15 text-info border-info/30",
  cancelado: "bg-destructive/15 text-destructive border-destructive/30",
};

export function SprintManager() {
  const { data: sprints = [] } = useAllSprints();
  const { data: items = [] } = useAllScrumWorkItems();
  const { data: clients = [] } = useClients();
  const createSprint = useCreateUnifiedSprint();
  const updateSprint = useUpdateUnifiedSprint();
  const updateItem = useUpdateWorkItemScrum();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState<UnifiedSprint | null>(null);
  const [retroOpen, setRetroOpen] = useState<UnifiedSprint | null>(null);
  const [form, setForm] = useState({
    name: "", goal: "", client_id: "", start_date: "", end_date: "", capacity_points: 20,
  });

  const selected = sprints.find(s => s.id === selectedId) || sprints[0];
  const sprintItems = useMemo(
    () => items.filter(i => i.sprint_id === selected?.id),
    [items, selected?.id]
  );
  const backlog = useMemo(
    () => items
      .filter(i => !i.sprint_id && i.scrum_status !== "done")
      .sort((a, b) => b.wsjf - a.wsjf)
      .slice(0, 30),
    [items]
  );

  const plannedPoints = sprintItems.reduce((s, i) => s + (i.story_points || 0), 0);
  const completedPoints = sprintItems
    .filter(i => i.scrum_status === "done")
    .reduce((s, i) => s + (i.story_points || 0), 0);
  const capacity = selected?.capacity_points || 0;
  const capacityPct = capacity > 0 ? Math.min(100, Math.round((plannedPoints / capacity) * 100)) : 0;
  const capacityColor =
    capacityPct > 100 ? "bg-destructive" :
    capacityPct > 90 ? "bg-warning" :
    capacityPct > 60 ? "bg-success" : "bg-info";

  const handleCreate = () => {
    if (!form.name.trim() || !form.client_id) {
      toast.error("Nombre y cliente son obligatorios");
      return;
    }
    createSprint.mutate(form, {
      onSuccess: () => {
        toast.success("Sprint creado");
        setCreateOpen(false);
        setForm({ name: "", goal: "", client_id: "", start_date: "", end_date: "", capacity_points: 20 });
      },
      onError: (e: any) => toast.error(e.message),
    });
  };

  const handleStatusChange = (sprint: UnifiedSprint, newStatus: string) => {
    if (newStatus === "completado" && sprint.status === "activo") {
      // Open review wizard before completing
      setReviewOpen(sprint);
      return;
    }
    updateSprint.mutate({ id: sprint.id, updates: { status: newStatus } }, {
      onSuccess: () => toast.success(`Sprint ${newStatus}`),
    });
  };

  const handlePullToSprint = async (item: ScrumWorkItem) => {
    if (!selected) return;
    try {
      await updateItem.mutateAsync({
        id: item.id,
        source: item.source,
        updates: { sprint_id: selected.id, scrum_status: "in_sprint" },
      });
      toast.success("Item añadido al sprint");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleRemoveFromSprint = async (item: ScrumWorkItem) => {
    try {
      await updateItem.mutateAsync({
        id: item.id,
        source: item.source,
        updates: { sprint_id: null, scrum_status: "backlog" },
      });
      toast.success("Item devuelto al backlog");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleDragStart = (e: React.DragEvent, item: ScrumWorkItem) => {
    e.dataTransfer.setData("application/json", JSON.stringify({ id: item.id, source: item.source }));
  };

  const handleDropOnSprint = (e: React.DragEvent) => {
    e.preventDefault();
    const data = e.dataTransfer.getData("application/json");
    if (!data) return;
    const { id, source } = JSON.parse(data);
    const item = items.find(i => i.id === id && i.source === source);
    if (item) handlePullToSprint(item);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Gestión de Sprints</h3>
          <p className="text-[11px] text-muted-foreground">Planifica, ejecuta y cierra sprints con drag & drop desde el backlog</p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="h-3.5 w-3.5 mr-1" />Nuevo Sprint</Button>
      </div>

      <div className="grid grid-cols-12 gap-3">
        {/* Sidebar: lista de sprints */}
        <Card className="col-span-12 md:col-span-3">
          <CardHeader className="pb-2"><CardTitle className="text-xs">Sprints ({sprints.length})</CardTitle></CardHeader>
          <CardContent className="space-y-1.5 max-h-[600px] overflow-auto px-2">
            {sprints.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-4">Sin sprints aún</p>}
            {sprints.map(s => {
              const isSel = s.id === selected?.id;
              const client = clients.find(c => c.id === s.client_id);
              return (
                <button
                  key={s.id}
                  onClick={() => setSelectedId(s.id)}
                  className={`w-full text-left p-2 rounded border transition ${isSel ? "border-primary bg-primary/10" : "border-border/50 hover:bg-muted/40"}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium truncate">{s.name}</span>
                    <Badge className={`${STATUS_COLORS[s.status] || ""} text-[9px] h-4`}>{s.status}</Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{client?.name || "—"}</p>
                  {s.start_date && (
                    <p className="text-[9px] text-muted-foreground mt-0.5">{s.start_date} → {s.end_date || "?"}</p>
                  )}
                </button>
              );
            })}
          </CardContent>
        </Card>

        {/* Main: detalle del sprint seleccionado */}
        <div className="col-span-12 md:col-span-9 space-y-3">
          {!selected ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              Selecciona o crea un sprint para empezar.
            </CardContent></Card>
          ) : (
            <>
              {/* Sprint header */}
              <Card>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-bold truncate">{selected.name}</h4>
                        <Badge className={`${STATUS_COLORS[selected.status] || ""} text-[10px]`}>{selected.status}</Badge>
                      </div>
                      {selected.goal && <p className="text-xs text-muted-foreground italic">🎯 {selected.goal}</p>}
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                        {selected.start_date && (
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{selected.start_date} → {selected.end_date}</span>
                        )}
                        <span>{sprintItems.length} items</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {selected.status === "planificado" && (
                        <Button size="sm" className="h-7 gap-1" onClick={() => handleStatusChange(selected, "activo")}>
                          <Play className="h-3 w-3" /> Iniciar
                        </Button>
                      )}
                      {selected.status === "activo" && (
                        <>
                          <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setRetroOpen(selected)}>
                            🔄 Retro
                          </Button>
                          <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => handleStatusChange(selected, "completado")}>
                            <Square className="h-3 w-3" /> Cerrar Sprint
                          </Button>
                        </>
                      )}
                      {selected.status === "completado" && (
                        <>
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => setReviewOpen(selected)}>Ver Review</Button>
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => setRetroOpen(selected)}>Ver Retro</Button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Capacity bar */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-medium">Capacidad: {plannedPoints} / {capacity} SP</span>
                      <span className={
                        capacityPct > 100 ? "text-destructive font-bold" :
                        capacityPct > 90 ? "text-warning font-semibold" :
                        "text-muted-foreground"
                      }>
                        {capacityPct}% {capacityPct > 100 && "⚠ sobrecargado"}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className={`h-full ${capacityColor}`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, capacityPct)}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    {selected.status === "activo" && (
                      <div className="flex items-center justify-between text-[10px] pt-1">
                        <span className="text-success">✅ Completado: {completedPoints} SP ({plannedPoints > 0 ? Math.round((completedPoints / plannedPoints) * 100) : 0}%)</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Burndown + Capacity per person */}
              <SprintInsightsPanel sprint={selected} items={sprintItems} />

              {/* Two columns: backlog ↔ sprint items */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {/* Backlog (drag source) */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs flex items-center gap-1.5">
                      <Trophy className="h-3.5 w-3.5 text-warning" />
                      Backlog (top WSJF) — arrastra al sprint →
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 max-h-[500px] overflow-auto">
                    {backlog.length === 0 && <p className="text-[11px] text-muted-foreground text-center py-4">Backlog vacío</p>}
                    {backlog.map(item => (
                      <div
                        key={`${item.source}-${item.id}`}
                        draggable
                        onDragStart={(e) => handleDragStart(e, item)}
                        className="p-2 rounded border border-border/40 hover:border-primary/40 hover:bg-muted/30 cursor-grab active:cursor-grabbing text-xs space-y-1"
                      >
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className={`text-[9px] h-4 ${item.source === "task" ? "text-info border-info/30" : "text-warning border-warning/30"}`}>
                            {item.source === "task" ? "T" : "C"}
                          </Badge>
                          <span className="font-medium truncate flex-1">{item.title}</span>
                          <Badge variant="outline" className="text-[9px] h-4">WSJF {item.wsjf || "—"}</Badge>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span className="truncate">{item.client_name} · {item.owner}</span>
                          <Button
                            size="sm" variant="ghost" className="h-5 px-1.5 text-[10px]"
                            onClick={() => handlePullToSprint(item)}
                            disabled={!selected || selected.status === "completado"}
                          >
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                {/* Sprint items (drop target) */}
                <Card
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDropOnSprint}
                  className="border-dashed border-2 border-primary/20"
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs flex items-center gap-1.5">
                      <Target className="h-3.5 w-3.5 text-primary" />
                      Items del Sprint ({sprintItems.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1 max-h-[500px] overflow-auto">
                    {sprintItems.length === 0 && (
                      <div className="py-8 text-center text-xs text-muted-foreground">
                        Arrastra items aquí desde el backlog ←
                      </div>
                    )}
                    <AnimatePresence>
                      {sprintItems.map(item => (
                        <motion.div
                          key={`${item.source}-${item.id}`}
                          initial={{ opacity: 0, y: -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="p-2 rounded border border-border/40 bg-muted/20 text-xs space-y-1"
                        >
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={`text-[9px] h-4 ${item.scrum_status === "done" ? "bg-success/15 text-success border-success/30" : ""}`}>
                              {item.scrum_status || "backlog"}
                            </Badge>
                            <span className="font-medium truncate flex-1">{item.title}</span>
                            {item.story_points && <Badge variant="outline" className="text-[9px] h-4">SP {item.story_points}</Badge>}
                          </div>
                          <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                            <span className="truncate">{item.owner}</span>
                            <Button
                              size="sm" variant="ghost" className="h-5 px-1.5 text-destructive hover:text-destructive"
                              onClick={() => handleRemoveFromSprint(item)}
                              disabled={selected?.status === "completado"}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo Sprint</DialogTitle>
            <DialogDescription>Define el alcance y duración del próximo sprint del equipo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium">Nombre *</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Sprint 12 — Octubre" />
            </div>
            <div>
              <label className="text-xs font-medium">Cliente *</label>
              <Select value={form.client_id} onValueChange={v => setForm(f => ({ ...f, client_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Selecciona cliente" /></SelectTrigger>
                <SelectContent>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium">Objetivo</label>
              <Textarea rows={2} value={form.goal} onChange={e => setForm(f => ({ ...f, goal: e.target.value }))} placeholder="Entregar el módulo de pagos y reducir deuda técnica…" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs font-medium">Inicio</label>
                <Input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium">Fin</label>
                <Input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))} />
              </div>
              <div>
                <label className="text-xs font-medium">Capacidad (SP)</label>
                <Input type="number" value={form.capacity_points} onChange={e => setForm(f => ({ ...f, capacity_points: parseInt(e.target.value) || 0 }))} />
              </div>
            </div>
            <Button onClick={handleCreate} disabled={createSprint.isPending} className="w-full">
              {createSprint.isPending ? "Creando..." : "Crear Sprint"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {reviewOpen && (
        <SprintReviewDialog
          sprint={reviewOpen}
          items={items.filter(i => i.sprint_id === reviewOpen.id)}
          open={!!reviewOpen}
          onOpenChange={(v) => !v && setReviewOpen(null)}
          onComplete={() => {
            updateSprint.mutate({ id: reviewOpen.id, updates: { status: "completado" } });
            setReviewOpen(null);
            setRetroOpen(reviewOpen);
          }}
        />
      )}

      {retroOpen && (
        <SprintRetroDialog
          sprint={retroOpen}
          open={!!retroOpen}
          onOpenChange={(v) => !v && setRetroOpen(null)}
        />
      )}
    </div>
  );
}
