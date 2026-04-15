import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SupportTicket {
  id: string;
  client_id: string;
  ticket_id: string;
  producto: string;
  asunto: string;
  tipo: string;
  prioridad: string;
  estado: string;
  fecha_registro: string | null;
  fecha_entrega: string | null;
  dias_antiguedad: number;
  ai_classification: string | null;
  ai_risk_level: string | null;
  ai_summary: string | null;
  responsable: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupportClient {
  id: string;
  name: string;
  country: string;
  industry: string;
  status: string;
  progress: number;
  contact_name: string;
  contact_email: string;
  team_assigned: string[];
  client_type: string;
}

export function useSupportClients() {
  return useQuery({
    queryKey: ["support-clients"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("clients")
        .select("*") as any)
        .eq("client_type", "soporte")
        .order("name");
      if (error) throw error;
      return (data || []) as SupportClient[];
    },
  });
}

export function useSupportTickets(clientId?: string) {
  return useQuery({
    queryKey: ["support-tickets", clientId],
    queryFn: async () => {
      let query = supabase.from("support_tickets").select("*").order("dias_antiguedad", { ascending: false });
      if (clientId) {
        query = query.eq("client_id", clientId);
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as SupportTicket[];
    },
  });
}

export function useAllSupportTickets() {
  return useQuery({
    queryKey: ["support-tickets-all"],
    queryFn: async () => {
      const { data: clients } = await (supabase
        .from("clients")
        .select("id") as any)
        .eq("client_type", "soporte");
      const ids = (clients || []).map((c: any) => c.id);
      if (ids.length === 0) return [];
      
      const { data, error } = await supabase
        .from("support_tickets")
        .select("*")
        .in("client_id", ids)
        .order("dias_antiguedad", { ascending: false });
      if (error) throw error;
      return (data || []) as SupportTicket[];
    },
  });
}

export function useUpdateSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, unknown> }) => {
      const { error } = await supabase.from("support_tickets").update(updates as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.invalidateQueries({ queryKey: ["support-tickets-all"] });
    },
  });
}

export function useCreateSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: Partial<SupportTicket> & { client_id: string; ticket_id: string }) => {
      const { error } = await supabase.from("support_tickets").insert([data] as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.invalidateQueries({ queryKey: ["support-tickets-all"] });
    },
  });
}

export function useDeleteSupportTicket() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("support_tickets").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.invalidateQueries({ queryKey: ["support-tickets-all"] });
    },
  });
}
