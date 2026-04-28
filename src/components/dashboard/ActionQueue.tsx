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
import { useBusinessRules } from "@/hooks/useBusinessRules";
import { computeSLAStatus } from "@/components/policy/ActivePolicyBar";
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
  const { data: rules = [] } = useBusinessRules();

  const actions = useMemo<Action[]>(() => {
    const list: Action[] = [];

    // 1. Boletas vencidas según SLA política v4.5
    const overdue = tickets.filter(t => {
      const s = computeSLAStatus(t as any, rules as any);
      return s && s.status === "overdue";
    });
    if (overdue.length > 0) {
      list.push({
        id: "sla-overdue",
        priority: 1,
        title: `${overdue.length} boleta${overdue.length === 1 ? "" : "s"} fuera de SLA`,
        detail: `Pasaron el plazo de la política activa v4.5`,
        count: overdue.length,
        Icon: Clock,
        tone: "destructive",
        cta: "Resolver ahora",
        onAction: () => onNavigate?.("soporte"),
        aiPrompt: `Listáme las boletas que están fuera de SLA según la política v4.5. Para cada una: cliente, antigüedad, prioridad, y qué acción tomar AHORA.`,
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
  }, [tickets, clients, rules, onNavigate]);

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
      bg: "bg-destructive/[0.04] hover:bg-destructive/[0.08]",
      border: "border-destructive/30",
      icon: "bg-destructive/15 text-destructive",
      cta: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    },
    warning: {
      bg: "bg-amber-500/[0.04] hover:bg-amber-500/[0.08]",
      border: "border-amber-500/30",
      icon: "bg-amber-500/15 text-amber-500",
      cta: "bg-amber-500 text-white hover:bg-amber-600",
    },
    info: {
      bg: "bg-info/[0.04] hover:bg-info/[0.08]",
      border: "border-info/30",
      icon: "bg-info/15 text-info",
      cta: "bg-info text-info-foreground hover:bg-info/90",
    },
  } as const;
  const t = tones[a.tone];

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
      className={cn("group flex items-center gap-3 p-3 rounded-lg border transition-all", t.bg, t.border)}
    >
      <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", t.icon)}>
        <a.Icon className="h-5 w-5" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-bold truncate">{a.title}</p>
          {a.priority === 1 && (
            <Badge className="h-4 text-[9px] bg-destructive text-destructive-foreground border-0">
              URGENTE
            </Badge>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground truncate mt-0.5">{a.detail}</p>
      </div>

      {a.aiPrompt && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => askAI(a.aiPrompt!)}
          className="h-8 gap-1 text-[11px] hidden md:inline-flex shrink-0"
          title="Que la IA me lo explique"
        >
          <Sparkles className="h-3 w-3" />
          Analizar
        </Button>
      )}

      <Button
        size="sm"
        onClick={a.onAction}
        className={cn("h-8 gap-1 text-xs font-semibold shrink-0", t.cta)}
      >
        {a.cta}
        <ArrowRight className="h-3 w-3" />
      </Button>
    </motion.div>
  );
}
