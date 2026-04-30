import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Unified work item across tasks (implementación) and support_tickets (soporte)
export interface ScrumWorkItem {
  id: string;
  source: "task" | "ticket";
  client_id: string;
  client_name?: string;
  title: string;
  status: string;
  priority: string;
  owner: string;
  due_date: string | null;
  sprint_id: string | null;
  story_points: number | null;
  business_value: number | null;
  effort: number | null;
  backlog_rank: number | null;
  scrum_status: string | null;
  wsjf: number;
  /** Visibility: 'interna' (solo equipo SVA) o 'externa' (cliente puede ver). */
  visibility: "interna" | "externa";
  raw: any;
}

export interface UnifiedSprint {
  id: string;
  client_id: string;
  name: string;
  goal: string | null;
  start_date: string | null;
  end_date: string | null;
  status: string;
  capacity_points: number;
  notes?: string;
  ceremony_dates?: any;
}

function calcWsjf(value: number | null, effort: number | null): number {
  if (!value || !effort || effort <= 0) return 0;
  return Math.round((value / effort) * 100) / 100;
}

// Paginación manual: el default REST de Supabase trunca a 1000 filas. Con
// 2800+ tickets totales (2099 implementación + ~720 soporte), Dos Pinos
// (1177 tickets) quedaba parcial o totalmente fuera. Cargar en chunks de
// 1000 hasta agotar.
async function fetchAllPages<T>(
  buildQuery: () => any,
  pageSize: number = 1000,
): Promise<T[]> {
  const all: T[] = [];
  let from = 0;
  // Hard upper bound to avoid infinite loops si algo va mal: 50k filas.
  for (let i = 0; i < 50; i++) {
    const { data, error } = await buildQuery().range(from, from + pageSize - 1);
    if (error) throw error;
    const chunk = (data || []) as T[];
    all.push(...chunk);
    if (chunk.length < pageSize) break;
    from += pageSize;
  }
  return all;
}

export function useAllScrumWorkItems() {
  return useQuery({
    queryKey: ["scrum-work-items"],
    queryFn: async () => {
      const [tasks, tickets, clients] = await Promise.all([
        fetchAllPages<any>(() => supabase.from("tasks").select("*")),
        fetchAllPages<any>(() => supabase.from("support_tickets").select("*")),
        fetchAllPages<any>(() => supabase.from("clients").select("id, name")),
      ]);

      const clientMap = new Map<string, string>();
      (clients).forEach((c: any) => clientMap.set(c.id, c.name));

      const taskItems: ScrumWorkItem[] = (tasks).map((t: any) => ({
        id: t.id,
        source: "task" as const,
        client_id: t.client_id,
        client_name: clientMap.get(t.client_id),
        title: t.title,
        status: t.status,
        priority: t.priority,
        owner: t.owner,
        due_date: t.due_date,
        sprint_id: t.sprint_id ?? null,
        story_points: t.story_points ?? null,
        business_value: t.business_value ?? null,
        effort: t.effort ?? null,
        backlog_rank: t.backlog_rank ?? null,
        scrum_status: t.scrum_status ?? "backlog",
        wsjf: calcWsjf(t.business_value, t.effort),
        visibility: (t.visibility === "interna" ? "interna" : "externa") as "interna" | "externa",
        raw: t,
      }));

      const ticketItems: ScrumWorkItem[] = (tickets).map((t: any) => ({
        id: t.id,
        source: "ticket" as const,
        client_id: t.client_id,
        client_name: clientMap.get(t.client_id),
        title: t.asunto || t.ticket_id,
        status: t.estado,
        priority: t.prioridad,
        owner: t.responsable || "—",
        due_date: t.fecha_entrega,
        sprint_id: t.sprint_id ?? null,
        story_points: t.story_points ?? null,
        business_value: t.business_value ?? null,
        effort: t.effort ?? null,
        backlog_rank: t.backlog_rank ?? null,
        scrum_status: t.scrum_status ?? "backlog",
        wsjf: calcWsjf(t.business_value, t.effort),
        // Casos soporte siempre son "externos" (relacionados al cliente).
        visibility: "externa" as const,
        raw: t,
      }));

      return [...taskItems, ...ticketItems];
    },
  });
}

export function useAllSprints() {
  return useQuery({
    queryKey: ["all-sprints"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("support_sprints").select("*") as any)
        .order("start_date", { ascending: false, nullsFirst: false });
      if (error) throw error;
      return (data || []) as UnifiedSprint[];
    },
  });
}

export function useUpdateWorkItemScrum() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id, source, updates,
    }: { id: string; source: "task" | "ticket"; updates: Record<string, unknown> }) => {
      const table = source === "task" ? "tasks" : "support_tickets";
      const { error } = await (supabase.from(table).update(updates as any).eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["scrum-work-items"] });
      qc.invalidateQueries({ queryKey: ["support-tickets"] });
      qc.invalidateQueries({ queryKey: ["support-tickets-all"] });
    },
  });
}

export function useCreateUnifiedSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<UnifiedSprint> & { client_id: string; name: string }) => {
      const { error } = await (supabase.from("support_sprints").insert([input] as any) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-sprints"] });
    },
  });
}

export function useUpdateUnifiedSprint() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<UnifiedSprint> }) => {
      const { error } = await (supabase.from("support_sprints").update(updates as any).eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-sprints"] });
    },
  });
}

export function useTeamAIAnalysis() {
  return useMutation({
    mutationFn: async ({ items, sprints }: { items: ScrumWorkItem[]; sprints: UnifiedSprint[] }) => {
      const { data, error } = await supabase.functions.invoke("analyze-team-scrum", {
        body: { items, sprints },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as {
        workload: Array<{ owner: string; level: "sobrecargado" | "saludable" | "subutilizado" | "sin_carga"; items: number; story_points?: number; reason: string }>;
        bottlenecks: Array<{ owner: string; severity: string; reason: string; load: number }>;
        underutilized: Array<{ owner: string; load: number; suggestion: string }>;
        risks: Array<{ item_id: string; reason: string; recommendation: string }>;
        recommendations: string[];
        sprint_health: string;
        team_balance_score: number;
        load_summary: Array<{ owner: string; total: number; in_progress: number; high_priority: number; unestimated: number; story_points: number }>;
      };
    },
  });
}
