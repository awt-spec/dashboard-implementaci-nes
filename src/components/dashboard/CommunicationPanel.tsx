import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  MessageSquare, ThumbsUp, Send, Bell, Plus, MessageCircle,
  Link2, FileCheck, ListTodo, ChevronDown, CheckCircle2,
  Clock, Hash, ArrowLeft, Paperclip, Search, Filter
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { type Client } from "@/data/projectData";

interface Thread {
  id: string;
  client_id: string;
  subject: string;
  linked_task_id: string | null;
  linked_deliverable_id: string | null;
  linked_thread_id: string | null;
  category: string;
  status: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  messages?: ThreadMessage[];
  _messageCount?: number;
  _lastMessage?: string;
}

interface ThreadMessage {
  id: string;
  thread_id: string;
  user_name: string;
  user_avatar: string;
  message: string;
  message_type: string;
  created_at: string;
}

const categoryConfig: Record<string, { label: string; emoji: string; color: string }> = {
  general: { label: "General", emoji: "💬", color: "text-info" },
  aprobacion: { label: "Aprobación", emoji: "👍", color: "text-success" },
  solicitud: { label: "Solicitud", emoji: "📨", color: "text-warning" },
  alerta: { label: "Alerta", emoji: "🔔", color: "text-destructive" },
  feedback: { label: "Feedback", emoji: "⭐", color: "text-primary" },
};

const statusConfig: Record<string, { label: string; color: string }> = {
  abierto: { label: "Abierto", color: "bg-success/15 text-success" },
  resuelto: { label: "Resuelto", color: "bg-muted text-muted-foreground" },
  "en-espera": { label: "En Espera", color: "bg-warning/15 text-warning" },
};

function useThreads(clientId: string) {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchThreads = useCallback(async () => {
    const { data: threadsData } = await supabase
      .from("communication_threads")
      .select("*")
      .eq("client_id", clientId)
      .order("updated_at", { ascending: false });

    if (!threadsData) { setLoading(false); return; }

    // Fetch messages for all threads
    const threadIds = threadsData.map(t => t.id);
    const { data: messagesData } = await supabase
      .from("thread_messages")
      .select("*")
      .in("thread_id", threadIds.length > 0 ? threadIds : ["none"])
      .order("created_at", { ascending: true });

    const messagesByThread: Record<string, ThreadMessage[]> = {};
    (messagesData || []).forEach(m => {
      if (!messagesByThread[m.thread_id]) messagesByThread[m.thread_id] = [];
      messagesByThread[m.thread_id].push(m);
    });

    const enriched = threadsData.map(t => ({
      ...t,
      messages: messagesByThread[t.id] || [],
      _messageCount: (messagesByThread[t.id] || []).length,
      _lastMessage: (messagesByThread[t.id] || []).slice(-1)[0]?.message || "",
    }));

    setThreads(enriched);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  return { threads, loading, refetch: fetchThreads };
}

interface CommunicationPanelProps {
  client: Client;
}

export function CommunicationPanel({ client }: CommunicationPanelProps) {
  const { profile } = useAuth();
  const { threads, loading, refetch } = useThreads(client.id);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");

  // New thread form
  const [subject, setSubject] = useState("");
  const [category, setCategory] = useState("general");
  const [linkedType, setLinkedType] = useState<"none" | "task" | "deliverable">("none");
  const [linkedId, setLinkedId] = useState("");
  const [firstMessage, setFirstMessage] = useState("");

  // Reply
  const [replyMessage, setReplyMessage] = useState("");
  const [replyType, setReplyType] = useState("comentario");

  const tasks = client.tasks.filter(t => t.visibility === "externa");
  const deliverables = client.deliverables;

  const handleCreateThread = async () => {
    if (!subject.trim() || !firstMessage.trim()) {
      toast.error("Completa el tema y el primer mensaje");
      return;
    }
    const userName = profile?.full_name || "Cliente";
    const avatar = userName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

    const threadPayload: any = {
      client_id: client.id,
      subject: subject.trim(),
      category,
      created_by: userName,
    };
    if (linkedType === "task" && linkedId) threadPayload.linked_task_id = linkedId;
    if (linkedType === "deliverable" && linkedId) threadPayload.linked_deliverable_id = linkedId;

    const { data: newThread, error } = await supabase
      .from("communication_threads")
      .insert(threadPayload)
      .select()
      .single();

    if (error || !newThread) { toast.error("Error al crear tema"); return; }

    await supabase.from("thread_messages").insert({
      thread_id: newThread.id,
      user_name: userName,
      user_avatar: avatar,
      message: firstMessage.trim(),
      message_type: category === "general" ? "comentario" : category,
    });

    toast.success("Tema creado");
    setNewThreadOpen(false);
    setSubject("");
    setCategory("general");
    setLinkedType("none");
    setLinkedId("");
    setFirstMessage("");
    await refetch();
    // Open the new thread
    const updated = await supabase.from("communication_threads").select("*").eq("id", newThread.id).single();
    if (updated.data) {
      const { data: msgs } = await supabase.from("thread_messages").select("*").eq("thread_id", newThread.id).order("created_at");
      setActiveThread({ ...updated.data, messages: msgs || [], _messageCount: msgs?.length || 0, _lastMessage: "" });
    }
  };

  const handleReply = async () => {
    if (!replyMessage.trim() || !activeThread) return;
    const userName = profile?.full_name || "Cliente";
    const avatar = userName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);

    const { error } = await supabase.from("thread_messages").insert({
      thread_id: activeThread.id,
      user_name: userName,
      user_avatar: avatar,
      message: replyMessage.trim(),
      message_type: replyType,
    });

    if (error) { toast.error("Error al enviar"); return; }

    // Update thread timestamp
    await supabase.from("communication_threads").update({ updated_at: new Date().toISOString() }).eq("id", activeThread.id);

    setReplyMessage("");
    await refetch();
    // Refresh active thread messages
    const { data: msgs } = await supabase.from("thread_messages").select("*").eq("thread_id", activeThread.id).order("created_at");
    setActiveThread(prev => prev ? { ...prev, messages: msgs || [], _messageCount: msgs?.length || 0 } : null);
  };

  const handleStatusChange = async (threadId: string, newStatus: string) => {
    await supabase.from("communication_threads").update({ status: newStatus }).eq("id", threadId);
    toast.success("Estado actualizado");
    await refetch();
    if (activeThread?.id === threadId) {
      setActiveThread(prev => prev ? { ...prev, status: newStatus } : null);
    }
  };

  const filteredThreads = threads.filter(t => {
    if (filterCategory !== "all" && t.category !== filterCategory) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (search && !t.subject.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Find linked names
  const getLinkedLabel = (thread: Thread) => {
    if (thread.linked_task_id) {
      const task = tasks.find(t => String(t.id) === thread.linked_task_id);
      return task ? { type: "Actividad", name: task.title, icon: ListTodo } : null;
    }
    if (thread.linked_deliverable_id) {
      const del = deliverables.find(d => d.id === thread.linked_deliverable_id);
      return del ? { type: "Entregable", name: del.name, icon: FileCheck } : null;
    }
    return null;
  };

  // Stats
  const stats = Object.entries(categoryConfig).map(([key, cfg]) => ({
    key, ...cfg, count: threads.filter(t => t.category === key).length,
  }));
  const openCount = threads.filter(t => t.status === "abierto").length;

  // ── Thread detail view ──
  if (activeThread) {
    const linked = getLinkedLabel(activeThread);
    const catCfg = categoryConfig[activeThread.category] || categoryConfig.general;
    const stCfg = statusConfig[activeThread.status] || statusConfig.abierto;

    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setActiveThread(null)}>
          <ArrowLeft className="h-4 w-4" /> Volver a temas
        </Button>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">{catCfg.emoji}</span>
                  <CardTitle className="text-base">{activeThread.subject}</CardTitle>
                </div>
                <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                  <span>Creado por {activeThread.created_by}</span>
                  <span>•</span>
                  <span>{new Date(activeThread.created_at).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })}</span>
                  {linked && (
                    <>
                      <span>•</span>
                      <span className="flex items-center gap-1 text-primary">
                        <linked.icon className="h-3 w-3" />
                        {linked.type}: {linked.name}
                      </span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Select value={activeThread.status} onValueChange={v => handleStatusChange(activeThread.id, v)}>
                  <SelectTrigger className="h-7 w-auto border-0 p-0 shadow-none">
                    <Badge className={`${stCfg.color} text-[10px] cursor-pointer`}>{stCfg.label}</Badge>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusConfig).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[400px]">
              <div className="space-y-1 pr-2">
                {(activeThread.messages || []).map((msg, idx) => {
                  const isOwn = msg.user_name === profile?.full_name;
                  const msgType = categoryConfig[msg.message_type] || categoryConfig.general;
                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: Math.min(idx * 0.03, 0.3) }}
                      className={`flex gap-3 p-3 rounded-xl hover:bg-muted/20 transition-colors ${isOwn ? "flex-row-reverse" : ""}`}
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className={`text-[10px] font-bold ${isOwn ? "bg-primary/15 text-primary" : "bg-info/15 text-info"}`}>
                          {msg.user_avatar}
                        </AvatarFallback>
                      </Avatar>
                      <div className={`flex-1 min-w-0 ${isOwn ? "text-right" : ""}`}>
                        <div className={`flex items-center gap-2 mb-1 ${isOwn ? "justify-end" : ""}`}>
                          <span className="text-xs font-semibold text-foreground">{msg.user_name}</span>
                          {msg.message_type !== "comentario" && (
                            <Badge variant="outline" className={`text-[9px] px-1.5 py-0 ${msgType.color}`}>
                              {msgType.emoji} {msgType.label}
                            </Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(msg.created_at).toLocaleDateString("es", { day: "2-digit", month: "short" })} {new Date(msg.created_at).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                        <div className={`inline-block rounded-xl px-3.5 py-2.5 text-sm leading-relaxed max-w-[85%] ${
                          isOwn ? "bg-primary/10 text-foreground rounded-tr-sm" : "bg-muted/50 text-foreground rounded-tl-sm"
                        }`}>
                          {msg.message}
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </ScrollArea>

            {/* Reply box */}
            <div className="mt-4 pt-4 border-t border-border space-y-3">
              <div className="flex items-center gap-2">
                <Select value={replyType} onValueChange={setReplyType}>
                  <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="comentario">💬 Comentario</SelectItem>
                    <SelectItem value="aprobacion">👍 Aprobación</SelectItem>
                    <SelectItem value="solicitud">📨 Solicitud</SelectItem>
                    <SelectItem value="alerta">🔔 Alerta</SelectItem>
                    <SelectItem value="feedback">⭐ Feedback</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2">
                <Textarea
                  value={replyMessage}
                  onChange={e => setReplyMessage(e.target.value)}
                  className="min-h-[60px] resize-none flex-1"
                  placeholder="Escriba su respuesta..."
                  onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleReply(); }}
                />
                <Button onClick={handleReply} disabled={!replyMessage.trim()} className="self-end gap-1.5">
                  <Send className="h-4 w-4" /> Enviar
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">Ctrl+Enter para enviar rápido</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── Thread list view ──
  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {stats.map((s, i) => (
          <motion.div key={s.key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Card
              className={`cursor-pointer transition-all hover:shadow-md ${filterCategory === s.key ? "ring-2 ring-primary" : ""}`}
              onClick={() => setFilterCategory(filterCategory === s.key ? "all" : s.key)}
            >
              <CardContent className="p-3 flex items-center gap-2">
                <span className="text-xl">{s.emoji}</span>
                <div>
                  <p className="text-base font-bold text-foreground">{s.count}</p>
                  <p className="text-[9px] text-muted-foreground uppercase">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar temas..."
            className="pl-9 h-9"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-9 w-[130px] text-xs"><Filter className="h-3.5 w-3.5 mr-1" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="abierto">Abiertos</SelectItem>
            <SelectItem value="resuelto">Resueltos</SelectItem>
            <SelectItem value="en-espera">En Espera</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="text-xs shrink-0">{openCount} abiertos</Badge>

        <Dialog open={newThreadOpen} onOpenChange={setNewThreadOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 ml-auto"><Plus className="h-4 w-4" /> Nuevo Tema</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader><DialogTitle>Crear Nuevo Tema de Conversación</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div>
                <label className="text-xs font-medium text-foreground">Asunto</label>
                <Input value={subject} onChange={e => setSubject(e.target.value)} className="mt-1.5" placeholder="Ej: Revisión del entregable de configuración" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground">Categoría</label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(categoryConfig).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.emoji} {v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground">Vincular a</label>
                  <Select value={linkedType} onValueChange={v => { setLinkedType(v as any); setLinkedId(""); }}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin vínculo</SelectItem>
                      <SelectItem value="task">Actividad</SelectItem>
                      <SelectItem value="deliverable">Entregable</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {linkedType === "task" && (
                <div>
                  <label className="text-xs font-medium text-foreground">Seleccionar Actividad</label>
                  <Select value={linkedId} onValueChange={setLinkedId}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                    <SelectContent>
                      {tasks.map(t => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          <span className="truncate">{t.title}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {linkedType === "deliverable" && (
                <div>
                  <label className="text-xs font-medium text-foreground">Seleccionar Entregable</label>
                  <Select value={linkedId} onValueChange={setLinkedId}>
                    <SelectTrigger className="mt-1.5"><SelectValue placeholder="Seleccione..." /></SelectTrigger>
                    <SelectContent>
                      {deliverables.map(d => (
                        <SelectItem key={d.id} value={d.id}>
                          <span className="truncate">{d.name}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-foreground">Primer Mensaje</label>
                <Textarea
                  value={firstMessage}
                  onChange={e => setFirstMessage(e.target.value)}
                  className="mt-1.5 min-h-[100px]"
                  placeholder="Escriba el mensaje inicial del tema..."
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setNewThreadOpen(false)}>Cancelar</Button>
                <Button onClick={handleCreateThread} disabled={!subject.trim() || !firstMessage.trim()}>
                  Crear Tema
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Thread list */}
      <div className="space-y-2">
        {loading ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">Cargando temas...</CardContent></Card>
        ) : filteredThreads.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No hay temas de conversación</p>
              <p className="text-xs text-muted-foreground/60 mt-1 mb-4">Cree un nuevo tema para iniciar la comunicación</p>
              <Button size="sm" className="gap-1.5" onClick={() => setNewThreadOpen(true)}>
                <Plus className="h-4 w-4" /> Crear Primer Tema
              </Button>
            </CardContent>
          </Card>
        ) : filteredThreads.map((thread, idx) => {
          const catCfg = categoryConfig[thread.category] || categoryConfig.general;
          const stCfg = statusConfig[thread.status] || statusConfig.abierto;
          const linked = getLinkedLabel(thread);

          return (
            <motion.div
              key={thread.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(idx * 0.03, 0.2) }}
            >
              <Card
                className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30"
                onClick={() => setActiveThread(thread)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 text-lg">
                      {catCfg.emoji}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-sm font-semibold text-foreground truncate">{thread.subject}</h4>
                        <Badge className={`${stCfg.color} text-[9px] shrink-0`}>{stCfg.label}</Badge>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground flex-wrap">
                        <span>{thread.created_by}</span>
                        <span>•</span>
                        <span>{new Date(thread.updated_at).toLocaleDateString("es", { day: "2-digit", month: "short" })}</span>
                        <span className="flex items-center gap-0.5">
                          <MessageSquare className="h-3 w-3" /> {thread._messageCount || 0}
                        </span>
                        {linked && (
                          <span className="flex items-center gap-1 text-primary">
                            <Link2 className="h-3 w-3" />
                            {linked.type}: {linked.name}
                          </span>
                        )}
                      </div>
                      {thread._lastMessage && (
                        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-1">{thread._lastMessage}</p>
                      )}
                    </div>
                    <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0 -rotate-90" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
