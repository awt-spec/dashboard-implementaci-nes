import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RoleScope = "interno" | "externo";

export interface Role {
  key: string;
  label: string;
  description: string | null;
  scope: RoleScope;
  is_system: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export function useRoles() {
  return useQuery({
    queryKey: ["roles-catalog"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("roles" as any).select("*").order("is_system", { ascending: false }).order("label") as any);
      if (error) throw error;
      return (data || []) as Role[];
    },
  });
}

export interface UpsertRoleInput {
  key: string;
  label: string;
  description?: string | null;
  scope?: RoleScope;
  is_active?: boolean;
  /** true cuando se está editando un rol existente (no se reescribe la key). */
  isEdit?: boolean;
}

export function useUpsertRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertRoleInput) => {
      if (input.isEdit) {
        const { error } = await (supabase.from("roles" as any).update({
          label: input.label,
          description: input.description ?? null,
          scope: input.scope ?? "interno",
          is_active: input.is_active ?? true,
        }).eq("key", input.key) as any);
        if (error) throw error;
      } else {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await (supabase.from("roles" as any).insert([{
          key: input.key,
          label: input.label,
          description: input.description ?? null,
          scope: input.scope ?? "interno",
          is_system: false,
          is_active: input.is_active ?? true,
          created_by: userData?.user?.id ?? null,
        }]) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roles-catalog"] }),
  });
}

export function useDeleteRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (key: string) => {
      const { error } = await (supabase.from("roles" as any).delete().eq("key", key) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["roles-catalog"] }),
  });
}

/** Conteo de usuarios por rol (desde user_roles, solo aplica a roles de sistema del enum). */
export function useRoleCounts() {
  return useQuery({
    queryKey: ["role-counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("role");
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach((r: any) => { if (r.role) counts[r.role] = (counts[r.role] || 0) + 1; });
      return counts;
    },
  });
}
