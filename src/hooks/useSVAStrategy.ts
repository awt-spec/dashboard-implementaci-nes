import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---------------------------------------------------------------------------
// Estrategia SVA: datos agregados para el panel "Estrategia".
// Consolida horas registradas, tickets y actividad, y expone el plan semanal IA.
// ---------------------------------------------------------------------------

export interface WorkTimeEntry {
  id: string;
  user_id: string;
  source: "task" | "ticket";
  item_id: string;
  client_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  is_billable: boolean;
  category: string | null;
  note: string | null;
}

export interface TeamMemberLite {
  id: string;
  name: string;
  email: string | null;
  role: string | null;
  department: string | null;
  cv_seniority: string | null;
  is_active: boolean;
  user_id: string | null;
}

export interface SVAWeeklyPlan {
  executive_summary: string;
  weekly_focus: string[];
  client_priorities: Array<{
    client_id: string;
    client_name: string;
    tier: "critico" | "alto" | "medio" | "bajo";
    reason: string;
    action: string;
  }>;
  assignments: Array<{
    member_name: string;
    primary_client: string;
    target_hours: number;
    focus_items: string[];
    note: string;
  }>;
  items_to_defer: Array<{
    item_id: string;
    title: string;
    action: "aplazar" | "dividir" | "cerrar" | "reasignar";
    reason: string;
  }>;
  risks_this_week: Array<{
    title: string;
    severity: "critico" | "alto" | "medio";
    mitigation: string;
  }>;
}

// ---------- Horas (últimos N días) ----------

export function useWorkTimeEntries(daysBack = 14) {
  return useQuery({
    queryKey: ["work-time-entries", daysBack],
    queryFn: async () => {
      const since = new Date(Date.now() - daysBack * 86400000).toISOString();
      const { data, error } = await (supabase.from("work_time_entries" as any)
        .select("*")
        .gte("started_at", since)
        .order("started_at", { ascending: false }) as any);
      if (error) throw error;
      return (data || []) as WorkTimeEntry[];
    },
  });
}

// ---------- Team members (solo activos, con mapping user_id → nombre) ----------

export function useActiveTeamMembers() {
  return useQuery({
    queryKey: ["sysde-team-members-active"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("sysde_team_members")
        .select("id, name, email, role, department, cv_seniority, is_active, user_id")
        .eq("is_active", true) as any);
      if (error) throw error;
      return (data || []) as TeamMemberLite[];
    },
  });
}

// ---------- Activity log (últimas 48h, para detectar desincronización) ----------

export function useRecentActivity(hoursBack = 48) {
  return useQuery({
    queryKey: ["user-activity-log", hoursBack],
    queryFn: async () => {
      const since = new Date(Date.now() - hoursBack * 3600000).toISOString();
      const { data, error } = await (supabase.from("user_activity_log" as any)
        .select("user_id, action, entity_type, created_at")
        .gte("created_at", since) as any);
      if (error) return [];
      return (data || []) as Array<{ user_id: string; action: string; entity_type: string | null; created_at: string }>;
    },
  });
}

// ---------- Último plan semanal IA guardado ----------

export function useLatestWeeklyPlan() {
  return useQuery({
    queryKey: ["sva-weekly-plan-latest"],
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("pm_ai_analysis")
        .select("id, scope, executive_summary, client_priorities, risks, full_analysis, metrics, created_at")
        .eq("analysis_type", "sva_weekly_plan")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle() as any);
      if (error) return null;
      if (!data) return null;
      return {
        id: data.id,
        scope: data.scope,
        plan: data.full_analysis as SVAWeeklyPlan,
        metrics: data.metrics,
        created_at: data.created_at,
      };
    },
  });
}

// ---------- Mutation: generar plan semanal ----------

export function useGenerateSVAStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sva-strategy", { body: {} });
      if (error) throw error;
      return data as { plan: SVAWeeklyPlan; id: string; generated_at: string };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sva-weekly-plan-latest"] });
    },
  });
}

// ---------- Health check: clientes sin financials ----------

export function useClientsWithoutFinancials() {
  return useQuery({
    queryKey: ["sva-health-clients-no-financials"],
    queryFn: async () => {
      const [cli, fin] = await Promise.all([
        (supabase.from("clients").select("id, name, client_type, status") as any),
        (supabase.from("client_financials").select("client_id") as any),
      ]);
      if (cli.error) throw cli.error;
      const haveFin = new Set((fin.data || []).map((f: any) => f.client_id));
      return (cli.data || [])
        .filter((c: any) => c.client_type === "soporte" && !haveFin.has(c.id))
        .map((c: any) => ({ id: c.id, name: c.name, status: c.status }));
    },
  });
}

export function useBulkCreateClientFinancials() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entries: Array<{ client_id: string; monthly_value: number; contract_value?: number }>) => {
      const now = new Date();
      const rows = entries.map(e => ({
        client_id: e.client_id,
        contract_value: e.contract_value ?? e.monthly_value * 12,
        billed: 0,
        paid: 0,
        pending: 0,
        hours_estimated: 0,
        hours_used: 0,
        monthly_breakdown: [{
          month: now.toISOString().slice(0, 7),
          value: e.monthly_value,
        }],
      }));
      const { data, error } = await (supabase.from("client_financials").insert(rows as any).select() as any);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sva-health-clients-no-financials"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
    },
  });
}

// ---------- Health check: clientes sin sprint activo ----------

export function useClientsWithoutActiveSprint() {
  return useQuery({
    queryKey: ["sva-health-clients-no-sprint"],
    queryFn: async () => {
      const [cli, spr, tkt] = await Promise.all([
        (supabase.from("clients").select("id, name, client_type, status") as any),
        (supabase.from("support_sprints").select("client_id, status") as any),
        (supabase.from("support_tickets").select("client_id, estado") as any),
      ]);
      if (cli.error) throw cli.error;
      const activeClientSprints = new Set(
        (spr.data || []).filter((s: any) => s.status === "activo").map((s: any) => s.client_id)
      );
      const openByClient = new Map<string, number>();
      (tkt.data || []).forEach((t: any) => {
        const estado = (t.estado || "").toUpperCase();
        if (estado === "CERRADA" || estado === "ANULADA" || estado === "FINALIZADO") return;
        openByClient.set(t.client_id, (openByClient.get(t.client_id) || 0) + 1);
      });
      return (cli.data || [])
        .filter((c: any) => c.client_type === "soporte"
          && c.status !== "completado"
          && !activeClientSprints.has(c.id)
          && (openByClient.get(c.id) || 0) > 0)
        .map((c: any) => ({
          id: c.id,
          name: c.name,
          open_tickets: openByClient.get(c.id) || 0,
        }));
    },
  });
}

export function useInitSprintForClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { client_id: string; name: string; goal?: string; start_date: string; end_date: string }) => {
      const { data, error } = await (supabase.from("support_sprints").insert({
        client_id: input.client_id,
        name: input.name,
        goal: input.goal ?? null,
        start_date: input.start_date,
        end_date: input.end_date,
        status: "activo",
      } as any).select().single() as any);
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sva-health-clients-no-sprint"] });
      qc.invalidateQueries({ queryKey: ["all-sprints"] });
    },
  });
}
