import { useState, useEffect, useRef } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  CalendarIcon, Trash2, MessageSquare, Send, Hash, User, Flag,
  CircleDot, Clock, Save, X, Plus, Link2, Tag, Paperclip,
  CheckSquare, ArrowRight, FileText, Download, Loader2
} from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useUpdateTask, useDeleteTask, useCreateComment } from "@/hooks/useClients";
import {
  useSubtasks, useCreateSubtask, useToggleSubtask, useDeleteSubtask,
  useTaskDependencies, useAddDependency, useRemoveDependency, useAvailableTasks,
  useTaskTags, useAddTag, useRemoveTag,
  useTaskAttachments, useUploadAttachment, useDeleteAttachment,
} from "@/hooks/useTaskDetails";
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

const TAG_COLORS = ["#6366f1", "#f43f5e", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#14b8a6"];

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
  const [newSubtask, setNewSubtask] = useState("");
  const [newTag, setNewTag] = useState("");
  const [selectedTagColor, setSelectedTagColor] = useState(TAG_COLORS[0]);
  const [depTaskId, setDepTaskId] = useState("");
  const [depType, setDepType] = useState("blocks");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();
  const createComment = useCreateComment();

  // New hooks
  const { data: subtasks = [] } = useSubtasks(dbTaskId);
  const createSubtask = useCreateSubtask();
  const toggleSubtask = useToggleSubtask();
  const deleteSubtask = useDeleteSubtask();

  const { data: dependencies = [] } = useTaskDependencies(dbTaskId);
  const addDependency = useAddDependency();
  const removeDependency = useRemoveDependency();
  const { data: availableTasks = [] } = useAvailableTasks(clientId, dbTaskId);

  const { data: tags = [] } = useTaskTags(dbTaskId);
  const addTag = useAddTag();
  const removeTag = useRemoveTag();

  const { data: attachments = [] } = useTaskAttachments(dbTaskId);
  const uploadAttachment = useUploadAttachment();
  const deleteAttachment = useDeleteAttachment();

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
      setNewSubtask("");
      setNewTag("");
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
          visibility,
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

  const handleAddSubtask = () => {
    if (!newSubtask.trim() || !dbTaskId) return;
    createSubtask.mutate({ task_id: dbTaskId, title: newSubtask.trim(), sort_order: subtasks.length }, {
      onSuccess: () => { setNewSubtask(""); toast.success("Subtarea agregada"); },
      onError: () => toast.error("Error al agregar subtarea"),
    });
  };

  const handleAddDependency = () => {
    if (!depTaskId || !dbTaskId) return;
    addDependency.mutate({ task_id: dbTaskId, depends_on_task_id: depTaskId, dependency_type: depType }, {
      onSuccess: () => { setDepTaskId(""); toast.success("Dependencia agregada"); },
      onError: () => toast.error("Error al agregar dependencia"),
    });
  };

  const handleAddTag = () => {
    if (!newTag.trim() || !dbTaskId) return;
    addTag.mutate({ task_id: dbTaskId, tag: newTag.trim(), color: selectedTagColor }, {
      onSuccess: () => { setNewTag(""); toast.success("Etiqueta agregada"); },
      onError: () => toast.error("Error al agregar etiqueta"),
    });
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !dbTaskId) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("Archivo muy grande (máx 20MB)"); return; }
    uploadAttachment.mutate({ task_id: dbTaskId, file, uploaded_by: owner || "Sistema" }, {
      onSuccess: () => toast.success("Archivo subido"),
      onError: () => toast.error("Error al subir archivo"),
    });
    e.target.value = "";
  };

  if (!task) return null;

  const taskComments = (comments || []).filter(c => c.message.includes(`[Tarea #${task.id}]`));
  const currentStatus = statusOptions.find(s => s.value === status);
  const currentPriority = priorityOptions.find(p => p.value === priority);
  const completedSubtasks = subtasks.filter(s => s.completed).length;
  const subtaskProgress = subtasks.length > 0 ? Math.round((completedSubtasks / subtasks.length) * 100) : 0;

  const blockingDeps = dependencies.filter(d => d.dependency_type === "blocks");
  const relatedDeps = dependencies.filter(d => d.dependency_type === "related");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-2xl w-full p-0 flex flex-col gap-0 border-l border-border">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Hash className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-foreground">Tarea #{task.id}</p>
              <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                {tags.map(t => (
                  <span key={t.id} className="text-[9px] px-1.5 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: t.color }}>
                    {t.tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5 h-8">
              <Save className="h-3.5 w-3.5" />
              {saving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-5 space-y-5">
            {/* Title */}
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="text-lg font-semibold border-0 px-0 h-auto shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
              placeholder="Título de la tarea..."
            />

            {/* Status cards */}
            <div className="grid grid-cols-2 gap-3">
              <motion.div className="rounded-xl border border-border p-3 space-y-2 hover:border-primary/30 transition-colors" whileHover={{ scale: 1.01 }}>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-semibold">
                  <CircleDot className="h-3 w-3" /> Estado
                </div>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="border-0 p-0 h-auto shadow-none">
                    <Badge className={cn(currentStatus?.color, "text-xs px-2.5 py-1")}>{currentStatus?.emoji} {currentStatus?.label}</Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map(o => <SelectItem key={o.value} value={o.value}><span className="flex items-center gap-2">{o.emoji} {o.label}</span></SelectItem>)}
                  </SelectContent>
                </Select>
              </motion.div>

              <motion.div className="rounded-xl border border-border p-3 space-y-2 hover:border-primary/30 transition-colors" whileHover={{ scale: 1.01 }}>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-semibold">
                  <Flag className="h-3 w-3" /> Prioridad
                </div>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger className="border-0 p-0 h-auto shadow-none">
                    <Badge className={cn(currentPriority?.color, "text-xs px-2.5 py-1")}>{currentPriority?.label}</Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {priorityOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </motion.div>

              <motion.div className="rounded-xl border border-border p-3 space-y-2 hover:border-primary/30 transition-colors col-span-2" whileHover={{ scale: 1.01 }}>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-semibold">
                  {visibility === "interna" ? "🔒" : "🌐"} Tipo de Tarea
                </div>
                <Select value={visibility} onValueChange={setVisibility}>
                  <SelectTrigger className="border-0 p-0 h-auto shadow-none">
                    <Badge variant="outline" className={cn("text-xs px-2.5 py-1 border", visibility === "interna" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary border-primary/20")}>
                      {visibility === "interna" ? "🔒 Interna" : "🌐 Externa"}
                    </Badge>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="externa">🌐 Externa (visible para cliente)</SelectItem>
                    <SelectItem value="interna">🔒 Interna (solo equipo)</SelectItem>
                  </SelectContent>
                </Select>
              </motion.div>
            </div>

            {/* Properties */}
            <div className="rounded-xl border border-border divide-y divide-border">
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
                  <Input value={owner} onChange={e => setOwner(e.target.value)} className="border-0 px-0 h-7 shadow-none focus-visible:ring-0 text-sm" placeholder="Asignar responsable..." />
                </div>
              </div>
              <div className="flex items-center gap-3 p-3">
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase font-semibold w-28 shrink-0">
                  <Clock className="h-3 w-3" /> Fecha límite
                </div>
                <Popover>
                  <PopoverTrigger asChild>
                    <button className={cn("text-sm hover:text-foreground transition-colors", dueDate ? "text-foreground" : "text-muted-foreground")}>
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
              <Textarea value={description} onChange={e => setDescription(e.target.value)} className="min-h-[80px] resize-none border-border/50 bg-secondary/20 focus:bg-transparent transition-colors" placeholder="Agregar descripción..." />
            </div>

            <Separator />

            {/* Tabs for detail sections */}
            <Tabs defaultValue="subtasks" className="w-full">
              <TabsList className="w-full h-9 grid grid-cols-5">
                <TabsTrigger value="subtasks" className="text-[10px] gap-1">
                  <CheckSquare className="h-3 w-3" />
                  <span className="hidden sm:inline">Subtareas</span>
                  {subtasks.length > 0 && <span className="text-[9px] bg-primary/10 text-primary rounded-full px-1">{completedSubtasks}/{subtasks.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="dependencies" className="text-[10px] gap-1">
                  <Link2 className="h-3 w-3" />
                  <span className="hidden sm:inline">Deps</span>
                  {dependencies.length > 0 && <span className="text-[9px] bg-primary/10 text-primary rounded-full px-1">{dependencies.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="tags" className="text-[10px] gap-1">
                  <Tag className="h-3 w-3" />
                  <span className="hidden sm:inline">Tags</span>
                  {tags.length > 0 && <span className="text-[9px] bg-primary/10 text-primary rounded-full px-1">{tags.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="attachments" className="text-[10px] gap-1">
                  <Paperclip className="h-3 w-3" />
                  <span className="hidden sm:inline">Archivos</span>
                  {attachments.length > 0 && <span className="text-[9px] bg-primary/10 text-primary rounded-full px-1">{attachments.length}</span>}
                </TabsTrigger>
                <TabsTrigger value="comments" className="text-[10px] gap-1">
                  <MessageSquare className="h-3 w-3" />
                  <span className="hidden sm:inline">Notas</span>
                  {taskComments.length > 0 && <span className="text-[9px] bg-primary/10 text-primary rounded-full px-1">{taskComments.length}</span>}
                </TabsTrigger>
              </TabsList>

              {/* ─── SUBTASKS ─── */}
              <TabsContent value="subtasks" className="space-y-3 mt-3">
                {subtasks.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 rounded-full bg-secondary">
                      <div className="h-1.5 rounded-full bg-primary transition-all" style={{ width: `${subtaskProgress}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground font-mono">{subtaskProgress}%</span>
                  </div>
                )}
                <div className="space-y-1">
                  {subtasks.map(st => (
                    <motion.div key={st.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-2 group rounded-lg hover:bg-secondary/30 p-1.5">
                      <Checkbox
                        checked={st.completed}
                        onCheckedChange={checked => toggleSubtask.mutate({ id: st.id, completed: !!checked, task_id: st.task_id })}
                      />
                      <span className={cn("text-sm flex-1", st.completed && "line-through text-muted-foreground")}>{st.title}</span>
                      <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => deleteSubtask.mutate({ id: st.id, task_id: st.task_id })}>
                        <X className="h-3 w-3" />
                      </Button>
                    </motion.div>
                  ))}
                </div>
                <div className="flex gap-1.5">
                  <Input value={newSubtask} onChange={e => setNewSubtask(e.target.value)} placeholder="Nueva subtarea..." className="text-sm h-8" onKeyDown={e => e.key === "Enter" && handleAddSubtask()} />
                  <Button size="sm" variant="outline" onClick={handleAddSubtask} disabled={!newSubtask.trim()} className="h-8 shrink-0">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TabsContent>

              {/* ─── DEPENDENCIES ─── */}
              <TabsContent value="dependencies" className="space-y-3 mt-3">
                {blockingDeps.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">🚫 Bloqueada por</p>
                    {blockingDeps.map(d => (
                      <div key={d.id} className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 p-2 group">
                        <ArrowRight className="h-3 w-3 text-destructive shrink-0" />
                        <span className="text-xs flex-1 font-medium">#{d.depends_on_task?.original_id} — {d.depends_on_task?.title || "Tarea"}</span>
                        <Badge className={cn("text-[9px]",
                          d.depends_on_task?.status === "completada" ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
                        )}>{d.depends_on_task?.status}</Badge>
                        <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => removeDependency.mutate({ id: d.id, task_id: d.task_id })}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {relatedDeps.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-muted-foreground uppercase font-semibold">🔗 Relacionada con</p>
                    {relatedDeps.map(d => (
                      <div key={d.id} className="flex items-center gap-2 rounded-lg border border-border bg-secondary/20 p-2 group">
                        <Link2 className="h-3 w-3 text-primary shrink-0" />
                        <span className="text-xs flex-1 font-medium">#{d.depends_on_task?.original_id} — {d.depends_on_task?.title || "Tarea"}</span>
                        <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100" onClick={() => removeDependency.mutate({ id: d.id, task_id: d.task_id })}>
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
                {dependencies.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-4 bg-secondary/10 rounded-lg">Sin dependencias</p>
                )}
                <div className="flex gap-1.5 items-end">
                  <div className="flex-1 space-y-1">
                    <Select value={depTaskId} onValueChange={setDepTaskId}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar tarea..." /></SelectTrigger>
                      <SelectContent>
                        {availableTasks.filter(t => !dependencies.some(d => d.depends_on_task_id === t.id)).map(t => (
                          <SelectItem key={t.id} value={t.id}>#{t.original_id} — {t.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Select value={depType} onValueChange={setDepType}>
                    <SelectTrigger className="h-8 w-[120px] text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blocks">🚫 Bloquea</SelectItem>
                      <SelectItem value="related">🔗 Relaciona</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" onClick={handleAddDependency} disabled={!depTaskId} className="h-8 shrink-0">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TabsContent>

              {/* ─── TAGS ─── */}
              <TabsContent value="tags" className="space-y-3 mt-3">
                <div className="flex flex-wrap gap-1.5">
                  {tags.map(t => (
                    <motion.div key={t.id} initial={{ scale: 0 }} animate={{ scale: 1 }} className="group flex items-center gap-1 rounded-full px-2.5 py-1 text-white text-xs font-medium" style={{ backgroundColor: t.color }}>
                      {t.tag}
                      <button className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => removeTag.mutate({ id: t.id, task_id: t.task_id })}>
                        <X className="h-3 w-3" />
                      </button>
                    </motion.div>
                  ))}
                  {tags.length === 0 && <p className="text-xs text-muted-foreground">Sin etiquetas</p>}
                </div>
                <div className="flex gap-1.5 items-center">
                  <Input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="Nueva etiqueta..." className="text-sm h-8 flex-1" onKeyDown={e => e.key === "Enter" && handleAddTag()} />
                  <div className="flex gap-0.5">
                    {TAG_COLORS.map(c => (
                      <button key={c} className={cn("h-5 w-5 rounded-full border-2 transition-transform", selectedTagColor === c ? "border-foreground scale-110" : "border-transparent")} style={{ backgroundColor: c }} onClick={() => setSelectedTagColor(c)} />
                    ))}
                  </div>
                  <Button size="sm" variant="outline" onClick={handleAddTag} disabled={!newTag.trim()} className="h-8 shrink-0">
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </TabsContent>

              {/* ─── ATTACHMENTS ─── */}
              <TabsContent value="attachments" className="space-y-3 mt-3">
                <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileUpload} />
                <div className="space-y-1.5">
                  {attachments.map(a => (
                    <div key={a.id} className="flex items-center gap-2.5 rounded-lg border border-border p-2.5 group hover:bg-secondary/20 transition-colors">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium truncate">{a.file_name}</p>
                        <p className="text-[10px] text-muted-foreground">{(a.file_size / 1024).toFixed(1)} KB · {a.uploaded_by}</p>
                      </div>
                      <a href={a.file_url} target="_blank" rel="noopener noreferrer">
                        <Button variant="ghost" size="icon" className="h-6 w-6"><Download className="h-3 w-3" /></Button>
                      </a>
                      <Button variant="ghost" size="icon" className="h-6 w-6 opacity-0 group-hover:opacity-100" onClick={() => deleteAttachment.mutate({ id: a.id, task_id: a.task_id })}>
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                  {attachments.length === 0 && <p className="text-xs text-muted-foreground text-center py-4 bg-secondary/10 rounded-lg">Sin archivos adjuntos</p>}
                </div>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileInputRef.current?.click()} disabled={uploadAttachment.isPending}>
                  {uploadAttachment.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Paperclip className="h-3.5 w-3.5" />}
                  Subir archivo
                </Button>
              </TabsContent>

              {/* ─── COMMENTS ─── */}
              <TabsContent value="comments" className="space-y-3 mt-3">
                <div className="flex gap-2">
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-[9px] font-bold">
                      {owner.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 flex gap-1.5">
                    <Input value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Escribe un comentario..." className="text-sm h-8 bg-secondary/20 border-border/50" onKeyDown={e => e.key === "Enter" && handleAddComment()} />
                    <Button size="icon" variant="ghost" onClick={handleAddComment} disabled={!newComment.trim()} className="h-8 w-8 shrink-0 hover:bg-primary hover:text-primary-foreground transition-colors">
                      <Send className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
                {taskComments.length > 0 && (
                  <div className="space-y-2">
                    {taskComments.map((c, i) => (
                      <motion.div key={c.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="flex gap-2.5 group">
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
                  <p className="text-xs text-muted-foreground text-center py-4 bg-secondary/10 rounded-lg">Sin comentarios aún.</p>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </ScrollArea>

        {/* Bottom bar */}
        <div className="px-5 py-3 border-t border-border bg-card">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5 text-xs">
                <Trash2 className="h-3.5 w-3.5" /> Eliminar tarea
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar tarea #{task.id}?</AlertDialogTitle>
                <AlertDialogDescription>Esta acción no se puede deshacer. Se eliminará permanentemente la tarea y su historial.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </SheetContent>
    </Sheet>
  );
}
