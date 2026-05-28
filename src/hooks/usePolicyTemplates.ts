import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PolicyTemplate {
  id: string;
  name: string;
  description: string | null;
  policy_version: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PolicyTemplatePackage {
  id: string;
  policy_template_id: string;
  name: string;
  description: string | null;
  included_hours: number;
  price: number;
  currency: string;
  billing_cycle: string;
  sort_order: number;
  created_at: string;
}

export function usePolicyTemplates(includeInactive = false) {
  return useQuery({
    queryKey: ["policy-templates", includeInactive],
    queryFn: async () => {
      let q = (supabase.from("policy_templates" as any).select("*") as any);
      if (!includeInactive) q = q.eq("is_active", true);
      const { data, error } = await q.order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as PolicyTemplate[];
    },
  });
}

export interface UpsertPolicyTemplateInput {
  id?: string;
  name: string;
  description?: string | null;
  policy_version?: string;
  is_active?: boolean;
}

export function useUpsertPolicyTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertPolicyTemplateInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const payload: any = {
        name: input.name.trim(),
        description: input.description ?? null,
        policy_version: input.policy_version ?? "v1",
        is_active: input.is_active ?? true,
      };
      if (input.id) {
        const { error } = await (supabase.from("policy_templates" as any).update(payload).eq("id", input.id) as any);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("policy_templates" as any).insert([{ ...payload, created_by: userData?.user?.id }]) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["policy-templates"] }),
  });
}

export function useDeletePolicyTemplate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("policy_templates" as any).delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["policy-templates"] }),
  });
}

// ── Paquetes de plantilla ────────────────────────────────────────────────
export function usePolicyTemplatePackages(templateId: string | undefined) {
  return useQuery({
    queryKey: ["policy-template-packages", templateId],
    enabled: !!templateId,
    queryFn: async () => {
      if (!templateId) return [];
      const { data, error } = await (
        supabase.from("policy_template_packages" as any).select("*").eq("policy_template_id", templateId).order("sort_order", { ascending: true }) as any
      );
      if (error) throw error;
      return (data || []) as PolicyTemplatePackage[];
    },
  });
}

export interface UpsertTemplatePackageInput {
  id?: string;
  policy_template_id: string;
  name: string;
  description?: string | null;
  included_hours?: number;
  price?: number;
  currency?: string;
  billing_cycle?: string;
  sort_order?: number;
}

export function useUpsertTemplatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertTemplatePackageInput) => {
      const payload: any = {
        policy_template_id: input.policy_template_id,
        name: input.name.trim(),
        description: input.description ?? null,
        included_hours: input.included_hours ?? 0,
        price: input.price ?? 0,
        currency: input.currency ?? "USD",
        billing_cycle: input.billing_cycle ?? "mensual",
        sort_order: input.sort_order ?? 0,
      };
      if (input.id) {
        const { error } = await (supabase.from("policy_template_packages" as any).update(payload).eq("id", input.id) as any);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("policy_template_packages" as any).insert([payload]) as any);
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["policy-template-packages", vars.policy_template_id] }),
  });
}

export function useDeleteTemplatePackage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; templateId: string }) => {
      const { error } = await (supabase.from("policy_template_packages" as any).delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["policy-template-packages", vars.templateId] }),
  });
}
