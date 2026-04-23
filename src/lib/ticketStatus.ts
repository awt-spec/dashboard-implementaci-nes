// Helpers de normalización para tickets/tasks (lado frontend).
// Espejo de `supabase/functions/_shared/ticketStatus.ts` para mantener
// la lógica consistente entre cliente y edge functions.

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
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function isTicketClosed(estado: string | null | undefined): boolean {
  return CLOSED_TICKET_STATES.has(norm(estado));
}

export function isTicketOpen(estado: string | null | undefined): boolean {
  return !isTicketClosed(estado);
}

export function isTaskClosed(status: string | null | undefined): boolean {
  return CLOSED_TASK_STATES.has(norm(status));
}

export function isTaskOpen(status: string | null | undefined): boolean {
  return !isTaskClosed(status);
}

/** Normaliza tipo de caso. "Critica, Impacto Negocio" → "critico". */
export function normalizeTipo(tipo: string | null | undefined): string {
  const n = norm(tipo);
  if (!n) return "consulta";
  if (n.startsWith("critica")) return "critico";
  return n;
}

/** Normaliza prioridad. "Critica, Impacto Negocio" → "critica". */
export function normalizePrioridad(p: string | null | undefined): string {
  const n = norm(p);
  if (!n) return "media";
  if (n.startsWith("critica")) return "critica";
  return n;
}
