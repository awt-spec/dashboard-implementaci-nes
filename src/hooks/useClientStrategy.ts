import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Tipos ───────────────────────────────────────────────────────────────

export interface ClientStrategyHealth {
  score: number;
  tendencia: "mejorando" | "estable" | "deteriorando";
  resumen: string;
}

export interface ClientStrategyPain {
  titulo: string;
  categoria: string;
  ocurrencias?: number;
  impacto: string;
  solucion_sugerida: string;
}

export interface ClientStrategyUpsell {
  titulo: string;
  detalle: string;
  estimado_usd_mes?: number;
  probabilidad: "alta" | "media" | "baja";
  momento_recomendado?: string;
}

export interface ClientStrategyChurnRisk {
  titulo: string;
  severidad: "critico" | "alto" | "medio" | "bajo";
  senales: string[];
  mitigacion: string;
}

export interface ClientStrategyPlanWeek {
  semana: number;
  objetivo: string;
  acciones: string[];
  responsable?: string;
}

export interface ClientStrategyOutput {
  salud_relacion: ClientStrategyHealth;
  top_3_dolores: ClientStrategyPain[];
  oportunidades_upsell: ClientStrategyUpsell[];
  riesgos_churn: ClientStrategyChurnRisk[];
  plan_proximo_mes: ClientStrategyPlanWeek[];
  confianza: number;
}

export interface ClientStrategyRecord {
  id: string;
  analysis_type: string;
  scope: string | null;
  executive_summary: string | null;
  team_health_score: number | null;
  recommendations: ClientStrategyPlanWeek[];
  risks: ClientStrategyChurnRisk[];
  metrics: Record<string, any>;
  full_analysis: ClientStrategyOutput;
  model: string | null;
  created_at: string;
}

// ─── Queries ─────────────────────────────────────────────────────────────

export function useLatestClientStrategy(clientId: string | null | undefined) {
  return useQuery({
    queryKey: ["client-strategy-latest", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      if (!clientId) return null;
      const { data, error } = await (supabase
        .from("pm_ai_analysis" as any)
        .select("*")
        .eq("analysis_type", "client_strategy")
        .eq("scope", clientId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle() as any);
      if (error) throw error;
      return (data as ClientStrategyRecord | null) ?? null;
    },
  });
}

export function useRunClientStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (client_id: string) => {
      const { data, error } = await supabase.functions.invoke("client-strategy-ai", {
        body: { client_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { success: true; analysis: ClientStrategyOutput; id: string };
    },
    onSuccess: (_d, client_id) => {
      qc.invalidateQueries({ queryKey: ["client-strategy-latest", client_id] });
    },
  });
}
