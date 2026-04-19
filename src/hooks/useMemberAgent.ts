import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface AgentConfig {
  id: string;
  member_id: string;
  role_template: string;
  custom_instructions: string | null;
  tone: string;
  enabled: boolean;
  preferred_model: string;
}

export interface AgentMessage {
  role: "user" | "assistant";
  content: string;
  ts?: string;
}

export interface AgentConversation {
  id: string;
  member_id: string;
  title: string;
  messages: AgentMessage[];
  context_snapshot: any;
  created_at: string;
  updated_at: string;
}

export interface MemberDigest {
  id: string;
  member_id: string;
  week_start: string;
  summary: string;
  suggestions: Array<{ icon?: string; title: string; detail: string }>;
  metrics: any;
  created_at: string;
}

export function useAgentConfig(memberId?: string) {
  return useQuery({
    queryKey: ["member-ai-agent", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_ai_agents")
        .select("*")
        .eq("member_id", memberId!)
        .maybeSingle();
      if (error) throw error;
      return data as AgentConfig | null;
    },
  });
}

export function useUpsertAgentConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cfg: Partial<AgentConfig> & { member_id: string }) => {
      const { data, error } = await supabase
        .from("member_ai_agents")
        .upsert(cfg, { onConflict: "member_id" })
        .select()
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: ["member-ai-agent", v.member_id] });
      toast.success("Configuración de agente guardada");
    },
    onError: (e: any) => toast.error(e.message || "Error guardando agente"),
  });
}

export function useAgentConversations(memberId?: string) {
  return useQuery({
    queryKey: ["member-ai-conversations", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_ai_conversations")
        .select("*")
        .eq("member_id", memberId!)
        .order("updated_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return (data || []) as unknown as AgentConversation[];
    },
  });
}

export function useDeleteConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("member_ai_conversations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["member-ai-conversations"] }),
  });
}

export function useChatWithAgent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: {
      member_id?: string;
      message: string;
      conversation_id?: string;
      task_id?: string;
      ticket_id?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke("member-agent-chat", { body: payload });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { answer: string; conversation_id: string; template: string };
    },
    onSuccess: (_d, v) => {
      if (v.member_id) qc.invalidateQueries({ queryKey: ["member-ai-conversations", v.member_id] });
    },
    onError: (e: any) => {
      const msg = e.message || "Error al consultar agente";
      if (msg.includes("Rate") || msg.includes("Límite")) toast.error("Demasiadas consultas, espera un momento");
      else if (msg.includes("Crédito")) toast.error("Créditos de IA agotados");
      else toast.error(msg);
    },
  });
}

export function useLatestDigest(memberId?: string) {
  return useQuery({
    queryKey: ["member-ai-digest", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("member_ai_digests")
        .select("*")
        .eq("member_id", memberId!)
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as MemberDigest | null;
    },
  });
}

export function useGenerateDigest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (member_id: string) => {
      const { data, error } = await supabase.functions.invoke("member-agent-weekly-digest", { body: { member_id } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (_d, member_id) => {
      qc.invalidateQueries({ queryKey: ["member-ai-digest", member_id] });
      toast.success("Resumen semanal generado");
    },
    onError: (e: any) => toast.error(e.message || "Error generando digest"),
  });
}
