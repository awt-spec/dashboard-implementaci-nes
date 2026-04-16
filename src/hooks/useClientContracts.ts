import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClientContract {
  id: string;
  client_id: string;
  contract_type: string;
  monthly_value: number;
  hourly_rate: number;
  included_hours: number;
  currency: string;
  start_date: string | null;
  end_date: string | null;
  auto_renewal: boolean;
  penalty_clause: string | null;
  payment_terms: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface ClientSLA {
  id: string;
  client_id: string;
  priority_level: string;
  case_type: string;
  response_time_hours: number;
  resolution_time_hours: number;
  business_hours_only: boolean;
  penalty_amount: number | null;
  penalty_description: string | null;
  is_active: boolean;
  notes: string | null;
}

export function useClientContracts(clientId?: string) {
  return useQuery({
    queryKey: ["client-contracts", clientId],
    queryFn: async () => {
      let q = (supabase.from("client_contracts" as any).select("*") as any);
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q.order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as ClientContract[];
    },
  });
}

export function useClientSLAs(clientId?: string) {
  return useQuery({
    queryKey: ["client-slas", clientId],
    queryFn: async () => {
      let q = (supabase.from("client_slas" as any).select("*") as any);
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q.order("priority_level");
      if (error) throw error;
      return (data || []) as ClientSLA[];
    },
  });
}

export function useUpsertContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: Partial<ClientContract> & { client_id: string }) => {
      if (c.id) {
        const { error } = await (supabase.from("client_contracts" as any).update(c).eq("id", c.id) as any);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("client_contracts" as any).insert([c]) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-contracts"] }),
  });
}

export function useDeleteContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("client_contracts" as any).delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-contracts"] }),
  });
}

export function useUpsertSLA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (s: Partial<ClientSLA> & { client_id: string }) => {
      if (s.id) {
        const { error } = await (supabase.from("client_slas" as any).update(s).eq("id", s.id) as any);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("client_slas" as any).insert([s]) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-slas"] }),
  });
}

export function useDeleteSLA() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("client_slas" as any).delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-slas"] }),
  });
}
