import { useState } from "react";
import { type Comment } from "@/data/projectData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageSquare, ThumbsUp, Send, Bell, Plus, Trash2, Pencil, Paperclip, Download, X, Check, Loader2 } from "lucide-react";
import {
  useCreateComment, useUpdateComment, useDeleteComment,
  uploadCommentAttachment, getCommentAttachmentUrl,
} from "@/hooks/useClients";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const commentTypeConfig = {
  comentario: { icon: MessageSquare, color: "text-info" },
  aprobacion: { icon: ThumbsUp, color: "text-success" },
  solicitud: { icon: Send, color: "text-warning" },
  alerta: { icon: Bell, color: "text-destructive" },
};

interface CollaborationTabProps {
  comments: Comment[];
  clientId: string;
}

export function CollaborationTab({ comments, clientId }: CollaborationTabProps) {
  const { user: authUser, role, profile } = useAuth();
  const isStaff = role && role !== "cliente";

  const [createOpen, setCreateOpen] = useState(false);
  const [user, setUser] = useState(profile?.full_name ?? "");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("comentario");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const createComment = useCreateComment();
  const updateComment = useUpdateComment();
  const deleteComment = useDeleteComment();

  const canModify = (c: Comment) => isStaff || (!!c.authorUserId && c.authorUserId === authUser?.id);

  const handleCreate = async () => {
    if (!user.trim() || !message.trim()) { toast.error("Usuario y mensaje son obligatorios"); return; }
    const avatar = user.trim().split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
    let attachment: { path: string; name: string; size: number } | null = null;
    if (file) {
      setUploading(true);
      attachment = await uploadCommentAttachment(clientId, file);
      setUploading(false);
      if (!attachment) { toast.error("No se pudo subir el archivo"); return; }
    }
    createComment.mutate({
      client_id: clientId, original_id: `c-${Date.now()}`, user: user.trim(), avatar,
      message: message.trim(),
      date: new Date().toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" }),
      type,
      attachment_path: attachment?.path ?? null,
      attachment_name: attachment?.name ?? null,
      attachment_size: attachment?.size ?? null,
    }, {
      onSuccess: () => { toast.success("Comentario agregado"); setCreateOpen(false); setMessage(""); setFile(null); },
      onError: (e: any) => toast.error(e?.message || "Error al crear"),
    });
  };

  const handleSaveEdit = (c: Comment) => {
    if (!c.dbId) { toast.error("Comentario legacy sin id editable"); return; }
    if (!editText.trim()) { toast.error("El mensaje no puede estar vacío"); return; }
    updateComment.mutate({ id: c.dbId, message: editText.trim() }, {
      onSuccess: () => { toast.success("Comentario editado"); setEditingId(null); },
      onError: (e: any) => toast.error(e?.message || "No se pudo editar (¿es tuyo?)"),
    });
  };

  const handleDelete = (c: Comment) => {
    if (!c.dbId) { toast.error("Comentario legacy sin id"); return; }
    if (!confirm("¿Eliminar este comentario?")) return;
    deleteComment.mutate(c.dbId, {
      onSuccess: () => toast.success("Comentario eliminado"),
      onError: (e: any) => toast.error(e?.message || "No se pudo eliminar (¿es tuyo?)"),
    });
  };

  const handleDownload = async (path: string, name: string) => {
    const url = await getCommentAttachmentUrl(path);
    if (!url) { toast.error("No se pudo obtener el archivo"); return; }
    const a = document.createElement("a");
    a.href = url; a.download = name; a.target = "_blank"; a.click();
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Comunicación y Feedback</CardTitle>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5 h-7 text-xs"><Plus className="h-3 w-3" /> Nuevo</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Nuevo Comentario</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-xs font-medium text-foreground">Usuario *</label><Input value={user} onChange={e => setUser(e.target.value)} className="mt-1" /></div>
                  <div><label className="text-xs font-medium text-foreground">Tipo</label>
                    <Select value={type} onValueChange={setType}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="comentario">Comentario</SelectItem><SelectItem value="aprobacion">Aprobación</SelectItem><SelectItem value="solicitud">Solicitud</SelectItem><SelectItem value="alerta">Alerta</SelectItem></SelectContent></Select>
                  </div>
                </div>
                <div><label className="text-xs font-medium text-foreground">Mensaje *</label><Textarea value={message} onChange={e => setMessage(e.target.value)} className="mt-1 min-h-[80px]" /></div>
                <div>
                  <label className="text-xs font-medium text-foreground">Adjunto (opcional)</label>
                  <div className="mt-1 flex items-center gap-2">
                    <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs px-2 py-1.5 rounded-md border hover:bg-accent">
                      <Paperclip className="h-3.5 w-3.5" /> {file ? "Cambiar" : "Adjuntar archivo"}
                      <input type="file" className="hidden" onChange={e => setFile(e.target.files?.[0] ?? null)} />
                    </label>
                    {file && (
                      <span className="text-[11px] text-muted-foreground flex items-center gap-1 min-w-0">
                        <span className="truncate max-w-[160px]">{file.name}</span>
                        <button onClick={() => setFile(null)} aria-label="Quitar archivo"><X className="h-3 w-3" /></button>
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
                  <Button onClick={handleCreate} disabled={createComment.isPending || uploading} className="gap-1.5">
                    {(createComment.isPending || uploading) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Agregar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {comments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Sin comentarios</p>
        ) : comments.map(comment => {
          const typeConfig = commentTypeConfig[comment.type];
          const TypeIcon = typeConfig.icon;
          const editable = canModify(comment);
          const isEditing = editingId === comment.id;
          return (
            <div key={comment.id} className="flex items-start gap-3 group">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{comment.avatar}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-foreground">{comment.user}</span>
                  <TypeIcon className={`h-3.5 w-3.5 ${typeConfig.color}`} />
                  <span className="text-[10px] text-muted-foreground">{comment.date}</span>
                  {comment.editedAt && <span className="text-[10px] text-muted-foreground italic">· editado</span>}
                  {editable && !isEditing && (
                    <div className="ml-auto flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => { setEditingId(comment.id); setEditText(comment.message); }} aria-label="Editar comentario">
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-5 w-5 hover:bg-destructive hover:text-destructive-foreground" onClick={() => handleDelete(comment)} aria-label="Eliminar comentario">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                </div>

                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea value={editText} onChange={e => setEditText(e.target.value)} className="min-h-[60px] text-sm" autoFocus />
                    <div className="flex gap-2">
                      <Button size="sm" className="h-7 text-xs gap-1" onClick={() => handleSaveEdit(comment)} disabled={updateComment.isPending}>
                        {updateComment.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />} Guardar
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingId(null)}>Cancelar</Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">{comment.message}</p>
                )}

                {comment.attachmentPath && comment.attachmentName && !isEditing && (
                  <button
                    onClick={() => handleDownload(comment.attachmentPath!, comment.attachmentName!)}
                    className="mt-1.5 inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-md border bg-muted/30 hover:bg-accent transition-colors"
                  >
                    <Paperclip className="h-3 w-3" />
                    <span className="truncate max-w-[200px]">{comment.attachmentName}</span>
                    <Download className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
