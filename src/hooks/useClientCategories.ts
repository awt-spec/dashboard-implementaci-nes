import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ClientCategory {
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

export function useClientCategories() {
  return useQuery({
    queryKey: ["client-categories", "active"],
    queryFn: async () => {
      const { data, error } = await (
        supabase
          .from("client_categories")
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }) as any
      );
      if (error) throw error;
      return (data || []) as ClientCategory[];
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useClientCategoriesAdmin() {
  return useQuery({
    queryKey: ["client-categories", "all"],
    queryFn: async () => {
      const { data, error } = await (
        supabase
          .from("client_categories")
          .select("*")
          .order("sort_order", { ascending: true }) as any
      );
      if (error) throw error;
      return (data || []) as ClientCategory[];
    },
  });
}

export interface UpsertClientCategoryInput {
  id?: string;
  code: string;
  name: string;
  description?: string | null;
  color?: string;
  is_active?: boolean;
  sort_order?: number;
}

export function useUpsertClientCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertClientCategoryInput) => {
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
          supabase.from("client_categories").update(payload).eq("id", input.id) as any
        );
        if (error) throw error;
      } else {
        const { error } = await (supabase.from("client_categories").insert([payload]) as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-categories"] }),
  });
}

export function useToggleClientCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (
        supabase.from("client_categories").update({ is_active }).eq("id", id) as any
      );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-categories"] }),
  });
}

export function useDeleteClientCategory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("client_categories").delete().eq("id", id) as any);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-categories"] }),
  });
}
