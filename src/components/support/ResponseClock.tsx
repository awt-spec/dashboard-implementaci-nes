import { MessageSquareReply, MessageSquareWarning, CheckCheck } from "lucide-react";
import type { ResponseStatus } from "@/hooks/useSlaCompliance";

/** "1h 20m", "3d", "12m". Sin decimales: en la cola no aportan. */
function dur(h: number): string {
  const abs = Math.abs(h);
  if (abs >= 48) return `${Math.round(abs / 24)}d`;
  if (abs >= 1) {
    const hh = Math.floor(abs);
    const mm = Math.round((abs - hh) * 60);
    return mm > 0 && hh < 10 ? `${hh}h ${mm}m` : `${hh}h`;
  }
  return `${Math.max(1, Math.round(abs * 60))}m`;
}

interface Props {
  status: ResponseStatus | null;
  /** Horas que faltan para incumplir. Negativo = ya se pasó. */
  hoursLeft: number | null;
  /** Horas que tardó la respuesta, para los casos ya resueltos. */
  hours: number | null;
  limitHours: number | null;
  compact?: boolean;
}

/**
 * Cuánto queda para responderle al cliente.
 *
 * Es el único dato del caso que dice qué hacer AHORA, así que se muestra como
 * cuenta regresiva y no como porcentaje: "faltan 40m" mueve a alguien, "62% del
 * SLA" no. El SLA de resolución se mide en días y puede esperar a un panel; el
 * de respuesta se mide en horas y tiene que estar en la fila.
 *
 * Cuando ya se respondió deja de ser una alarma y pasa a ser un registro: se
 * apaga el color y dice cuánto se tardó.
 */
export function ResponseClock({ status, hoursLeft, hours, limitHours, compact }: Props) {
  if (!status) return null;

  const done = status === "ok" || status === "late";
  const Icon = done ? CheckCheck : status === "overdue" ? MessageSquareWarning : MessageSquareReply;

  // Respondido a tiempo no necesita gritar: se apaga. El que urge es el que
  // todavía no se respondió.
  const tone =
    status === "ok" ? "text-muted-foreground"
    : status === "late" ? "text-warning"
    : status === "overdue" ? "text-destructive"
    : hoursLeft !== null && hoursLeft <= 1 ? "text-destructive"
    : hoursLeft !== null && hoursLeft <= 2 ? "text-warning"
    : "text-muted-foreground";

  const label =
    status === "ok" ? (hours !== null ? `respondido en ${dur(hours)}` : "respondido")
    : status === "late" ? (hours !== null && limitHours !== null
        ? `respondido en ${dur(hours)} · meta ${dur(limitHours)}`
        : "respondido tarde")
    : status === "overdue" ? (hoursLeft !== null ? `sin responder hace ${dur(hoursLeft)}` : "sin responder")
    : hoursLeft !== null ? `responder en ${dur(hoursLeft)}` : "por responder";

  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap tabular-nums ${tone} ${compact ? "text-[10px]" : "text-[11px]"}`}
      title={
        limitHours !== null
          ? `SLA de primera respuesta: ${dur(limitHours)} desde el registro. La respuesta se cuenta cuando se escribe una nota visible para el cliente.`
          : undefined
      }
    >
      <Icon className={compact ? "h-3 w-3 shrink-0" : "h-3.5 w-3.5 shrink-0"} />
      {label}
    </span>
  );
}
