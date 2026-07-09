import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Urgencia basada en SLA real por contrato ────────────────────────────────
// Lee client_slas (tiempos de respuesta/resolución por prioridad y cliente) y
// evalúa cada ticket contra su SLA en lugar de una heurística de antigüedad.

export type SlaLevel = "critica" | "alta" | "media" | "baja";
export interface SlaTimes { resp: number; reso: number }
export type SlaMap = Map<string, Map<SlaLevel, SlaTimes>>;

export function normLevel(p?: string | null): SlaLevel {
  const s = (p || "").toLowerCase();
  if (/cr[ií]t/.test(s)) return "critica";
  if (/alta/.test(s)) return "alta";
  if (/baja/.test(s)) return "baja";
  return "media";
}

export function useClientSlaMap() {
  return useQuery({
    queryKey: ["csr-sla-map"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<SlaMap> => {
      const { data } = await supabase
        .from("client_slas")
        .select("client_id, priority_level, response_time_hours, resolution_time_hours")
        .eq("is_active", true);
      const map: SlaMap = new Map();
      for (const r of (data as any[]) || []) {
        const lvl = normLevel(r.priority_level);
        if (!map.has(r.client_id)) map.set(r.client_id, new Map());
        map.get(r.client_id)!.set(lvl, {
          resp: Number(r.response_time_hours) || 0,
          reso: Number(r.resolution_time_hours) || 0,
        });
      }
      return map;
    },
  });
}

export type SlaKind = "breach" | "risk" | "ok" | "none";
export interface SlaEval { kind: SlaKind; pct: number | null; hoursLeft: number | null; reso: number | null }

// Evalúa un ticket contra el SLA de su cliente/prioridad. `start` es la fecha de
// registro (o creación). Devuelve kind 'none' si el cliente no tiene SLA.
export function evalSla(
  t: { client_id?: string | null; prioridad?: string | null; fecha_registro?: string | null; created_at?: string | null },
  slaMap?: SlaMap,
): SlaEval {
  const sla = t.client_id ? slaMap?.get(t.client_id)?.get(normLevel(t.prioridad)) : undefined;
  if (!sla || !sla.reso) return { kind: "none", pct: null, hoursLeft: null, reso: null };
  const startStr = t.fecha_registro || t.created_at;
  const startMs = startStr ? Date.parse(startStr) : NaN;
  if (isNaN(startMs)) return { kind: "none", pct: null, hoursLeft: null, reso: sla.reso };
  const elapsedH = (Date.now() - startMs) / 3_600_000;
  const pct = elapsedH / sla.reso;
  const hoursLeft = sla.reso - elapsedH;
  const kind: SlaKind = pct >= 1 ? "breach" : pct >= 0.75 ? "risk" : "ok";
  return { kind, pct, hoursLeft, reso: sla.reso };
}
