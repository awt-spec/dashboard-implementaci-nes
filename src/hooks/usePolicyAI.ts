import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Mode = "recommend_action" | "generate_notice" | "validate_closing";

export function usePolicyAI() {
  return useMutation({
    mutationFn: async ({ mode, ticket_id, notice_type }: { mode: Mode; ticket_id: string; notice_type?: string }) => {
      const { data, error } = await supabase.functions.invoke("policy-ai-assistant", {
        body: { mode, ticket_id, notice_type },
      });
      if (error) throw error;
      return data as { result: string; mode: Mode; model: string };
    },
    onError: (e: any) => {
      const msg = e?.message || "Error IA";
      if (msg.includes("payment")) toast({ title: "Sin créditos IA", description: "Recarga tu workspace", variant: "destructive" });
      else if (msg.includes("rate")) toast({ title: "Límite IA", description: "Intenta en un momento", variant: "destructive" });
      else toast({ title: "Error IA", description: msg, variant: "destructive" });
    },
  });
}
