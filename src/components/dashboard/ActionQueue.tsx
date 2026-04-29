/**
 * ActionQueue — "Hoy hay que decidir esto" — lista de acciones priorizadas
 * con botones one-click. Reemplaza parte del enfoque de "reporte" del
 * Resumen Ejecutivo: en lugar de mirar charts, el usuario actúa.
 *
 * Cada acción tiene un destino (sección) y un prompt opcional para la IA
 * que, si se dispara, abre el chat con un análisis pre-cargado.
 */
import { useMemo } from "react";
import { useClients } from "@/hooks/useClients";
import { useAllSupportTickets } from "@/hooks/useSupportTickets";
import { useTicketsSLAStatus } from "@/hooks/useTicketsSLAStatus";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertOctagon, ChevronRight, ShieldAlert, Flame, UserX, Package,
  Clock, Sparkles, ArrowRight, Inbox,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  /** Callback para navegar a una sección específica */
  onNavigate?: (section: string) => void;
}

interface Action {
  id: string;
  priority: number; // 1 = top urgency
  title: string;
  detail: string;
  count: number;
  Icon: typeof AlertOctagon;
  tone: "destructive" | "warning" | "info";
  cta: string;
  onAction: () => void;
  /** Pregunta para la IA si el usuario quiere análisis */
  aiPrompt?: string;
}

function askAI(question: string) {
  window.dispatchEvent(new CustomEvent("ai-chat:ask", { detail: { question, autoSend: true } }));
}

export function ActionQueue({ onNavigate }: Props) {
  const { data: clients = [] } = useClients();
  const { data: tickets = [] } = useAllSupportTickets();
  // Server-side SLA con fuente (policy vs client_override) para etiquetar correctamente
  const { byId: slaByTicketId } = useTicketsSLAStatus();

  const actions = useMemo<Action[]>(() => {
    const list: Action[] = [];

    // 1. Boletas vencidas — separadas por fuente del plazo (política vs SLA cliente)
    let overduePolicy = 0;
    let overdueClient = 0;
    tickets.forEach(t => {
      const s = slaByTicketId.get(t.id);
      if (!s || s.status !== "overdue") return;
      if (s.source === "client_override") overdueClient++;
      else overduePolicy++;
    });

    // Acción para vencidos según POLÍTICA (regla global v4.5)
    if (overduePolicy > 0) {
      list.push({
        id: "policy-overdue",
        priority: 1,
        title: `${overduePolicy} boleta${overduePolicy === 1 ? "" : "s"} fuera de Política`,
        detail: `Pasaron el plazo de la política activa v4.5`,
        count: overduePolicy,
        Icon: Clock,
        tone: "destructive",
        cta: "Resolver ahora",
        onAction: () => onNavigate?.("soporte"),
        aiPrompt: `Listáme las boletas que pasaron el plazo de la política v4.5 (sin override de cliente). Para cada una: cliente, antigüedad, prioridad, y qué acción tomar AHORA.`,
      });
    }

    // Acción para vencidos según SLA del CLIENTE (contrato override)
    if (overdueClient > 0) {
      list.push({
        id: "client-sla-overdue",
        priority: 1,
        title: `${overdueClient} boleta${overdueClient === 1 ? "" : "s"} fuera de SLA Cliente`,
        detail: `Pasaron el plazo del contrato del cliente (override)`,
        count: overdueClient,
        Icon: Clock,
        tone: "destructive",
        cta: "Resolver ahora",
        onAction: () => onNavigate?.("soporte"),
        aiPrompt: `Listáme las boletas que pasaron el SLA del contrato del cliente (override del v4.5 estándar). Para cada una: cliente, plazo del contrato, días excedidos, y qué acción tomar.`,
      });
    }

    // 2. Boletas críticas sin asignar
    const sinAtencionCriticas = tickets.filter(t =>
      t.estado === "PENDIENTE" && !t.responsable && /critica/i.test(t.prioridad || "")
    );
    if (sinAtencionCriticas.length > 0) {
      list.push({
        id: "critical-unassigned",
        priority: 1,
        title: `${sinAtencionCriticas.length} caso${sinAtencionCriticas.length === 1 ? "" : "s"} crítico${sinAtencionCriticas.length === 1 ? "" : "s"} sin asignar`,
        detail: `Prioridad alta + sin responsable`,
        count: sinAtencionCriticas.length,
        Icon: Flame,
        tone: "destructive",
        cta: "Asignar",
        onAction: () => onNavigate?.("soporte"),
        aiPrompt: `Para las boletas críticas sin asignar, sugerí a quién asignarlas según la carga actual del equipo y dame el motivo de cada sugerencia.`,
      });
    }

    // 3. Clientes en riesgo
    const atRisk = (clients as any[]).filter(c => c.status === "en-riesgo");
    if (atRisk.length > 0) {
      list.push({
        id: "clients-risk",
        priority: 2,
        title: `${atRisk.length} cliente${atRisk.length === 1 ? "" : "s"} en riesgo`,
        detail: atRisk.map(c => c.name).slice(0, 3).join(" · "),
        count: atRisk.length,
        Icon: ShieldAlert,
        tone: "destructive",
        cta: "Revisar",
        onAction: () => onNavigate?.("clients"),
        aiPrompt: `¿Por qué los ${atRisk.length} clientes están en riesgo? Para cada uno: motivo, riesgo concreto, qué hacer hoy. Dame un ranking de urgencia.`,
      });
    }

    // 4. Boletas sin atención (más amplio)
    const sinAtencion = tickets.filter(t => t.estado === "PENDIENTE" && !t.responsable);
    if (sinAtencion.length > sinAtencionCriticas.length) {
      const restoSinAtender = sinAtencion.length - sinAtencionCriticas.length;
      list.push({
        id: "unassigned",
        priority: 3,
        title: `${restoSinAtender} boleta${restoSinAtender === 1 ? "" : "s"} sin asignar`,
        detail: `PENDIENTE sin responsable (prioridad normal)`,
        count: restoSinAtender,
        Icon: UserX,
        tone: "warning",
        cta: "Distribuir",
        onAction: () => onNavigate?.("soporte"),
        aiPrompt: `Distribuí las boletas sin asignar entre el equipo según carga actual. Dame una propuesta de asignación con justificación por persona.`,
      });
    }

    // 5. Entregables vencidos
    const allDeliv = (clients as any[]).flatMap(c => (c.deliverables || []).map((d: any) => ({ ...d, _client: c.name })));
    const delivOverdue = allDeliv.filter(d => {
      if (d.status === "aprobado" || d.status === "entregado") return false;
      if (!d.dueDate) return false;
      return new Date(d.dueDate).getTime() < Date.now();
    });
    if (delivOverdue.length > 0) {
      list.push({
        id: "deliverables-overdue",
        priority: 2,
        title: `${delivOverdue.length} entregable${delivOverdue.length === 1 ? "" : "s"} vencido${delivOverdue.length === 1 ? "" : "s"}`,
        detail: delivOverdue.slice(0, 2).map(d => d._client + " · " + d.name).join(" · "),
        count: delivOverdue.length,
        Icon: Package,
        tone: "warning",
        cta: "Ver",
        onAction: () => onNavigate?.("clients"),
        aiPrompt: `Detallá los entregables vencidos: cliente, qué entregable, hace cuántos días debió entregarse, y qué bloqueo identificás.`,
      });
    }

    return list.sort((a, b) => a.priority - b.priority || b.count - a.count);
  }, [tickets, clients, slaByTicketId, onNavigate]);

  if (actions.length === 0) {
    return (
      <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/[0.04] via-card to-card">
        <CardContent className="py-8 text-center space-y-2">
          <div className="h-12 w-12 rounded-full bg-emerald-500/15 flex items-center justify-center mx-auto">
            <Inbox className="h-6 w-6 text-emerald-500" />
          </div>
          <p className="text-sm font-bold">Bandeja de acciones limpia</p>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            No hay decisiones urgentes en este momento. El sistema cumple con la política v4.5.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertOctagon className="h-4 w-4 text-destructive" />
          <h3 className="text-sm font-bold tracking-tight">Hay que decidir hoy</h3>
          <Badge variant="outline" className="h-5 text-[10px] tabular-nums bg-destructive/10 text-destructive border-destructive/30">
            {actions.length}
          </Badge>
        </div>
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">
          Ordenado por urgencia
        </p>
      </div>

      <div className="space-y-2">
        {actions.map((a, i) => (
          <ActionRow key={a.id} action={a} delay={i * 0.05} />
        ))}
      </div>
    </div>
  );
}

function ActionRow({ action: a, delay }: { action: Action; delay: number }) {
  const tones = {
    destructive: {
      bg: "hover:bg-destructive/[0.04]",
      leftBar: "bg-destructive",
      iconColor: "text-destructive",
      cta: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
      pill: "bg-destructive text-destructive-foreground",
    },
    warning: {
      bg: "hover:bg-amber-500/[0.04]",
      leftBar: "bg-amber-500",
      iconColor: "text-amber-500",
      cta: "bg-amber-500 text-white hover:bg-amber-600",
      pill: "bg-amber-500 text-white",
    },
    info: {
      bg: "hover:bg-info/[0.04]",
      leftBar: "bg-info",
      iconColor: "text-info",
      cta: "bg-info text-info-foreground hover:bg-info/90",
      pill: "bg-info text-info-foreground",
    },
  } as const;
  const t = tones[a.tone];

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
      className={cn(
        "group relative flex items-center gap-3 px-3.5 py-2.5 rounded-lg border border-border/60 bg-card transition-colors overflow-hidden",
        t.bg
      )}
    >
      {/* Barra vertical izquierda — indicador de urgencia más sutil que un bg lleno */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1", t.leftBar)} />

      {/* Icono pequeño sin bg pill — color sólido de la urgencia */}
      <a.Icon className={cn("h-4 w-4 shrink-0 ml-1", t.iconColor)} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-bold truncate">{a.title}</p>
          {a.priority === 1 && (
            <span className={cn("inline-flex items-center h-4 px-1.5 rounded text-[9px] font-bold uppercase tracking-wider", t.pill)}>
              URGENTE
            </span>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{a.detail}</p>
      </div>

      {/* Analizar — icon-only en mobile, con label en desktop */}
      {a.aiPrompt && (
        <button
          type="button"
          onClick={() => askAI(a.aiPrompt!)}
          className="inline-flex items-center gap-1 h-7 px-2 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title="Que la IA te lo explique"
        >
          <Sparkles className="h-3 w-3" />
          <span className="text-[11px] hidden md:inline">Analizar</span>
        </button>
      )}

      <Button
        size="sm"
        onClick={a.onAction}
        className={cn("h-7 gap-1 text-xs font-semibold shrink-0 px-3", t.cta)}
      >
        {a.cta}
        <ArrowRight className="h-3 w-3" />
      </Button>
    </motion.div>
  );
}
