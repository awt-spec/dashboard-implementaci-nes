import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SvaTeam {
  id: string;
  name: string;
  description: string | null;
  lead_user_id: string | null;
  color: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SvaTeamHoliday {
  id: string;
  sva_team_id: string;
  holiday_date: string;
  description: string | null;
  created_at: string;
}

// ── Teams ────────────────────────────────────────────────────────────────
export function useSvaTeams(includeInactive = false) {
  return useQuery({
    queryKey: ["sva-teams", includeInactive],
    queryFn: async () => {
      let q = (supabase.from("sva_teams" as any).select("*") as any);
      if (!includeInactive) q = q.eq("is_active", true);
      const { data, error } = await q.order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as SvaTeam[];
    },
  });
}

export interface UpsertSvaTeamInput {
  id?: string;
  name: string;
  description?: string | null;
  lead_user_id?: string | null;
  color?: string;
  is_active?: boolean;
}

export function useUpsertSvaTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertSvaTeamInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const payload: any = {
        name: input.name.trim(),
        description: input.description ?? null,
        lead_user_id: input.lead_user_id ?? null,
        color: input.color ?? "#C8200F",
        is_active: input.is_active ?? true,
      };
      if (input.id) {
        const { error } = await (supabase.from("sva_teams" as any).update(payload).eq("id", input.id) as any);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("sva_teams" as any).insert([{ ...payload, created_by: userData?.user?.id }]) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sva-teams"] }),
  });
}

export function useDeleteSvaTeam() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("sva_teams" as any).delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["sva-teams"] }),
  });
}

// ── Holidays ───────────────────────────────────────────────────────────────
export function useSvaTeamHolidays(teamId: string | undefined) {
  return useQuery({
    queryKey: ["sva-team-holidays", teamId],
    enabled: !!teamId,
    queryFn: async () => {
      if (!teamId) return [];
      const { data, error } = await (
        supabase.from("sva_team_holidays" as any).select("*").eq("sva_team_id", teamId).order("holiday_date", { ascending: true }) as any
      );
      if (error) throw error;
      return (data || []) as SvaTeamHoliday[];
    },
  });
}

export function useAddSvaTeamHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ teamId, date, description }: { teamId: string; date: string; description?: string }) => {
      const { error } = await (
        supabase.from("sva_team_holidays" as any).insert([{ sva_team_id: teamId, holiday_date: date, description: description ?? null }]) as any
      );
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["sva-team-holidays", vars.teamId] }),
  });
}

export function useDeleteSvaTeamHoliday() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; teamId: string }) => {
      const { error } = await (supabase.from("sva_team_holidays" as any).delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["sva-team-holidays", vars.teamId] }),
  });
}
