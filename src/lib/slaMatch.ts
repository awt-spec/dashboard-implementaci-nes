import { slaNorm } from "./ticketStatus";

/**
 * Qué plazo de la política aplica a un caso.
 *
 * Esta cascada estaba copiada en ActivePolicyBar y en TicketSLAExplanation, y
 * así fue como se desincronizaron con la base: las dos comparaban con
 * `toLowerCase()` mientras el SQL usa `sla_norm()`, que además quita acentos.
 * Una regla guardada como "Crítica" no cruzaba en pantalla con un caso
 * "Critica, Impacto Negocio", pero sí en la base — el vencimiento decía una
 * cosa y la explicación otra.
 *
 * El orden replica el de get_tickets_sla_status() (migraciones 20260428160000
 * y 20260824120000):
 *   1) prioridad Y tipo — lo más específico
 *   2) prioridad sola, prefiriendo el plazo más corto
 *   3) tipo solo
 *   4) la regla de prioridad "media", como respaldo declarado
 */
export interface Deadline {
  priority?: string | null;
  case_type?: string | null;
  deadline_days?: number | null;
  [k: string]: unknown;
}

export type TipoDeCruce = "priority+type" | "priority-only" | "type-only" | "fallback";

export interface Cruce extends Deadline {
  matchType: TipoDeCruce;
}

export function matchDeadline(
  deadlines: Deadline[] | null | undefined,
  caso: { prioridad?: string | null; tipo?: string | null },
): Cruce | null {
  const lista = Array.isArray(deadlines) ? deadlines : [];
  if (lista.length === 0) return null;

  // Se normaliza a los dos lados, igual que sla_norm() en la base.
  const prio = slaNorm(caso.prioridad);
  const tipo = slaNorm(caso.tipo);

  const cruzaPrio = (d: Deadline) => !!d.priority && prio.includes(slaNorm(d.priority));
  const cruzaTipo = (d: Deadline) => !!d.case_type && tipo.includes(slaNorm(d.case_type));

  const ambos = lista.find(d => cruzaPrio(d) && cruzaTipo(d));
  if (ambos) return { ...ambos, matchType: "priority+type" };

  // Prioridad sola: gana el plazo más corto, que es el más estricto.
  const soloPrio = lista.filter(cruzaPrio)
    .sort((a, b) => (a.deadline_days ?? 999) - (b.deadline_days ?? 999));
  if (soloPrio[0]) return { ...soloPrio[0], matchType: "priority-only" };

  const soloTipo = lista.find(cruzaTipo);
  if (soloTipo) return { ...soloTipo, matchType: "type-only" };

  const respaldo = lista.find(d => slaNorm(d.priority) === "media");
  if (respaldo) return { ...respaldo, matchType: "fallback" };

  return null;
}
