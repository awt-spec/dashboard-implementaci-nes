/**
 * TicketSLAExplanation — explica POR QUÉ un ticket tiene su etiqueta SLA/Política.
 * Se muestra dentro de TicketDetailSheet para dar trazabilidad completa.
 *
 * Información mostrada:
 *  • Etiqueta actual (SLA Cliente / Política / Sin plazo) con color
 *  • Plazo aplicado (ej: 5 días) y días transcurridos
 *  • Regla específica que matcheó (priority + case_type)
 *  • Fuente del plazo:
 *      - "client_override" → "Contrato del cliente <nombre>"
 *      - "policy_v4.5"     → "Política v4.5 (regla global)"
 *  • Próxima acción sugerida según estado
 */
import { useMemo } from "react";
import { useTicketsSLAStatus } from "@/hooks/useTicketsSLAStatus";
import { useBusinessRules } from "@/hooks/useBusinessRules";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Building2, ListMinus, AlertTriangle, Clock, CheckCircle2,
  ArrowRight, Info, BookOpen, Target,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  ticket: {
    id: string;
    ticket_id: string;
    prioridad?: string | null;
    tipo?: string | null;
    estado?: string;
    fecha_registro?: string | null;
    created_at?: string;
  };
  clientName?: string;
}

export function TicketSLAExplanation({ ticket, clientName }: Props) {
  const { byId } = useTicketsSLAStatus();
  const { data: rules = [] } = useBusinessRules();

  const sla = byId.get(ticket.id);

  // Buscar la regla SLA activa para mostrar el detalle de matching
  const slaRule = useMemo(() =>
    rules.find(r => r.rule_type === "sla" && r.is_active && r.policy_version === "v4.5"),
    [rules]
  );

  // Calcular qué entrada de deadlines matcheó
  const matchedDeadline = useMemo(() => {
    if (!slaRule || !sla) return null;
    const deadlines: any[] = slaRule.content?.deadlines || [];
    const prio = (ticket.prioridad || "").toLowerCase();
    const tipo = (ticket.tipo || "").toLowerCase();

    // 1) priority + case_type
    let m: any = deadlines.find(d =>
      d.priority && d.case_type &&
      prio.includes(d.priority.toLowerCase()) && tipo.includes(d.case_type.toLowerCase())
    );
    if (m) return { ...m, matchType: "priority+type" };

    // 2) priority sólo (más estricto)
    const prioMatches = deadlines.filter(d => d.priority && prio.includes(d.priority.toLowerCase()));
    prioMatches.sort((a, b) => (a.deadline_days || 999) - (b.deadline_days || 999));
    if (prioMatches[0]) return { ...prioMatches[0], matchType: "priority-only" };

    // 3) case_type sólo
    m = deadlines.find(d => d.case_type && tipo.includes(d.case_type.toLowerCase()));
    if (m) return { ...m, matchType: "type-only" };

    // 4) media fallback
    m = deadlines.find(d => (d.priority || "").toLowerCase() === "media");
    if (m) return { ...m, matchType: "fallback" };
    return null;
  }, [slaRule, sla, ticket.prioridad, ticket.tipo]);

  if (!sla) return null;

  // Si está en estado terminal (CERRADA/ANULADA/ENTREGADA/APROBADA)
  if (sla.status === "no_sla") {
    return (
      <Card className="border-muted">
        <CardContent className="p-3 flex items-center gap-2.5">
          <CheckCircle2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            Sin plazo aplicable · este caso ya fue {ticket.estado?.toLowerCase()}
          </p>
        </CardContent>
      </Card>
    );
  }

  const isClient = sla.source === "client_override";
  const isOverdue = sla.status === "overdue";
  const isWarning = sla.status === "warning";

  // Tonos por estado
  const tone = isOverdue
    ? { card: "border-destructive/40 bg-destructive/[0.04]", icon: "bg-destructive/15 text-destructive", text: "text-destructive", label: "Plazo vencido" }
    : isWarning
    ? { card: "border-warning/40 bg-warning/[0.04]", icon: "bg-warning/15 text-warning", text: "text-warning", label: "En riesgo (≥75% del plazo)" }
    : { card: "border-success/40 bg-success/[0.04]", icon: "bg-success/15 text-success", text: "text-success", label: "Dentro de plazo" };

  const StatusIcon = isOverdue ? AlertTriangle : isWarning ? Clock : CheckCircle2;

  // Etiqueta de fuente
  const SourceIcon = isClient ? Building2 : ListMinus;
  const sourceTitle = isClient
    ? `Contrato del cliente${clientName ? ` · ${clientName}` : ""}`
    : "Política v4.5 (regla global)";

  // Etiqueta principal del badge según fuente (lo que ve en la lista)
  const badgeLabel = isClient ? "SLA Cliente" : "Política";

  // Acción sugerida
  const nextAction = isOverdue
    ? "Resolver inmediatamente o escalar al PM"
    : isWarning
    ? `Atender en las próximas ${Math.max(sla.deadlineDays - sla.daysElapsed, 1)} días`
    : "Continuar el flujo normal de atención";

  // Explicación del matching
  const matchExplanation = matchedDeadline ? {
    "priority+type": `Match exacto: prioridad "${matchedDeadline.priority}" + tipo "${matchedDeadline.case_type}"`,
    "priority-only": `Match por prioridad "${matchedDeadline.priority}" (cualquier tipo)`,
    "type-only": `Match por tipo "${matchedDeadline.case_type}" (cualquier prioridad)`,
    "fallback": `Sin match específico — fallback a prioridad "media"`,
  }[matchedDeadline.matchType as keyof any] || null : null;

  return (
    <Card className={cn("border", tone.card)}>
      <CardContent className="p-4 space-y-3">
        {/* Header: estado + etiqueta principal */}
        <div className="flex items-start gap-3">
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", tone.icon)}>
            <StatusIcon className={cn("h-5 w-5", isOverdue && "animate-pulse")} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className={cn("text-sm font-bold", tone.text)}>{tone.label}</h4>
              <Badge
                variant="outline"
                className={cn(
                  "gap-1 text-[10px] font-bold",
                  isClient ? "bg-primary/10 text-primary border-primary/30" : "bg-muted/50 text-muted-foreground border-border"
                )}
              >
                <SourceIcon className="h-2.5 w-2.5" />
                {badgeLabel}
              </Badge>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {isOverdue
                ? `Lleva ${sla.daysElapsed} día${sla.daysElapsed === 1 ? "" : "s"} · plazo era ${sla.deadlineDays} día${sla.deadlineDays === 1 ? "" : "s"} → excedió por ${sla.daysElapsed - sla.deadlineDays} día${sla.daysElapsed - sla.deadlineDays === 1 ? "" : "s"}`
                : isWarning
                ? `Lleva ${sla.daysElapsed} de ${sla.deadlineDays} días · ${Math.round((sla.daysElapsed / sla.deadlineDays) * 100)}% consumido`
                : `Lleva ${sla.daysElapsed} de ${sla.deadlineDays} días · ${Math.round((sla.daysElapsed / sla.deadlineDays) * 100)}% consumido`
              }
            </p>
          </div>
        </div>

        {/* Barra de progreso visual */}
        <div className="space-y-1">
          <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                isOverdue ? "bg-destructive" : isWarning ? "bg-warning" : "bg-success"
              )}
              style={{ width: `${Math.min((sla.daysElapsed / Math.max(sla.deadlineDays, 1)) * 100, 100)}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[9px] text-muted-foreground tabular-nums">
            <span>0d</span>
            <span className="font-semibold">{sla.daysElapsed}d transcurridos</span>
            <span>{sla.deadlineDays}d (plazo)</span>
          </div>
        </div>

        {/* Por qué esta etiqueta — fuente y matching */}
        <div className="rounded-lg bg-background/60 border border-border/40 p-3 space-y-2">
          <div className="flex items-center gap-1.5">
            <Info className="h-3 w-3 text-primary shrink-0" />
            <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Por qué tiene esta etiqueta
            </span>
          </div>

          {/* Fuente del plazo */}
          <div className="flex items-start gap-2">
            <BookOpen className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px]">
                <span className="text-muted-foreground">Fuente:</span>{" "}
                <span className="font-bold">{sourceTitle}</span>
              </p>
              {isClient && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  El cliente tiene un override activo en <code className="font-mono text-[9px]">client_rule_overrides</code> que se respeta sobre la política global.
                </p>
              )}
              {!isClient && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Sin override de cliente · aplica la regla global de business_rules. Si querés un plazo diferente, configurá un override en el cliente.
                </p>
              )}
            </div>
          </div>

          {/* Regla matcheada */}
          {matchExplanation && matchedDeadline && (
            <div className="flex items-start gap-2">
              <Target className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px]">
                  <span className="text-muted-foreground">Regla aplicada:</span>{" "}
                  <span className="font-bold">{matchExplanation}</span>
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  Plazo: <span className="font-mono font-bold text-foreground">{matchedDeadline.deadline_days} día{matchedDeadline.deadline_days === 1 ? "" : "s"}</span>
                  {matchedDeadline.notices && <> · {matchedDeadline.notices} aviso{matchedDeadline.notices === 1 ? "" : "s"}</>}
                  {matchedDeadline.interval_hours && <> cada {matchedDeadline.interval_hours}h</>}
                </p>
              </div>
            </div>
          )}

          {/* Datos del ticket que entraron al match */}
          <div className="flex items-start gap-2">
            <Clock className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-[11px]">
              <span className="text-muted-foreground">Datos del ticket:</span>{" "}
              <span className="font-mono text-foreground">{ticket.prioridad || "—"}</span>
              {" / "}
              <span className="font-mono text-foreground">{ticket.tipo || "—"}</span>
            </p>
          </div>
        </div>

        {/* Próxima acción */}
        <div className={cn(
          "flex items-center gap-2 pt-2 border-t",
          isOverdue ? "border-destructive/20" : isWarning ? "border-warning/20" : "border-success/20"
        )}>
          <ArrowRight className={cn("h-3.5 w-3.5 shrink-0", tone.text)} />
          <p className={cn("text-xs font-semibold", tone.text)}>{nextAction}</p>
        </div>
      </CardContent>
    </Card>
  );
}
