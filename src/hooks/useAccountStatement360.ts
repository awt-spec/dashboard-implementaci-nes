import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ── Capa de datos unificada del Estado de Cuenta 360 ────────────────────────
// Junta contrato + facturación/suscripción + horas + SLAs + hitos + auditoría
// de alcance en un solo modelo, y computa insights determinísticos (riesgos y
// oportunidades). Es la base del centro de control de la cuenta.

const MONTH_LABELS = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

export interface Stmt360 {
  currency: string;
  contract: any | null;
  financials: { billed: number; paid: number; pending: number; contractValue: number };
  subscription: { active: boolean; nextPayment: string | null; cycle: string | null; amount: number | null } | null;
  hours: { included: number; periodLabel: string | null; consumed: number; pct: number; byMonth: { label: string; hours: number }[]; over: number };
  slas: { priority_level: string; response_time_hours: number; resolution_time_hours: number; penalty_amount: number | null }[];
  milestones: { descripcion: string; status: string; monto: number | null }[];
  scope: { fuera: number; dudoso: number; horasFuera: number; facturableFuera: number; hallazgos: any[]; ranAt: string | null };
  insights: { risks: string[]; opportunities: string[] };
  invoices: any[];
}

const MONTHLY_TYPES = new Set(["fee_mensual", "bolsa_horas"]);

export function useAccountStatement360(clientId?: string) {
  return useQuery({
    queryKey: ["account-360", clientId],
    enabled: !!clientId,
    queryFn: async (): Promise<Stmt360> => {
      const [ctRes, wtRes, bpRes, msRes, slaRes, scRes] = await Promise.all([
        supabase.from("client_contracts").select("*").eq("client_id", clientId!).eq("is_active", true).order("included_hours", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("work_time_entries").select("duration_seconds, started_at").eq("client_id", clientId!).not("duration_seconds", "is", null).limit(5000),
        supabase.from("billed_packages").select("*").eq("client_id", clientId!).order("created_at", { ascending: false }),
        supabase.from("contract_milestones").select("descripcion, status, monto, moneda").eq("client_id", clientId!).order("numero"),
        supabase.from("client_slas").select("priority_level, response_time_hours, resolution_time_hours, penalty_amount").eq("client_id", clientId!).eq("is_active", true),
        supabase.from("pm_ai_analysis").select("full_analysis, created_at, metrics").eq("analysis_type", "contract_scope_audit").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);

      const contract = (ctRes.data as any) ?? null;
      const currency = contract?.currency || "USD";
      const rate = Number(contract?.hourly_rate || 0);

      // ── Facturación ──
      const bp = (bpRes.data as any[]) || [];
      const sum = (arr: any[]) => arr.reduce((s, p) => s + Number(p.total_amount || 0), 0);
      const paid = sum(bp.filter((p) => p.status === "pagado"));
      const pending = sum(bp.filter((p) => p.status === "pendiente"));
      const billed = sum(bp.filter((p) => p.status !== "anulado"));
      const contractValue = contract?.contract_type === "fee_mensual" ? Number(contract?.monthly_value || 0) * 12 : Number(contract?.monthly_value || 0);

      const subRow = bp.find((p) => p.is_subscription);
      const subscription = subRow ? {
        active: subRow.next_payment_date ? new Date(subRow.next_payment_date) >= new Date(new Date().toDateString()) : true,
        nextPayment: subRow.next_payment_date ?? null,
        cycle: subRow.billing_cycle ?? "mensual",
        amount: subRow.total_amount != null ? Number(subRow.total_amount) : null,
      } : null;

      // ── Horas por mes ──
      const byMonthMap = new Map<string, number>();
      for (const e of (wtRes.data as any[]) || []) {
        const d = new Date(e.started_at);
        const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
        byMonthMap.set(key, (byMonthMap.get(key) ?? 0) + (e.duration_seconds ?? 0) / 3600);
      }
      const sortedKeys = [...byMonthMap.keys()].sort();
      const byMonth = sortedKeys.slice(-6).map((k) => ({ label: `${MONTH_LABELS[Number(k.slice(5, 7)) - 1]} ${k.slice(2, 4)}`, hours: Math.round((byMonthMap.get(k)! ) * 10) / 10 }));
      const included = Number(contract?.included_hours || 0);
      const isMonthly = MONTHLY_TYPES.has(contract?.contract_type);
      const latestKey = sortedKeys[sortedKeys.length - 1] ?? null;
      const consumed = isMonthly && latestKey ? Math.round(byMonthMap.get(latestKey)! * 10) / 10 : Math.round([...byMonthMap.values()].reduce((a, b) => a + b, 0) * 10) / 10;
      const periodLabel = isMonthly && latestKey ? `${MONTH_LABELS[Number(latestKey.slice(5, 7)) - 1]} ${latestKey.slice(0, 4)}` : "histórico";
      const pct = included > 0 ? (consumed / included) * 100 : 0;
      const over = Math.max(0, consumed - included);

      // ── Alcance (auditoría IA) ──
      const scData: any = scRes.data ?? null;
      const hallazgos: any[] = Array.isArray(scData?.full_analysis?.hallazgos) ? scData.full_analysis.hallazgos : [];
      const fueraArr = hallazgos.filter((h) => h.veredicto === "fuera");
      const dudoso = hallazgos.filter((h) => h.veredicto === "dudoso").length;
      const horasFuera = fueraArr.reduce((s, h) => s + Number(h.horas || 0), 0);
      const facturableFuera = horasFuera * rate;

      // ── Insights determinísticos ──
      const risks: string[] = [];
      const opportunities: string[] = [];
      if (included > 0 && pct >= 80 && over === 0) risks.push(`Bolsa de horas al ${Math.round(pct)}% en ${periodLabel} — proyección de agotamiento antes del cierre.`);
      if (over > 0) risks.push(`Bolsa de horas EXCEDIDA en ${over.toFixed(1)} h (${periodLabel}) — trabajo fuera de contrato.`);
      if (pending > 0) risks.push(`Hay ${pending.toLocaleString()} ${currency} pendientes de pago.`);
      if (subscription && !subscription.active) risks.push(`Suscripción vencida (próximo pago ${subscription.nextPayment}) — revisar continuidad del servicio.`);
      if (facturableFuera > 0) opportunities.push(`~${horasFuera.toFixed(1)} h fuera de alcance ≈ ${Math.round(facturableFuera).toLocaleString()} ${currency} facturables sin cotizar.`);
      if (included > 0 && pct >= 80) opportunities.push(`Consumo sostenido alto — candidato a ampliar la bolsa de horas.`);
      const hitoPorFacturar = ((msRes.data as any[]) || []).find((m) => m.status === "cumplido");
      if (hitoPorFacturar) opportunities.push(`Hito "${hitoPorFacturar.descripcion}" cumplido y sin facturar.`);

      return {
        currency,
        contract,
        financials: { billed, paid, pending, contractValue },
        subscription,
        hours: { included, periodLabel, consumed, pct, byMonth, over },
        slas: (slaRes.data as any[]) || [],
        milestones: (msRes.data as any[]) || [],
        scope: { fuera: fueraArr.length, dudoso, horasFuera, facturableFuera, hallazgos, ranAt: scData?.created_at ?? null },
        insights: { risks, opportunities },
        invoices: bp,
      };
    },
  });
}
