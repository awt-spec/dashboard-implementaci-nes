import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface UserPreferences {
  sla_alerts: boolean;
  reassigned_cases: boolean;
  daily_summary: boolean;
  ai_case_summary: boolean;
  offline_mode: boolean;
}

/**
 * Mismos valores que los DEFAULT de la migración
 * 20260820100000_user_preferences.sql. Se usan mientras la consulta carga y
 * para el usuario que todavía no tiene fila (se crea al primer guardado).
 */
export const DEFAULT_PREFERENCES: UserPreferences = {
  sla_alerts: true,
  reassigned_cases: true,
  daily_summary: false,
  ai_case_summary: true,
  offline_mode: false,
};

export function useUserPreferences() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-preferences", user?.id],
    enabled: !!user?.id,
    queryFn: async (): Promise<UserPreferences> => {
      const { data, error } = await supabase
        .from("user_preferences")
        .select("sla_alerts, reassigned_cases, daily_summary, ai_case_summary, offline_mode")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      // Sin fila todavía: el usuario nunca guardó una preferencia.
      return data ?? DEFAULT_PREFERENCES;
    },
  });
}

export function useUpdateUserPreference() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const key = ["user-preferences", user?.id];

  return useMutation({
    mutationFn: async (patch: Partial<UserPreferences>) => {
      if (!user?.id) throw new Error("No autenticado");
      // upsert: la fila se crea recién al primer guardado, así no hace falta
      // sembrar una fila por usuario al darlo de alta.
      const { error } = await supabase
        .from("user_preferences")
        .upsert({ user_id: user.id, ...patch }, { onConflict: "user_id" });
      if (error) throw error;
    },
    // Optimista: un toggle que tarda en pintarse se siente roto y el usuario
    // lo vuelve a tocar.
    onMutate: async (patch) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<UserPreferences>(key);
      qc.setQueryData<UserPreferences>(key, { ...(prev ?? DEFAULT_PREFERENCES), ...patch });
      return { prev };
    },
    onError: (_e, _patch, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => { void qc.invalidateQueries({ queryKey: key }); },
  });
}
