import { useEffect, useState, useMemo } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Building2, Calendar, Hash, Target, X, MoreHorizontal, Link2, Send, Plus } from "lucide-react";
import type { ScrumWorkItem } from "@/hooks/useTeamScrum";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUpdateWorkItemScrum } from "@/hooks/useTeamScrum";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface TaskDetailSheetProps {
  item: ScrumWorkItem | null;
  clientName?: string;
  sprintName?: string;
  daysLeft?: number | null;
  onClose: () => void;
}

interface ChecklistItem { id: string; text: string; done: boolean }
interface ActivityRow { id: string; user: string; message: string; date: string }

export function TaskDetailSheet({ item, clientName, sprintName, daysLeft, onClose }: TaskDetailSheetProps) {
  const { profile } = useAuth();
  const updateScrum = useUpdateWorkItemScrum();
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [newChecklistText, setNewChecklistText] = useState("");
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [comment, setComment] = useState("");
  const [persisting, setPersisting] = useState(false);

  const isTask = item?.source === "task";
  const itemCode = useMemo(() => {
    if (!item) return "";
    const prefix = item.source === "task" ? "TASK" : "TICK";
    return `${prefix}-${String(item.raw?.original_id || item.id).slice(0, 4).padStart(4, "0").toUpperCase()}`;
  }, [item]);

  // Load checklist + comments when item changes
  useEffect(() => {
    if (!item) return;
    const raw = (item.raw as any)?.checklist;
    setChecklist(Array.isArray(raw) ? raw : []);

    // Load comments by original_id
    (async () => {
      const { data } = await supabase
        .from("comments")
        .select("id, user, message, date, created_at")
        .eq("client_id", item.client_id)
        .eq("original_id", String(item.raw?.original_id || item.id))
        .order("created_at", { ascending: false })
        .limit(15);
      setActivity((data || []).map((c: any) => ({
        id: c.id,
        user: c.user,
        message: c.message,
        date: c.created_at || c.date,
      })));
    })();
  }, [item?.id]);

  if (!item) return null;

  const persistChecklist = async (next: ChecklistItem[]) => {
    if (!isTask) {
      toast.error("Checklist solo disponible en tareas");
      return;
    }
    setPersisting(true);
    setChecklist(next);
    const { error } = await (supabase.from("tasks").update({ checklist: next as any }).eq("id", item.id) as any);
    setPersisting(false);
    if (error) toast.error(error.message);
  };

  const toggleChecklistItem = (id: string) => {
    persistChecklist(checklist.map(c => c.id === id ? { ...c, done: !c.done } : c));
  };

  const addChecklistItem = () => {
    if (!newChecklistText.trim()) return;
    persistChecklist([...checklist, { id: crypto.randomUUID(), text: newChecklistText.trim(), done: false }]);
    setNewChecklistText("");
  };

  const sendComment = async () => {
    if (!comment.trim()) return;
    const { data, error } = await supabase.from("comments").insert([{
      client_id: item.client_id,
      original_id: String(item.raw?.original_id || item.id),
      user: profile?.full_name || "Sin nombre",
      message: comment.trim(),
      date: new Date().toISOString(),
      type: "task",
      avatar: (profile?.full_name || "?").split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase(),
    }]).select().single();
    if (error) { toast.error(error.message); return; }
    setActivity([{ id: data.id, user: data.user, message: data.message, date: data.created_at || data.date }, ...activity]);
    setComment("");
  };

  const statusOptions = [
    { key: "ready", label: "Por hacer" },
    { key: "in_progress", label: "En progreso" },
    { key: "blocked", label: "Bloqueada" },
    { key: "done", label: "Hecha" },
  ];

  const handleStatusChange = async (newStatus: string) => {
    await updateScrum.mutateAsync({ id: item.id, source: item.source, updates: { scrum_status: newStatus } });
    toast.success("Estado actualizado");
  };

  const initials = (n: string) => n.split(" ").map(s => s[0]).slice(0, 2).join("").toUpperCase();
  const priorityClass: Record<string, string> = {
    alta: "bg-red-50 text-red-600 border-red-200",
    critica: "bg-red-100 text-red-700 border-red-300",
    media: "bg-amber-50 text-amber-700 border-amber-200",
    baja: "bg-slate-50 text-slate-600 border-slate-200",
  };

  return (
    <Sheet open={!!item} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0">
        {/* Header bar */}
        <div className="sticky top-0 z-10 bg-background border-b border-border px-5 py-3 flex items-center gap-3">
          <Badge variant="outline" className="font-mono text-[10px] tracking-wider">{itemCode}</Badge>
          {item.priority && (
            <Badge variant="outline" className={`text-[10px] capitalize ${priorityClass[item.priority?.toLowerCase()] || priorityClass.media}`}>
              {item.priority}
            </Badge>
          )}
          <div className="ml-auto flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Copiar enlace">
              <Link2 className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="px-5 py-5 space-y-6">
          {/* Title */}
          <h2 className="text-2xl font-bold tracking-tight leading-tight">{item.title}</h2>

          {/* Field rows */}
          <div className="space-y-2.5">
            <FieldRow label="Estado">
              <select
                value={item.scrum_status || "ready"}
                onChange={(e) => handleStatusChange(e.target.value)}
                className="text-xs bg-sky-50 text-sky-700 border border-sky-200 rounded-full px-3 py-1 font-medium focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {statusOptions.map(o => <option key={o.key} value={o.key}>{o.label}</option>)}
              </select>
            </FieldRow>
            <FieldRow label="Cliente">
              <span className="flex items-center gap-1.5 text-sm">
                <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                {clientName || item.client_id}
              </span>
            </FieldRow>
            <FieldRow label="Asignado">
              <span className="flex items-center gap-2 text-sm">
                <Avatar className="h-5 w-5">
                  <AvatarFallback className="text-[9px] bg-primary/15 text-primary font-bold">{initials(item.owner || "?")}</AvatarFallback>
                </Avatar>
                {item.owner || "Sin asignar"}
              </span>
            </FieldRow>
            <FieldRow label="Puntos">
              <span className="text-sm font-bold">{item.story_points ?? "—"}</span>
            </FieldRow>
            <FieldRow label="Vence">
              <span className="flex items-center gap-1.5 text-sm">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                {item.due_date || "Sin fecha"}
              </span>
            </FieldRow>
            {sprintName && (
              <FieldRow label="Sprint">
                <span className="flex items-center gap-1.5 text-sm">
                  <Target className="h-3.5 w-3.5 text-muted-foreground" />
                  {sprintName} {daysLeft !== null && daysLeft !== undefined && <span className="text-muted-foreground">· cierra en {daysLeft}d</span>}
                </span>
              </FieldRow>
            )}
          </div>

          {/* Description */}
          {item.raw?.description && (
            <div>
              <p className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground mb-2">DESCRIPCIÓN</p>
              <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap">{item.raw.description}</p>
            </div>
          )}

          {/* Checklist */}
          {isTask && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground">CHECKLIST</p>
                <span className="text-[10px] text-muted-foreground">
                  {checklist.filter(c => c.done).length}/{checklist.length}
                </span>
              </div>
              <div className="space-y-1.5">
                {checklist.map(c => (
                  <label key={c.id} className="flex items-center gap-2.5 cursor-pointer group py-0.5">
                    <Checkbox
                      checked={c.done}
                      onCheckedChange={() => toggleChecklistItem(c.id)}
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <span className={`text-sm flex-1 ${c.done ? "line-through text-muted-foreground" : ""}`}>{c.text}</span>
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                      onClick={(e) => { e.preventDefault(); persistChecklist(checklist.filter(x => x.id !== c.id)); }}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </label>
                ))}
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    value={newChecklistText}
                    onChange={(e) => setNewChecklistText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addChecklistItem()}
                    placeholder="Agregar sub-tarea..."
                    className="h-7 text-xs"
                    disabled={persisting}
                  />
                  <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={addChecklistItem} disabled={!newChecklistText.trim()}>
                    <Plus className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* Activity */}
          <div>
            <p className="text-[10px] font-bold tracking-[0.18em] text-muted-foreground mb-3">ACTIVIDAD</p>
            <div className="space-y-3">
              {activity.length === 0 && (
                <p className="text-xs text-muted-foreground italic">Sin comentarios todavía</p>
              )}
              {activity.map(a => (
                <div key={a.id} className="flex items-start gap-2.5">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[10px] bg-amber-100 text-amber-700 font-bold">{initials(a.user)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs">
                      <strong className="font-semibold">{a.user}</strong>
                      <span className="text-muted-foreground"> · hace {formatDistanceToNow(new Date(a.date), { locale: es })}</span>
                    </p>
                    <p className="text-sm mt-0.5 leading-relaxed">{a.message}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Comment box */}
          <div className="flex items-center gap-2 pt-2 border-t border-border">
            <Input
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendComment(); } }}
              placeholder="Agregar comentario..."
              className="text-sm"
            />
            <Button size="icon" onClick={sendComment} disabled={!comment.trim()} className="shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function FieldRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] items-center gap-3">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div>{children}</div>
    </div>
  );
}
