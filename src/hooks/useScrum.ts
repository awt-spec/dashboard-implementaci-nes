import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SupportSprint {
  id: string;
  client_id: string;
  name: string;
  goal: string;
  start_date: string | null;
  end_date: string | null;
  status: "planificado" | "activo" | "completado";
  capacity_points: number;
  created_at: string;
  updated_at: string;
}

export interface ScrumFields {
  sprint_id?: string | null;
  story_points?: number | null;
  business_value?: number | null;
  effort?: number | null;
  backlog_rank?: number | null;
  scrum_status?: "backlog" | "ready" | "in_sprint" | "in_progress" | "done" | null;
}

export function useSprints(clientId?: string) {
  return useQuery({
    queryKey: ["support-sprints", clientId],
    queryFn: async () => {
      if (!clientId) return [] as SupportSprint[];
      const { data, error } = await (supabase.from("support_sprints" as any).select("*") as any)
        .eq("client_id", clientId)
        .order("start_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data || []) as SupportSprint[];
    },
    enabled: !!clientId,
  });
}

export function useCreateSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<SupportSprint> & { client_id: string; name: string }) => {
      const { error } = await (supabase.from("support_sprints" as any).insert([input] as any) as any);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["support-sprints", v.client_id] }),
  });
}

export function useUpdateSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SupportSprint>; client_id: string }) => {
      const { error } = await (supabase.from("support_sprints" as any).update(updates as any).eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["support-sprints", v.client_id] }),
  });
}

export function useDeleteSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; client_id: string }) => {
      const { error } = await (supabase.from("support_sprints" as any).delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: (_d, v) => qc.invalidateQueries({ queryKey: ["support-sprints", v.client_id] }),
  });
}

export function useUpdateTicketScrum() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: ScrumFields }) => {
      const { error } = await (supabase.from("support_tickets").update(updates as any).eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.invalidateQueries({ queryKey: ["support-tickets-all"] });
    },
  });
}

// Helpers de priorización
export function wsjf(value: number, effort: number) {
  // WSJF simplificado: valor / esfuerzo
  if (!effort || effort <= 0) return 0;
  return Math.round((value / effort) * 100) / 100;
}
