import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Target, Plus, Calendar, Zap, TrendingUp, Layers, ArrowUp, ArrowDown,
  Sparkles, Trophy, Flame, GripVertical, ListChecks, Rocket
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useSprints, useCreateSprint, useUpdateSprint, useUpdateTicketScrum, wsjf, type SupportSprint } from "@/hooks/useScrum";
import { useSupportTickets, type SupportTicket } from "@/hooks/useSupportTickets";

const SCRUM_STATUS_LABELS: Record<string, string> = {
  backlog: "Backlog",
  ready: "Listo",
  in_sprint: "En Sprint",
  in_progress: "En Progreso",
  done: "Hecho",
};

const SCRUM_STATUS_COLORS: Record<string, string> = {
  backlog: "bg-slate-500/15 text-slate-300 border-slate-500/30",
  ready: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  in_sprint: "bg-violet-500/15 text-violet-300 border-violet-500/30",
  in_progress: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  done: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

const SPRINT_STATUS_COLORS: Record<string, string> = {
  planificado: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  activo: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  completado: "bg-slate-500/15 text-slate-300 border-slate-500/30",
};

interface Props {
  clientId: string;
  clientName?: string;
}

export function SupportScrumPanel({ clientId, clientName }: Props) {
  const { data: sprints = [] } = useSprints(clientId);
  const { data: tickets = [], refetch } = useSupportTickets(clientId);
  const createSprint = useCreateSprint();
  const updateSprint = useUpdateSprint();
  const updateScrum = useUpdateTicketScrum();

  const [createSprintOpen, setCreateSprintOpen] = useState(false);
  const [newSprint, setNewSprint] = useState({ name: "", goal: "", start_date: "", end_date: "", capacity_points: 20 });

  const activeSprint = sprints.find(s => s.status === "activo");
  const openTickets = useMemo(
    () => tickets.filter(t => !["CERRADA", "ANULADA"].includes(t.estado)),
    [tickets]
  );

  // Backlog priorizado por WSJF (valor/esfuerzo) si está scoreado, sino por antigüedad
  const prioritizedBacklog = useMemo(() => {
    return [...openTickets]
      .filter(t => !(t as any).sprint_id || (t as any).sprint_id === activeSprint?.id ? false : true)
      .map(t => {
        const value = (t as any).business_value || valueFromPriority(t.prioridad);
        const effort = (t as any).effort || effortFromAge(t.dias_antiguedad);
        return { ...t, _value: value, _effort: effort, _wsjf: wsjf(value, effort) };
      })
      .sort((a, b) => b._wsjf - a._wsjf);
  }, [openTickets, activeSprint]);

  const sprintTickets = useMemo(() => {
    if (!activeSprint) return [];
    return openTickets.filter(t => (t as any).sprint_id === activeSprint.id);
  }, [openTickets, activeSprint]);

  const sprintPoints = sprintTickets.reduce((s, t) => s + ((t as any).story_points || 0), 0);
  const sprintProgress = activeSprint?.capacity_points
    ? Math.min(100, Math.round((sprintPoints / activeSprint.capacity_points) * 100))
    : 0;

  const sprintDoneCount = sprintTickets.filter(t => (t as any).scrum_status === "done").length;

  const handleCreateSprint = () => {
    if (!newSprint.name.trim()) { toast.error("Nombre requerido"); return; }
    createSprint.mutate(
      {
        client_id: clientId,
        name: newSprint.name.trim(),
        goal: newSprint.goal,
        start_date: newSprint.start_date || null,
        end_date: newSprint.end_date || null,
        capacity_points: Number(newSprint.capacity_points) || 0,
        status: "planificado",
      },
      {
        onSuccess: () => {
          toast.success("Sprint creado");
          setCreateSprintOpen(false);
          setNewSprint({ name: "", goal: "", start_date: "", end_date: "", capacity_points: 20 });
        },
        onError: (e: any) => toast.error(e.message),
      }
    );
  };

  const handleAssignToSprint = (ticketId: string, sprintId: string | null) => {
    updateScrum.mutate(
      { id: ticketId, updates: { sprint_id: sprintId, scrum_status: sprintId ? "in_sprint" : "backlog" } },
      { onSuccess: () => { toast.success(sprintId ? "Movido a sprint" : "Devuelto al backlog"); refetch(); } }
    );
  };

  const handleStatusChange = (ticketId: string, status: string) => {
    updateScrum.mutate(
      { id: ticketId, updates: { scrum_status: status as any } },
      { onSuccess: () => refetch() }
    );
  };

  const handleStartSprint = (sprint: SupportSprint) => {
    updateSprint.mutate(
      { id: sprint.id, client_id: clientId, updates: { status: "activo" } },
      { onSuccess: () => toast.success("Sprint iniciado") }
    );
  };

  const handleCompleteSprint = (sprint: SupportSprint) => {
    updateSprint.mutate(
      { id: sprint.id, client_id: clientId, updates: { status: "completado" } },
      { onSuccess: () => toast.success("Sprint completado") }
    );
  };

  return (
    <div className="space-y-4">
      {/* Header / Strategy intro */}
      <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 via-card to-blue-500/5">
        <CardContent className="p-4 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-violet-500/15 flex items-center justify-center shrink-0">
            <Target className="h-6 w-6 text-violet-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold flex items-center gap-2">
              Estrategia & Priorización Scrum
              {clientName && <Badge variant="outline" className="text-[10px]">{clientName}</Badge>}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Backlog priorizado por valor/esfuerzo (WSJF), planificación de sprints y "qué hacer ahora"
            </p>
          </div>
          <Dialog open={createSprintOpen} onOpenChange={setCreateSprintOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Nuevo Sprint</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle className="flex items-center gap-2"><Rocket className="h-4 w-4" /> Crear Sprint</DialogTitle></DialogHeader>
              <div className="space-y-3 py-2">
                <div>
                  <label className="text-xs font-medium">Nombre</label>
                  <Input className="mt-1" value={newSprint.name} onChange={e => setNewSprint(p => ({ ...p, name: e.target.value }))} placeholder="Sprint 12 — Reducción backlog crítico" />
                </div>
                <div>
                  <label className="text-xs font-medium">Objetivo del Sprint</label>
                  <Textarea className="mt-1" rows={2} value={newSprint.goal} onChange={e => setNewSprint(p => ({ ...p, goal: e.target.value }))} placeholder="¿Qué queremos lograr en este sprint?" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-xs font-medium">Inicio</label>
                    <Input type="date" className="mt-1" value={newSprint.start_date} onChange={e => setNewSprint(p => ({ ...p, start_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Fin</label>
                    <Input type="date" className="mt-1" value={newSprint.end_date} onChange={e => setNewSprint(p => ({ ...p, end_date: e.target.value }))} />
                  </div>
                  <div>
                    <label className="text-xs font-medium">Capacidad (pts)</label>
                    <Input type="number" className="mt-1" value={newSprint.capacity_points} onChange={e => setNewSprint(p => ({ ...p, capacity_points: Number(e.target.value) }))} />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateSprintOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreateSprint} disabled={createSprint.isPending}>Crear</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardContent>
      </Card>

      {/* Sprint activo */}
      {activeSprint ? (
        <Card className="border-emerald-500/30">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <Flame className="h-4 w-4 text-emerald-400" />
                <CardTitle className="text-sm">Sprint Activo: {activeSprint.name}</CardTitle>
                <Badge className={SPRINT_STATUS_COLORS[activeSprint.status]}>{activeSprint.status}</Badge>
              </div>
              <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => handleCompleteSprint(activeSprint)}>
                <Trophy className="h-3 w-3" /> Completar
              </Button>
            </div>
            {activeSprint.goal && <p className="text-xs text-muted-foreground mt-1">{activeSprint.goal}</p>}
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-4 gap-3">
              <KPI icon={Layers} label="Casos" value={sprintTickets.length} color="text-blue-400" />
              <KPI icon={Zap} label="Story Points" value={sprintPoints} color="text-violet-400" />
              <KPI icon={TrendingUp} label="Capacidad" value={`${sprintPoints}/${activeSprint.capacity_points}`} color="text-amber-400" />
              <KPI icon={Trophy} label="Hechos" value={`${sprintDoneCount}/${sprintTickets.length}`} color="text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                <span>Carga del sprint</span>
                <span>{sprintProgress}%</span>
              </div>
              <Progress value={sprintProgress} className="h-1.5" />
            </div>

            {sprintTickets.length === 0 ? (
              <p className="text-xs text-muted-foreground italic text-center py-4">Sin casos asignados al sprint. Asígnalos desde el backlog.</p>
            ) : (
              <div className="space-y-1.5">
                {sprintTickets.map(t => (
                  <SprintCaseRow key={t.id} ticket={t} onStatusChange={s => handleStatusChange(t.id, s)} onRemove={() => handleAssignToSprint(t.id, null)} />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed border-border/60">
          <CardContent className="p-6 text-center">
            <Rocket className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm font-medium">Sin sprint activo</p>
            <p className="text-xs text-muted-foreground mt-1">Crea un sprint y arrastra casos desde el backlog priorizado.</p>
            {sprints.filter(s => s.status === "planificado").length > 0 && (
              <div className="mt-3 flex flex-wrap justify-center gap-2">
                {sprints.filter(s => s.status === "planificado").map(s => (
                  <Button key={s.id} size="sm" variant="outline" className="text-xs gap-1" onClick={() => handleStartSprint(s)}>
                    <Rocket className="h-3 w-3" /> Iniciar "{s.name}"
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="backlog">
        <TabsList>
          <TabsTrigger value="backlog" className="gap-1.5"><ListChecks className="h-3.5 w-3.5" /> Backlog Priorizado</TabsTrigger>
          <TabsTrigger value="next" className="gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Qué Hacer Después</TabsTrigger>
          <TabsTrigger value="sprints" className="gap-1.5"><Calendar className="h-3.5 w-3.5" /> Sprints</TabsTrigger>
        </TabsList>

        <TabsContent value="backlog" className="mt-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <ListChecks className="h-4 w-4 text-primary" /> Backlog ordenado por WSJF
                <Badge variant="outline" className="text-[10px] ml-auto">{prioritizedBacklog.length} casos</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {prioritizedBacklog.length === 0 ? (
                <p className="text-xs text-muted-foreground italic text-center py-6">Backlog vacío</p>
              ) : (
                <div className="space-y-1.5 max-h-[500px] overflow-y-auto pr-1">
                  {prioritizedBacklog.map((t, idx) => (
                    <BacklogRow
                      key={t.id}
                      rank={idx + 1}
                      ticket={t}
                      sprints={sprints.filter(s => s.status !== "completado")}
                      onAssign={sprintId => handleAssignToSprint(t.id, sprintId)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="next" className="mt-3 space-y-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" /> Próximos pasos recomendados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {prioritizedBacklog.slice(0, 5).map((t, idx) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card hover:bg-muted/20 transition-colors"
                >
                  <div className="h-7 w-7 rounded-lg bg-amber-500/15 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0">
                    #{idx + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-muted-foreground">{t.ticket_id}</p>
                    <p className="text-sm font-medium leading-tight truncate">{t.asunto}</p>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <Badge variant="outline" className="text-[9px]">Valor {t._value}</Badge>
                      <Badge variant="outline" className="text-[9px]">Esfuerzo {t._effort}</Badge>
                      <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-400">WSJF {t._wsjf}</Badge>
                      <Badge variant="outline" className="text-[9px]">{t.dias_antiguedad}d</Badge>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1.5 italic">
                      → {recommendNextStep(t)}
                    </p>
                  </div>
                  {activeSprint && (
                    <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1 shrink-0" onClick={() => handleAssignToSprint(t.id, activeSprint.id)}>
                      <ArrowUp className="h-3 w-3" /> Sprint
                    </Button>
                  )}
                </motion.div>
              ))}
              {prioritizedBacklog.length === 0 && (
                <p className="text-xs text-muted-foreground italic text-center py-4">Backlog limpio. ¡Excelente trabajo!</p>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sprints" className="mt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {sprints.length === 0 && (
              <p className="col-span-2 text-xs text-muted-foreground italic text-center py-6">Aún no hay sprints. Crea uno para empezar.</p>
            )}
            {sprints.map(s => {
              const tks = openTickets.filter(t => (t as any).sprint_id === s.id);
              const pts = tks.reduce((acc, t) => acc + ((t as any).story_points || 0), 0);
              return (
                <Card key={s.id} className={s.status === "activo" ? "border-emerald-500/40" : ""}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between gap-2">
                      <CardTitle className="text-sm">{s.name}</CardTitle>
                      <Badge className={SPRINT_STATUS_COLORS[s.status]}>{s.status}</Badge>
                    </div>
                    {s.goal && <p className="text-[11px] text-muted-foreground">{s.goal}</p>}
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-muted-foreground">{s.start_date || "—"} → {s.end_date || "—"}</span>
                      <span className="font-mono">{pts}/{s.capacity_points} pts · {tks.length} casos</span>
                    </div>
                    <Progress value={s.capacity_points ? Math.min(100, (pts / s.capacity_points) * 100) : 0} className="h-1" />
                    <div className="flex gap-1.5">
                      {s.status === "planificado" && (
                        <Button size="sm" variant="outline" className="text-[10px] h-7 gap-1" onClick={() => handleStartSprint(s)}>
                          <Rocket className="h-3 w-3" /> Iniciar
                        </Button>
                      )}
                      {s.status === "activo" && (
                        <Button size="sm" variant="outline" className="text-[10px] h-7 gap-1" onClick={() => handleCompleteSprint(s)}>
                          <Trophy className="h-3 w-3" /> Completar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KPI({ icon: Icon, label, value, color }: any) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30 border border-border/40">
      <Icon className={`h-4 w-4 ${color}`} />
      <div>
        <p className="text-sm font-bold leading-none">{value}</p>
        <p className="text-[9px] text-muted-foreground uppercase tracking-wide mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function BacklogRow({ rank, ticket, sprints, onAssign }: { rank: number; ticket: any; sprints: SupportSprint[]; onAssign: (sprintId: string) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="group flex items-center gap-2 p-2 rounded-lg border border-border/40 hover:border-primary/30 hover:bg-muted/20 transition-all"
    >
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
      <div className="h-6 w-6 rounded bg-primary/10 text-primary font-bold text-[10px] flex items-center justify-center shrink-0">{rank}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground">{ticket.ticket_id}</span>
          <Badge variant="outline" className={`text-[9px] h-4 px-1 ${SCRUM_STATUS_COLORS[ticket.scrum_status || "backlog"]}`}>
            {SCRUM_STATUS_LABELS[ticket.scrum_status || "backlog"]}
          </Badge>
        </div>
        <p className="text-xs font-medium truncate">{ticket.asunto}</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Badge variant="outline" className="text-[9px]">V{ticket._value}</Badge>
        <Badge variant="outline" className="text-[9px]">E{ticket._effort}</Badge>
        <Badge variant="outline" className="text-[9px] border-amber-500/40 text-amber-400">{ticket._wsjf}</Badge>
        {sprints.length > 0 && (
          <Select onValueChange={onAssign}>
            <SelectTrigger className="h-7 text-[10px] w-[110px]">
              <SelectValue placeholder="→ Sprint" />
            </SelectTrigger>
            <SelectContent>
              {sprints.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
    </motion.div>
  );
}

function SprintCaseRow({ ticket, onStatusChange, onRemove }: { ticket: any; onStatusChange: (s: string) => void; onRemove: () => void }) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg border border-border/40 bg-muted/10">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-muted-foreground">{ticket.ticket_id}</span>
          {ticket.story_points != null && <Badge variant="outline" className="text-[9px]">{ticket.story_points} pts</Badge>}
        </div>
        <p className="text-xs font-medium truncate">{ticket.asunto}</p>
      </div>
      <Select value={ticket.scrum_status || "in_sprint"} onValueChange={onStatusChange}>
        <SelectTrigger className="h-7 text-[10px] w-[120px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(SCRUM_STATUS_LABELS).map(([k, v]) => (
            <SelectItem key={k} value={k}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" variant="ghost" className="h-7 text-[10px] gap-1" onClick={onRemove}>
        <ArrowDown className="h-3 w-3" /> Backlog
      </Button>
    </div>
  );
}

function valueFromPriority(p: string): number {
  if (p === "Critica, Impacto Negocio") return 10;
  if (p === "Alta") return 7;
  if (p === "Media") return 4;
  return 2;
}

function effortFromAge(days: number): number {
  // heurística: casos viejos suelen ser más complejos
  if (days > 365) return 8;
  if (days > 180) return 6;
  if (days > 90) return 4;
  if (days > 30) return 3;
  return 2;
}

function recommendNextStep(t: SupportTicket): string {
  if (t.estado === "ENTREGADA") return "Coordinar cierre con cliente y validar conformidad";
  if (t.estado === "PENDIENTE") return "Identificar bloqueador y desbloquear con responsable";
  if (t.dias_antiguedad > 365) return "Caso muy antiguo: re-evaluar viabilidad o cerrar";
  if (t.prioridad === "Critica, Impacto Negocio") return "Asignar a sprint actual y resolver con prioridad máxima";
  if (!t.responsable) return "Asignar responsable antes de continuar";
  return "Refinar caso, definir criterios de aceptación y mover a 'Listo'";
}
