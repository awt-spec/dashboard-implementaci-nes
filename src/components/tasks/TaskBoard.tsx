import { useState } from "react";
import { type ClientTask } from "@/data/projectData";
import { Badge } from "@/components/ui/badge";
import { Calendar, User, Trash2, GripVertical } from "lucide-react";
import { useUpdateTask, useDeleteTask } from "@/hooks/useClients";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const columns = [
  { key: "pendiente", label: "Pendiente", color: "bg-muted", dragColor: "ring-muted-foreground/50 bg-muted/40" },
  { key: "en-progreso", label: "Progreso", color: "bg-info", dragColor: "ring-info bg-info/10" },
  { key: "bloqueada", label: "Bloqueada", color: "bg-destructive", dragColor: "ring-destructive bg-destructive/10" },
  { key: "completada", label: "Completada", color: "bg-success", dragColor: "ring-success bg-success/10" },
];

const priorityDot: Record<string, string> = {
  alta: "bg-destructive",
  media: "bg-warning",
  baja: "bg-success",
};

interface TaskBoardProps {
  tasks: (ClientTask & { clientId?: string })[];
  clientId: string;
  onEdit?: (task: ClientTask) => void;
}

export function TaskBoard({ tasks, clientId, onEdit }: TaskBoardProps) {
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [draggingTaskId, setDraggingTaskId] = useState<number | null>(null);

  const getClientId = (task: ClientTask & { clientId?: string }) => {
    return (task as any).clientId || clientId;
  };

  const handleMove = async (task: ClientTask & { clientId?: string }, newStatus: string) => {
    const cid = getClientId(task);
    const { data } = await supabase
      .from("tasks").select("id").eq("client_id", cid).eq("original_id", task.id).single();
    if (!data) return;
    updateTask.mutate(
      { id: data.id, updates: { status: newStatus } },
      { onSuccess: () => toast.success("Estado actualizado") }
    );
  };

  const handleDelete = async (task: ClientTask & { clientId?: string }) => {
    const cid = getClientId(task);
    const { data } = await supabase
      .from("tasks").select("id").eq("client_id", cid).eq("original_id", task.id).single();
    if (!data) return;
    deleteTask.mutate(data.id, {
      onSuccess: () => toast.success("Tarea eliminada"),
      onError: () => toast.error("Error al eliminar"),
    });
  };

  const handleDragStart = (e: React.DragEvent, task: ClientTask) => {
    e.dataTransfer.setData("taskId", String(task.id));
    e.dataTransfer.effectAllowed = "move";
    setDraggingTaskId(task.id);
  };

  const handleDragOver = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(colKey);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = (e: React.DragEvent, colKey: string) => {
    e.preventDefault();
    setDragOverCol(null);
    setDraggingTaskId(null);
    const taskId = Number(e.dataTransfer.getData("taskId"));
    const task = tasks.find(t => t.id === taskId);
    if (task && task.status !== colKey) {
      handleMove(task, colKey);
    }
  };

  const handleDragEnd = () => {
    setDragOverCol(null);
    setDraggingTaskId(null);
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {columns.map(col => {
        const colTasks = tasks.filter(t => t.status === col.key);
        const isOver = dragOverCol === col.key;
        return (
          <div
            key={col.key}
            className="space-y-2"
            onDragOver={e => handleDragOver(e, col.key)}
            onDragLeave={handleDragLeave}
            onDrop={e => handleDrop(e, col.key)}
          >
            <div className="flex items-center gap-2 pb-2">
              <div className={`w-3 h-3 rounded-full ${col.color}`} />
              <span className="text-sm font-semibold text-foreground">{col.label}</span>
              <Badge variant="outline" className="ml-auto text-xs">{colTasks.length}</Badge>
            </div>
            <div
              className={cn(
                "space-y-2 min-h-[100px] p-2 rounded-lg border transition-all duration-200",
                isOver
                  ? `ring-2 ${col.dragColor} border-transparent scale-[1.02]`
                  : "bg-secondary/30 border-border/50"
              )}
            >
              {colTasks.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  {isOver ? "Soltar aquí" : "Sin tareas"}
                </p>
              ) : colTasks.map(task => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={e => handleDragStart(e, task)}
                  onDragEnd={handleDragEnd}
                  className={cn(
                    "p-3 rounded-lg bg-card border border-border hover:shadow-md transition-all cursor-grab active:cursor-grabbing group",
                    draggingTaskId === task.id && "opacity-40 scale-95"
                  )}
                  onClick={() => onEdit?.(task)}
                >
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="flex items-center gap-1.5">
                      <GripVertical className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      <span className="text-[10px] font-mono text-muted-foreground">#{task.id}</span>
                    </div>
                    <motion.div whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }}>
                      <Button
                        variant="ghost" size="icon"
                        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-all hover:bg-destructive hover:text-destructive-foreground shrink-0"
                        onClick={e => { e.stopPropagation(); handleDelete(task); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </motion.div>
                  </div>
                  <div className="mb-2">
                    <p className="text-sm font-medium text-foreground leading-tight line-clamp-2">{task.title}</p>
                  </div>
                  {task.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{task.description}</p>
                  )}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${priorityDot[task.priority]}`} />
                      <span className="text-[10px] text-muted-foreground capitalize">{task.priority}</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {task.dueDate}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <User className="h-3 w-3 text-muted-foreground" />
                    <span className="text-[10px] text-muted-foreground truncate">{task.owner}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
