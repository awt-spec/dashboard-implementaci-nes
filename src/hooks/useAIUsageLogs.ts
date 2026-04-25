import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface AIUsageLog {
  id: string;
  function_name: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  /** "success" | "error" | "rate_limited" */
  status: string;
  error_message: string | null;
  client_id: string | null;
  /** Hardening 2026-04-25: agregados a la tabla. */
  user_id: string | null;
  scope: string | null;
  /** true si se redactaron campos confidenciales antes de mandar al LLM. */
  redacted: boolean;
  metadata: Record<string, any>;
  created_at: string;
}

export function useAIUsageLogs() {
  return useQuery({
    queryKey: ["ai-usage-logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ai_usage_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as AIUsageLog[];
    },
  });
}
