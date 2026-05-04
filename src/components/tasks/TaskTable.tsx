import { type ClientTask } from "@/data/projectData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Pencil } from "lucide-react";
import { useDeleteTask } from "@/hooks/useClients";
import { toast } from "sonner";
import { motion } from "framer-motion";

const statusConfig: Record<string, { label: string; className: string }> = {
  completada: { label: "Completada", className: "bg-success text-success-foreground" },
  "en-progreso": { label: "Progreso", className: "bg-info text-info-foreground" },
  bloqueada: { label: "Bloqueada", className: "bg-destructive text-destructive-foreground" },
  pendiente: { label: "Pendiente", className: "bg-warning text-warning-foreground" },
};

const priorityConfig: Record<string, { label: string; dot: string }> = {
  alta: { label: "Alta", dot: "bg-destructive" },
  media: { label: "Media", dot: "bg-warning" },
  baja: { label: "Baja", dot: "bg-success" },
};

const visibilityConfig: Record<string, { label: string; className: string }> = {
  externa: { label: "Externa", className: "bg-primary/10 text-primary border-primary/20" },
  interna: { label: "Interna", className: "bg-muted text-muted-foreground border-muted-foreground/20" },
};

interface TaskTableProps {
  tasks: (ClientTask & { clientId?: string; visibility?: string })[];
  clientId: string;
  onEdit?: (task: ClientTask) => void;
}

export function TaskTable({ tasks, clientId, onEdit }: TaskTableProps) {
  const deleteTask = useDeleteTask();

  const getClientId = (task: ClientTask & { clientId?: string }) => {
    return (task as any).clientId || clientId;
  };

  const getDbId = async (task: ClientTask & { clientId?: string }) => {
    const cid = getClientId(task);
    const { ensureTaskInDb } = await import("@/lib/ensureTaskInDb");
    return ensureTaskInDb(task, cid);
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
      <div className="min-w-[750px]">
        {/* Header */}
        <div className="grid grid-cols-[60px_1fr_120px_90px_80px_70px_95px_70px] bg-secondary/50 border-b border-border">
          <div className="px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Nº</div>
          <div className="px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Tarea</div>
          <div className="px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Responsable</div>
          <div className="px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Estado</div>
          <div className="px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Prioridad</div>
          <div className="px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Tipo</div>
          <div className="px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Fecha</div>
          <div className="px-2 py-2 text-[10px] font-semibold text-muted-foreground uppercase">Acciones</div>
        </div>

        {/* Rows */}
        {tasks.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">No hay tareas</div>
        ) : tasks.map(task => {
          const sConfig = statusConfig[task.status] || statusConfig.pendiente;
          const pConfig = priorityConfig[task.priority] || priorityConfig.media;
          const vConfig = visibilityConfig[(task as any).visibility || "externa"] || visibilityConfig.externa;

          return (
            <div
              key={task.id}
              className="grid grid-cols-[60px_1fr_120px_90px_80px_70px_95px_70px] border-b border-border/50 hover:bg-secondary/20 transition-colors group items-center cursor-pointer"
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

              {/* Status - plain badge, no dropdown */}
              <div className="px-2 py-2.5 overflow-hidden">
                <Badge className={`${sConfig.className} text-[10px]`}>{sConfig.label}</Badge>
              </div>

              {/* Priority - plain display, no dropdown */}
              <div className="px-2 py-2.5 overflow-hidden">
                <div className="flex items-center gap-1">
                  <div className={`w-2 h-2 rounded-full ${pConfig.dot} shrink-0`} />
                  <span className="text-xs text-foreground">{pConfig.label}</span>
                </div>
              </div>

              {/* Visibility */}
              <div className="px-2 py-2.5 overflow-hidden">
                <Badge variant="outline" className={`${vConfig.className} text-[9px] border`}>{vConfig.label}</Badge>
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
