import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type SupervisionScope = "general" | "tickets" | "tasks" | "quality" | "time";

export interface UserSupervision {
  id: string;
  supervisor_id: string;
  supervised_user_id: string;
  scope: SupervisionScope;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamSupervision {
  id: string;
  supervisor_id: string;
  team_department: string;
  scope: SupervisionScope;
  started_at: string;
  ended_at: string | null;
  is_active: boolean;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SupervisorOfUserRow {
  supervisor_id: string;
  source: string; // "direct" | "team:<dept>"
  scope: SupervisionScope;
  started_at: string;
}

// ────────────────────────────────────────────────────────────────────────────
// USER SUPERVISIONS — queries
// ────────────────────────────────────────────────────────────────────────────

export function useUserSupervisions(filters?: { supervisorId?: string; supervisedUserId?: string; onlyActive?: boolean }) {
  return useQuery({
    queryKey: ["user-supervisions", filters],
    queryFn: async () => {
      let q = (supabase.from("user_supervisions").select("*") as any);
      if (filters?.supervisorId) q = q.eq("supervisor_id", filters.supervisorId);
      if (filters?.supervisedUserId) q = q.eq("supervised_user_id", filters.supervisedUserId);
      if (filters?.onlyActive) q = q.eq("is_active", true);
      const { data, error } = await q.order("started_at", { ascending: false });
      if (error) throw error;
      return (data || []) as UserSupervision[];
    },
  });
}

export function useTeamSupervisions(filters?: { supervisorId?: string; teamDepartment?: string; onlyActive?: boolean }) {
  return useQuery({
    queryKey: ["team-supervisions", filters],
    queryFn: async () => {
      let q = (supabase.from("team_supervisions").select("*") as any);
      if (filters?.supervisorId) q = q.eq("supervisor_id", filters.supervisorId);
      if (filters?.teamDepartment) q = q.eq("team_department", filters.teamDepartment);
      if (filters?.onlyActive) q = q.eq("is_active", true);
      const { data, error } = await q.order("started_at", { ascending: false });
      if (error) throw error;
      return (data || []) as TeamSupervision[];
    },
  });
}

/** Supervisores activos de un usuario (directos + por department). */
export function useSupervisorsOfUser(userId: string | undefined) {
  return useQuery({
    queryKey: ["supervisors-of-user", userId],
    enabled: !!userId,
    queryFn: async () => {
      if (!userId) return [];
      const { data, error } = await supabase.rpc(
        "get_supervisors_of_user" as any,
        { _user_id: userId } as any,
      );
      if (error) throw error;
      return (data ?? []) as SupervisorOfUserRow[];
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// MUTATIONS — user supervisions
// ────────────────────────────────────────────────────────────────────────────

export interface UpsertUserSupervisionInput {
  id?: string;
  supervisor_id: string;
  supervised_user_id: string;
  scope?: SupervisionScope;
  started_at?: string;
  ended_at?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

export function useUpsertUserSupervision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertUserSupervisionInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      const payload: any = {
        supervisor_id:      input.supervisor_id,
        supervised_user_id: input.supervised_user_id,
        scope:              input.scope ?? "general",
        started_at:         input.started_at ?? new Date().toISOString().slice(0, 10),
        ended_at:           input.ended_at ?? null,
        is_active:          input.is_active ?? true,
        notes:              input.notes ?? null,
        created_by:         userId,
      };
      if (input.id) {
        const { error } = await (
          supabase.from("user_supervisions").update(payload).eq("id", input.id) as any
        );
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("user_supervisions").insert([payload]) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-supervisions"] });
      qc.invalidateQueries({ queryKey: ["supervisors-of-user"] });
    },
  });
}

export function useEndUserSupervision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (
        supabase
          .from("user_supervisions")
          .update({ is_active: false, ended_at: new Date().toISOString().slice(0, 10) })
          .eq("id", id) as any
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-supervisions"] });
      qc.invalidateQueries({ queryKey: ["supervisors-of-user"] });
    },
  });
}

export function useDeleteUserSupervision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (
        supabase.from("user_supervisions").delete().eq("id", id) as any
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-supervisions"] });
      qc.invalidateQueries({ queryKey: ["supervisors-of-user"] });
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// MUTATIONS — team supervisions
// ────────────────────────────────────────────────────────────────────────────

export interface UpsertTeamSupervisionInput {
  id?: string;
  supervisor_id: string;
  team_department: string;
  scope?: SupervisionScope;
  started_at?: string;
  ended_at?: string | null;
  is_active?: boolean;
  notes?: string | null;
}

export function useUpsertTeamSupervision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertTeamSupervisionInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      const payload: any = {
        supervisor_id:   input.supervisor_id,
        team_department: input.team_department,
        scope:           input.scope ?? "general",
        started_at:      input.started_at ?? new Date().toISOString().slice(0, 10),
        ended_at:        input.ended_at ?? null,
        is_active:       input.is_active ?? true,
        notes:           input.notes ?? null,
        created_by:      userId,
      };
      if (input.id) {
        const { error } = await (
          supabase.from("team_supervisions").update(payload).eq("id", input.id) as any
        );
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("team_supervisions").insert([payload]) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-supervisions"] });
    },
  });
}

export function useEndTeamSupervision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (
        supabase
          .from("team_supervisions")
          .update({ is_active: false, ended_at: new Date().toISOString().slice(0, 10) })
          .eq("id", id) as any
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-supervisions"] });
    },
  });
}

export function useDeleteTeamSupervision() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (
        supabase.from("team_supervisions").delete().eq("id", id) as any
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["team-supervisions"] });
    },
  });
}

// ────────────────────────────────────────────────────────────────────────────
// HELPERS para selectores — departments existentes en sysde_team_members
// ────────────────────────────────────────────────────────────────────────────

export function useDepartments() {
  return useQuery({
    queryKey: ["sysde-departments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sysde_team_members")
        .select("department")
        .eq("is_active", true);
      if (error) throw error;
      const set = new Set<string>();
      for (const row of (data ?? []) as Array<{ department: string | null }>) {
        if (row.department) set.add(row.department.trim());
      }
      return Array.from(set).sort();
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Listado de profiles staff (no clientes). Usado en selectores del panel admin. */
export interface StaffProfile {
  user_id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
}

export function useStaffProfiles() {
  return useQuery({
    queryKey: ["staff-profiles"],
    queryFn: async () => {
      // profiles + user_roles join — toma el rol con mayor prioridad por user
      const { data: profilesData, error: profilesErr } = await supabase
        .from("profiles")
        .select("user_id, full_name, email");
      if (profilesErr) throw profilesErr;

      const { data: rolesData, error: rolesErr } = await supabase
        .from("user_roles")
        .select("user_id, role");
      if (rolesErr) throw rolesErr;

      const PRIORITY: Record<string, number> = {
        ceo: 6, admin: 5, pm: 4, gerente_soporte: 3.5, gerente: 3, colaborador: 2, cliente: 1,
      };
      const bestRoleBy = new Map<string, string>();
      for (const r of (rolesData ?? []) as Array<{ user_id: string; role: string }>) {
        const cur = bestRoleBy.get(r.user_id);
        if (!cur || (PRIORITY[r.role] ?? 0) > (PRIORITY[cur] ?? 0)) {
          bestRoleBy.set(r.user_id, r.role);
        }
      }

      const result: StaffProfile[] = (profilesData ?? [])
        .map((p: any) => ({
          user_id: p.user_id,
          full_name: p.full_name,
          email: p.email,
          role: bestRoleBy.get(p.user_id) ?? null,
        }))
        .filter(p => p.role && p.role !== "cliente");

      result.sort((a, b) => (a.full_name ?? a.email ?? "").localeCompare(b.full_name ?? b.email ?? ""));
      return result;
    },
    staleTime: 5 * 60 * 1000,
  });
}
