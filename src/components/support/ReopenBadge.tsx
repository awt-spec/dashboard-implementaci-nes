import { RotateCcw } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Badge "🔁 Reincidencia #N" — solo cara INTERNA.
 *
 * Reglas visuales (acordadas con María — COO):
 *   - count=0 → no renderiza (oculto, no ruido)
 *   - count=1 → pill amber sutil (advertencia)
 *   - count=2 → pill warning sólido (atención requerida)
 *   - count≥3 → pill destructive con animate-pulse (intervención QA)
 *
 * SIEMPRE oculto si el caller pasa `clientFacing={true}`. La cara cliente
 * sigue viendo solo "EN ATENCIÓN".
 */
interface Props {
  count?: number | null;
  lastReason?: string | null;
  lastReopenAt?: string | null;
  size?: "sm" | "md";
  clientFacing?: boolean;
  className?: string;
}

export function ReopenBadge({
  count,
  lastReason,
  lastReopenAt,
  size = "md",
  clientFacing = false,
  className,
}: Props) {
  // Cara cliente: jamás renderizar el badge de reincidencias
  if (clientFacing) return null;
  const n = count ?? 0;
  if (n <= 0) return null;

  const isCritical = n >= 3;
  const isWarning = n === 2;
  // n === 1 → estilo sutil

  const sizeClasses = size === "sm"
    ? "h-5 px-1.5 text-[10px] gap-1"
    : "h-6 px-2 text-xs gap-1.5";
  const iconSize = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";

  const toneClasses = isCritical
    ? "border-destructive/50 bg-destructive/15 text-destructive font-bold"
    : isWarning
    ? "border-warning/50 bg-warning/15 text-warning font-bold"
    : "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold";

  const label = n === 1
    ? "1ª vuelta"
    : `Reincidencia #${n}`;

  const fmtDate = lastReopenAt
    ? new Date(lastReopenAt).toLocaleDateString("es-PA", {
        day: "2-digit", month: "short", year: "numeric"
      })
    : null;

  const tooltipContent = (
    <div className="space-y-1 max-w-xs">
      <p className="font-semibold">
        {n === 1 ? "Volvió 1 vez" : `Reincidencia #${n}`}
      </p>
      {lastReason && (
        <p className="text-xs opacity-90">
          <span className="font-medium">Último motivo:</span> {lastReason}
        </p>
      )}
      {fmtDate && (
        <p className="text-[10px] opacity-70">Última vez: {fmtDate}</p>
      )}
      {isCritical && (
        <p className="text-[10px] uppercase tracking-wider text-destructive font-bold pt-1 border-t border-border/40">
          ⚠ Intervención QA recomendada
        </p>
      )}
    </div>
  );

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center rounded-full border tabular-nums",
              sizeClasses,
              toneClasses,
              isCritical && "animate-pulse",
              className,
            )}
          >
            <RotateCcw className={iconSize} />
            <span>{label}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="top">{tooltipContent}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
