import { useState } from "react";
import { type Deliverable, type ClientTask } from "@/data/projectData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { FileText, Package, Settings, GraduationCap, BarChart3, ChevronDown, ChevronUp, Clock, Paperclip, History, Plus, Trash2, Building2, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCreateDeliverable, useDeleteDeliverable, useUpdateDeliverable } from "@/hooks/useClients";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const deliverableStatusConfig = {
  aprobado: { label: "Aprobado", className: "bg-success text-success-foreground" },
  entregado: { label: "Entregado", className: "bg-info text-info-foreground" },
  "en-revision": { label: "En Revisión", className: "bg-warning text-warning-foreground" },
  pendiente: { label: "Pendiente", className: "bg-muted text-muted-foreground" },
};

const deliverableTypeIcons = {
  documento: FileText,
  modulo: Package,
  configuracion: Settings,
  capacitacion: GraduationCap,
  reporte: BarChart3,
};

interface DeliverablesTabProps {
  deliverables: Deliverable[];
  clientId: string;
  tasks?: ClientTask[];
}

export function DeliverablesTab({ deliverables, clientId, tasks = [] }: DeliverablesTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("documento");
  const [newStatus, setNewStatus] = useState("pendiente");
  const [newDueDate, setNewDueDate] = useState("");
  const [newResponsible, setNewResponsible] = useState("sysde");
  const [newTeam, setNewTeam] = useState("");
  const [newLinkedTask, setNewLinkedTask] = useState("");
  const createDeliverable = useCreateDeliverable();
  const deleteDeliverable = useDeleteDeliverable();
  const updateDeliverable = useUpdateDeliverable();

  const handleCreate = () => {
    if (!newName.trim() || !newDueDate) { toast.error("Nombre y fecha son obligatorios"); return; }
    createDeliverable.mutate({
      client_id: clientId,
      original_id: `D-${Date.now()}`,
      name: newName.trim(),
      type: newType,
      status: newStatus,
      due_date: newDueDate,
      version: "1.0",
      responsible_party: newResponsible,
      responsible_team: newResponsible === "sysde" && newTeam.trim() ? newTeam.trim() : undefined,
      linked_task_id: newLinkedTask ? Number(newLinkedTask) : undefined,
    }, {
      onSuccess: () => {
        toast.success("Entregable creado");
        setCreateOpen(false);
        setNewName(""); setNewDueDate(""); setNewTeam(""); setNewLinkedTask("");
      },
      onError: () => toast.error("Error al crear"),
    });
  };

  const handleDelete = async (d: Deliverable) => {
    const { data } = await supabase.from("deliverables").select("id").eq("client_id", clientId).eq("original_id", d.id).single();
    if (!data) return;
    deleteDeliverable.mutate(data.id, {
      onSuccess: () => toast.success("Entregable eliminado"),
      onError: () => toast.error("Error al eliminar"),
    });
  };

  const handleStatusChange = async (d: Deliverable, newSt: string) => {
    const { data } = await supabase.from("deliverables").select("id").eq("client_id", clientId).eq("original_id", d.id).single();
    if (!data) return;
    const updates: Record<string, unknown> = { status: newSt };
    if (newSt === "entregado") updates.delivered_date = new Date().toISOString().slice(0, 10);
    updateDeliverable.mutate({ id: data.id, updates }, {
      onSuccess: () => toast.success("Estado actualizado"),
    });
  };

  // Get linked task info from deliverable (we need to fetch from DB)
  const getLinkedTaskTitle = (linkedId?: number) => {
    if (!linkedId) return null;
    const t = tasks.find(t => t.id === linkedId);
    return t ? `#${t.id} ${t.title}` : `#${linkedId}`;
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Entregables ({deliverables.length})</CardTitle>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 h-7 text-xs"><Plus className="h-3 w-3" /> Nuevo</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Nuevo Entregable</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs font-medium text-foreground">Nombre *</label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-foreground">Tipo</label>
                    <Select value={newType} onValueChange={setNewType}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="documento">Documento</SelectItem>
                        <SelectItem value="modulo">Módulo</SelectItem>
                        <SelectItem value="configuracion">Configuración</SelectItem>
                        <SelectItem value="capacitacion">Capacitación</SelectItem>
                        <SelectItem value="reporte">Reporte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-foreground">Estado</label>
                    <Select value={newStatus} onValueChange={setNewStatus}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pendiente">Pendiente</SelectItem>
                        <SelectItem value="en-revision">En Revisión</SelectItem>
                        <SelectItem value="entregado">Entregado</SelectItem>
                        <SelectItem value="aprobado">Aprobado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground">Fecha límite *</label>
                  <Input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)} className="mt-1" />
                </div>
                {/* Responsible party */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium text-foreground">Responsable</label>
                    <Select value={newResponsible} onValueChange={setNewResponsible}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sysde">SYSDE</SelectItem>
                        <SelectItem value="cliente">Cliente</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {newResponsible === "sysde" && (
                    <div>
                      <label className="text-xs font-medium text-foreground">Equipo</label>
                      <Input value={newTeam} onChange={e => setNewTeam(e.target.value)} className="mt-1" placeholder="Equipo Técnico" />
                    </div>
                  )}
                </div>
                {/* Linked task */}
                {tasks.length > 0 && (
                  <div>
                    <label className="text-xs font-medium text-foreground">Vincular a tarea</label>
                    <Select value={newLinkedTask} onValueChange={setNewLinkedTask}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Sin vincular" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Sin vincular</SelectItem>
                        {tasks.map(t => (
                          <SelectItem key={t.id} value={String(t.id)}>#{t.id} — {t.title.slice(0, 40)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                  <Button onClick={handleCreate}>Crear</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {deliverables.map(d => {
          const Icon = deliverableTypeIcons[d.type];
          const config = deliverableStatusConfig[d.status];
          const isExpanded = expandedId === d.id;
          const hasDetail = !!d.detail;
          const rp = (d as any).responsibleParty as string | undefined;
          const rt = (d as any).responsibleTeam as string | undefined;
          const lt = (d as any).linkedTaskId as number | undefined;

          return (
            <div key={d.id} className="rounded-lg border border-border bg-card hover:bg-secondary/20 transition-colors group">
              <div className="flex items-center justify-between p-3">
                <button
                  onClick={() => hasDetail && setExpandedId(isExpanded ? null : d.id)}
                  className={`flex items-center gap-3 min-w-0 flex-1 text-left ${hasDetail ? "cursor-pointer" : "cursor-default"}`}
                >
                  <div className="h-8 w-8 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{d.name}</p>
                    <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                      <span>v{d.version}</span>
                      <span>•</span>
                      <span>Fecha: {d.dueDate}</span>
                      {d.deliveredDate && <><span>•</span><span>Entregado: {d.deliveredDate}</span></>}
                    </div>
                  </div>
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  {rp && (
                    <Badge variant="outline" className={rp === "sysde" || rp === "cisde" ? "border-primary/30 text-primary" : "border-warning/30 text-warning"}>
                      {rp === "sysde" || rp === "cisde" ? <><Building2 className="h-3 w-3 mr-1" />SYSDE</> : <><Users className="h-3 w-3 mr-1" />Cliente</>}
                    </Badge>
                  )}
                  {lt && (
                    <Badge variant="outline" className="text-[10px]">#{lt}</Badge>
                  )}
                  <Select value={d.status} onValueChange={v => handleStatusChange(d, v)}>
                    <SelectTrigger className="h-6 border-0 bg-transparent p-0 shadow-none w-auto">
                      <Badge className={config.className}>{config.label}</Badge>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(deliverableStatusConfig).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <motion.div whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}>
                    <Button
                      variant="ghost" size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground transition-all"
                      onClick={() => handleDelete(d)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </motion.div>
                  {hasDetail && (isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />)}
                </div>
              </div>
              {/* Extra info row */}
              {(rt || lt) && (
                <div className="px-3 pb-2 flex gap-3 text-[10px] text-muted-foreground">
                  {rt && <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Equipo: {rt}</span>}
                  {lt && <span className="flex items-center gap-1">Tarea: {getLinkedTaskTitle(lt)}</span>}
                </div>
              )}
              <AnimatePresence>
                {isExpanded && d.detail && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 border-t border-border pt-3 space-y-3">
                      <p className="text-xs text-muted-foreground">{d.detail.description}</p>
                      <div className="flex gap-4 text-xs">
                        <span className="flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" /> {d.detail.hoursInvested}h invertidas</span>
                        <span className="flex items-center gap-1 text-muted-foreground"><Paperclip className="h-3 w-3" /> {d.detail.attachments.length} archivos</span>
                      </div>
                      {d.detail.reviewNotes && (
                        <div className="bg-warning/5 border border-warning/20 rounded-lg p-2.5">
                          <p className="text-[10px] font-semibold text-foreground uppercase mb-0.5">Notas de Revisión</p>
                          <p className="text-xs text-muted-foreground">{d.detail.reviewNotes}</p>
                        </div>
                      )}
                      {d.detail.attachments.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-foreground uppercase mb-1.5">Archivos</p>
                          <div className="flex flex-wrap gap-1.5">
                            {d.detail.attachments.map(a => (
                              <span key={a} className="flex items-center gap-1 bg-secondary/50 rounded px-2 py-1 text-[11px] text-foreground">
                                <Paperclip className="h-3 w-3" /> {a}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {d.detail.history.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-foreground uppercase mb-1.5">Historial</p>
                          <div className="space-y-1.5">
                            {d.detail.history.map((h, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs">
                                <History className="h-3 w-3 text-muted-foreground shrink-0" />
                                <span className="text-muted-foreground">{h.date}</span>
                                <span className="text-foreground">{h.action}</span>
                                <span className="text-muted-foreground">— {h.by}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
