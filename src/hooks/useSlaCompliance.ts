/**
 * Estado de SLA de los casos, con UNA sola fuente: la función
 * get_tickets_sla_status() de la base.
 *
 * Antes esto se calculaba acá, en el navegador, leyendo client_slas en HORAS,
 * mientras el sidebar y la bandeja leían la RPC, que usaba business_rules en
 * DÍAS. La misma pantalla mostraba 318 vencidos arriba y 383 abajo. Y
 * useSlaAlerts era una tercera copia de la misma regla.
 *
 * La regla vive en la migración 20260824120000_unify_sla_source.sql: manda el
 * SLA contractual del cliente si existe, si no la política v4.5.
 *
 * DOS NÚMEROS DISTINTOS, A PROPÓSITO (20260825140000_sla_measurement_cutoff):
 *   • el INVENTARIO — breached, atRisk, onTrack — es todo lo abierto. Si hay
 *     293 casos rotos hay que verlos, sin importar de cuándo sean.
 *   • la MEDICIÓN — measured, compliancePct — sólo lo registrado desde el
 *     corte. Los casos viejos ya rompieron su plazo y nada de lo que haga el
 *     equipo hoy los recupera; dejarlos en el denominador clava el
 *     cumplimiento en 0% haga lo que haga.
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSupportTickets, type SupportTicket } from "@/hooks/useSupportTickets";

export type SlaLevel = "breached" | "at_risk" | "on_track";

/**
 * Estado de la primera respuesta.
 *   ok       ya se respondió, dentro del plazo
 *   late     ya se respondió, fuera del plazo
 *   pending  todavía no, y el reloj sigue corriendo
 *   overdue  todavía no, y el plazo ya venció
 * `pending` es el único que no es un veredicto: sale del denominador.
 */
export type ResponseStatus = "ok" | "late" | "pending" | "overdue";

/** Fila cruda que devuelve la RPC. */
export interface SlaStatusRow {
  ticket_id: string;
  client_id: string | null;
  estado: string | null;
  prioridad: string | null;
  limit_hours: number | null;
  elapsed_hours: number | null;
  sla_source: string | null;
  sla_status: "ok" | "warning" | "overdue" | "no_sla";
  /** Registrado desde la fecha de corte: cuenta para el cumplimiento. */
  in_scope: boolean;
  /** Cargado después del corte pero fechado antes: sale de la medición. */
  registered_late: boolean;
  /** Si la fecha del caso cae dentro de la vigencia de un contrato. */
  coverage: "cubierto" | "fuera_de_vigencia" | "sin_contrato" | null;
  contract_id: string | null;
  first_response_at: string | null;
  response_limit_hours: number | null;
  response_hours: number | null;
  response_status: ResponseStatus | null;
}

export interface SlaCaseRow {
  ticket: SupportTicket;
  /** Prioridad tal como la aplicó la regla. */
  priorityLevel: string;
  /** "contrato" | "politica" — de dónde salió el límite, para poder auditarlo. */
  slaSource: string;
  elapsedHours: number;
  limitHours: number;
  pct: number;
  level: SlaLevel;
  /** Si entra al cociente de cumplimiento. */
  inScope: boolean;
  /** Cargado tras el corte con fecha anterior. */
  registeredLate: boolean;
  /** Primera respuesta: estado, límite y horas transcurridas o consumidas. */
  responseStatus: ResponseStatus | null;
  responseLimitHours: number | null;
  responseHours: number | null;
  /** Horas que faltan para incumplir. Negativo = ya se pasó. null = sin regla. */
  responseHoursLeft: number | null;
  /** Cobertura contractual de la fecha del caso. null si la base no la trajo. */
  coverage: "cubierto" | "fuera_de_vigencia" | "sin_contrato" | null;
}

export interface SlaSummary {
  /* Inventario: todo lo abierto con SLA aplicable. */
  withSla: number;
  breached: number;
  atRisk: number;
  onTrack: number;
  sinSla: number;
  /* Medición: sólo desde el corte. */
  measured: number;
  measuredBreached: number;
  /** Sobre `measured`, no sobre `withSla`. null = todavía no hay qué medir. */
  compliancePct: number | null;
  /**
   * Cargados tras el corte con fecha anterior — quedaron fuera de la medición.
   * A veces es legítimo (el caso llegó antes y se registró tarde), así que no
   * se bloquea. Se cuenta para que la salida sea visible: si no, un caso deja
   * de medirse y nadie se entera.
   */
  registeredLate: number;
  /**
   * Casos abiertos que se están trabajando sin respaldo contractual: la fecha
   * cae fuera de toda vigencia, o el cliente no tiene contrato.
   */
  uncovered: number;
  /** Primera respuesta, sobre el mismo subconjunto medido que la resolución. */
  respOk: number;
  respLate: number;
  respPending: number;
  respOverdue: number;
  /**
   * Sobre los que ya tienen veredicto. Los que siguen en plazo no cuentan como
   * incumplidos ni como cumplidos: todavía no pasó nada.
   */
  respCompliancePct: number | null;
}

export interface SlaComplianceResult {
  rows: SlaCaseRow[];
  summary: SlaSummary;
  /** Desde cuándo se mide, en ISO. La base es la que manda. */
  cutoff: string | null;
}

const EMPTY_SUMMARY: SlaSummary = {
  withSla: 0, breached: 0, atRisk: 0, onTrack: 0, sinSla: 0,
  measured: 0, measuredBreached: 0, compliancePct: null, registeredLate: 0, uncovered: 0,
  respOk: 0, respLate: 0, respPending: 0, respOverdue: 0, respCompliancePct: null,
};

/** Una sola llamada para toda la app; se filtra por cliente en memoria. */
export function useSlaStatusRows() {
  return useQuery({
    queryKey: ["sla-status-rows"],
    queryFn: async (): Promise<SlaStatusRow[]> => {
      const { data, error } = await supabase.rpc("get_tickets_sla_status" as never);
      if (error) throw error;
      return (data ?? []) as unknown as SlaStatusRow[];
    },
    staleTime: 60 * 1000,
    refetchInterval: 60 * 1000,
    // Si la migración todavía no se aplicó, la vista queda vacía en vez de
    // reventar; el error se ve en la consola de red, no en la pantalla.
    retry: false,
  });
}

/**
 * Desde cuándo se mide. Es una constante en la base, no un valor que cambie
 * solo: se consulta una vez y no se vuelve a pedir.
 *
 * Vive en SQL y no acá para no reintroducir la segunda fuente de verdad que
 * este módulo entero existe para eliminar: si la fecha estuviera hardcodeada
 * en TypeScript, el porcentaje del servidor y el del navegador podrían dejar
 * de coincidir sin que nadie se entere.
 */
export function useSlaMeasurementStart() {
  return useQuery({
    queryKey: ["sla-measurement-start"],
    queryFn: async (): Promise<string | null> => {
      const { data, error } = await supabase.rpc("sla_measurement_start" as never);
      if (error) throw error;
      return (data as unknown as string) ?? null;
    },
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });
}

export function useSlaCompliance(clientId?: string): SlaComplianceResult {
  const { data: tickets = [] } = useSupportTickets(clientId);
  const { data: statusRows = [] } = useSlaStatusRows();
  const { data: cutoff = null } = useSlaMeasurementStart();

  return useMemo(() => {
    if (tickets.length === 0) return { rows: [], summary: EMPTY_SUMMARY, cutoff };

    const byId = new Map(statusRows.map(r => [r.ticket_id, r]));
    const rows: SlaCaseRow[] = [];
    let sinSla = 0;

    for (const t of tickets) {
      const s = byId.get(t.id);
      // Sin fila de estado el caso no se cuenta: inventarle un SLA acá sería
      // reintroducir la segunda implementación que este cambio elimina.
      if (!s) continue;
      if (s.sla_status === "no_sla") { sinSla++; continue; }

      const limitHours = Number(s.limit_hours) || 0;
      const elapsedHours = Number(s.elapsed_hours) || 0;
      if (!limitHours) { sinSla++; continue; }

      rows.push({
        ticket: t,
        priorityLevel: s.prioridad ?? t.prioridad ?? "—",
        slaSource: s.sla_source ?? "—",
        elapsedHours,
        limitHours,
        pct: Math.round((elapsedHours / limitHours) * 100),
        level: s.sla_status === "overdue" ? "breached" : s.sla_status === "warning" ? "at_risk" : "on_track",
        // La RPC vieja no traía la columna. Sin el === true, undefined sería
        // falsy y todo quedaría fuera de la medición sin aviso; con él, una
        // base sin migrar da 0 medidos y "—", que es lo mismo que dirá el día
        // uno del corte. Nunca un porcentaje inventado.
        inScope: s.in_scope === true,
        registeredLate: s.registered_late === true,
        coverage: s.coverage ?? null,
        responseStatus: s.response_status ?? null,
        responseLimitHours: s.response_limit_hours === null || s.response_limit_hours === undefined
          ? null : Number(s.response_limit_hours),
        responseHours: s.response_hours === null || s.response_hours === undefined
          ? null : Number(s.response_hours),
        responseHoursLeft: s.response_limit_hours == null || s.response_hours == null
          ? null : Number(s.response_limit_hours) - Number(s.response_hours),
      });
    }

    rows.sort((a, b) => b.pct - a.pct);
    return { rows, summary: summarizeSla(rows, sinSla), cutoff };
  }, [tickets, statusRows, cutoff]);
}

/**
 * Los dos conteos, separados a propósito. Función pura para poder probar la
 * regla del corte sin montar la app: es la parte del módulo donde un error
 * silencioso —contar los viejos en el denominador— vuelve a clavar el
 * porcentaje en 0% sin que nada se vea roto.
 */
export function summarizeSla(rows: SlaCaseRow[], sinSla: number): SlaSummary {
  const breached = rows.filter(r => r.level === "breached").length;
  const atRisk = rows.filter(r => r.level === "at_risk").length;
  const onTrack = rows.filter(r => r.level === "on_track").length;

  const inScope = rows.filter(r => r.inScope);
  const measured = inScope.length;
  const measuredBreached = inScope.filter(r => r.level === "breached").length;
  // null, no 0: sin casos medibles no hay juicio que emitir. Un 0% dice "lo
  // hicieron mal"; el guión dice "todavía no hay con qué juzgarlos".
  const compliancePct = measured > 0
    ? Math.round(((measured - measuredBreached) / measured) * 100)
    : null;

  return {
    withSla: rows.length, breached, atRisk, onTrack, sinSla,
    measured, measuredBreached, compliancePct,
    registeredLate: rows.filter(r => r.registeredLate).length,
    // Sólo lo que la base afirmó que NO está cubierto. Un null —migración sin
    // aplicar— no cuenta como descubierto: sería inventar una alarma.
    uncovered: rows.filter(r => r.coverage === "fuera_de_vigencia" || r.coverage === "sin_contrato").length,
    ...summarizeResponse(rows.filter(r => r.inScope)),
  };
}

/**
 * Primera respuesta sobre el subconjunto medido. Pura, para poder probar la
 * regla del denominador sin montar la app.
 */
export function summarizeResponse(inScope: SlaCaseRow[]) {
  const con = inScope.filter(r => r.responseStatus !== null);
  const respOk = con.filter(r => r.responseStatus === "ok").length;
  const respLate = con.filter(r => r.responseStatus === "late").length;
  const respPending = con.filter(r => r.responseStatus === "pending").length;
  const respOverdue = con.filter(r => r.responseStatus === "overdue").length;
  // Denominador: sólo lo que ya tiene veredicto. Un caso que sigue en plazo no
  // respondió, pero tampoco incumplió — contarlo como fallo sería castigar al
  // equipo por casos que todavía puede atender bien.
  const juzgables = respOk + respLate + respOverdue;
  return {
    respOk, respLate, respPending, respOverdue,
    respCompliancePct: juzgables > 0 ? Math.round((respOk / juzgables) * 100) : null,
  };
}

/**
 * "1 de septiembre de 2026", para explicar en pantalla de dónde sale el corte.
 *
 * Se rinde en hora de Costa Rica, no en la del navegador. El corte está
 * DEFINIDO en hora CR (sla_measurement_start() usa el offset -06), así que la
 * medianoche del 1 de septiembre viaja como 06:00Z. Sin fijar la zona, un
 * navegador al oeste de UTC-6 restaba horas y mostraba el día anterior:
 *
 *   America/Costa_Rica -> 1 de septiembre de 2026
 *   UTC                -> 1 de septiembre de 2026
 *   America/Tijuana    -> 31 de agosto de 2026     <- la fecha equivocada
 *
 * La frontera es la misma para todos; la etiqueta también tiene que serlo.
 */
export function formatCutoff(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("es-CR", {
    day: "numeric", month: "long", year: "numeric", timeZone: "America/Costa_Rica",
  });
}
