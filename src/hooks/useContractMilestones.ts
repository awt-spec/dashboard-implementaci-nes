import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type MilestoneStatus = "propuesto" | "confirmado" | "cumplido" | "facturado" | "descartado";

export interface ContractMilestone {
  id: string;
  contract_id: string;
  client_id: string | null;
  numero: number | null;
  descripcion: string;
  condicion: string | null;
  clausula_referencia: string | null;
  porcentaje: number | null;
  monto: number | null;
  horas: number | null;
  moneda: string | null;
  status: MilestoneStatus;
  source: string;
  confirmed_by: string | null;
  confirmed_at: string | null;
}

export const MILESTONE_META: Record<MilestoneStatus, { label: string; tone: string }> = {
  propuesto: { label: "Propuesto por IA", tone: "muted" },
  confirmado: { label: "Confirmado", tone: "info" },
  cumplido: { label: "Cumplido", tone: "success" },
  facturado: { label: "Facturado", tone: "primary" },
  descartado: { label: "Descartado", tone: "muted" },
};

/** Siguiente estado natural en el flujo de un hito. */
export const NEXT_STATUS: Partial<Record<MilestoneStatus, { to: MilestoneStatus; label: string }>> = {
  propuesto: { to: "confirmado", label: "Confirmar" },
  confirmado: { to: "cumplido", label: "Marcar cumplido" },
  cumplido: { to: "facturado", label: "Marcar facturado" },
};

export function useContractMilestones(contractId?: string) {
  return useQuery({
    queryKey: ["contract-milestones", contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("contract_milestones")
        .select("*")
        .eq("contract_id", contractId)
        .order("numero", { nullsFirst: false }) as any);
      if (error) throw error;
      return (data ?? []) as ContractMilestone[];
    },
  });
}

export function useUpdateMilestone(contractId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: MilestoneStatus }) => {
      const patch: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
      if (status === "confirmado" || status === "cumplido") {
        patch.confirmed_at = new Date().toISOString();
      }
      const { error } = await (supabase.from("contract_milestones").update(patch as any).eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contract-milestones", contractId] }),
  });
}
