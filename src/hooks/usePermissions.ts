import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Permission {
  key: string;
  module: string;
  action: string;
  description: string | null;
}

export interface RolePermission {
  role_key: string;
  permission_key: string;
}

/** Catálogo de permisos (módulo + acción). */
export function usePermissionsCatalog() {
  return useQuery({
    queryKey: ["permissions-catalog"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("permissions" as any).select("*").order("module").order("action") as any);
      if (error) throw error;
      return (data || []) as Permission[];
    },
  });
}

/** Todas las asignaciones rol→permiso (para la matriz RBAC). */
export function useRolePermissions() {
  return useQuery({
    queryKey: ["role-permissions"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("role_permissions" as any).select("role_key, permission_key") as any);
      if (error) throw error;
      return (data || []) as RolePermission[];
    },
  });
}

/** Activa/desactiva un permiso para un rol (insert/delete). */
export function useToggleRolePermission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ role_key, permission_key, enabled }: { role_key: string; permission_key: string; enabled: boolean }) => {
      if (enabled) {
        const { error } = await (supabase.from("role_permissions" as any).insert([{ role_key, permission_key }]) as any);
        if (error && error.code !== "23505") throw error; // ignora duplicado
      } else {
        const { error } = await (supabase.from("role_permissions" as any).delete().eq("role_key", role_key).eq("permission_key", permission_key) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["role-permissions"] });
      qc.invalidateQueries({ queryKey: ["my-permissions"] });
    },
  });
}

/** Permisos efectivos del usuario actual (vía get_my_permissions RPC). */
export function useMyPermissions() {
  return useQuery({
    queryKey: ["my-permissions"],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc("get_my_permissions" as any) as any);
      if (error) throw error;
      return new Set(((data || []) as { permission_key: string }[]).map((r) => r.permission_key));
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Helper de gating: ¿el usuario actual tiene el permiso? */
export function useHasPermission(permissionKey: string) {
  const { data: perms } = useMyPermissions();
  return perms?.has(permissionKey) ?? false;
}

// ── Roles personalizados asignados a usuarios ───────────────────────────────
export interface UserCustomRole {
  id: string;
  user_id: string;
  role_key: string;
  created_at: string;
}

export function useUserCustomRoles(userId?: string) {
  return useQuery({
    queryKey: ["user-custom-roles", userId ?? "all"],
    queryFn: async () => {
      let q = (supabase.from("user_custom_roles" as any).select("*") as any);
      if (userId) q = q.eq("user_id", userId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as UserCustomRole[];
    },
  });
}

export function useAssignCustomRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ user_id, role_key, enabled }: { user_id: string; role_key: string; enabled: boolean }) => {
      if (enabled) {
        const { data: userData } = await supabase.auth.getUser();
        const { error } = await (supabase.from("user_custom_roles" as any).insert([{ user_id, role_key, assigned_by: userData?.user?.id ?? null }]) as any);
        if (error && error.code !== "23505") throw error;
      } else {
        const { error } = await (supabase.from("user_custom_roles" as any).delete().eq("user_id", user_id).eq("role_key", role_key) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-custom-roles"] }),
  });
}
