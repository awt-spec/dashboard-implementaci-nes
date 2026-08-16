import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ContractHistoryEntry {
  id: string;
  contract_id: string;
  changed_by: string | null;
  changed_at: string;
  action: "created" | "updated" | "deleted" | "restored";
  /** { campo: { old, new } } de los campos con significado de negocio. */
  changes: Record<string, { old: unknown; new: unknown }>;
}

export interface ContractAmendment {
  id: string;
  contract_id: string;
  numero: number | null;
  titulo: string;
  descripcion: string | null;
  effective_date: string | null;
  nuevo_valor_mensual: number | null;
  nueva_fecha_fin: string | null;
  moneda: string | null;
  created_at: string;
}

/** Bitácora automática del contrato (la escribe un trigger, no la app). */
export function useContractHistory(contractId?: string) {
  return useQuery({
    queryKey: ["contract-history", contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("contract_history")
        .select("*")
        .eq("contract_id", contractId!)
        .order("changed_at", { ascending: false })
        .limit(50));
      if (error) throw error;
      return (data || []) as ContractHistoryEntry[];
    },
  });
}

export function useContractAmendments(contractId?: string) {
  return useQuery({
    queryKey: ["contract-amendments", contractId],
    enabled: !!contractId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("contract_amendments")
        .select("*")
        .eq("contract_id", contractId!)
        .order("effective_date", { ascending: false, nullsFirst: false }));
      if (error) throw error;
      return (data || []) as ContractAmendment[];
    },
  });
}

export function useUpsertAmendment(contractId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: Partial<ContractAmendment> & { contract_id: string; titulo: string }) => {
      const { error } = a.id
        ? await supabase.from("contract_amendments").update(a).eq("id", a.id)
        : await supabase.from("contract_amendments").insert([a]);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contract-amendments", contractId] }),
  });
}

export function useDeleteAmendment(contractId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("contract_amendments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contract-amendments", contractId] }),
  });
}
