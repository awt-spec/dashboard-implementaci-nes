import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Capa 2 del auditor: clasifica gestiones recientes como dentro/fuera/dudoso de
// alcance, con base en el contrato ingestado en la KB. Resultado advisory.

export type ScopeVerdict = "dentro" | "fuera" | "dudoso";

export interface ScopeFinding {
  ticket_id: string;
  asunto?: string;
  veredicto: ScopeVerdict;
  razon: string;
  confianza?: number;
}

export interface ScopeAudit {
  resumen: string;
  hallazgos: ScopeFinding[];
}

export interface ScopeAuditResult {
  audit: ScopeAudit;
  evaluated: number;
  fuera: number;
  dudoso: number;
  scope_chunks: number;
}

export function useContractScopeAudit(clientId?: string) {
  return useMutation({
    mutationFn: async (args: { contractId?: string }): Promise<ScopeAuditResult> => {
      if (!clientId) throw new Error("clientId requerido");
      const { data, error } = await supabase.functions.invoke("audit-contract-scope", {
        body: { client_id: clientId, contract_id: args.contractId ?? null },
      });
      if (error) {
        const msg = error.message || "";
        if (/not found|404|Failed to send|Failed to fetch|fetch/i.test(msg)) {
          throw new Error("El auditor de alcance todavía no está disponible (edge function sin desplegar).");
        }
        throw new Error(msg);
      }
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as ScopeAuditResult;
    },
  });
}
