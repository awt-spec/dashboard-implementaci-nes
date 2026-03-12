import { type ClientTask } from "@/data/projectData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, Pencil } from "lucide-react";
import { useUpdateTask, useDeleteTask } from "@/hooks/useClients";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";

const statusConfig: Record<string, { label: string; className: string }> = {
  completada: { label: "Completada", className: "bg-success text-success-foreground" },
  "en-progreso": { label: "En Progreso", className: "bg-info text-info-foreground" },
  bloqueada: { label: "Bloqueada", className: "bg-destructive text-destructive-foreground" },
  pendiente: { label: "Pendiente", className: "bg-warning text-warning-foreground" },
};

const priorityConfig: Record<string, { label: string; dot: string }> = {
  alta: { label: "Alta", dot: "bg-destructive" },
  media: { label: "Media", dot: "bg-warning" },
  baja: { label: "Baja", dot: "bg-success" },
};

interface TaskTableProps {
  tasks: (ClientTask & { clientId?: string })[];
  clientId: string;
  onEdit?: (task: ClientTask) => void;
}

export function TaskTable({ tasks, clientId, onEdit }: TaskTableProps) {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const getClientId = (task: ClientTask & { clientId?: string }) => {
    return (task as any).clientId || clientId;
  };

  const getDbId = async (task: ClientTask & { clientId?: string }) => {
    const cid = getClientId(task);
    const { ensureTaskInDb } = await import("@/lib/ensureTaskInDb");
    return ensureTaskInDb(task, cid);
  };

  const handleStatusChange = async (task: ClientTask & { clientId?: string }, newStatus: string) => {
    const dbId = await getDbId(task);
    if (!dbId) return;
    updateTask.mutate(
      { id: dbId, updates: { status: newStatus } },
      { onSuccess: () => toast.success("Estado actualizado") }
    );
  };

  const handlePriorityChange = async (task: ClientTask & { clientId?: string }, newPriority: string) => {
    const dbId = await getDbId(task);
    if (!dbId) return;
    updateTask.mutate(
      { id: dbId, updates: { priority: newPriority } },
      { onSuccess: () => toast.success("Prioridad actualizada") }
    );
  };

  const handleDelete = async (task: ClientTask & { clientId?: string }) => {
    const dbId = await getDbId(task);
    if (!dbId) return;
    deleteTask.mutate(dbId, {
      onSuccess: () => toast.success("Tarea eliminada"),
      onError: () => toast.error("Error al eliminar"),
    });
  };

  return (
    <div className="rounded-lg border border-border overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Header */}
        <div className="grid grid-cols-[60px_1fr_120px_100px_80px_95px_70px] bg-secondary/50 border-b border-border">
          <div className="px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Nº</div>
          <div className="px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Tarea</div>
          <div className="px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Responsable</div>
          <div className="px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Estado</div>
          <div className="px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Prioridad</div>
          <div className="px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Fecha</div>
          <div className="px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Acciones</div>
        </div>

        {/* Rows */}
        {tasks.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">No hay tareas</div>
        ) : tasks.map(task => {
          const sConfig = statusConfig[task.status] || statusConfig.pendiente;
          const pConfig = priorityConfig[task.priority] || priorityConfig.media;

          return (
            <div
              key={task.id}
              className="grid grid-cols-[60px_1fr_120px_100px_80px_95px_70px] border-b border-border/50 hover:bg-secondary/20 transition-colors group items-center cursor-pointer"
              onClick={() => onEdit?.(task)}
            >
              {/* Task Number */}
              <div className="px-2 py-2.5 overflow-hidden">
                <span className="text-xs font-mono text-muted-foreground truncate block">#{task.id}</span>
              </div>

              {/* Title */}
              <div className="px-2 py-2.5 overflow-hidden">
                <p className="text-sm font-medium text-foreground truncate">{task.title}</p>
                {task.description && (
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{task.description}</p>
                )}
              </div>

              {/* Owner */}
              <div className="px-2 py-2.5 overflow-hidden">
                <span className="text-xs text-foreground truncate block">{task.owner}</span>
              </div>

              {/* Status */}
              <div className="px-2 py-2.5 overflow-hidden" onClick={e => e.stopPropagation()}>
                <Select value={task.status} onValueChange={v => handleStatusChange(task, v)}>
                  <SelectTrigger className="h-6 border-0 bg-transparent p-0 shadow-none">
                    <Badge className={`${sConfig.className} text-[10px] cursor-pointer`}>{sConfig.label}</Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Priority */}
              <div className="px-2 py-2.5 overflow-hidden" onClick={e => e.stopPropagation()}>
                <Select value={task.priority} onValueChange={v => handlePriorityChange(task, v)}>
                  <SelectTrigger className="h-6 border-0 bg-transparent p-0 shadow-none">
                    <div className="flex items-center gap-1 cursor-pointer">
                      <div className={`w-2 h-2 rounded-full ${pConfig.dot} shrink-0`} />
                      <span className="text-xs text-foreground">{pConfig.label}</span>
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(priorityConfig).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Due Date */}
              <div className="px-2 py-2.5 overflow-hidden">
                <span className="text-xs text-muted-foreground truncate block">{task.dueDate}</span>
              </div>

              {/* Actions */}
              <div className="px-2 py-2.5 flex gap-0.5" onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => onEdit?.(task)}>
                  <Pencil className="h-3 w-3" />
                </Button>
                <motion.div whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}>
                  <Button
                    variant="ghost" size="icon"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground transition-all"
                    onClick={() => handleDelete(task)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </motion.div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
