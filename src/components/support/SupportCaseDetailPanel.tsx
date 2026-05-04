import { useState, useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckSquare, Plus, Trash2, X, Link2, Tag, Paperclip, MessageSquare,
  Globe, Lock, Loader2, ExternalLink, Target
} from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import type { SupportTicket } from "@/hooks/useSupportTickets";
import {
  useTicketSubtasks, useCreateTicketSubtask, useToggleTicketSubtask, useDeleteTicketSubtask,
  useTicketTags, useAddTicketTag, useRemoveTicketTag,
  useTicketAttachments, useUploadTicketAttachment, useDeleteTicketAttachment,
  useTicketNotes, useCreateTicketNote, useDeleteTicketNote,
  useTicketDependencies, useAddTicketDependency, useRemoveTicketDependency,
  useAvailableTickets,
} from "@/hooks/useSupportTicketDetails";
import { SupportCaseScrumSection } from "./SupportCaseScrumSection";
import { CaseCompliancePanel } from "./CaseCompliancePanel";
import { TicketLegacyView } from "./TicketLegacyView";
import { Shield, ScrollText } from "lucide-react";
import { useSupportClients } from "@/hooks/useSupportTickets";

const TAG_COLORS = ["#6366f1", "#ec4899", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6", "#06b6d4", "#f97316"];

interface Props {
  ticket: SupportTicket;
  teamMembers?: string[];
}

export function SupportCaseDetailPanel({ ticket }: Props) {
  const t = ticket;
  const { data: clients = [] } = useSupportClients();
  const clientForTicket = clients.find(c => c.id === t.client_id);

  // Subtasks
  const { data: subtasks = [] } = useTicketSubtasks(t.id);
  const createSubtask = useCreateTicketSubtask();
  const toggleSubtask = useToggleTicketSubtask();
  const deleteSubtask = useDeleteTicketSubtask();
  const [newSubtask, setNewSubtask] = useState("");

  // Tags
  const { data: tags = [] } = useTicketTags(t.id);
  const addTag = useAddTicketTag();
  const removeTag = useRemoveTicketTag();
  const [newTag, setNewTag] = useState("");
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0]);

  // Attachments
  const { data: attachments = [] } = useTicketAttachments(t.id);
  const uploadAttachment = useUploadTicketAttachment();
  const deleteAttachment = useDeleteTicketAttachment();
  const fileRef = useRef<HTMLInputElement>(null);

  // Notes
  const { data: notes = [] } = useTicketNotes(t.id);
  const createNote = useCreateTicketNote();
  const deleteNote = useDeleteTicketNote();
  const [newNote, setNewNote] = useState("");
  const [noteVisibility, setNoteVisibility] = useState<"interna" | "externa">("interna");

  // Dependencies
  const { data: dependencies = [] } = useTicketDependencies(t.id);
  const addDep = useAddTicketDependency();
  const removeDep = useRemoveTicketDependency();
  const { data: availableTickets = [] } = useAvailableTickets(t.client_id, t.id);
  const [depTicketId, setDepTicketId] = useState("");

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    createSubtask.mutate(
      { ticket_id: t.id, title: newSubtask.trim(), sort_order: subtasks.length },
      { onSuccess: () => { setNewSubtask(""); toast.success("Subtarea agregada"); } }
    );
  };

  const handleAddTag = () => {
    if (!newTag.trim()) return;
    addTag.mutate(
      { ticket_id: t.id, tag: newTag.trim(), color: newTagColor },
      { onSuccess: () => { setNewTag(""); toast.success("Etiqueta agregada"); } }
    );
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("Archivo muy grande (máx 20MB)"); return; }
    uploadAttachment.mutate(
      { ticket_id: t.id, file, uploaded_by: "Sistema" },
      { onSuccess: () => { toast.success("Archivo subido"); if (fileRef.current) fileRef.current.value = ""; } }
    );
  };

  const handleAddNote = () => {
    if (!newNote.trim()) return;
    createNote.mutate(
      { ticket_id: t.id, content: newNote.trim(), author_name: "Sistema", visibility: noteVisibility },
      { onSuccess: () => { setNewNote(""); toast.success("Nota agregada"); } }
    );
  };

  const handleAddDep = () => {
    if (!depTicketId) return;
    addDep.mutate(
      { ticket_id: t.id, depends_on_ticket_id: depTicketId, dependency_type: "blocks" },
      { onSuccess: () => { setDepTicketId(""); toast.success("Dependencia agregada"); } }
    );
  };

  const completedCount = subtasks.filter(s => s.completed).length;
  const progressPct = subtasks.length > 0 ? Math.round((completedCount / subtasks.length) * 100) : 0;

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Tabs defaultValue="policy" className="w-full">
      <TabsList className="w-full h-8 bg-muted/50 flex-wrap">
        <TabsTrigger value="policy" className="text-[10px] h-6 px-2 gap-1 flex-1">
          <Shield className="h-3 w-3" />Política
        </TabsTrigger>
        <TabsTrigger value="legacy" className="text-[10px] h-6 px-2 gap-1 flex-1">
          <ScrollText className="h-3 w-3" />Vista clásica
        </TabsTrigger>
        <TabsTrigger value="scrum" className="text-[10px] h-6 px-2 gap-1 flex-1">
          <Target className="h-3 w-3" />Scrum
        </TabsTrigger>
        <TabsTrigger value="subtasks" className="text-[10px] h-6 px-2 gap-1 flex-1">
          <CheckSquare className="h-3 w-3" />Sub
          {subtasks.length > 0 && <Badge variant="secondary" className="text-[8px] h-3.5 px-1">{subtasks.length}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="deps" className="text-[10px] h-6 px-2 gap-1 flex-1">
          <Link2 className="h-3 w-3" />Deps
          {dependencies.length > 0 && <Badge variant="secondary" className="text-[8px] h-3.5 px-1">{dependencies.length}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="tags" className="text-[10px] h-6 px-2 gap-1 flex-1">
          <Tag className="h-3 w-3" />Tags
          {tags.length > 0 && <Badge variant="secondary" className="text-[8px] h-3.5 px-1">{tags.length}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="files" className="text-[10px] h-6 px-2 gap-1 flex-1">
          <Paperclip className="h-3 w-3" />Arch
          {attachments.length > 0 && <Badge variant="secondary" className="text-[8px] h-3.5 px-1">{attachments.length}</Badge>}
        </TabsTrigger>
        <TabsTrigger value="notes" className="text-[10px] h-6 px-2 gap-1 flex-1">
          <MessageSquare className="h-3 w-3" />Notas
          {notes.length > 0 && <Badge variant="secondary" className="text-[8px] h-3.5 px-1">{notes.length}</Badge>}
        </TabsTrigger>
      </TabsList>

      {/* Política v4.5 */}
      <TabsContent value="policy" className="mt-3">
        <CaseCompliancePanel ticketId={ticket.id} clientId={(ticket as any).client_id} />
      </TabsContent>

      {/* Vista clásica (replica del formulario Gurunet legacy) */}
      <TabsContent value="legacy" className="mt-3">
        <TicketLegacyView ticket={ticket} client={clientForTicket || null} canEditInternal={true} />
      </TabsContent>

      {/* Scrum */}
      <TabsContent value="scrum" className="mt-3">
        <SupportCaseScrumSection ticket={ticket} />
      </TabsContent>

      {/* Subtasks */}
      <TabsContent value="subtasks" className="mt-3 space-y-3">
        {subtasks.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>{completedCount}/{subtasks.length} completadas</span>
              <span>{progressPct}%</span>
            </div>
            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${progressPct}%` }} />
            </div>
          </div>
        )}
        <div className="space-y-1">
          {subtasks.map(s => (
            <motion.div key={s.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="group flex items-center gap-2 p-2 rounded-lg hover:bg-muted/30 transition-colors">
              <Checkbox checked={s.completed}
                onCheckedChange={checked => toggleSubtask.mutate({ id: s.id, completed: !!checked, ticket_id: t.id })} />
              <span className={`flex-1 text-xs ${s.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>{s.title}</span>
              <button onClick={() => deleteSubtask.mutate({ id: s.id, ticket_id: t.id })}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 rounded">
                <Trash2 className="h-3 w-3" />
              </button>
            </motion.div>
          ))}
        </div>
        <div className="flex gap-2">
          <Input className="text-xs h-8 flex-1" placeholder="Nueva subtarea..." value={newSubtask}
            onChange={e => setNewSubtask(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddSubtask()} />
          <Button size="sm" className="h-8 px-3 text-xs gap-1" onClick={handleAddSubtask} disabled={!newSubtask.trim()}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </TabsContent>

      {/* Dependencies */}
      <TabsContent value="deps" className="mt-3 space-y-3">
        <div className="space-y-2">
          {dependencies.map(d => (
            <motion.div key={d.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="group flex items-center gap-2 p-2.5 rounded-lg border border-border/50 bg-card">
              <Link2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{d.depends_on_ticket?.ticket_id} — {d.depends_on_ticket?.asunto || "..."}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="outline" className="text-[9px] h-4">{d.dependency_type === "blocks" ? "Bloquea" : d.dependency_type}</Badge>
                  {d.depends_on_ticket?.estado && <Badge variant="secondary" className="text-[9px] h-4">{d.depends_on_ticket.estado}</Badge>}
                </div>
              </div>
              <button onClick={() => removeDep.mutate({ id: d.id, ticket_id: t.id })}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 rounded">
                <Trash2 className="h-3 w-3" />
              </button>
            </motion.div>
          ))}
          {dependencies.length === 0 && <p className="text-[11px] text-muted-foreground/60 italic">Sin dependencias</p>}
        </div>
        <div className="flex gap-2">
          <Select value={depTicketId || "__none__"} onValueChange={v => setDepTicketId(v === "__none__" ? "" : v)}>
            <SelectTrigger className="h-8 text-xs flex-1"><SelectValue placeholder="Seleccionar caso..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Seleccionar...</SelectItem>
              {availableTickets.filter(at => !dependencies.some(d => d.depends_on_ticket_id === at.id)).map(at => (
                <SelectItem key={at.id} value={at.id}>{at.ticket_id} — {at.asunto.slice(0, 40)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" className="h-8 px-3 text-xs gap-1" onClick={handleAddDep} disabled={!depTicketId}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </TabsContent>

      {/* Tags */}
      <TabsContent value="tags" className="mt-3 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {tags.map(tag => (
            <motion.div key={tag.id} initial={{ scale: 0.8 }} animate={{ scale: 1 }}
              className="group inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium border"
              style={{ backgroundColor: `${tag.color}15`, borderColor: `${tag.color}40`, color: tag.color }}>
              {tag.tag}
              <button onClick={() => removeTag.mutate({ id: tag.id, ticket_id: t.id })}
                className="opacity-0 group-hover:opacity-100 hover:text-destructive ml-0.5">
                <X className="h-2.5 w-2.5" />
              </button>
            </motion.div>
          ))}
          {tags.length === 0 && <p className="text-[11px] text-muted-foreground/60 italic">Sin etiquetas</p>}
        </div>
        <div className="flex gap-2 items-center">
          <Input className="text-xs h-8 flex-1" placeholder="Nueva etiqueta..." value={newTag}
            onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === "Enter" && handleAddTag()} />
          <div className="flex gap-1">
            {TAG_COLORS.map(c => (
              <button key={c} onClick={() => setNewTagColor(c)}
                className={`h-5 w-5 rounded-full border-2 transition-transform ${newTagColor === c ? "scale-125 border-foreground" : "border-transparent"}`}
                style={{ backgroundColor: c }} />
            ))}
          </div>
          <Button size="sm" className="h-8 px-3 text-xs" onClick={handleAddTag} disabled={!newTag.trim()}>
            <Plus className="h-3 w-3" />
          </Button>
        </div>
      </TabsContent>

      {/* Attachments */}
      <TabsContent value="files" className="mt-3 space-y-3">
        <div className="space-y-2">
          {attachments.map(a => (
            <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="group flex items-center gap-3 p-2.5 rounded-lg border border-border/50 bg-card">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Paperclip className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{a.file_name}</p>
                <p className="text-[10px] text-muted-foreground">{formatSize(a.file_size)} · {new Date(a.created_at).toLocaleDateString("es")}</p>
              </div>
              <a href={a.file_url} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-muted/50">
                <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
              </a>
              <button onClick={() => deleteAttachment.mutate({ id: a.id, ticket_id: t.id })}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 rounded">
                <Trash2 className="h-3 w-3" />
              </button>
            </motion.div>
          ))}
          {attachments.length === 0 && <p className="text-[11px] text-muted-foreground/60 italic">Sin archivos adjuntos</p>}
        </div>
        <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload} />
        <Button variant="outline" size="sm" className="w-full h-8 text-xs gap-1.5 border-dashed"
          onClick={() => fileRef.current?.click()} disabled={uploadAttachment.isPending}>
          {uploadAttachment.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Paperclip className="h-3 w-3" />}
          Subir archivo
        </Button>
      </TabsContent>

      {/* Notes */}
      <TabsContent value="notes" className="mt-3 space-y-3">
        <div className="space-y-2">
          {notes.map(n => (
            <motion.div key={n.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className={`group p-3 rounded-lg border ${n.visibility === "interna" ? "border-amber-500/20 bg-amber-500/5" : "border-blue-500/20 bg-blue-500/5"}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs text-foreground leading-relaxed flex-1">{n.content}</p>
                <button onClick={() => deleteNote.mutate({ id: n.id, ticket_id: t.id })}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-1 rounded shrink-0">
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                <span>{n.author_name}</span>
                <span>·</span>
                <span>{new Date(n.created_at).toLocaleDateString("es")}</span>
                <Badge variant="outline" className={`text-[8px] h-3.5 px-1 gap-0.5 ${n.visibility === "interna" ? "border-amber-500/30 text-amber-400" : "border-blue-500/30 text-blue-400"}`}>
                  {n.visibility === "interna" ? <Lock className="h-2 w-2" /> : <Globe className="h-2 w-2" />}
                  {n.visibility}
                </Badge>
              </div>
            </motion.div>
          ))}
          {notes.length === 0 && <p className="text-[11px] text-muted-foreground/60 italic">Sin notas</p>}
        </div>
        <div className="space-y-2">
          <Textarea className="text-xs min-h-[60px]" placeholder="Agregar nota..." value={newNote}
            onChange={e => setNewNote(e.target.value)} />
          <div className="flex items-center gap-2 justify-between">
            <div className="flex gap-1">
              <Button variant={noteVisibility === "interna" ? "default" : "outline"} size="sm"
                className="h-7 text-[10px] px-2 gap-1" onClick={() => setNoteVisibility("interna")}>
                <Lock className="h-2.5 w-2.5" /> Interna
              </Button>
              <Button variant={noteVisibility === "externa" ? "default" : "outline"} size="sm"
                className="h-7 text-[10px] px-2 gap-1" onClick={() => setNoteVisibility("externa")}>
                <Globe className="h-2.5 w-2.5" /> Externa
              </Button>
            </div>
            <Button size="sm" className="h-7 text-xs px-3 gap-1" onClick={handleAddNote} disabled={!newNote.trim()}>
              <Plus className="h-3 w-3" /> Agregar
            </Button>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
