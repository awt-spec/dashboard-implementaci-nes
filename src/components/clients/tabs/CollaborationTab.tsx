import { useState } from "react";
import { type Comment } from "@/data/projectData";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageSquare, ThumbsUp, Send, Bell, Plus, Trash2 } from "lucide-react";
import { useCreateComment, useDeleteComment } from "@/hooks/useClients";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { motion } from "framer-motion";

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
  const [createOpen, setCreateOpen] = useState(false);
  const [user, setUser] = useState("");
  const [message, setMessage] = useState("");
  const [type, setType] = useState("comentario");

  const createComment = useCreateComment();
  const deleteComment = useDeleteComment();

  const handleCreate = () => {
    if (!user.trim() || !message.trim()) { toast.error("Usuario y mensaje son obligatorios"); return; }
    const avatar = user.trim().split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
    createComment.mutate({
      client_id: clientId, original_id: `c-${Date.now()}`, user: user.trim(), avatar,
      message: message.trim(), date: new Date().toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" }), type,
    }, {
      onSuccess: () => { toast.success("Comentario agregado"); setCreateOpen(false); setUser(""); setMessage(""); },
      onError: () => toast.error("Error al crear"),
    });
  };

  const handleDelete = async (comment: Comment) => {
    const { data } = await supabase.from("comments").select("id").eq("client_id", clientId).eq("original_id", comment.id).single();
    if (!data) return;
    deleteComment.mutate(data.id, { onSuccess: () => toast.success("Comentario eliminado"), onError: () => toast.error("Error") });
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
                <div className="flex justify-end gap-2 pt-2"><Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button><Button onClick={handleCreate}>Agregar</Button></div>
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
                  <motion.div whileHover={{ scale: 1.2 }} whileTap={{ scale: 0.9 }} className="ml-auto">
                    <Button variant="ghost" size="icon" className="h-5 w-5 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground transition-all" onClick={() => handleDelete(comment)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </motion.div>
                </div>
                <p className="text-sm text-muted-foreground">{comment.message}</p>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
