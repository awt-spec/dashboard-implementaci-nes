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

/**
 * Orden de prioridad para listar casos: crítica primero, sin clasificar al
 * final. Los valores llegan de dos fuentes con formas distintas —el formulario
 * del cliente guarda "Critica, Impacto Negocio" y el interno guarda "critica"—,
 * así que se ordena sobre normalizePrioridad, no sobre el texto crudo.
 * Una prioridad vacía cuenta como "media", igual que en el resto del sistema.
 */
const RANGO_PRIORIDAD: Record<string, number> = {
  critica: 0,
  alta: 1,
  media: 2,
  baja: 3,
};

export function prioridadRank(p: string | null | undefined): number {
  return RANGO_PRIORIDAD[normalizePrioridad(p)] ?? 4;
}

/**
 * Orden de la lista de casos: prioridad primero y, dentro de una misma
 * prioridad, lo más viejo arriba. Vive aquí y no en la pantalla para que la
 * prueba compare el mismo comparador que se ejecuta en producción.
 */
export function compararCasosPorUrgencia(
  a: { prioridad?: string | null; dias_antiguedad?: number | null },
  b: { prioridad?: string | null; dias_antiguedad?: number | null },
): number {
  return prioridadRank(a.prioridad) - prioridadRank(b.prioridad)
    || (b.dias_antiguedad ?? 0) - (a.dias_antiguedad ?? 0);
}
