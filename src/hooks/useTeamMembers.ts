import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SysdeTeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  is_active: boolean;
  created_at: string;
}

export interface ClientTeamMember {
  id: string;
  client_id: string;
  name: string;
  email: string;
  role: string;
  department: string;
  is_active: boolean;
  created_at: string;
}

export function useSysdeTeamMembers() {
  return useQuery({
    queryKey: ["sysde-team-members"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("sysde_team_members" as any).select("*").order("name") as any);
      if (error) throw error;
      return (data || []) as SysdeTeamMember[];
    },
  });
}

export function useClientTeamMembers(clientId?: string) {
  return useQuery({
    queryKey: ["client-team-members", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("client_team_members" as any).select("*").eq("client_id", clientId).order("name") as any);
      if (error) throw error;
      return (data || []) as ClientTeamMember[];
    },
  });
}

export function useCreateSysdeTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (member: Partial<SysdeTeamMember>) => {
      const { error } = await (supabase.from("sysde_team_members" as any).insert([member]) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sysde-team-members"] }),
  });
}

export function useUpdateSysdeTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<SysdeTeamMember> }) => {
      const { error } = await (supabase.from("sysde_team_members" as any).update(updates).eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sysde-team-members"] }),
  });
}

export function useDeleteSysdeTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("sysde_team_members" as any).delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sysde-team-members"] }),
  });
}

export function useCreateClientTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (member: Partial<ClientTeamMember> & { client_id: string }) => {
      const { error } = await (supabase.from("client_team_members" as any).insert([member]) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-team-members"] }),
  });
}

export function useDeleteClientTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("client_team_members" as any).delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-team-members"] }),
  });
}
