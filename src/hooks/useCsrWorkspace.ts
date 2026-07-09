import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Hooks del workspace del CSR: pendientes (to-do), obstáculos, hitos, comercial
// y asistente IA. Tablas nuevas con cast `as any` (types.ts no regenerado).

// ── Pendientes ────────────────────────────────────────────────────────────
export interface CsrTask {
  id: string; title: string; notes: string | null;
  priority: "alta" | "media" | "baja"; due_date: string | null; done: boolean;
  ticket_id: string | null; created_at: string;
}
export function useCsrTasks() {
  return useQuery({
    queryKey: ["csr-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("csr_tasks" as any)
        .select("*").order("done").order("due_date", { nullsFirst: false }).order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as CsrTask[];
    },
  });
}
export function useUpsertCsrTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (t: Partial<CsrTask> & { title: string }) => {
      const row: any = { title: t.title, priority: t.priority ?? "media", due_date: t.due_date ?? null, notes: t.notes ?? null };
      const q = t.id ? supabase.from("csr_tasks" as any).update(row).eq("id", t.id) : supabase.from("csr_tasks" as any).insert(row);
      const { error } = await q; if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["csr-tasks"] }),
  });
}
export function useToggleCsrTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { error } = await supabase.from("csr_tasks" as any).update({ done, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["csr-tasks"] }),
  });
}
export function useDeleteCsrTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("csr_tasks" as any).delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["csr-tasks"] }),
  });
}

// ── Obstáculos ──────────────────────────────────────────────────────────────
export interface CsrBlocker {
  id: string; title: string; description: string | null; client_id: string | null;
  severity: "alta" | "media" | "baja"; status: "abierto" | "en_gestion" | "resuelto"; created_at: string;
}
export function useCsrBlockers() {
  return useQuery({
    queryKey: ["csr-blockers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("csr_blockers" as any).select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as CsrBlocker[];
    },
  });
}
export function useUpsertCsrBlocker() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (b: Partial<CsrBlocker> & { title: string }) => {
      const row: any = { title: b.title, description: b.description ?? null, severity: b.severity ?? "media", client_id: b.client_id ?? null };
      const q = b.id ? supabase.from("csr_blockers" as any).update(row).eq("id", b.id) : supabase.from("csr_blockers" as any).insert(row);
      const { error } = await q; if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["csr-blockers"] }),
  });
}
export function useUpdateBlockerStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: CsrBlocker["status"] }) => {
      const { error } = await supabase.from("csr_blockers" as any).update({ status, updated_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["csr-blockers"] }),
  });
}

// ── Hitos (contract_milestones, lectura) ────────────────────────────────────
export function useCsrMilestones() {
  return useQuery({
    queryKey: ["csr-milestones"],
    queryFn: async () => {
      const { data } = await supabase.from("contract_milestones" as any)
        .select("id, client_id, descripcion, condicion, status, monto, porcentaje, moneda, numero")
        .order("status").limit(50);
      return (data || []) as any[];
    },
  });
}

// ── Comercial (quotes, lectura) ─────────────────────────────────────────────
export function useCsrQuotes() {
  return useQuery({
    queryKey: ["csr-quotes"],
    queryFn: async () => {
      const { data } = await supabase.from("quotes" as any)
        .select("id, quote_number, client_id, title, status, total_amount, currency, valid_until, created_at")
        .order("created_at", { ascending: false }).limit(40);
      return (data || []) as any[];
    },
  });
}

// ── Señales comerciales reales (RPC) ────────────────────────────────────────
export interface CommercialSignal {
  client_id: string;
  open_tickets: number;
  has_active_contract: boolean;
  included_hours: number;
  consumed_hours_month: number;
  hitos_cumplidos: number;
  sub_vencida: boolean;
  last_quote_status: string | null;
}
export function useCsrCommercialSignals() {
  return useQuery({
    queryKey: ["csr-commercial-signals"],
    staleTime: 2 * 60_000,
    queryFn: async (): Promise<CommercialSignal[]> => {
      const { data, error } = await (supabase.rpc as any)("get_csr_commercial_signals");
      if (error) throw error;
      return ((data as any[]) || []).map((r) => ({
        client_id: r.client_id,
        open_tickets: Number(r.open_tickets) || 0,
        has_active_contract: !!r.has_active_contract,
        included_hours: Number(r.included_hours) || 0,
        consumed_hours_month: Number(r.consumed_hours_month) || 0,
        hitos_cumplidos: Number(r.hitos_cumplidos) || 0,
        sub_vencida: !!r.sub_vencida,
        last_quote_status: r.last_quote_status ?? null,
      }));
    },
  });
}

// ── Asistente IA ────────────────────────────────────────────────────────────
export interface CsrPlan {
  resumen: string;
  prioridades: { ticket_id: string; razon: string }[];
  urgentes?: string[];
  acciones: string[];
}
export function useCsrAssistant() {
  return useMutation({
    mutationFn: async (args: { tickets: any[]; question?: string }): Promise<CsrPlan> => {
      const { data, error } = await supabase.functions.invoke("csr-assistant", { body: args });
      if (error) {
        const m = error.message || "";
        if (/not found|404|Failed to send|fetch/i.test(m)) throw new Error("El asistente aún no está disponible (edge function sin desplegar).");
        throw new Error(m);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      return (data as any).plan as CsrPlan;
    },
  });
}
