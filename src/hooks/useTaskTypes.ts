import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TaskType {
  id: string;
  code: string;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  sort_order: number;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

/** Tipos activos (para selector). */
export function useTaskTypes() {
  return useQuery({
    queryKey: ["task-types", "active"],
    queryFn: async () => {
      const { data, error } = await (
        supabase
          .from("task_types" as any)
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }) as any
      );
      if (error) throw error;
      return (data || []) as TaskType[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Todos (para panel admin). */
export function useTaskTypesAdmin() {
  return useQuery({
    queryKey: ["task-types", "all"],
    queryFn: async () => {
      const { data, error } = await (
        supabase
          .from("task_types" as any)
          .select("*")
          .order("sort_order", { ascending: true }) as any
      );
      if (error) throw error;
      return (data || []) as TaskType[];
    },
  });
}

export interface UpsertTaskTypeInput {
  id?: string;
  code: string;
  name: string;
  description?: string | null;
  color?: string;
  is_active?: boolean;
  sort_order?: number;
}

export function useUpsertTaskType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertTaskTypeInput) => {
      const payload: any = {
        code: input.code,
        name: input.name,
        description: input.description ?? null,
        color: input.color ?? "#6366f1",
        is_active: input.is_active ?? true,
        sort_order: input.sort_order ?? 0,
      };
      if (input.id) {
        const { error } = await (
          supabase.from("task_types" as any).update(payload).eq("id", input.id) as any
        );
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("task_types" as any).insert([payload]) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-types"] }),
  });
}

export function useToggleTaskType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (
        supabase.from("task_types" as any).update({ is_active }).eq("id", id) as any
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-types"] }),
  });
}

export function useDeleteTaskType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("task_types" as any).delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["task-types"] }),
  });
}
