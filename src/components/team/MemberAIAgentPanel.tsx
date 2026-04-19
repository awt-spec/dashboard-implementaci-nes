import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  useAgentConfig, useAgentConversations, useChatWithAgent,
  useDeleteConversation, type AgentConversation, type AgentMessage,
} from "@/hooks/useMemberAgent";
import { AgentConfigDialog } from "./AgentConfigDialog";
import {
  Bot, Send, Settings2, Sparkles, Loader2, Plus, Trash2, MessageSquare, Wand2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

const QUICK_PROMPTS_BY_TEMPLATE: Record<string, Array<{ icon: string; label: string; prompt: string }>> = {
  developer: [
    { icon: "🐛", label: "Ayúdame a depurar", prompt: "Tengo un bug. Te describo síntomas y código, ayúdame a encontrar la causa raíz paso a paso." },
    { icon: "🧪", label: "Genera tests", prompt: "Te paso una función. Genera tests unitarios cubriendo casos felices, edge cases y errores." },
    { icon: "👀", label: "Code review", prompt: "Revisa este snippet con foco en legibilidad, performance y seguridad. Sé crítico pero constructivo." },
  ],
  qa: [
    { icon: "📋", label: "Plan de pruebas", prompt: "Diseña un plan de pruebas para la siguiente funcionalidad." },
    { icon: "🔁", label: "Casos regresión", prompt: "Sugiere casos de regresión clave para este módulo." },
  ],
  pm: [
    { icon: "📊", label: "Status semanal", prompt: "Resume el estado de mis proyectos esta semana: logros, próximos pasos, riesgos." },
    { icon: "✉️", label: "Update a cliente", prompt: "Redacta un update profesional al cliente sobre el estado del proyecto." },
    { icon: "⚠️", label: "Detecta riesgos", prompt: "Identifica riesgos en mi sprint actual y propone mitigaciones." },
  ],
  consultant: [
    { icon: "🛠️", label: "Configuración", prompt: "Necesito guía para configurar el siguiente módulo / parametrización." },
    { icon: "🔍", label: "Troubleshooting", prompt: "Ayúdame a diagnosticar este problema funcional." },
  ],
  support: [
    { icon: "🎫", label: "Diagnóstica ticket", prompt: "Te describo un ticket. Ayúdame a estructurar el diagnóstico." },
    { icon: "💬", label: "Redacta respuesta", prompt: "Redacta una respuesta empática y clara para el cliente." },
  ],
  designer: [
    { icon: "🎨", label: "Feedback UX", prompt: "Te describo un flujo. Dame feedback UX accionable." },
  ],
  default: [],
};

const COMMON_PROMPTS = [
  { icon: "📅", label: "Resume mi semana", prompt: "Resume lo que hice esta semana, qué viene la próxima y dónde tengo bloqueos." },
  { icon: "🤝", label: "Prepara mi 1:1", prompt: "Ayúdame a preparar mi próximo 1:1 con mi líder: logros, dudas, ayuda que necesito." },
  { icon: "📚", label: "¿Qué aprendo?", prompt: "Basado en mis skills y tareas, ¿qué debería aprender o reforzar esta semana?" },
];

export function MemberAIAgentPanel({
  memberId,
  memberName,
  layout = "split",
}: {
  memberId: string;
  memberName: string;
  layout?: "split" | "stacked";
}) {
  const { data: cfg } = useAgentConfig(memberId);
  const { data: conversations = [] } = useAgentConversations(memberId);
  const chat = useChatWithAgent();
  const del = useDeleteConversation();

  const [activeConv, setActiveConv] = useState<AgentConversation | null>(null);
  const [input, setInput] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  const [pendingMsgs, setPendingMsgs] = useState<AgentMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Determine template for quick prompts
  const template = cfg?.role_template && cfg.role_template !== "auto" ? cfg.role_template : "default";
  const quickPrompts = [...COMMON_PROMPTS, ...(QUICK_PROMPTS_BY_TEMPLATE[template] || [])];

  // Sync active conversation messages when conv list updates
  useEffect(() => {
    if (activeConv) {
      const fresh = conversations.find(c => c.id === activeConv.id);
      if (fresh) setActiveConv(fresh);
    }
  }, [conversations]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [activeConv?.messages, pendingMsgs, chat.isPending]);

  const messages: AgentMessage[] = activeConv?.messages || pendingMsgs;

  const send = async (text?: string) => {
    const msg = (text ?? input).trim();
    if (!msg || chat.isPending) return;
    setInput("");
    const userMsg: AgentMessage = { role: "user", content: msg, ts: new Date().toISOString() };
    if (activeConv) {
      setActiveConv({ ...activeConv, messages: [...activeConv.messages, userMsg] });
    } else {
      setPendingMsgs(prev => [...prev, userMsg]);
    }

    try {
      const res = await chat.mutateAsync({
        member_id: memberId,
        message: msg,
        conversation_id: activeConv?.id,
      });
      if (!activeConv && res.conversation_id) {
        // Wait for refetch then set active
        setTimeout(() => {
          setPendingMsgs([]);
        }, 300);
        // Optimistically build conv
        setActiveConv({
          id: res.conversation_id,
          member_id: memberId,
          title: msg.slice(0, 80),
          messages: [userMsg, { role: "assistant", content: res.answer, ts: new Date().toISOString() }],
          context_snapshot: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
      }
    } catch (_e) {
      // toast handled in hook
    }
  };

  const newChat = () => {
    setActiveConv(null);
    setPendingMsgs([]);
    setInput("");
  };

  const stacked = layout === "stacked";

  return (
    <div className={stacked ? "flex flex-col gap-3 h-full" : "grid grid-cols-1 lg:grid-cols-4 gap-3"}>
      {/* Conversations sidebar */}
      <Card className={stacked ? "shrink-0 max-h-32 flex flex-col" : "lg:col-span-1 h-[600px] flex flex-col"}>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm flex items-center gap-2"><MessageSquare className="h-4 w-4" /> Historial</CardTitle>
          <Button size="sm" variant="ghost" className="h-7" onClick={newChat}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-2">
          <ScrollArea className="h-full">
            {conversations.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">Aún no hay conversaciones</p>
            ) : (
              <div className="space-y-1">
                {conversations.map(c => (
                  <div
                    key={c.id}
                    className={`group flex items-start gap-1 rounded-md p-2 cursor-pointer hover:bg-accent ${activeConv?.id === c.id ? "bg-accent" : ""}`}
                    onClick={() => { setActiveConv(c); setPendingMsgs([]); }}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{c.title}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(c.updated_at).toLocaleDateString("es")}</p>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                      onClick={(e) => { e.stopPropagation(); del.mutate(c.id); if (activeConv?.id === c.id) newChat(); }}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Chat area */}
      <Card className={stacked ? "flex-1 min-h-0 flex flex-col" : "lg:col-span-3 h-[600px] flex flex-col"}>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0 border-b">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <CardTitle className="text-sm">Tu agente IA</CardTitle>
              <p className="text-[10px] text-muted-foreground">
                {cfg?.enabled === false ? "Desactivado" : `Especialización: ${cfg?.role_template === "auto" || !cfg ? "auto" : cfg.role_template}`}
              </p>
            </div>
          </div>
          <Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={() => setConfigOpen(true)}>
            <Settings2 className="h-3.5 w-3.5" /> Config
          </Button>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden flex flex-col p-0">
          {messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center px-6 text-center gap-3">
              <div className="h-14 w-14 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                <Sparkles className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="font-semibold">Hola {memberName.split(" ")[0]}, ¿en qué te ayudo hoy?</p>
                <p className="text-xs text-muted-foreground mt-1">Tu agente conoce tus skills, sprint, horas y metas.</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 w-full max-w-2xl mt-2">
                {quickPrompts.map((p, i) => (
                  <Button
                    key={i}
                    variant="outline"
                    className="h-auto py-2.5 px-3 justify-start text-left whitespace-normal"
                    onClick={() => send(p.prompt)}
                  >
                    <span className="mr-2 text-base">{p.icon}</span>
                    <span className="text-xs">{p.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          ) : (
            <ScrollArea className="flex-1" ref={scrollRef as any}>
              <div className="px-4 py-4 space-y-4">
                {messages.map((m, i) => (
                  <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className={m.role === "user" ? "bg-primary text-primary-foreground text-xs" : "bg-muted"}>
                        {m.role === "user" ? memberName[0] : <Bot className="h-3.5 w-3.5" />}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`rounded-2xl px-3.5 py-2 max-w-[85%] text-sm ${
                      m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"
                    }`}>
                      {m.role === "assistant" ? (
                        <div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-pre:my-2 prose-ul:my-1.5">
                          <ReactMarkdown>{m.content}</ReactMarkdown>
                        </div>
                      ) : (
                        <p className="whitespace-pre-wrap">{m.content}</p>
                      )}
                    </div>
                  </div>
                ))}
                {chat.isPending && (
                  <div className="flex gap-2.5">
                    <Avatar className="h-7 w-7"><AvatarFallback className="bg-muted"><Bot className="h-3.5 w-3.5" /></AvatarFallback></Avatar>
                    <div className="bg-muted rounded-2xl px-3.5 py-2 flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" /> Pensando...
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          )}

          <div className="border-t p-3">
            {messages.length > 0 && quickPrompts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {quickPrompts.slice(0, 4).map((p, i) => (
                  <Badge
                    key={i}
                    variant="outline"
                    className="cursor-pointer hover:bg-accent text-[10px] gap-1"
                    onClick={() => send(p.prompt)}
                  >
                    <span>{p.icon}</span> {p.label}
                  </Badge>
                ))}
              </div>
            )}
            <div className="flex gap-2 items-end">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
                placeholder="Pregunta lo que necesites..."
                rows={1}
                className="resize-none min-h-[44px] max-h-32"
                disabled={chat.isPending || cfg?.enabled === false}
              />
              <Button onClick={() => send()} disabled={chat.isPending || !input.trim() || cfg?.enabled === false} size="icon" className="h-11 w-11 shrink-0">
                {chat.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
            {cfg?.enabled === false && (
              <p className="text-[10px] text-warning mt-1.5 flex items-center gap-1">
                <Wand2 className="h-3 w-3" /> Agente desactivado. Actívalo en configuración.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <AgentConfigDialog open={configOpen} onOpenChange={setConfigOpen} memberId={memberId} />
    </div>
  );
}
