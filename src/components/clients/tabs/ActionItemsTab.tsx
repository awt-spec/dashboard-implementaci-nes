import { useState } from "react";
import { type ActionItem, type ClientTask } from "@/data/projectData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CheckCircle2, Circle, AlertTriangle, User, Calendar, Link2, Plus, Trash2, Building2, Users } from "lucide-react";
import { useCreateActionItem, useDeleteActionItem, useUpdateActionItem } from "@/hooks/useClients";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";

const statusConfig = {
  pendiente: { label: "Pendiente", icon: Circle, className: "bg-warning text-warning-foreground" },
  completado: { label: "Completado", icon: CheckCircle2, className: "bg-success text-success-foreground" },
  vencido: { label: "Vencido", icon: AlertTriangle, className: "bg-destructive text-destructive-foreground" },
};

const priorityColors = {
  alta: "bg-destructive/10 text-destructive border-destructive/20",
  media: "bg-warning/10 text-warning border-warning/20",
  baja: "bg-muted text-muted-foreground border-border",
};

interface ActionItemsTabProps {
  actionItems: ActionItem[];
  clientId: string;
  tasks?: ClientTask[];
}

export function ActionItemsTab({ actionItems, clientId, tasks = [] }: ActionItemsTabProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [assignee, setAssignee] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priority, setPriority] = useState("media");
  const [source, setSource] = useState("");
  const [responsible, setResponsible] = useState("sysde");
  const [team, setTeam] = useState("");
  const [linkedTask, setLinkedTask] = useState("");

  const createItem = useCreateActionItem();
  const deleteItem = useDeleteActionItem();
  const updateItem = useUpdateActionItem();

  const pending = actionItems.filter(a => a.status === "pendiente").length;
  const overdue = actionItems.filter(a => a.status === "vencido").length;

  const handleCreate = () => {
    if (!title.trim() || !assignee.trim() || !dueDate) { toast.error("Campos obligatorios incompletos"); return; }
    createItem.mutate({
      client_id: clientId, original_id: `AI-${Date.now()}`, title: title.trim(),
      assignee: assignee.trim(), due_date: dueDate, status: "pendiente", source: source.trim() || "Manual", priority,
      responsible_party: responsible,
      responsible_team: responsible === "sysde" && team.trim() ? team.trim() : undefined,
      linked_task_id: linkedTask ? Number(linkedTask) : undefined,
    }, {
      onSuccess: () => {
        toast.success("Pendiente creado");
        setCreateOpen(false);
        setTitle(""); setAssignee(""); setDueDate(""); setSource(""); setTeam(""); setLinkedTask("");
      },
      onError: () => toast.error("Error al crear"),
    });
  };

  const handleDelete = async (item: ActionItem) => {
    const { data } = await supabase.from("action_items").select("id").eq("client_id", clientId).eq("original_id", item.id).single();
    if (!data) return;
    deleteItem.mutate(data.id, { onSuccess: () => toast.success("Eliminado"), onError: () => toast.error("Error") });
  };

  const handleStatusChange = async (item: ActionItem, newStatus: string) => {
    const { data } = await supabase.from("action_items").select("id").eq("client_id", clientId).eq("original_id", item.id).single();
    if (!data) return;
    updateItem.mutate({ id: data.id, updates: { status: newStatus } }, { onSuccess: () => toast.success("Actualizado") });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Pendientes ({actionItems.length})</CardTitle>
          <div className="flex gap-2 items-center">
            {overdue > 0 && <Badge className="bg-destructive text-destructive-foreground">{overdue} vencidos</Badge>}
            {pending > 0 && <Badge className="bg-warning text-warning-foreground">{pending} pendientes</Badge>}
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5 h-7 text-xs"><Plus className="h-3 w-3" /> Nuevo</Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader><DialogTitle>Nuevo Pendiente</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <div><label className="text-xs font-medium text-foreground">Título *</label><Input value={title} onChange={e => setTitle(e.target.value)} className="mt-1" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs font-medium text-foreground">Responsable *</label><Input value={assignee} onChange={e => setAssignee(e.target.value)} className="mt-1" /></div>
                    <div><label className="text-xs font-medium text-foreground">Prioridad</label>
                      <Select value={priority} onValueChange={setPriority}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="alta">Alta</SelectItem><SelectItem value="media">Media</SelectItem><SelectItem value="baja">Baja</SelectItem></SelectContent></Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="text-xs font-medium text-foreground">Fecha límite *</label><Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="mt-1" /></div>
                    <div><label className="text-xs font-medium text-foreground">Fuente</label><Input value={source} onChange={e => setSource(e.target.value)} className="mt-1" placeholder="Manual" /></div>
                  </div>
                  {/* Responsible party */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium text-foreground">A cargo de</label>
                      <Select value={responsible} onValueChange={setResponsible}>
                        <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sysde">SYSDE</SelectItem>
                          <SelectItem value="cliente">Cliente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {responsible === "sysde" && (
                      <div>
                        <label className="text-xs font-medium text-foreground">Equipo</label>
                        <Input value={team} onChange={e => setTeam(e.target.value)} className="mt-1" placeholder="Equipo Técnico" />
                      </div>
                    )}
                  </div>
                  {/* Linked task */}
                  {tasks.length > 0 && (
                    <div>
                      <label className="text-xs font-medium text-foreground">Vincular a tarea</label>
                      <Select value={linkedTask} onValueChange={setLinkedTask}>
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
                  <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button onClick={handleCreate}>Crear</Button></div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {actionItems.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin pendientes registrados</p>
        ) : actionItems.map(item => {
          const config = statusConfig[item.status];
          const rp = (item as any).responsibleParty as string | undefined;
          const rt = (item as any).responsibleTeam as string | undefined;
          const lt = (item as any).linkedTaskId as number | undefined;
          return (
            <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-border hover:bg-secondary/20 transition-colors group">
              <div className="flex items-center gap-3 min-w-0">
                <config.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                  <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1"><User className="h-3 w-3" /> {item.assignee}</span>
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {item.dueDate}</span>
                    <span className="flex items-center gap-1"><Link2 className="h-3 w-3" /> {item.source}</span>
                    {rp && (
                      <span className="flex items-center gap-1">
                         {rp === "sysde" || rp === "cisde" ? <Building2 className="h-3 w-3" /> : <Users className="h-3 w-3" />}
                        {rp === "sysde" || rp === "cisde" ? "SYSDE" : "Cliente"}
                        {rt && ` · ${rt}`}
                      </span>
                    )}
                    {lt && <span className="flex items-center gap-1">Tarea #{lt}</span>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge variant="outline" className={priorityColors[item.priority]}>{item.priority}</Badge>
                {rp && (
                  <Badge variant="outline" className={rp === "sysde" || rp === "cisde" ? "border-primary/30 text-primary text-[10px]" : "border-warning/30 text-warning text-[10px]"}>
                    {rp === "sysde" || rp === "cisde" ? "SYSDE" : "Cliente"}
                  </Badge>
                )}
                <Select value={item.status} onValueChange={v => handleStatusChange(item, v)}>
                  <SelectTrigger className="h-6 border-0 bg-transparent p-0 shadow-none w-auto">
                    <Badge className={config.className}>{config.label}</Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([k, v]) => (<SelectItem key={k} value={k}>{v.label}</SelectItem>))}
                  </SelectContent>
                </Select>
                <motion.div whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}>
                  <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground transition-all" onClick={() => handleDelete(item)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </motion.div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
