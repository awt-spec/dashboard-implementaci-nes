import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─────────────────────────────────────────────────────────────────────────────
// Auditoría de contrato — Capa 1 (determinística): consumo de horas vs contrato.
// Fuente de verdad: work_time_entries (tiempo real cargado) vs client_contracts
// (horas incluidas). Sin IA: son hechos, no juicios.
//
// Ventana de auditoría según el tipo de contrato:
//   • fee_mensual / bolsa_horas → included_hours es cupo MENSUAL → se audita el
//     ÚLTIMO mes con actividad (no el calendario actual, que puede no tener
//     tiempo cargado todavía). Es el período que un PM realmente necesita vigilar.
//   • proyecto_cerrado / tiempo_materiales → included_hours es total → histórico.
// ─────────────────────────────────────────────────────────────────────────────

export type AuditStatus = "sin_contrato" | "sin_cupo" | "dentro" | "en_riesgo" | "excedido";

export interface ContractHoursAudit {
  status: AuditStatus;
  contractType: string | null;
  window: "mes" | "total" | null;
  periodLabel: string | null; // ej. "junio 2026" o "histórico"
  includedHours: number;      // cupo aplicable a la ventana
  consumedHours: number;      // horas consumidas en la ventana
  totalHours: number;         // histórico total (referencia)
  pct: number;                // % del cupo consumido
  overHours: number;          // horas por encima del cupo (0 si dentro)
  hourlyRate: number | null;
  currency: string | null;
  overCost: number | null;    // costo estimado del exceso (overHours * hourlyRate)
}

const MONTH_LABELS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

const MONTHLY_TYPES = new Set(["fee_mensual", "bolsa_horas"]);
const RISK_THRESHOLD = 0.8;   // 80% del cupo = en riesgo

export function useContractHoursAudit(clientId?: string) {
  return useQuery({
    queryKey: ["contract-hours-audit", clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<ContractHoursAudit> => {
      // Contrato activo con cupo de horas.
      const { data: contracts, error: cErr } = await supabase
        .from("client_contracts")
        .select("contract_type, included_hours, hourly_rate, currency, is_active")
        .eq("client_id", clientId!)
        .eq("is_active", true)
        .order("included_hours", { ascending: false });
      if (cErr) throw cErr;
      const contract = (contracts || [])[0] as any;

      // Tiempo real cargado contra el cliente.
      const { data: entries, error: eErr } = await supabase
        .from("work_time_entries")
        .select("duration_seconds, started_at")
        .eq("client_id", clientId!)
        .not("duration_seconds", "is", null)
        .limit(5000);
      if (eErr) throw eErr;

      // Buckets por mes (YYYY-MM) para ubicar el último mes con actividad.
      let totalSecs = 0;
      const byMonth = new Map<string, number>();
      for (const e of entries || []) {
        const s = (e as any).duration_seconds ?? 0;
        totalSecs += s;
        const d = new Date((e as any).started_at);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        byMonth.set(key, (byMonth.get(key) ?? 0) + s);
      }
      const totalHours = totalSecs / 3600;
      // Último mes con actividad (clave más alta).
      const latestKey = [...byMonth.keys()].sort().pop() ?? null;
      const latestMonthHours = latestKey ? (byMonth.get(latestKey)! / 3600) : 0;
      const latestMonthLabel = latestKey
        ? `${MONTH_LABELS[Number(latestKey.slice(5, 7)) - 1]} ${latestKey.slice(0, 4)}`
        : null;

      if (!contract) {
        return {
          status: "sin_contrato", contractType: null, window: null, periodLabel: null,
          includedHours: 0, consumedHours: latestMonthHours, totalHours, pct: 0,
          overHours: 0, hourlyRate: null, currency: null, overCost: null,
        };
      }

      const contractType = contract.contract_type ?? null;
      const isMonthly = MONTHLY_TYPES.has(contractType);
      const window = isMonthly ? "mes" : "total";
      const consumedHours = isMonthly ? latestMonthHours : totalHours;
      const periodLabel = isMonthly ? latestMonthLabel : "histórico del contrato";
      const includedHours = Number(contract.included_hours ?? 0);
      const hourlyRate = contract.hourly_rate != null ? Number(contract.hourly_rate) : null;
      const currency = contract.currency ?? null;

      if (includedHours <= 0) {
        return {
          status: "sin_cupo", contractType, window, periodLabel,
          includedHours: 0, consumedHours, totalHours, pct: 0,
          overHours: 0, hourlyRate, currency, overCost: null,
        };
      }

      const pct = (consumedHours / includedHours) * 100;
      const overHours = Math.max(0, consumedHours - includedHours);
      const status: AuditStatus = overHours > 0 ? "excedido" : pct >= RISK_THRESHOLD * 100 ? "en_riesgo" : "dentro";
      const overCost = overHours > 0 && hourlyRate != null ? overHours * hourlyRate : null;

      return {
        status, contractType, window, periodLabel,
        includedHours, consumedHours, totalHours, pct,
        overHours, hourlyRate, currency, overCost,
      };
    },
  });
}
