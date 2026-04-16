import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PMAnalysis {
  id: string;
  analysis_type: string;
  scope: string | null;
  executive_summary: string | null;
  duration_estimate_weeks: number | null;
  team_health_score: number | null;
  recommendations: any[];
  client_priorities: any[];
  risks: any[];
  metrics: any;
  full_analysis: any;
  model: string | null;
  created_at: string;
}

export function useLatestPMAnalysis() {
  return useQuery({
    queryKey: ["pm-ai-analysis-latest"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("pm_ai_analysis" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle() as any);
      if (error) throw error;
      return data as PMAnalysis | null;
    },
  });
}

export function useRunPMAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("pm-ai-analysis", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pm-ai-analysis-latest"] }),
  });
}
