import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TeamSkill {
  id: string;
  member_id: string;
  skill_name: string;
  category: string;
  level: number;
  years_experience: number;
  is_certified: boolean;
  notes?: string;
}

export interface OnboardingRecord {
  id: string;
  member_id: string;
  status: string;
  start_date: string;
  expected_end_date?: string | null;
  completed_date?: string | null;
  buddy_member_id?: string | null;
  checklist: Array<{ id: string; title: string; done: boolean }>;
  progress_pct: number;
  notes?: string;
}

export function useAllTeamSkills() {
  return useQuery({
    queryKey: ["team-skills-all"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("team_member_skills" as any).select("*").order("skill_name") as any);
      if (error) throw error;
      return (data || []) as TeamSkill[];
    },
  });
}

export function useMemberSkills(memberId?: string) {
  return useQuery({
    queryKey: ["team-skills", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("team_member_skills" as any).select("*").eq("member_id", memberId).order("level", { ascending: false }) as any);
      if (error) throw error;
      return (data || []) as TeamSkill[];
    },
  });
}

export function useUpsertSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (skill: Partial<TeamSkill> & { member_id: string; skill_name: string }) => {
      const { error } = await (supabase.from("team_member_skills" as any).upsert([skill], { onConflict: "member_id,skill_name" }) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-skills-all"] });
      qc.invalidateQueries({ queryKey: ["team-skills"] });
    },
  });
}

export function useDeleteSkill() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("team_member_skills" as any).delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-skills-all"] });
      qc.invalidateQueries({ queryKey: ["team-skills"] });
    },
  });
}

export function useAllOnboarding() {
  return useQuery({
    queryKey: ["team-onboarding-all"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("team_onboarding" as any).select("*").order("created_at", { ascending: false }) as any);
      if (error) throw error;
      return (data || []) as OnboardingRecord[];
    },
  });
}

export function useUpsertOnboarding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rec: Partial<OnboardingRecord> & { member_id: string }) => {
      const { error } = await (supabase.from("team_onboarding" as any).upsert([rec], { onConflict: "member_id" }) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["team-onboarding-all"] }),
  });
}
