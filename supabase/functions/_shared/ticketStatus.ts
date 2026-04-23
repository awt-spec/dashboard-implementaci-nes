// Helpers de normalización para tickets/tasks.
// Unifica variantes de estado ("CERRADA" vs "FINALIZADO" vs "Cerrado") y
// variantes de tipo/prioridad que conviven en la BD histórica.

const CLOSED_TICKET_STATES = new Set([
  "cerrada", "cerrado", "closed",
  "finalizado", "finalizada",
  "anulada", "anulado",
]);

const CLOSED_TASK_STATES = new Set([
  "completada", "completado", "completed", "closed",
]);

function norm(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // quitar acentos
    .trim();
}

/**
 * ¿El ticket de soporte está cerrado?
 * Cubre: CERRADA (real), FINALIZADO (legacy), Cerrado, Closed, ANULADA.
 */
export function isTicketClosed(estado: string | null | undefined): boolean {
  return CLOSED_TICKET_STATES.has(norm(estado));
}

export function isTicketOpen(estado: string | null | undefined): boolean {
  return !isTicketClosed(estado);
}

/**
 * ¿La tarea de implementación está cerrada?
 * Valor canónico en tabla: "completada".
 */
export function isTaskClosed(status: string | null | undefined): boolean {
  return CLOSED_TASK_STATES.has(norm(status));
}

export function isTaskOpen(status: string | null | undefined): boolean {
  return !isTaskClosed(status);
}

/**
 * Normaliza el `tipo` de un ticket para hacer match contra deadlines
 * de la política SLA (que usan lowercase sin acentos).
 *
 * Tabla real usa: "Requerimiento", "Correccion", "Consulta", "Incidente",
 * "Pregunta", "Problema", "Critica, Impacto Negocio".
 *
 * Devuelve: "requerimiento" | "correccion" | "consulta" | "incidente" |
 *           "pregunta" | "problema" | "critico"
 */
export function normalizeTipo(tipo: string | null | undefined): string {
  const n = norm(tipo);
  if (!n) return "consulta";
  if (n.startsWith("critica")) return "critico";
  return n;
}

/**
 * Normaliza la `prioridad` de un ticket para hacer match contra deadlines.
 *
 * Tabla real usa: "Alta", "Baja", "Media", "Critica, Impacto Negocio".
 * Deadlines en políticas usan: "critica", "alta", "media", "baja".
 */
export function normalizePrioridad(p: string | null | undefined): string {
  const n = norm(p);
  if (!n) return "media";
  if (n.startsWith("critica")) return "critica";
  return n;
}
