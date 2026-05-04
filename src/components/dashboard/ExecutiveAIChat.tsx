import { useEffect, useRef, useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, Send, Loader2, Bot, User as UserIcon, RefreshCw,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  ts: number;
}

const SUGGESTED = [
  "¿Qué casos críticos están sin resolver?",
  "Resumen del estado de Coopecar",
  "¿Quién tiene más carga de trabajo esta semana?",
  "Entregables que vencen en los próximos 7 días",
  "¿Hay algún cliente en riesgo? Por qué",
  "Resumen ejecutivo de los últimos 7 días",
];

export function ExecutiveAIChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Autoscroll al final
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  // Listener global: cualquier botón puede dispararle al asistente con
  //   window.dispatchEvent(new CustomEvent("ai-chat:ask", { detail: { question, autoSend? } }))
  // Si autoSend=true → manda la pregunta automáticamente. Si no, sólo abre el sheet.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail || {};
      const q = typeof detail === "string" ? detail : detail.question;
      const auto = typeof detail === "string" ? false : !!detail.autoSend;
      setOpen(true);
      if (q) {
        if (auto) {
          // Disparar send con la pregunta directamente — usa setTimeout para
          // garantizar que el setOpen ya está aplicado.
          setTimeout(() => sendDirectly(q), 50);
        } else {
          setInput(q);
        }
      }
    };
    window.addEventListener("ai-chat:ask", handler);
    return () => window.removeEventListener("ai-chat:ask", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper para enviar una pregunta sin pasar por el state local de input
  const sendDirectly = async (question: string) => {
    if (!question || loading) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: question, ts: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("executive-ai-chat", {
        body: {
          question,
          messages: newMessages.slice(-20).map(m => ({ role: m.role, content: m.content })),
        },
      });
      if (error) throw error;
      const reply = data?.reply || "No pude generar respuesta.";
      setMessages(prev => [...prev, { id: crypto.randomUUID(), role: "assistant", content: reply, ts: Date.now() }]);
    } catch (err: any) {
      toast.error(err.message || "Error consultando la IA");
    } finally {
      setLoading(false);
    }
  };

  const send = async (q?: string) => {
    const question = (q ?? input).trim();
    if (!question || loading) return;

    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: question, ts: Date.now() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("executive-ai-chat", {
        body: {
          question,
          messages: newMessages.slice(-20).map(m => ({ role: m.role, content: m.content })),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const reply: Msg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data?.reply || "(Sin respuesta)",
        ts: Date.now(),
      };
      setMessages(m => [...m, reply]);
    } catch (e: any) {
      toast.error(e.message || "Error consultando IA");
      // Remover el último user message si falló para que se pueda reintentar
      setMessages(m => m.slice(0, -1));
      setInput(question);
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    if (loading) return;
    if (messages.length > 0 && !confirm("¿Limpiar el chat?")) return;
    setMessages([]);
    setInput("");
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {/* Floating trigger button */}
      <motion.button
        onClick={() => setOpen(true)}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-gradient-to-br from-violet-500 to-primary text-white shadow-2xl shadow-primary/30 flex items-center justify-center group"
        title="Preguntale a la IA"
      >
        <Sparkles className="h-6 w-6 group-hover:rotate-12 transition-transform" />
        <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-emerald-400 border-2 border-background animate-pulse" />
      </motion.button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl p-0 flex flex-col"
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-border flex items-center gap-3 shrink-0">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-primary/20 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-violet-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold">Asistente IA</p>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Conoce tu portafolio · clientes, casos, sprints, equipo
              </p>
            </div>
            <Button size="sm" variant="ghost" onClick={reset} disabled={loading} className="h-8 gap-1 text-xs">
              <RefreshCw className="h-3.5 w-3.5" /> Nuevo
            </Button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4">
            {messages.length === 0 && !loading ? (
              <div className="space-y-5">
                <div className="text-center py-4">
                  <div className="inline-flex h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500/15 to-primary/15 items-center justify-center mb-2">
                    <Bot className="h-7 w-7 text-violet-400" />
                  </div>
                  <p className="text-sm font-bold">Preguntame lo que quieras</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Tengo contexto del portafolio en vivo. Datos confidenciales redactados automáticamente.
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-2">Sugerencias</p>
                  <div className="space-y-1.5">
                    {SUGGESTED.map(s => (
                      <button
                        key={s}
                        onClick={() => send(s)}
                        className="w-full text-left p-2.5 rounded-lg border border-border bg-card hover:border-primary/40 hover:bg-muted/30 transition-colors group"
                      >
                        <span className="text-xs flex items-center gap-2">
                          <Sparkles className="h-3 w-3 text-violet-400 shrink-0 group-hover:scale-110 transition-transform" />
                          <span className="flex-1">{s}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <AnimatePresence initial={false}>
                  {messages.map(m => (
                    <motion.div
                      key={m.id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "flex gap-2.5",
                        m.role === "user" ? "flex-row-reverse" : "flex-row"
                      )}
                    >
                      <div className={cn(
                        "h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                        m.role === "user" ? "bg-primary/15" : "bg-violet-500/15"
                      )}>
                        {m.role === "user" ? (
                          <UserIcon className="h-3.5 w-3.5 text-primary" />
                        ) : (
                          <Bot className="h-3.5 w-3.5 text-violet-400" />
                        )}
                      </div>
                      <div className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed",
                        m.role === "user"
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-muted rounded-tl-sm"
                      )}>
                        <div className="whitespace-pre-wrap">{m.content}</div>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {loading && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="flex gap-2.5"
                  >
                    <div className="h-7 w-7 rounded-lg bg-violet-500/15 flex items-center justify-center shrink-0">
                      <Bot className="h-3.5 w-3.5 text-violet-400" />
                    </div>
                    <div className="bg-muted rounded-2xl rounded-tl-sm px-3.5 py-3">
                      <div className="flex items-center gap-1">
                        <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="h-1.5 w-1.5 rounded-full bg-violet-400 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>

          {/* Input */}
          <div className="px-5 py-4 border-t border-border shrink-0 space-y-2">
            <div className="relative">
              <Textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKey}
                placeholder="Preguntá sobre clientes, casos, sprints, equipo…"
                rows={2}
                disabled={loading}
                className="text-sm resize-none pr-12"
              />
              <Button
                size="icon"
                onClick={() => send()}
                disabled={loading || !input.trim()}
                className="absolute bottom-2 right-2 h-8 w-8"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>⏎ enviar · ⇧⏎ línea nueva</span>
              {messages.length > 0 && (
                <Badge variant="outline" className="text-[9px] h-4">{messages.length} mensajes</Badge>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}
