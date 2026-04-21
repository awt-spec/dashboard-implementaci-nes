import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface CaseCompliance {
  id: string;
  ticket_id: string;
  client_id: string | null;
  rule_id: string | null;
  policy_version: string;
  applicable_deadline_days: number | null;
  days_remaining: number | null;
  semaphore: "green" | "yellow" | "red" | "overdue";
  notices_sent: number;
  notices_required: number;
  checklist: Record<string, boolean>;
  checklist_completed_count: number;
  ai_recommendation: string | null;
  ai_recommendation_action: string | null;
  ai_last_run_at: string | null;
  ai_model: string | null;
  risk_level: "low" | "medium" | "high" | "critical";
  escalated_to_sprint_id: string | null;
  escalated_at: string | null;
  last_evaluated_at: string;
}

export function useCaseCompliance(ticketId?: string) {
  return useQuery({
    queryKey: ["case_compliance", ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_compliance")
        .select("*")
        .eq("ticket_id", ticketId!)
        .maybeSingle();
      if (error) throw error;
      return data as CaseCompliance | null;
    },
  });
}

export function useEvaluateCompliance() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ticket_id: string) => {
      const { data, error } = await supabase.functions.invoke("evaluate-case-compliance", {
        body: { ticket_id },
      });
      if (error) throw error;
      return data?.compliance;
    },
    onSuccess: (_d, ticket_id) => {
      qc.invalidateQueries({ queryKey: ["case_compliance", ticket_id] });
      qc.invalidateQueries({ queryKey: ["case_compliance_all"] });
    },
    onError: (e: any) => toast({ title: "Error evaluando cumplimiento", description: e.message, variant: "destructive" }),
  });
}

export function useUpdateChecklist() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ticket_id, checklist }: { ticket_id: string; checklist: Record<string, boolean> }) => {
      const completed = Object.values(checklist).filter(Boolean).length;
      const { error } = await supabase
        .from("case_compliance")
        .update({ checklist, checklist_completed_count: completed })
        .eq("ticket_id", ticket_id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["case_compliance", vars.ticket_id] });
    },
  });
}

export function useIncrementNotice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ticket_id: string) => {
      const { data: row } = await supabase
        .from("case_compliance")
        .select("notices_sent")
        .eq("ticket_id", ticket_id)
        .maybeSingle();
      const newCount = (row?.notices_sent ?? 0) + 1;
      const { error } = await supabase
        .from("case_compliance")
        .update({ notices_sent: newCount })
        .eq("ticket_id", ticket_id);
      if (error) throw error;
    },
    onSuccess: (_d, ticket_id) => {
      qc.invalidateQueries({ queryKey: ["case_compliance", ticket_id] });
    },
  });
}

export function useAllCompliance() {
  return useQuery({
    queryKey: ["case_compliance_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("case_compliance")
        .select("*")
        .order("last_evaluated_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as CaseCompliance[];
    },
  });
}
