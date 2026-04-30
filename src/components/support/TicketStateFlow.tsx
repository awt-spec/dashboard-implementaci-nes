import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Inbox, PlayCircle, ClipboardList, DollarSign, BadgeCheck,
  Truck, CircleCheck, Archive, PauseCircle, XCircle,
  ChevronRight, Check, type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { isTicketClosed } from "@/lib/ticketStatus";

// ════════════════════════════════════════════════════════════════════════════
// TicketStateFlow — visualización de los 10 estados del caso, agrupados en
// 3 fases lógicas que reflejan los flujos reales del soporte SYSDE:
//
//   ① ESTÁNDAR  (correcciones / consultas — flujo corto)
//      PENDIENTE → EN ATENCIÓN → ENTREGADA → POR CERRAR → CERRADA
//
//   ② COMERCIAL (requerimientos con cotización — flujo extendido)
//      desde EN ATENCIÓN: → VALORACIÓN → COTIZADA → APROBADA
//      luego vuelve a EN ATENCIÓN del flujo estándar para ejecutar
//
//   ③ EXCEPCIÓN
//      ON HOLD  — pausa temporal (esperando cliente, blocker externo)
//      ANULADA  — cancelado / descartado
//
// Feedback COO 30/04: la versión anterior tenía POR CERRAR antes de ENTREGADA
// (inconsistente) y mezclaba los 3 grupos en "alternativos". Ahora cada fase
// tiene su sección con título, color e iconografía distintivos.
// ════════════════════════════════════════════════════════════════════════════

type StandardState = "PENDIENTE" | "EN ATENCIÓN" | "ENTREGADA" | "POR CERRAR" | "CERRADA";
type CommercialState = "VALORACIÓN" | "COTIZADA" | "APROBADA";
type ExceptionState = "ON HOLD" | "ANULADA";
type AnyState = StandardState | CommercialState | ExceptionState;

interface StateMeta {
  icon: LucideIcon;
  label: string;        // mostrar más legible
  hint: string;
  tone: "default" | "warning" | "info" | "success" | "destructive" | "muted";
  group: "standard" | "commercial" | "exception";
}

const STANDARD_FLOW: StandardState[] = [
  "PENDIENTE", "EN ATENCIÓN", "ENTREGADA", "POR CERRAR", "CERRADA",
];

const COMMERCIAL_FLOW: CommercialState[] = [
  "VALORACIÓN", "COTIZADA", "APROBADA",
];

const EXCEPTION_STATES: ExceptionState[] = ["ON HOLD", "ANULADA"];

const META: Record<AnyState, StateMeta> = {
  // ═ Estándar
  "PENDIENTE":   { icon: Inbox,        label: "Pendiente",   hint: "Recién creado · esperando que alguien del equipo lo tome", tone: "warning",     group: "standard" },
  "EN ATENCIÓN": { icon: PlayCircle,   label: "En atención", hint: "El equipo lo está trabajando activamente",                  tone: "info",        group: "standard" },
  "ENTREGADA":   { icon: Truck,        label: "Entregada",   hint: "Entregado al cliente · esperando que confirme",            tone: "success",     group: "standard" },
  "POR CERRAR":  { icon: CircleCheck,  label: "Por cerrar",  hint: "Cliente confirmó · listo para cerrar formalmente",         tone: "success",     group: "standard" },
  "CERRADA":     { icon: Archive,      label: "Cerrada",     hint: "Caso finalizado oficialmente en el sistema",               tone: "muted",       group: "standard" },
  // ═ Comercial (cotización para requerimientos)
  "VALORACIÓN":  { icon: ClipboardList,label: "Valoración",  hint: "Analizando alcance y esfuerzo · paso previo a cotizar",    tone: "info",        group: "commercial" },
  "COTIZADA":    { icon: DollarSign,   label: "Cotizada",    hint: "Cotización enviada al cliente · esperando respuesta",      tone: "info",        group: "commercial" },
  "APROBADA":    { icon: BadgeCheck,   label: "Aprobada",    hint: "Cliente aprobó la cotización · pasa a ejecución",          tone: "success",     group: "commercial" },
  // ═ Excepciones
  "ON HOLD":     { icon: PauseCircle,  label: "On hold",     hint: "Pausa temporal · bloqueador externo o esperando cliente",  tone: "warning",     group: "exception" },
  "ANULADA":     { icon: XCircle,      label: "Anulada",     hint: "Cancelado o descartado · no se trabajará",                 tone: "destructive", group: "exception" },
};

// ─── Helpers de estilo ────────────────────────────────────────────────────

type NodeStatus = "past" | "current" | "future" | "alt";

function nodeStatus(state: AnyState, current: string, group: StateMeta["group"]): NodeStatus {
  if (state === current) return "current";
  if (group === "standard") {
    const idx = STANDARD_FLOW.indexOf(state as StandardState);
    const curIdx = STANDARD_FLOW.indexOf(current as StandardState);
    if (idx >= 0 && curIdx >= 0 && idx < curIdx) return "past";
    if (idx >= 0 && curIdx >= 0 && idx > curIdx) return "future";
  }
  if (group === "commercial") {
    const idx = COMMERCIAL_FLOW.indexOf(state as CommercialState);
    const curIdx = COMMERCIAL_FLOW.indexOf(current as CommercialState);
    if (idx >= 0 && curIdx >= 0 && idx < curIdx) return "past";
    if (idx >= 0 && curIdx >= 0 && idx > curIdx) return "future";
  }
  return "alt";
}

function chipClasses(status: NodeStatus, tone: StateMeta["tone"], disabled: boolean): string {
  const base = "transition-all duration-150";
  const cursor = disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer";

  if (status === "current") {
    const map: Record<StateMeta["tone"], string> = {
      destructive: "bg-destructive text-destructive-foreground border-destructive shadow-md ring-2 ring-destructive/30",
      success:     "bg-success text-success-foreground border-success shadow-md ring-2 ring-success/30",
      warning:     "bg-warning text-warning-foreground border-warning shadow-md ring-2 ring-warning/30",
      info:        "bg-info text-info-foreground border-info shadow-md ring-2 ring-info/30",
      muted:       "bg-muted-foreground text-background border-muted-foreground shadow-md ring-2 ring-muted-foreground/30",
      default:     "bg-primary text-primary-foreground border-primary shadow-md ring-2 ring-primary/30",
    };
    return `${base} ${cursor} ${map[tone]} border-2 font-bold ring-offset-1 ring-offset-background`;
  }
  if (status === "past") {
    return `${base} ${cursor} bg-success/10 border border-success/30 text-success/90 hover:bg-success/15`;
  }
  if (status === "future") {
    return `${base} ${cursor} bg-card border border-border text-muted-foreground hover:border-primary/40 hover:text-foreground`;
  }
  // alt — fuera del flujo actual del estado (otra fase)
  return `${base} ${cursor} bg-muted/30 border border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground hover:bg-muted/50`;
}

// ─── Componente ───────────────────────────────────────────────────────────

interface Props {
  currentState: string;
  onChange: (newState: AnyState) => void;
  disabled?: boolean;
  pending?: boolean;
}

export function TicketStateFlow({ currentState, onChange, disabled = false, pending = false }: Props) {
  const isClosed = isTicketClosed(currentState);
  const allKnown = useMemo(
    () => [...STANDARD_FLOW, ...COMMERCIAL_FLOW, ...EXCEPTION_STATES] as AnyState[],
    [],
  );
  const isUnknown = !allKnown.includes(currentState as AnyState);
  const currentMeta = META[currentState as AnyState];

  const handleClick = (state: AnyState) => {
    if (disabled || state === currentState || pending) return;
    onChange(state);
  };

  const renderNode = (state: AnyState, opts: { showArrow?: boolean; size?: "md" | "sm" } = {}) => {
    const meta = META[state];
    const status = nodeStatus(state, currentState, meta.group);
    const Icon = meta.icon;
    const isCurrent = status === "current";
    const spinning = isCurrent && pending;
    const sizeClasses = opts.size === "sm"
      ? "px-2 py-1 text-[10px] gap-1 rounded-full"
      : "px-2.5 py-1.5 text-[11px] gap-1.5 rounded-md";
    const iconSize = opts.size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5";

    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.button
            whileHover={!disabled && !isCurrent ? { scale: 1.03 } : {}}
            whileTap={!disabled && !isCurrent ? { scale: 0.97 } : {}}
            onClick={() => handleClick(state)}
            disabled={disabled || isCurrent}
            className={`relative flex items-center ${sizeClasses} ${chipClasses(status, meta.tone, disabled)}`}
            aria-current={isCurrent ? "step" : undefined}
            aria-label={`Cambiar a ${meta.label}`}
          >
            <Icon className={`${iconSize} shrink-0 ${spinning ? "animate-spin" : ""}`} />
            <span className="whitespace-nowrap font-semibold tracking-tight uppercase">{meta.label}</span>
            {status === "past" && <Check className={`${iconSize} shrink-0 opacity-70`} />}
          </motion.button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-[11px] max-w-xs">
          <div className="font-semibold mb-0.5">{meta.label}</div>
          <div className="text-muted-foreground">{meta.hint}</div>
        </TooltipContent>
      </Tooltip>
    );
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-3">

        {/* ═══ Fase ESTÁNDAR — flujo corto (correcciones/consultas) ═══ */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Flujo estándar
            </span>
            <span className="text-[9px] text-muted-foreground/60 italic hidden sm:inline">
              · correcciones, consultas
            </span>
          </div>
          <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
            {STANDARD_FLOW.map((state, i) => (
              <div key={state} className="flex items-center gap-1 shrink-0">
                {renderNode(state)}
                {i < STANDARD_FLOW.length - 1 && (
                  <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${
                    nodeStatus(state, currentState, "standard") === "past"
                      ? "text-success/70" : "text-muted-foreground/40"
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ═══ Fase COMERCIAL — cotización para requerimientos ═══ */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] uppercase font-bold text-info tracking-wider">
              Flujo comercial
            </span>
            <span className="text-[9px] text-muted-foreground/60 italic hidden sm:inline">
              · requerimientos con cotización
            </span>
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            {COMMERCIAL_FLOW.map((state, i) => (
              <div key={state} className="flex items-center gap-1 shrink-0">
                {renderNode(state)}
                {i < COMMERCIAL_FLOW.length - 1 && (
                  <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${
                    nodeStatus(state, currentState, "commercial") === "past"
                      ? "text-success/70" : "text-muted-foreground/40"
                  }`} />
                )}
              </div>
            ))}
            <span className="text-[10px] text-muted-foreground/70 italic ml-2 hidden md:inline">
              ↩ regresa a "En atención" para ejecutar
            </span>
          </div>
        </div>

        {/* ═══ Excepciones — pausa o cancelación ═══ */}
        <div>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider">
              Excepciones
            </span>
            <span className="text-[9px] text-muted-foreground/60 italic hidden sm:inline">
              · pausa o cancelación
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {EXCEPTION_STATES.map((state) => (
              <span key={state}>{renderNode(state, { size: "sm" })}</span>
            ))}
          </div>
        </div>

        {/* Estado legacy no reconocido (datos viejos antes del catálogo definitivo) */}
        {isUnknown && currentState && (
          <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30">
            Estado no estándar: {currentState}
          </Badge>
        )}

        {/* Hint contextual */}
        {isClosed && !pending && (
          <p className="text-[10px] text-muted-foreground italic flex items-center gap-1">
            <Archive className="h-3 w-3" />
            Caso cerrado. Click en cualquier estado activo para reabrirlo (queda registrado como reincidencia si aplica).
          </p>
        )}
        {currentState === "ON HOLD" && (
          <p className="text-[10px] text-warning italic flex items-center gap-1">
            <PauseCircle className="h-3 w-3" />
            Pausado. Recordá agregar nota explicando el bloqueador y reanudar cuando se desbloquee.
          </p>
        )}
        {currentMeta && currentMeta.group === "commercial" && (
          <p className="text-[10px] text-info italic">
            En flujo comercial. Cuando el cliente apruebe la cotización, regresá a "En atención" para ejecutar.
          </p>
        )}

      </div>
    </TooltipProvider>
  );
}
