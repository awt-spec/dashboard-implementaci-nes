import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CapacityRow {
  id: string;
  member_id: string;
  weekly_hours: number;
  timezone: string;
  ooo_periods: { start: string; end: string; reason: string }[];
  current_allocation_pct: number;
  notes: string;
}

export interface CertificationRow {
  id: string;
  member_id: string;
  name: string;
  issuer: string;
  issued_date: string | null;
  expires_date: string | null;
  credential_url: string;
}

export interface CareerPathRow {
  id: string;
  member_id: string;
  current_role_name: string;
  target_role_name: string;
  skills_gap: { skill: string; priority: string; reason: string }[];
  recommended_certifications: { name: string; issuer: string; timeline_months?: number }[];
  roadmap: { milestone: string; timeframe: string; actions: string[] }[];
  mentoring_suggestions: string[];
  ai_summary: string;
  generated_at: string;
  model: string;
}

export function useMember(memberId?: string) {
  return useQuery({
    queryKey: ["member", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("sysde_team_members" as any).select("*").eq("id", memberId).maybeSingle() as any);
      if (error) throw error;
      return data as any;
    },
  });
}

export function useMemberCapacity(memberId?: string) {
  return useQuery({
    queryKey: ["member-capacity", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("team_member_capacity" as any).select("*").eq("member_id", memberId).maybeSingle() as any);
      if (error) throw error;
      return data as CapacityRow | null;
    },
  });
}

export function useUpsertCapacity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: Partial<CapacityRow> & { member_id: string }) => {
      const { data: existing } = await (supabase.from("team_member_capacity" as any).select("id").eq("member_id", row.member_id).maybeSingle() as any);
      if (existing) {
        const { error } = await (supabase.from("team_member_capacity" as any).update(row).eq("id", existing.id) as any);
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("team_member_capacity" as any).insert(row) as any);
        if (error) throw error;
      }
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["member-capacity", vars.member_id] }),
  });
}

export function useMemberCertifications(memberId?: string) {
  return useQuery({
    queryKey: ["member-certs", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("team_member_certifications" as any).select("*").eq("member_id", memberId).order("issued_date", { ascending: false }) as any);
      if (error) throw error;
      return (data || []) as CertificationRow[];
    },
  });
}

export function useAddCertification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (cert: Partial<CertificationRow> & { member_id: string; name: string }) => {
      const { error } = await (supabase.from("team_member_certifications" as any).insert(cert) as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["member-certs", vars.member_id] }),
  });
}

export function useDeleteCertification() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string; member_id: string }) => {
      const { error } = await (supabase.from("team_member_certifications" as any).delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["member-certs", vars.member_id] }),
  });
}

export function useCareerPath(memberId?: string) {
  return useQuery({
    queryKey: ["member-career", memberId],
    enabled: !!memberId,
    queryFn: async () => {
      const { data, error } = await (supabase.from("team_career_paths" as any).select("*").eq("member_id", memberId).maybeSingle() as any);
      if (error) throw error;
      return data as CareerPathRow | null;
    },
  });
}

export function useGenerateCareerPath() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ memberId, targetRole }: { memberId: string; targetRole?: string }) => {
      const { data, error } = await supabase.functions.invoke("analyze-career-path", { body: { memberId, targetRole } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (_, vars) => qc.invalidateQueries({ queryKey: ["member-career", vars.memberId] }),
  });
}

// Performance: aggregate completed work items + activity for a member by name
export function useMemberPerformance(memberName?: string) {
  return useQuery({
    queryKey: ["member-performance", memberName],
    enabled: !!memberName,
    queryFn: async () => {
      const [tasksRes, ticketsRes, sessionsRes, timeRes] = await Promise.all([
        (supabase.from("tasks" as any).select("id,status,priority,owner,created_at,updated_at,due_date").eq("owner", memberName) as any),
        (supabase.from("support_tickets" as any).select("id,estado,prioridad,responsable,scrum_status,story_points,created_at,updated_at,fecha_entrega").eq("responsable", memberName) as any),
        (supabase.from("user_sessions" as any).select("id,started_at,ended_at,last_heartbeat").order("started_at", { ascending: false }).limit(50) as any).catch(() => ({ data: [] })),
        (supabase.from("work_time_entries" as any).select("id,duration_seconds,started_at,ended_at,task_id,ticket_id").order("started_at", { ascending: false }).limit(200) as any).catch(() => ({ data: [] })),
      ]);
      return {
        tasks: (tasksRes?.data || []) as any[],
        tickets: (ticketsRes?.data || []) as any[],
        sessions: (sessionsRes?.data || []) as any[],
        timeEntries: (timeRes?.data || []) as any[],
      };
    },
  });
}
