import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ---------- KUDOS ----------
export function useKudos(memberId?: string) {
  return useQuery({
    queryKey: ["team_kudos", memberId || "all"],
    queryFn: async () => {
      let q = supabase.from("team_kudos").select("*").order("created_at", { ascending: false }).limit(100);
      if (memberId) q = q.eq("to_member_id", memberId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useGiveKudo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (k: { from_member_id: string; to_member_id: string; category: string; message: string; emoji?: string }) => {
      const { error } = await supabase.from("team_kudos").insert(k);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team_kudos"] });
      toast.success("¡Kudo enviado!");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ---------- BADGES ----------
export function useBadges() {
  return useQuery({
    queryKey: ["team_badges"],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_badges").select("*").order("name");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useMemberBadges(memberId?: string) {
  return useQuery({
    queryKey: ["team_member_badges", memberId || "all"],
    enabled: true,
    queryFn: async () => {
      let q = supabase.from("team_member_badges").select("*, team_badges(*)").order("awarded_at", { ascending: false });
      if (memberId) q = q.eq("member_id", memberId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useAwardBadge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (a: { member_id: string; badge_id: string; awarded_by?: string; reason?: string }) => {
      const { error } = await supabase.from("team_member_badges").insert(a);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team_member_badges"] });
      toast.success("Insignia otorgada");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ---------- TIME-OFF ----------
export function useTimeOff(memberId?: string) {
  return useQuery({
    queryKey: ["team_time_off", memberId || "all"],
    queryFn: async () => {
      let q = supabase.from("team_time_off").select("*, sysde_team_members(name, department)").order("start_date", { ascending: false });
      if (memberId) q = q.eq("member_id", memberId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useRequestTimeOff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (r: { member_id: string; type: string; start_date: string; end_date: string; reason?: string }) => {
      const { error } = await supabase.from("team_time_off").insert(r);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team_time_off"] });
      toast.success("Solicitud creada");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateTimeOff() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: any) => {
      const { error } = await supabase.from("team_time_off").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team_time_off"] });
      toast.success("Actualizado");
    },
    onError: (e: any) => toast.error(e.message),
  });
}

// ---------- LEARNING ----------
export function useCourses() {
  return useQuery({
    queryKey: ["learning_courses"],
    queryFn: async () => {
      const { data, error } = await supabase.from("learning_courses").select("*").order("title");
      if (error) throw error;
      return data || [];
    },
  });
}

export function useEnrollments(memberId?: string) {
  return useQuery({
    queryKey: ["learning_enrollments", memberId || "all"],
    queryFn: async () => {
      let q = supabase.from("learning_enrollments").select("*, learning_courses(*), sysde_team_members(name)").order("updated_at", { ascending: false });
      if (memberId) q = q.eq("member_id", memberId);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });
}

export function useUpsertCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (c: any) => {
      const { error } = c.id
        ? await supabase.from("learning_courses").update(c).eq("id", c.id)
        : await supabase.from("learning_courses").insert(c);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["learning_courses"] }); toast.success("Curso guardado"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useEnroll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (e: { member_id: string; course_id: string }) => {
      const { error } = await supabase.from("learning_enrollments").insert({ ...e, status: "enrolled", started_at: new Date().toISOString().slice(0, 10) });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["learning_enrollments"] }); toast.success("Inscrito"); },
    onError: (e: any) => toast.error(e.message),
  });
}

export function useUpdateEnrollment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: any) => {
      const { error } = await supabase.from("learning_enrollments").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["learning_enrollments"] }),
    onError: (e: any) => toast.error(e.message),
  });
}
