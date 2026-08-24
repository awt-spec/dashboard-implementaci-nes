/**
 * Urgencia por SLA para el tablero de CSR.
 *
 * Antes leía client_slas y evaluaba por su cuenta con umbral de riesgo al 75%,
 * mientras el resto de la app usaba 80% y el panorama 70%: el mismo caso podía
 * salir "en riesgo" en una pantalla y "ok" en la de al lado. Ahora consulta la
 * misma fuente que todo lo demás — get_tickets_sla_status() — y sólo traduce
 * el resultado al vocabulario que usa este tablero.
 */
import { useMemo } from "react";
import { useSlaStatusRows } from "@/hooks/useSlaCompliance";

export type SlaLevel = "critica" | "alta" | "media" | "baja";

export function normLevel(p?: string | null): SlaLevel {
  const s = (p || "").toLowerCase();
  if (/cr[ií]t/.test(s)) return "critica";
  if (/alta/.test(s)) return "alta";
  if (/baja/.test(s)) return "baja";
  return "media";
}

export type SlaKind = "breach" | "risk" | "ok" | "none";
export interface SlaEval { kind: SlaKind; pct: number | null; hoursLeft: number | null; reso: number | null }

const NONE: SlaEval = { kind: "none", pct: null, hoursLeft: null, reso: null };

/** Evaluación ya resuelta por la base, indexada por id de ticket. */
export type SlaMap = Map<string, SlaEval>;

export function useClientSlaMap() {
  const query = useSlaStatusRows();
  const data = useMemo<SlaMap>(() => {
    const map: SlaMap = new Map();
    for (const r of query.data ?? []) {
      const limit = Number(r.limit_hours) || 0;
      const elapsed = Number(r.elapsed_hours) || 0;
      if (r.sla_status === "no_sla" || !limit) { map.set(r.ticket_id, NONE); continue; }
      map.set(r.ticket_id, {
        kind: r.sla_status === "overdue" ? "breach" : r.sla_status === "warning" ? "risk" : "ok",
        pct: elapsed / limit,
        hoursLeft: limit - elapsed,
        reso: limit,
      });
    }
    return map;
  }, [query.data]);
  return { ...query, data };
}

/** Ya no calcula nada: busca lo que la base resolvió para ese ticket. */
export function evalSla(t: { id?: string | null }, slaMap?: SlaMap): SlaEval {
  return (t.id ? slaMap?.get(t.id) : undefined) ?? NONE;
}
