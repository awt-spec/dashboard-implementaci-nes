import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface BusinessRule {
  id: string;
  name: string;
  description: string | null;
  scope: "global" | "client" | "case_type";
  policy_version: string;
  rule_type: string;
  content: any;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useBusinessRules() {
  return useQuery({
    queryKey: ["business_rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_rules")
        .select("*")
        .order("rule_type", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as BusinessRule[];
    },
  });
}

export function useUpsertBusinessRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: Partial<BusinessRule> & { name: string; rule_type: string }) => {
      const { data, error } = await supabase
        .from("business_rules")
        .upsert({
          id: rule.id,
          name: rule.name,
          description: rule.description ?? null,
          scope: rule.scope ?? "global",
          policy_version: rule.policy_version ?? "v4.5",
          rule_type: rule.rule_type,
          content: rule.content ?? {},
          is_active: rule.is_active ?? true,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business_rules"] });
      toast({ title: "Regla guardada" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function useToggleBusinessRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("business_rules").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["business_rules"] }),
  });
}

export function useDeleteBusinessRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("business_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["business_rules"] });
      toast({ title: "Regla eliminada" });
    },
  });
}

export function useClientOverrides(clientId?: string) {
  return useQuery({
    queryKey: ["client_rule_overrides", clientId],
    queryFn: async () => {
      let q = supabase.from("client_rule_overrides").select("*, business_rules(*)");
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useUpsertClientOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (o: { id?: string; client_id: string; rule_id: string; override_content: any; notes?: string; is_active?: boolean }) => {
      const { data, error } = await supabase
        .from("client_rule_overrides")
        .upsert({
          id: o.id,
          client_id: o.client_id,
          rule_id: o.rule_id,
          override_content: o.override_content,
          notes: o.notes,
          is_active: o.is_active ?? true,
        }, { onConflict: "client_id,rule_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client_rule_overrides"] });
      toast({ title: "Override guardado" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });
}

export function usePolicyAISettings() {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: ["policy_ai_settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("policy_ai_settings")
        .select("*")
        .eq("scope", "global")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const update = useMutation({
    mutationFn: async (patch: any) => {
      const current = query.data;
      if (current?.id) {
        const { error } = await supabase.from("policy_ai_settings").update(patch).eq("id", current.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("policy_ai_settings").insert({ scope: "global", ...patch });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["policy_ai_settings"] });
      toast({ title: "Configuración IA actualizada" });
    },
  });

  return { ...query, update };
}
