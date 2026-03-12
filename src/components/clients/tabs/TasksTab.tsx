import { type ClientTask, type TaskAssignee } from "@/data/projectData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CheckCircle2, Loader2, Circle, AlertOctagon, User, Calendar,
  Users, ChevronDown, ChevronUp, Pencil, Save, X
} from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useUpdateTask } from "@/hooks/useClients";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const taskStatusConfig = {
  completada: { label: "Completada", icon: CheckCircle2, className: "bg-success text-success-foreground" },
  "en-progreso": { label: "Progreso", icon: Loader2, className: "bg-warning text-warning-foreground" },
  bloqueada: { label: "Bloqueada", icon: AlertOctagon, className: "bg-destructive text-destructive-foreground" },
  pendiente: { label: "Pendiente", icon: Circle, className: "bg-muted text-muted-foreground" },
};

const priorityConfig = {
  alta: { label: "Alta", className: "bg-destructive/10 text-destructive border-destructive/20" },
  media: { label: "Media", className: "bg-warning/10 text-warning border-warning/20" },
  baja: { label: "Baja", className: "bg-muted text-muted-foreground border-border" },
};

interface TasksTabProps {
  tasks: ClientTask[];
  clientId: string;
}

export function TasksTab({ tasks, clientId }: TasksTabProps) {
  const [expandedTask, setExpandedTask] = useState<number | null>(null);
  const [editingTask, setEditingTask] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ title: string; description: string; priority: string }>({
    title: "",
    description: "",
    priority: "",
  });
  const updateTask = useUpdateTask();

  const handleStatusChange = async (task: ClientTask, newStatus: string) => {
    // Find the DB id by querying with client_id and original_id
    const { data } = await supabase
      .from("tasks")
      .select("id")
      .eq("client_id", clientId)
      .eq("original_id", task.id)
      .single();

    if (!data) {
      toast.error("No se encontró la tarea");
      return;
    }

    updateTask.mutate(
      { id: data.id, updates: { status: newStatus } },
      {
        onSuccess: () => toast.success(`Estado cambiado a "${taskStatusConfig[newStatus as keyof typeof taskStatusConfig]?.label}"`),
        onError: () => toast.error("Error al actualizar estado"),
      }
    );
  };

  const startEditing = (task: ClientTask) => {
    setEditingTask(task.id);
    setEditForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
    });
  };

  const cancelEditing = () => {
    setEditingTask(null);
  };

  const saveEditing = async (task: ClientTask) => {
    const { data } = await supabase
      .from("tasks")
      .select("id")
      .eq("client_id", clientId)
      .eq("original_id", task.id)
      .single();

    if (!data) {
      toast.error("No se encontró la tarea");
      return;
    }

    updateTask.mutate(
      {
        id: data.id,
        updates: {
          title: editForm.title,
          description: editForm.description || null,
          priority: editForm.priority,
        },
      },
      {
        onSuccess: () => {
          toast.success("Tarea actualizada");
          setEditingTask(null);
        },
        onError: () => toast.error("Error al actualizar tarea"),
      }
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm">Tareas ({tasks.length})</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {tasks.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No hay tareas pendientes</p>
        ) : tasks.map(task => {
          const config = taskStatusConfig[task.status];
          const isExpanded = expandedTask === task.id;
          const isEditing = editingTask === task.id;
          return (
            <div key={task.id} className="rounded-lg border border-border hover:bg-secondary/20 transition-colors">
              <button
                onClick={() => setExpandedTask(isExpanded ? null : task.id)}
                className="w-full flex items-center justify-between p-3 text-left"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <config.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                    <div className="flex gap-3 text-[10px] text-muted-foreground mt-0.5">
                      <span className="flex items-center gap-1"><User className="h-3 w-3" /> {task.owner}</span>
                      <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {task.dueDate}</span>
                      <span className="flex items-center gap-1"><Users className="h-3 w-3" /> {task.assignees.length} asignados</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className={priorityConfig[task.priority]?.className}>
                    {priorityConfig[task.priority]?.label}
                  </Badge>
                  <Badge className={config.className}>{config.label}</Badge>
                  {isExpanded ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
                </div>
              </button>
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 border-t border-border pt-3 space-y-3">
                      {/* Status change buttons */}
                      <div>
                        <p className="text-[10px] font-semibold text-foreground uppercase mb-2">Cambiar Estado</p>
                        <div className="flex flex-wrap gap-1.5">
                          {(Object.entries(taskStatusConfig) as [string, typeof config][]).map(([key, cfg]) => (
                            <button
                              key={key}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStatusChange(task, key);
                              }}
                              disabled={task.status === key || updateTask.isPending}
                              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                task.status === key
                                  ? `${cfg.className} ring-2 ring-offset-1 ring-primary/30`
                                  : "bg-secondary text-secondary-foreground hover:bg-accent"
                              } disabled:opacity-50`}
                            >
                              {cfg.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Edit form or display */}
                      {isEditing ? (
                        <div className="space-y-2" onClick={(e) => e.stopPropagation()}>
                          <div>
                            <label className="text-[10px] font-semibold text-foreground uppercase">Título</label>
                            <Input
                              value={editForm.title}
                              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                              className="mt-1 h-8 text-sm"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-foreground uppercase">Descripción</label>
                            <Textarea
                              value={editForm.description}
                              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                              className="mt-1 text-sm min-h-[60px]"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-foreground uppercase">Prioridad</label>
                            <Select value={editForm.priority} onValueChange={(v) => setEditForm({ ...editForm, priority: v })}>
                              <SelectTrigger className="mt-1 h-8 text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="alta">Alta</SelectItem>
                                <SelectItem value="media">Media</SelectItem>
                                <SelectItem value="baja">Baja</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex gap-2 pt-1">
                            <Button
                              size="sm"
                              onClick={() => saveEditing(task)}
                              disabled={updateTask.isPending || !editForm.title.trim()}
                              className="gap-1.5 h-7 text-xs"
                            >
                              <Save className="h-3 w-3" /> Guardar
                            </Button>
                            <Button size="sm" variant="outline" onClick={cancelEditing} className="h-7 text-xs gap-1.5">
                              <X className="h-3 w-3" /> Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          {task.description && (
                            <p className="text-xs text-muted-foreground">{task.description}</p>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => { e.stopPropagation(); startEditing(task); }}
                            className="h-7 text-xs gap-1.5"
                          >
                            <Pencil className="h-3 w-3" /> Editar tarea
                          </Button>
                        </>
                      )}

                      {/* Assignees */}
                      <div>
                        <p className="text-[10px] font-semibold text-foreground uppercase mb-2">Equipo Asignado</p>
                        <div className="flex flex-wrap gap-2">
                          {task.assignees.map(a => (
                            <div key={a.name} className="flex items-center gap-2 bg-secondary/50 rounded-lg px-2.5 py-1.5">
                              <Avatar className="h-6 w-6">
                                <AvatarFallback className="bg-primary/10 text-primary text-[10px] font-bold">{a.avatar}</AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-xs font-medium text-foreground">{a.name}</p>
                                <p className="text-[10px] text-muted-foreground">{a.role}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
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
