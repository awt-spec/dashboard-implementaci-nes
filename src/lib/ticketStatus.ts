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

/**
 * Espejo exacto de `sla_norm()` en la base (migración 20260824120000):
 *   translate(lower(coalesce(txt, '')), 'áéíóúüñ', 'aeiouun')
 *
 * Importa que sean idénticas: el vencimiento de un caso lo calcula el SQL y
 * la pantalla lo explica. Si normalizan distinto, la base marca "vencido" con
 * un plazo y la explicación muestra otro.
 *
 * Deliberadamente NO usa `norm()`, que además hace trim() y quita cualquier
 * diacrítico vía NFD. Se comparó caso por caso contra la función real y esas
 * dos libertades producían discrepancias: con una regla guardada como
 * "alta " (espacio al final) el SQL no cruza y el JS sí. La base manda, así
 * que acá se copia su comportamiento, no se mejora.
 *
 * Diferencia conocida que queda: el SQL compara con LIKE, donde `%` y `_` del
 * patrón son comodines, y acá se usa includes(), donde son literales. Sólo se
 * notaría con una prioridad o un tipo de caso que contuviera esos caracteres.
 */
export function slaNorm(s: string | null | undefined): string {
  const DE = "áéíóúüñ";
  const A  = "aeiouun";
  let r = "";
  for (const ch of (s ?? "").toLowerCase()) {
    const i = DE.indexOf(ch);
    r += i === -1 ? ch : A[i];
  }
  return r;
}

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
