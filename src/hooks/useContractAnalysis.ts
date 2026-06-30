import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface ContractAnalysis {
  resumen_ejecutivo: string;
  obligaciones: { parte: string; obligacion: string }[];
  riesgos: { titulo: string; severidad: string; impacto?: string; mitigacion: string }[];
  vacios_o_ambiguedades?: string[];
  recomendaciones: string[];
  confianza: number;
  generated_at?: string;
}

/**
 * Lanza el análisis IA de un contrato (edge function analyze-contract-ai).
 * Si la función aún no está desplegada, devuelve un error legible.
 */
export function useAnalyzeContract() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (contractId: string): Promise<ContractAnalysis> => {
      const { data, error } = await supabase.functions.invoke("analyze-contract-ai", {
        body: { contract_id: contractId },
      });
      if (error) {
        const msg = error.message || "";
        if (/not found|404|Failed to send|fetch/i.test(msg)) {
          throw new Error("El análisis con IA todavía no está disponible (la función analyze-contract-ai no está desplegada).");
        }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      return (data as any).analysis as ContractAnalysis;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-contracts"] }),
  });
}
