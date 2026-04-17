import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SprintDaily {
  id: string;
  sprint_id: string;
  member_name: string;
  date: string;
  yesterday: string;
  today: string;
  blockers: string;
  mood: number;
  created_at: string;
  updated_at: string;
}

export interface SprintRetro {
  id: string;
  sprint_id: string;
  what_went_well: string[];
  what_to_improve: string[];
  action_items: string[];
  team_mood: number;
  facilitator: string;
}

export interface SprintReview {
  id: string;
  sprint_id: string;
  demo_notes: string;
  completed_items: any[];
  carry_over: any[];
  stakeholder_feedback: string;
  velocity_planned: number;
  velocity_completed: number;
}

// ===== DAILIES =====
export function useSprintDailies(sprintId?: string) {
  return useQuery({
    queryKey: ["sprint-dailies", sprintId],
    enabled: !!sprintId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sprint_dailies" as any)
        .select("*")
        .eq("sprint_id", sprintId)
        .order("date", { ascending: false }) as any);
      if (error) throw error;
      return (data || []) as SprintDaily[];
    },
  });
}

export function useUpsertDaily() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<SprintDaily> & { sprint_id: string; member_name: string; date: string }) => {
      const { error } = await (supabase
        .from("sprint_dailies" as any)
        .upsert([input], { onConflict: "sprint_id,member_name,date" }) as any);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["sprint-dailies", vars.sprint_id] }),
  });
}

// ===== RETROSPECTIVES =====
export function useSprintRetro(sprintId?: string) {
  return useQuery({
    queryKey: ["sprint-retro", sprintId],
    enabled: !!sprintId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sprint_retrospectives" as any)
        .select("*")
        .eq("sprint_id", sprintId)
        .maybeSingle() as any);
      if (error) throw error;
      return data as SprintRetro | null;
    },
  });
}

export function useUpsertRetro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<SprintRetro> & { sprint_id: string }) => {
      const { error } = await (supabase
        .from("sprint_retrospectives" as any)
        .upsert([input], { onConflict: "sprint_id" }) as any);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["sprint-retro", vars.sprint_id] }),
  });
}

// ===== REVIEWS =====
export function useSprintReview(sprintId?: string) {
  return useQuery({
    queryKey: ["sprint-review", sprintId],
    enabled: !!sprintId,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sprint_reviews" as any)
        .select("*")
        .eq("sprint_id", sprintId)
        .maybeSingle() as any);
      if (error) throw error;
      return data as SprintReview | null;
    },
  });
}

export function useUpsertReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<SprintReview> & { sprint_id: string }) => {
      const { error } = await (supabase
        .from("sprint_reviews" as any)
        .upsert([input], { onConflict: "sprint_id" }) as any);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: ["sprint-review", vars.sprint_id] }),
  });
}

// ===== FORECAST IA =====
export function useSprintForecast() {
  return useMutation({
    mutationFn: async (input: { velocity_history: { sprint: string; planned: number; completed: number }[]; backlog_points: number }) => {
      const { data, error } = await supabase.functions.invoke("forecast-sprint", { body: input });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as {
        avg_velocity: number;
        sprints_to_complete: number;
        estimated_end_date: string;
        confidence: "alta" | "media" | "baja";
        risk_factors: string[];
        recommendations: string[];
      };
    },
  });
}
