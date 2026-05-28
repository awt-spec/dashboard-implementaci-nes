import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BilledPackageType = "horas" | "servicio" | "licencia" | "proyecto" | "otro";
export type BilledPackageStatus = "pendiente" | "facturado" | "pagado" | "anulado";

export interface BilledPackage {
  id: string;
  client_id: string;
  contract_id: string | null;
  name: string;
  description: string | null;
  package_type: BilledPackageType;
  quantity: number;
  unit_price: number;
  total_amount: number;
  currency: string;
  status: BilledPackageStatus;
  invoice_number: string | null;
  billed_date: string | null;
  paid_date: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useBilledPackages(clientId?: string) {
  return useQuery({
    queryKey: ["billed-packages", clientId],
    queryFn: async () => {
      let q = (supabase.from("billed_packages" as any).select("*") as any);
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as BilledPackage[];
    },
  });
}

export interface UpsertBilledPackageInput {
  id?: string;
  client_id: string;
  contract_id?: string | null;
  name: string;
  description?: string | null;
  package_type?: BilledPackageType;
  quantity: number;
  unit_price: number;
  currency?: string;
  status?: BilledPackageStatus;
  invoice_number?: string | null;
  billed_date?: string | null;
  paid_date?: string | null;
  notes?: string | null;
}

export function useUpsertBilledPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertBilledPackageInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      // total_amount es GENERATED — no se envía
      const payload: any = {
        client_id: input.client_id,
        contract_id: input.contract_id ?? null,
        name: input.name.trim(),
        description: input.description ?? null,
        package_type: input.package_type ?? "horas",
        quantity: input.quantity,
        unit_price: input.unit_price,
        currency: input.currency ?? "USD",
        status: input.status ?? "pendiente",
        invoice_number: input.invoice_number ?? null,
        billed_date: input.billed_date ?? null,
        paid_date: input.paid_date ?? null,
        notes: input.notes ?? null,
      };
      if (input.id) {
        const { error } = await (
          supabase.from("billed_packages" as any).update(payload).eq("id", input.id) as any
        );
        if (error) throw error;
      } else {
        const { error } = await (
          supabase.from("billed_packages" as any).insert([{ ...payload, created_by: userId }]) as any
        );
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["billed-packages", vars.client_id] }),
  });
}

export function useDeleteBilledPackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; clientId: string }) => {
      const { error } = await (supabase.from("billed_packages" as any).delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["billed-packages", vars.clientId] }),
  });
}
