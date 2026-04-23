import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  Check, ChevronRight, Pause, DollarSign, FileSignature, Hourglass,
  CheckCircle2, XCircle, Loader2, Circle, type LucideIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { isTicketClosed } from "@/lib/ticketStatus";

// ─── Definición del flujo ─────────────────────────────────────────────────
// Camino principal del caso, de izquierda a derecha.
// Cada estado alternativo se ancla a uno del main (para saber dónde "salen")
// y tiene un icono distintivo.

type MainState =
  | "PENDIENTE"
  | "EN ATENCIÓN"
  | "POR CERRAR"
  | "ENTREGADA"
  | "CERRADA";

type AltState =
  | "ON HOLD"
  | "VALORACIÓN"
  | "COTIZADA"
  | "APROBADA"
  | "ANULADA";

type AnyState = MainState | AltState;

interface StateMeta {
  icon: LucideIcon;
  hint: string;
  tone: "default" | "warning" | "info" | "success" | "destructive" | "muted";
}

const MAIN_FLOW: MainState[] = [
  "PENDIENTE", "EN ATENCIÓN", "POR CERRAR", "ENTREGADA", "CERRADA",
];

const ALT_STATES: AltState[] = ["ON HOLD", "VALORACIÓN", "COTIZADA", "APROBADA", "ANULADA"];

const META: Record<AnyState, StateMeta> = {
  "PENDIENTE":   { icon: Hourglass,      hint: "Esperando ser tomado",                  tone: "warning" },
  "EN ATENCIÓN": { icon: Loader2,        hint: "Alguien del equipo lo está trabajando", tone: "info" },
  "POR CERRAR":  { icon: Circle,         hint: "Listo para cerrar, pendiente revisión", tone: "default" },
  "ENTREGADA":   { icon: CheckCircle2,   hint: "Entregado al cliente",                  tone: "success" },
  "CERRADA":     { icon: Check,          hint: "Caso finalizado",                       tone: "muted" },
  "ON HOLD":     { icon: Pause,          hint: "Pausado temporalmente",                 tone: "warning" },
  "VALORACIÓN":  { icon: FileSignature,  hint: "Analizando alcance / esfuerzo",         tone: "info" },
  "COTIZADA":    { icon: DollarSign,     hint: "Con cotización enviada al cliente",     tone: "info" },
  "APROBADA":    { icon: Check,          hint: "Cotización aprobada por el cliente",    tone: "info" },
  "ANULADA":     { icon: XCircle,        hint: "Caso cancelado o descartado",           tone: "destructive" },
};

// ─── Helpers de estilo ────────────────────────────────────────────────────

type NodeStatus = "past" | "current" | "future" | "alt" | "terminal";

function nodeStatus(state: AnyState, current: string): NodeStatus {
  if (state === current) return "current";
  const mainIdx = MAIN_FLOW.indexOf(state as MainState);
  const curIdx = MAIN_FLOW.indexOf(current as MainState);
  if (mainIdx >= 0 && curIdx >= 0 && mainIdx < curIdx) return "past";
  if (mainIdx >= 0 && curIdx >= 0 && mainIdx > curIdx) return "future";
  if (state === "CERRADA" || state === "ANULADA") return "terminal";
  return "alt";
}

function nodeClasses(status: NodeStatus, tone: StateMeta["tone"], disabled: boolean): string {
  const base = "transition-all duration-150 border-2";
  const cursor = disabled ? "cursor-not-allowed opacity-70" : "cursor-pointer";

  if (status === "current") {
    const toneBg =
      tone === "destructive" ? "bg-destructive/15 border-destructive text-destructive" :
      tone === "success"     ? "bg-success/15 border-success text-success" :
      tone === "warning"     ? "bg-warning/15 border-warning text-warning" :
      tone === "info"        ? "bg-info/15 border-info text-info" :
                               "bg-primary/10 border-primary text-primary";
    const ringColor =
      tone === "destructive" ? "ring-destructive/40" :
      tone === "success"     ? "ring-success/40" :
      tone === "warning"     ? "ring-warning/40" :
      tone === "info"        ? "ring-info/40" :
                               "ring-primary/40";
    return `${base} ${cursor} ${toneBg} shadow-sm ring-2 ring-offset-1 ring-offset-background ${ringColor} font-bold`;
  }
  if (status === "past") {
    return `${base} ${cursor} bg-success/5 border-success/30 text-success/80 hover:bg-success/10`;
  }
  if (status === "future") {
    return `${base} ${cursor} bg-background border-border text-muted-foreground hover:border-primary/40 hover:text-foreground`;
  }
  if (status === "terminal") {
    return `${base} ${cursor} bg-muted/30 border-border/60 text-muted-foreground hover:bg-muted/60`;
  }
  // alt
  return `${base} ${cursor} bg-muted/20 border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground`;
}

// ─── Props ────────────────────────────────────────────────────────────────

interface Props {
  currentState: string;
  onChange: (newState: AnyState) => void;
  disabled?: boolean;
  pending?: boolean;
}

// ─── Componente ───────────────────────────────────────────────────────────

export function TicketStateFlow({ currentState, onChange, disabled = false, pending = false }: Props) {
  const isClosed = isTicketClosed(currentState);
  // Estado no reconocido (legacy): lo mostramos aparte sin romper el render.
  const allKnown = useMemo(() =>
    [...MAIN_FLOW, ...ALT_STATES] as AnyState[],
    []
  );
  const isUnknown = !allKnown.includes(currentState as AnyState);

  const handleClick = (state: AnyState) => {
    if (disabled || state === currentState || pending) return;
    onChange(state);
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-2.5">
        {/* Main flow */}
        <div className="flex items-stretch gap-1 overflow-x-auto pb-1">
          {MAIN_FLOW.map((state, i) => {
            const status = nodeStatus(state, currentState);
            const meta = META[state];
            const Icon = meta.icon;
            const isCurrent = status === "current";
            const spinning = isCurrent && pending;

            return (
              <div key={state} className="flex items-center gap-1 shrink-0">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <motion.button
                      whileHover={!disabled && !isCurrent ? { scale: 1.03 } : {}}
                      whileTap={!disabled && !isCurrent ? { scale: 0.97 } : {}}
                      onClick={() => handleClick(state)}
                      disabled={disabled || isCurrent}
                      className={`relative rounded-md px-2.5 py-1.5 text-[11px] flex items-center gap-1.5 min-w-0 ${nodeClasses(status, meta.tone, disabled)}`}
                      aria-current={isCurrent ? "step" : undefined}
                      aria-label={`Cambiar a ${state}`}
                    >
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${
                        spinning || (isCurrent && state === "EN ATENCIÓN") ? "animate-spin" : ""
                      }`} />
                      <span className="whitespace-nowrap font-semibold tracking-tight">{state}</span>
                      {status === "past" && <Check className="h-3 w-3 shrink-0" />}
                    </motion.button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="text-[11px]">
                    {meta.hint}
                  </TooltipContent>
                </Tooltip>

                {/* Arrow entre nodos */}
                {i < MAIN_FLOW.length - 1 && (
                  <ChevronRight className={`h-3.5 w-3.5 shrink-0 ${status === "past" ? "text-success/60" : "text-muted-foreground/40"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Alt states */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide shrink-0">
            Alternativos
          </span>
          {ALT_STATES.map((state) => {
            const status = nodeStatus(state, currentState);
            const meta = META[state];
            const Icon = meta.icon;
            const isCurrent = status === "current";

            return (
              <Tooltip key={state}>
                <TooltipTrigger asChild>
                  <motion.button
                    whileHover={!disabled && !isCurrent ? { scale: 1.04 } : {}}
                    whileTap={!disabled && !isCurrent ? { scale: 0.96 } : {}}
                    onClick={() => handleClick(state)}
                    disabled={disabled || isCurrent}
                    className={`rounded-full px-2 py-0.5 text-[10px] flex items-center gap-1 ${nodeClasses(status, meta.tone, disabled)}`}
                    aria-current={isCurrent ? "step" : undefined}
                  >
                    <Icon className={`h-3 w-3 ${isCurrent && pending ? "animate-spin" : ""}`} />
                    <span className="font-semibold tracking-tight">{state}</span>
                  </motion.button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-[11px]">
                  {meta.hint}
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>

        {/* Estado legacy no reconocido */}
        {isUnknown && currentState && (
          <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30">
            Estado no estándar: {currentState}
          </Badge>
        )}

        {/* Hint al cerrar */}
        {isClosed && !pending && (
          <p className="text-[10px] text-muted-foreground italic">
            Caso cerrado. Click en cualquier estado activo para reabrir.
          </p>
        )}
      </div>
    </TooltipProvider>
  );
}
