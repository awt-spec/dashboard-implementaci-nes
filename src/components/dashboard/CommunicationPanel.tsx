import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import {
  MessageSquare, ThumbsUp, Send, Bell, Plus, MessageCircle,
  Link2, FileCheck, ListTodo, ChevronRight, CheckCircle2,
  Clock, ArrowLeft, Search, Filter, Pin, PinOff,
  Sparkles, CornerDownRight, CircleDot, Archive, Inbox,
  Star, Hash, Zap, Eye, Smile
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
  _lastAuthor?: string;
  _lastDate?: string;
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

const categoryConfig: Record<string, { label: string; emoji: string; icon: typeof MessageCircle; gradient: string; bg: string; text: string }> = {
  general: { label: "General", emoji: "💬", icon: MessageCircle, gradient: "from-blue-500/20 to-blue-600/10", bg: "bg-blue-500/10", text: "text-blue-600 dark:text-blue-400" },
  aprobacion: { label: "Aprobación", emoji: "✅", icon: CheckCircle2, gradient: "from-emerald-500/20 to-emerald-600/10", bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400" },
  solicitud: { label: "Solicitud", emoji: "📋", icon: Inbox, gradient: "from-amber-500/20 to-amber-600/10", bg: "bg-amber-500/10", text: "text-amber-600 dark:text-amber-400" },
  alerta: { label: "Alerta", emoji: "⚠️", icon: Zap, gradient: "from-red-500/20 to-red-600/10", bg: "bg-red-500/10", text: "text-red-600 dark:text-red-400" },
  feedback: { label: "Feedback", emoji: "⭐", icon: Star, gradient: "from-purple-500/20 to-purple-600/10", bg: "bg-purple-500/10", text: "text-purple-600 dark:text-purple-400" },
};

const statusConfig: Record<string, { label: string; color: string; icon: typeof CircleDot }> = {
  abierto: { label: "Abierto", color: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/20", icon: CircleDot },
  resuelto: { label: "Resuelto", color: "bg-muted text-muted-foreground border-border", icon: CheckCircle2 },
  "en-espera": { label: "En Espera", color: "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/20", icon: Clock },
};

const QUICK_EMOJIS = ["👍", "❤️", "😂", "😮", "😢", "🙏", "🎉", "🔥"];

interface Reaction {
  id: string;
  message_id: string;
  user_name: string;
  emoji: string;
}
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

    const enriched = threadsData.map(t => {
      const msgs = messagesByThread[t.id] || [];
      const last = msgs[msgs.length - 1];
      return {
        ...t,
        messages: msgs,
        _messageCount: msgs.length,
        _lastMessage: last?.message || "",
        _lastAuthor: last?.user_name || "",
        _lastDate: last?.created_at || t.created_at,
      };
    });

    setThreads(enriched);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { fetchThreads(); }, [fetchThreads]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`threads-${clientId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "thread_messages" }, () => {
        fetchThreads();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "communication_threads", filter: `client_id=eq.${clientId}` }, () => {
        fetchThreads();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [clientId, fetchThreads]);

  return { threads, loading, refetch: fetchThreads };
}

function relativeTime(dateStr: string) {
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "ahora";
  if (mins < 60) return `hace ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `hace ${days}d`;
  return d.toLocaleDateString("es", { day: "2-digit", month: "short" });
}

interface CommunicationPanelProps {
  client: Client;
}

export function CommunicationPanel({ client }: CommunicationPanelProps) {
  const { profile } = useAuth();
  const { threads, loading, refetch } = useThreads(client.id);
  const [activeThread, setActiveThread] = useState<Thread | null>(null);
  const [newThreadOpen, setNewThreadOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [search, setSearch] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

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

  const scrollToBottom = useCallback(() => {
    setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }, []);

  useEffect(() => {
    if (activeThread) scrollToBottom();
  }, [activeThread?.messages?.length, scrollToBottom]);

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

    const catLabel = categoryConfig[category]?.label || category;
    await supabase.from("client_notifications").insert({
      client_id: client.id,
      title: `Nuevo tema: "${subject.trim()}"`,
      message: `${userName} abrió un hilo de ${catLabel}: "${firstMessage.trim().slice(0, 80)}${firstMessage.trim().length > 80 ? "..." : ""}"`,
      type: category === "alerta" ? "warning" : "info",
    });

    toast.success("Tema creado exitosamente");
    setNewThreadOpen(false);
    setSubject("");
    setCategory("general");
    setLinkedType("none");
    setLinkedId("");
    setFirstMessage("");
    await refetch();

    const updated = await supabase.from("communication_threads").select("*").eq("id", newThread.id).single();
    if (updated.data) {
      const { data: msgs } = await supabase.from("thread_messages").select("*").eq("thread_id", newThread.id).order("created_at");
      setActiveThread({ ...updated.data, messages: msgs || [], _messageCount: msgs?.length || 0, _lastMessage: "", _lastAuthor: "", _lastDate: "" });
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

    await supabase.from("communication_threads").update({ updated_at: new Date().toISOString() }).eq("id", activeThread.id);

    const catLabel = categoryConfig[activeThread.category]?.label || activeThread.category;
    await supabase.from("client_notifications").insert({
      client_id: activeThread.client_id,
      title: `Nueva respuesta en "${activeThread.subject}"`,
      message: `${userName} respondió en el hilo de ${catLabel}: "${replyMessage.trim().slice(0, 80)}${replyMessage.trim().length > 80 ? "..." : ""}"`,
      type: activeThread.category === "alerta" ? "warning" : "info",
    });

    setReplyMessage("");
    await refetch();
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
    if (activeTab !== "all" && t.category !== activeTab) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (search && !t.subject.toLowerCase().includes(search.toLowerCase()) && !t._lastMessage?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

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

  const stats = Object.entries(categoryConfig).map(([key, cfg]) => ({
    key, ...cfg, count: threads.filter(t => t.category === key).length,
  }));
  const totalMessages = threads.reduce((acc, t) => acc + (t._messageCount || 0), 0);
  const openCount = threads.filter(t => t.status === "abierto").length;
  const resolvedCount = threads.filter(t => t.status === "resuelto").length;

  // ── Thread Detail View (WhatsApp/Teams style) ──
  if (activeThread) {
    const linked = getLinkedLabel(activeThread);
    const catCfg = categoryConfig[activeThread.category] || categoryConfig.general;
    const stCfg = statusConfig[activeThread.status] || statusConfig.abierto;
    const CatIcon = catCfg.icon;
    const StIcon = stCfg.icon;
    const myName = profile?.full_name || "";

    // Group consecutive messages from same author
    const groupedMessages: { author: string; avatar: string; isOwn: boolean; msgs: ThreadMessage[] }[] = [];
    (activeThread.messages || []).forEach((msg) => {
      const isOwn = msg.user_name === myName;
      const last = groupedMessages[groupedMessages.length - 1];
      const sameAuthor = last && last.author === msg.user_name;
      const withinTime = last && (new Date(msg.created_at).getTime() - new Date(last.msgs[last.msgs.length - 1].created_at).getTime()) < 120000;
      if (sameAuthor && withinTime) {
        last.msgs.push(msg);
      } else {
        groupedMessages.push({ author: msg.user_name, avatar: msg.user_avatar, isOwn, msgs: [msg] });
      }
    });

    return (
      <div className="flex flex-col h-[580px] rounded-xl overflow-hidden border border-border shadow-sm">
        {/* ─── Top bar (Teams style) ─── */}
        <div className="flex items-center gap-3 px-4 py-3 bg-card border-b border-border shrink-0">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground rounded-full" onClick={() => setActiveThread(null)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar className="h-9 w-9 shrink-0">
            <AvatarFallback className={`text-xs font-bold ${catCfg.bg} ${catCfg.text}`}>
              {catCfg.emoji}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="text-[13px] font-semibold text-foreground truncate">{activeThread.subject}</h3>
            <p className="text-[10px] text-muted-foreground truncate">
              {activeThread.messages?.length || 0} mensajes
              {linked && <> · <Link2 className="h-2.5 w-2.5 inline" /> {linked.name}</>}
            </p>
          </div>
          <Select value={activeThread.status} onValueChange={v => handleStatusChange(activeThread.id, v)}>
            <SelectTrigger className="h-7 w-auto border gap-1 px-2 shadow-none text-[11px] rounded-full">
              <StIcon className="h-3 w-3" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(statusConfig).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  <span className="flex items-center gap-1.5"><v.icon className="h-3 w-3" /> {v.label}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* ─── Chat messages (WhatsApp wallpaper feel) ─── */}
        <ScrollArea className="flex-1" style={{ background: "hsl(var(--muted) / 0.15)" }}>
          <div className="px-3 sm:px-6 py-4">
            {(activeThread.messages || []).map((msg, idx) => {
              const isOwn = msg.user_name === myName;
              const msgCat = categoryConfig[msg.message_type] || categoryConfig.general;
              const prevMsg = idx > 0 ? activeThread.messages![idx - 1] : null;
              const showDate = idx === 0 || new Date(msg.created_at).toDateString() !== new Date(prevMsg!.created_at).toDateString();
              const sameAuthorAsPrev = prevMsg && prevMsg.user_name === msg.user_name && (new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime()) < 120000;
              const nextMsg = idx < activeThread.messages!.length - 1 ? activeThread.messages![idx + 1] : null;
              const sameAuthorAsNext = nextMsg && nextMsg.user_name === msg.user_name && (new Date(nextMsg.created_at).getTime() - new Date(msg.created_at).getTime()) < 120000;

              // Bubble corner radius logic (WhatsApp style)
              const isFirst = !sameAuthorAsPrev;
              const isLast = !sameAuthorAsNext;
              let bubbleRadius = "rounded-lg";
              if (isOwn) {
                if (isFirst && isLast) bubbleRadius = "rounded-2xl rounded-tr-sm";
                else if (isFirst) bubbleRadius = "rounded-2xl rounded-tr-sm rounded-br-md";
                else if (isLast) bubbleRadius = "rounded-2xl rounded-br-sm";
                else bubbleRadius = "rounded-xl";
              } else {
                if (isFirst && isLast) bubbleRadius = "rounded-2xl rounded-tl-sm";
                else if (isFirst) bubbleRadius = "rounded-2xl rounded-tl-sm rounded-bl-md";
                else if (isLast) bubbleRadius = "rounded-2xl rounded-bl-sm";
                else bubbleRadius = "rounded-xl";
              }

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="flex justify-center my-4">
                      <span className="text-[10px] text-muted-foreground font-medium px-3 py-1 rounded-full bg-card shadow-sm border border-border">
                        {new Date(msg.created_at).toLocaleDateString("es", { weekday: "short", day: "numeric", month: "short" })}
                      </span>
                    </div>
                  )}

                  <div className={`flex ${isOwn ? "justify-end" : "justify-start"} ${isFirst && idx > 0 ? "mt-3" : "mt-[3px]"}`}>
                    <div className={`flex gap-1.5 ${isOwn ? "flex-row-reverse" : ""}`} style={{ maxWidth: "75%" }}>
                      {/* Avatar (only for others, only first in group) */}
                      {!isOwn && (
                        <div className="w-7 shrink-0 self-end">
                          {isLast ? (
                            <Avatar className="h-7 w-7">
                              <AvatarFallback className="text-[9px] font-bold bg-muted text-muted-foreground">
                                {msg.user_avatar}
                              </AvatarFallback>
                            </Avatar>
                          ) : null}
                        </div>
                      )}

                      {/* Bubble */}
                      <div className={`relative ${bubbleRadius} px-3 py-[7px] shadow-sm ${
                        isOwn
                          ? "bg-primary text-primary-foreground"
                          : "bg-card text-foreground border border-border"
                      }`}>
                        {/* Author name (first message in group, not own) */}
                        {isFirst && !isOwn && (
                          <p className={`text-[11px] font-semibold mb-0.5 ${msgCat.text}`}>
                            {msg.user_name}
                          </p>
                        )}

                        {/* Category tag for non-comment types */}
                        {msg.message_type !== "comentario" && isFirst && (
                          <span className={`inline-flex items-center gap-1 text-[9px] font-semibold px-1.5 py-0.5 rounded-md mb-1 ${
                            isOwn
                              ? "bg-primary-foreground/15 text-primary-foreground"
                              : `${msgCat.bg} ${msgCat.text}`
                          }`}>
                            {msgCat.emoji} {msgCat.label}
                          </span>
                        )}

                        {/* Message text */}
                        <p className="text-[13px] leading-[1.45] whitespace-pre-wrap break-words">{msg.message}</p>

                        {/* Time + read indicator */}
                        <div className={`flex items-center gap-1 justify-end mt-0.5 -mb-0.5 ${
                          isOwn ? "text-primary-foreground/45" : "text-muted-foreground/40"
                        }`}>
                          <span className="text-[9px] leading-none">
                            {new Date(msg.created_at).toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                          {isOwn && (
                            <CheckCircle2 className="h-2.5 w-2.5" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        </ScrollArea>

        {/* ─── Input bar (WhatsApp style) ─── */}
        <div className="px-3 py-2 bg-card border-t border-border shrink-0">
          <div className="flex items-end gap-2">
            {/* Type selector as emoji button */}
            <Select value={replyType} onValueChange={setReplyType}>
              <SelectTrigger className="h-10 w-10 border-0 bg-muted/40 p-0 shadow-none rounded-full shrink-0 flex items-center justify-center hover:bg-muted/70 transition-colors">
                <span className="text-base">{(categoryConfig[replyType] || categoryConfig.general).emoji}</span>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="comentario">💬 Comentario</SelectItem>
                <SelectItem value="aprobacion">✅ Aprobación</SelectItem>
                <SelectItem value="solicitud">📋 Solicitud</SelectItem>
                <SelectItem value="alerta">⚠️ Alerta</SelectItem>
                <SelectItem value="feedback">⭐ Feedback</SelectItem>
              </SelectContent>
            </Select>

            {/* Message input */}
            <div className="flex-1">
              <Textarea
                value={replyMessage}
                onChange={e => setReplyMessage(e.target.value)}
                className="min-h-[40px] max-h-[100px] resize-none text-[13px] bg-muted/20 border border-border rounded-3xl py-2.5 px-4 focus-visible:ring-1 focus-visible:ring-primary/30"
                placeholder="Escribe un mensaje..."
                rows={1}
                onKeyDown={e => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleReply();
                  }
                }}
              />
            </div>

            {/* Send button */}
            <Button
              onClick={handleReply}
              disabled={!replyMessage.trim()}
              size="icon"
              className="h-10 w-10 rounded-full shrink-0 shadow-md"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }



  // ── Thread List View ──
  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{threads.length}</p>
              <p className="text-[10px] text-muted-foreground">Conversaciones</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/5 to-emerald-500/10 border-emerald-500/20">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/15 flex items-center justify-center">
              <CircleDot className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{openCount}</p>
              <p className="text-[10px] text-muted-foreground">Abiertos</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/5 to-blue-500/10 border-blue-500/20">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-blue-500/15 flex items-center justify-center">
              <CornerDownRight className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground">{totalMessages}</p>
              <p className="text-[10px] text-muted-foreground">Mensajes</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="h-8 bg-muted/50">
            <TabsTrigger value="all" className="text-xs h-6 px-3 data-[state=active]:shadow-sm">
              Todos ({threads.length})
            </TabsTrigger>
            {stats.filter(s => s.count > 0).map(s => (
              <TabsTrigger key={s.key} value={s.key} className="text-xs h-6 px-3 data-[state=active]:shadow-sm">
                {s.emoji} {s.label} ({s.count})
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <Dialog open={newThreadOpen} onOpenChange={setNewThreadOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-1.5 h-8 rounded-lg">
              <Plus className="h-3.5 w-3.5" /> Nuevo Tema
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Nuevo Tema de Conversación
              </DialogTitle>
            </DialogHeader>
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
                        <SelectItem key={t.id} value={String(t.id)}>{t.title}</SelectItem>
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
                        <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
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
                <Button onClick={handleCreateThread} disabled={!subject.trim() || !firstMessage.trim()} className="gap-1.5">
                  <Send className="h-3.5 w-3.5" /> Crear Tema
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search + status filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar conversaciones..."
            className="pl-8 h-8 text-xs"
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="h-8 w-[120px] text-xs">
            <Filter className="h-3 w-3 mr-1" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todo</SelectItem>
            <SelectItem value="abierto">Abiertos</SelectItem>
            <SelectItem value="resuelto">Resueltos</SelectItem>
            <SelectItem value="en-espera">En Espera</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Thread list */}
      <div className="space-y-1.5">
        <AnimatePresence mode="popLayout">
          {loading ? (
            <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">Cargando conversaciones...</CardContent></Card>
          ) : filteredThreads.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <div className="h-16 w-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="h-8 w-8 text-muted-foreground/30" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Sin conversaciones</p>
                <p className="text-xs text-muted-foreground/60 mt-1 mb-5">Inicie un tema para comunicarse con el equipo</p>
                <Button size="sm" className="gap-1.5" onClick={() => setNewThreadOpen(true)}>
                  <Plus className="h-4 w-4" /> Iniciar Conversación
                </Button>
              </CardContent>
            </Card>
          ) : filteredThreads.map((thread, idx) => {
            const catCfg = categoryConfig[thread.category] || categoryConfig.general;
            const stCfg = statusConfig[thread.status] || statusConfig.abierto;
            const linked = getLinkedLabel(thread);
            const CatIcon = catCfg.icon;
            const StIcon = stCfg.icon;

            return (
              <motion.div
                key={thread.id}
                layout
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.97 }}
                transition={{ delay: Math.min(idx * 0.02, 0.15) }}
              >
                <Card
                  className="cursor-pointer transition-all hover:shadow-md hover:border-primary/20 group"
                  onClick={() => setActiveThread(thread)}
                >
                  <CardContent className="p-3.5">
                    <div className="flex items-start gap-3">
                      {/* Category icon */}
                      <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${catCfg.gradient} flex items-center justify-center shrink-0 mt-0.5`}>
                        <CatIcon className={`h-4 w-4 ${catCfg.text}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h4 className="text-sm font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {thread.subject}
                          </h4>
                          <Badge variant="outline" className={`${stCfg.color} text-[9px] shrink-0 h-4 px-1.5 gap-0.5 border`}>
                            <StIcon className="h-2.5 w-2.5" />
                            {stCfg.label}
                          </Badge>
                        </div>

                        {/* Last message preview */}
                        {thread._lastMessage && (
                          <p className="text-xs text-muted-foreground line-clamp-1 mb-1.5">
                            <span className="font-medium text-foreground/70">{thread._lastAuthor}:</span>{" "}
                            {thread._lastMessage}
                          </p>
                        )}

                        {/* Meta */}
                        <div className="flex items-center gap-3 text-[10px] text-muted-foreground/60 flex-wrap">
                          <span className="flex items-center gap-0.5">
                            <MessageSquare className="h-2.5 w-2.5" /> {thread._messageCount || 0}
                          </span>
                          <span>{relativeTime(thread._lastDate || thread.updated_at)}</span>
                          {linked && (
                            <span className={`flex items-center gap-0.5 ${catCfg.text} font-medium`}>
                              <Link2 className="h-2.5 w-2.5" />
                              {linked.name}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Arrow */}
                      <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary shrink-0 mt-1 transition-colors" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
