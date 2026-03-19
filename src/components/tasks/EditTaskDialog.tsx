import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  CalendarIcon, Trash2, MessageSquare, Send, Hash, User, Flag,
  CircleDot, Clock, Save, X
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useUpdateTask, useDeleteTask, useCreateComment } from "@/hooks/useClients";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import type { ClientTask } from "@/data/projectData";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger
} from "@/components/ui/alert-dialog";
import { motion } from "framer-motion";

interface EditTaskDialogProps {
  task: ClientTask | null;
  clientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const statusOptions = [
  { value: "pendiente", label: "Pendiente", emoji: "⏳", color: "bg-muted text-muted-foreground" },
  { value: "en-progreso", label: "Progreso", emoji: "🔄", color: "bg-info text-info-foreground" },
  { value: "bloqueada", label: "Bloqueada", emoji: "🚫", color: "bg-destructive text-destructive-foreground" },
  { value: "completada", label: "Completada", emoji: "✅", color: "bg-success text-success-foreground" },
];

const priorityOptions = [
  { value: "alta", label: "Alta", color: "bg-destructive text-destructive-foreground" },
  { value: "media", label: "Media", color: "bg-warning text-warning-foreground" },
  { value: "baja", label: "Baja", color: "bg-success text-success-foreground" },
];

function parseDueDate(dateStr: string): Date | undefined {
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? undefined : d;
}

export function EditTaskDialog({ task, clientId, open, onOpenChange }: EditTaskDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState("pendiente");
  const [priority, setPriority] = useState("media");
  const [owner, setOwner] = useState("");
  const [dueDate, setDueDate] = useState<Date>();
  const [visibility, setVisibility] = useState("externa");
  const [saving, setSaving] = useState(false);
  const [dbTaskId, setDbTaskId] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const createComment = useCreateComment();

  useEffect(() => {
    if (task && open) {
      (async () => {
        const { ensureTaskInDb } = await import("@/lib/ensureTaskInDb");
        const id = await ensureTaskInDb(task, clientId);
        setDbTaskId(id);
      })();
    }
  }, [task, clientId, open]);

  const { data: comments, refetch: refetchComments } = useQuery({
    queryKey: ["task-comments", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("comments")
        .select("*")
        .eq("client_id", clientId)
        .order("created_at", { ascending: false });
      return (data || []) as { id: string; original_id: string; user: string; avatar: string; message: string; date: string; type: string; created_at: string }[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || "");
      setStatus(task.status);
      setPriority(task.priority);
      setOwner(task.owner);
      setDueDate(parseDueDate(task.dueDate));
      setVisibility((task as any).visibility || "externa");
      setNewComment("");
    }
  }, [task]);

  const handleSave = async () => {
    if (!title.trim() || !owner.trim()) {
      toast.error("Título y responsable son obligatorios");
      return;
    }
    if (!dbTaskId) {
      toast.error("No se encontró la tarea");
      return;
    }
    setSaving(true);
    updateTask.mutate(
      {
        id: dbTaskId,
        updates: {
          title: title.trim(),
          description: description.trim() || null,
          status,
          priority,
          owner: owner.trim(),
          due_date: dueDate ? format(dueDate, "yyyy-MM-dd") : task!.dueDate,
          assignees: [{ name: owner.trim(), avatar: owner.trim().split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 3) }],
        },
      },
      {
        onSuccess: () => { toast.success("Tarea actualizada"); setSaving(false); onOpenChange(false); },
        onError: () => { toast.error("Error al actualizar"); setSaving(false); },
      }
    );
  };

  const handleDelete = async () => {
    if (!dbTaskId) return;
    deleteTask.mutate(dbTaskId, {
      onSuccess: () => { toast.success("Tarea eliminada"); onOpenChange(false); },
      onError: () => toast.error("Error al eliminar"),
    });
  };

  const handleAddComment = () => {
    if (!newComment.trim()) return;
    createComment.mutate({
      client_id: clientId,
      original_id: `TC-${Date.now()}`,
      user: owner || "Usuario",
      avatar: (owner || "U").split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2),
      message: `[Tarea #${task?.id}] ${newComment.trim()}`,
      date: new Date().toISOString().slice(0, 10),
      type: "comentario",
    }, {
      onSuccess: () => { setNewComment(""); refetchComments(); toast.success("Comentario agregado"); },
    });
  };

  if (!task) return null;

  const taskComments = (comments || []).filter(c => c.message.includes(`[Tarea #${task.id}]`));
  const currentStatus = statusOptions.find(s => s.value === status);
  const currentPriority = priorityOptions.find(p => p.value === priority);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-xl w-full p-0 flex flex-col gap-0 border-l border-border">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Hash className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Tarea #{task.id}</p>
              <p className="text-[10px] text-muted-foreground">Cliente: {clientId}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gap-1.5 h-8"
            >
              <Save className="h-3.5 w-3.5" />
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-5">
            {/* Title - large editable */}
            <div>
              <Input
                value={title}
                onChange={e => setTitle(e.target.value)}
                className="text-lg font-semibold border-0 px-0 h-auto shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
                placeholder="Título de la tarea..."
              />
            </div>

            {/* Status cards row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Status */}
              <motion.div
                className="rounded-xl border border-border p-3 space-y-2 hover:border-primary/30 transition-colors"
                whileHover={{ scale: 1.01 }}
              >
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-semibold">
                  <CircleDot className="h-3 w-3" /> Estado
                </div>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="border-0 p-0 h-auto shadow-none">
                    <Badge className={cn(currentStatus?.color, "text-xs px-2.5 py-1")}>
                      {currentStatus?.emoji} {currentStatus?.label}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(o => (
                      <SelectItem key={o.value} value={o.value}>
                        <span className="flex items-center gap-2">{o.emoji} {o.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </motion.div>

              {/* Priority */}
              <motion.div
                className="rounded-xl border border-border p-3 space-y-2 hover:border-primary/30 transition-colors"
                whileHover={{ scale: 1.01 }}
              >
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-semibold">
                  <Flag className="h-3 w-3" /> Prioridad
                </div>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="border-0 p-0 h-auto shadow-none">
                    <Badge className={cn(currentPriority?.color, "text-xs px-2.5 py-1")}>
                      {currentPriority?.label}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map(o => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </motion.div>
            </div>

            {/* Properties */}
            <div className="rounded-xl border border-border divide-y divide-border">
              {/* Owner */}
              <div className="flex items-center gap-3 p-3">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-semibold w-28 shrink-0">
                  <User className="h-3 w-3" /> Responsable
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <Avatar className="h-6 w-6">
                    <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-bold">
                      {owner.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "?"}
                    </AvatarFallback>
                  </Avatar>
                  <Input
                    value={owner}
                    onChange={e => setOwner(e.target.value)}
                    className="border-0 px-0 h-7 shadow-none focus-visible:ring-0 text-sm"
                    placeholder="Asignar responsable..."
                  />
                </div>
              </div>

              {/* Due Date */}
              <div className="flex items-center gap-3 p-3">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-semibold w-28 shrink-0">
                  <Clock className="h-3 w-3" /> Fecha límite
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className={cn(
                      "text-sm hover:text-foreground transition-colors",
                      dueDate ? "text-foreground" : "text-muted-foreground"
                    )}>
                      <span className="flex items-center gap-1.5">
                        <CalendarIcon className="h-3.5 w-3.5" />
                        {dueDate ? format(dueDate, "dd MMM yyyy", { locale: es }) : "Sin fecha"}
                      </span>
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar mode="single" selected={dueDate} onSelect={setDueDate} initialFocus locale={es} className="p-3 pointer-events-auto" />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-2">
              <p className="text-[10px] text-muted-foreground uppercase font-semibold">Descripción</p>
              <Textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="min-h-[80px] resize-none border-border/50 bg-secondary/20 focus:bg-transparent transition-colors"
                placeholder="Agregar descripción..."
              />
            </div>

            <Separator />

            {/* Comments */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-semibold">
                  <MessageSquare className="h-3 w-3" /> Comentarios
                </div>
                <Badge variant="outline" className="text-[10px]">{taskComments.length}</Badge>
              </div>

              {/* Comment input */}
              <div className="flex gap-2">
                <Avatar className="h-7 w-7 shrink-0">
                  <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-bold">
                    {owner.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "U"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 flex gap-1.5">
                  <Input
                    value={newComment}
                    onChange={e => setNewComment(e.target.value)}
                    placeholder="Escribe un comentario..."
                    className="text-sm h-8 bg-secondary/20 border-border/50"
                    onKeyDown={e => e.key === "Enter" && handleAddComment()}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={handleAddComment}
                    disabled={!newComment.trim()}
                    className="h-8 w-8 shrink-0 hover:bg-primary hover:text-primary-foreground transition-colors"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              {/* Comments list */}
              {taskComments.length > 0 && (
                <div className="space-y-2">
                  {taskComments.map((c, i) => (
                    <motion.div
                      key={c.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex gap-2.5 group"
                    >
                      <Avatar className="h-7 w-7 shrink-0 mt-0.5">
                        <AvatarFallback className="bg-secondary text-muted-foreground text-[9px] font-bold">{c.avatar}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 rounded-lg bg-secondary/30 p-2.5 border border-border/30">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-xs font-medium text-foreground">{c.user}</span>
                          <span className="text-[10px] text-muted-foreground">{c.date}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {c.message.replace(`[Tarea #${task.id}] `, "")}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {taskComments.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4 bg-secondary/10 rounded-lg">
                  Sin comentarios aún. Sé el primero en comentar.
                </p>
              )}
            </div>
          </div>
        </ScrollArea>

        {/* Bottom bar - delete zone */}
        <div className="px-5 py-3 border-t border-border bg-card">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5 text-xs"
              >
                <Trash2 className="h-3.5 w-3.5" /> Eliminar tarea
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar tarea #{task.id}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Esta acción no se puede deshacer. Se eliminará permanentemente la tarea y su historial.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </SheetContent>
    </Sheet>
  );
}
