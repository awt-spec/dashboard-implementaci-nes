import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface TimeEntry {
  id: string;
  user_id: string;
  source: "task" | "ticket";
  item_id: string;
  client_id: string | null;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  note: string | null;
  description: string;
  is_billable: boolean;
  is_manual: boolean;
  approval_status: "pending" | "approved" | "rejected";
  tags: string[];
  work_date: string;
}

export interface TimeGoal {
  id: string;
  user_id: string;
  weekly_target_hours: number;
  billable_target_pct: number;
}

export function useMyTimeEntries(rangeDays = 30) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-time-entries", user?.id, rangeDays],
    enabled: !!user?.id,
    queryFn: async () => {
      const from = new Date();
      from.setDate(from.getDate() - rangeDays);
      const { data, error } = await (supabase
        .from("work_time_entries" as any)
        .select("*")
        .eq("user_id", user!.id)
        .gte("started_at", from.toISOString())
        .order("started_at", { ascending: false }) as any);
      if (error) throw error;
      return (data as TimeEntry[]) || [];
    },
  });
}

export function useAllTimeEntries(rangeDays = 30) {
  return useQuery({
    queryKey: ["all-time-entries", rangeDays],
    queryFn: async () => {
      const from = new Date();
      from.setDate(from.getDate() - rangeDays);
      const { data, error } = await (supabase
        .from("work_time_entries" as any)
        .select("*")
        .gte("started_at", from.toISOString())
        .order("started_at", { ascending: false }) as any);
      if (error) throw error;
      return (data as TimeEntry[]) || [];
    },
  });
}

export function useMyTimeGoal() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["my-time-goal", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await (supabase
        .from("time_tracking_goals" as any)
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle() as any);
      if (error) throw error;
      return (data as TimeGoal) || { weekly_target_hours: 40, billable_target_pct: 80 };
    },
  });
}

export function useUpsertTimeGoal() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (goal: { weekly_target_hours: number; billable_target_pct: number }) => {
      const { error } = await (supabase
        .from("time_tracking_goals" as any)
        .upsert([{ user_id: user!.id, ...goal }] as any, { onConflict: "user_id" }) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["my-time-goal"] }),
  });
}

export function useCreateManualEntry() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (entry: {
      source: "task" | "ticket";
      item_id: string;
      client_id?: string | null;
      work_date: string;
      hours: number;
      description?: string;
      is_billable?: boolean;
      tags?: string[];
    }) => {
      const seconds = Math.round(entry.hours * 3600);
      const startedAt = new Date(`${entry.work_date}T09:00:00`);
      const endedAt = new Date(startedAt.getTime() + seconds * 1000);
      const { error } = await (supabase.from("work_time_entries" as any).insert([{
        user_id: user!.id,
        source: entry.source,
        item_id: entry.item_id,
        client_id: entry.client_id ?? null,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        duration_seconds: seconds,
        description: entry.description ?? "",
        is_billable: entry.is_billable ?? true,
        is_manual: true,
        approval_status: "pending",
        tags: entry.tags ?? [],
        work_date: entry.work_date,
      }] as any) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-time-entries"] });
      qc.invalidateQueries({ queryKey: ["all-time-entries"] });
    },
  });
}

export function useUpdateTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<TimeEntry> }) => {
      const { error } = await (supabase.from("work_time_entries" as any).update(updates as any).eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-time-entries"] });
      qc.invalidateQueries({ queryKey: ["all-time-entries"] });
    },
  });
}

export function useDeleteTimeEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("work_time_entries" as any).delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-time-entries"] });
      qc.invalidateQueries({ queryKey: ["all-time-entries"] });
    },
  });
}

// Helpers
export function startOfWeek(d = new Date()) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);
  return date;
}

export function formatHours(seconds: number) {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function entryHours(e: TimeEntry) {
  return (e.duration_seconds || 0) / 3600;
}
