import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ReopenReasonSeverity = "alta" | "media" | "baja" | "neutra";

export interface ReopenReason {
  id: string;
  code: string;
  name: string;
  hint: string | null;
  severity: ReopenReasonSeverity;
  is_active: boolean;
  sort_order: number;
  is_system: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Lista de motivos activos (para selector en formularios).
 * Ordenados por sort_order ascendente.
 */
export function useReopenReasons() {
  return useQuery({
    queryKey: ["reopen-reasons", "active"],
    queryFn: async () => {
      const { data, error } = await (
        supabase
          .from("reopen_reasons" as any)
          .select("*")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }) as any
      );
      if (error) throw error;
      return (data || []) as ReopenReason[];
    },
    staleTime: 5 * 60 * 1000, // 5 min - el catálogo cambia poco
  });
}

/**
 * Lista completa incluyendo inactivos (para panel admin).
 */
export function useReopenReasonsAdmin() {
  return useQuery({
    queryKey: ["reopen-reasons", "all"],
    queryFn: async () => {
      const { data, error } = await (
        supabase
          .from("reopen_reasons" as any)
          .select("*")
          .order("sort_order", { ascending: true }) as any
      );
      if (error) throw error;
      return (data || []) as ReopenReason[];
    },
  });
}

export interface UpsertReopenReasonInput {
  id?: string;
  code: string;
  name: string;
  hint?: string | null;
  severity?: ReopenReasonSeverity;
  is_active?: boolean;
  sort_order?: number;
}

export function useUpsertReopenReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpsertReopenReasonInput) => {
      const payload: any = {
        code: input.code,
        name: input.name,
        hint: input.hint ?? null,
        severity: input.severity ?? "media",
        is_active: input.is_active ?? true,
        sort_order: input.sort_order ?? 0,
      };
      if (input.id) {
        const { error } = await (
          supabase.from("reopen_reasons" as any).update(payload).eq("id", input.id) as any
        );
        if (error) throw error;
      } else {
        const { error } = await (
          supabase.from("reopen_reasons" as any).insert([payload]) as any
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reopen-reasons"] });
    },
  });
}

export function useToggleReopenReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await (
        supabase.from("reopen_reasons" as any).update({ is_active }).eq("id", id) as any
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reopen-reasons"] });
    },
  });
}

export function useDeleteReopenReason() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (
        supabase.from("reopen_reasons" as any).delete().eq("id", id) as any
      );
      if (error) {
        // El trigger SQL bloquea borrar motivos del sistema con mensaje claro
        throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reopen-reasons"] });
    },
  });
}

export function useReorderReopenReasons() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Array<{ id: string; sort_order: number }>) => {
      // Update individual — sequential. PostgREST no soporta bulk update by id list trivialmente.
      for (const u of updates) {
        const { error } = await (
          supabase.from("reopen_reasons" as any).update({ sort_order: u.sort_order }).eq("id", u.id) as any
        );
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reopen-reasons"] });
    },
  });
}
