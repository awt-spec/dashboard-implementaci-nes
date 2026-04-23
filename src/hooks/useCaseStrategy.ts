import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─── Tipos del output del edge function ──────────────────────────────────

export interface CaseStrategyAction {
  titulo: string;
  detalle: string;
  responsable_sugerido?: string;
  urgencia: "inmediata" | "hoy" | "esta_semana" | "este_mes";
  esfuerzo_estimado_horas?: number;
}

export interface CaseStrategyRisk {
  titulo: string;
  severidad: "critico" | "alto" | "medio" | "bajo";
  impacto_financiero?: string;
  mitigacion: string;
}

export interface CaseStrategySimilar {
  ticket_id: string;
  asunto?: string;
  relevancia: string;
  leccion_aplicable: string;
}

export interface CaseStrategySlaStatus {
  estado: "ok" | "en_riesgo" | "incumplido" | "sin_sla" | "cerrado";
  mensaje: string;
  accion_sla?: string;
}

export interface CaseStrategyOutput {
  diagnostico: string;
  accion_recomendada: CaseStrategyAction;
  riesgos: CaseStrategyRisk[];
  casos_similares: CaseStrategySimilar[];
  sla_status: CaseStrategySlaStatus;
  confianza: number;
}

export interface CaseStrategyRecord {
  id: string;
  analysis_type: string;
  scope: string | null;
  executive_summary: string | null;
  recommendations: CaseStrategyAction[];
  risks: CaseStrategyRisk[];
  metrics: Record<string, unknown>;
  full_analysis: CaseStrategyOutput;
  model: string | null;
  created_at: string;
}

// ─── Queries ─────────────────────────────────────────────────────────────

export function useLatestCaseStrategy(ticketId: string | null | undefined) {
  return useQuery({
    queryKey: ["case-strategy-latest", ticketId],
    enabled: !!ticketId,
    queryFn: async () => {
      if (!ticketId) return null;
      const { data, error } = await (supabase
        .from("pm_ai_analysis" as any)
        .select("*")
        .eq("analysis_type", "case_strategy")
        .eq("scope", ticketId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle() as any);
      if (error) throw error;
      return (data as CaseStrategyRecord | null) ?? null;
    },
  });
}

export function useRunCaseStrategy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ticket_id: string) => {
      const { data, error } = await supabase.functions.invoke("case-strategy-ai", {
        body: { ticket_id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { success: true; analysis: CaseStrategyOutput; id: string };
    },
    onSuccess: (_d, ticket_id) => {
      qc.invalidateQueries({ queryKey: ["case-strategy-latest", ticket_id] });
    },
  });
}
