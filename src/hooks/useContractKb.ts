import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ─────────────────────────────────────────────────────────────────────────────
// Knowledge Base de contratos (Frente A) — hooks de frontend.
//   • useContractDocuments  — lista los PDFs ingestados de un cliente.
//   • useIngestContractDoc  — sube el PDF al bucket + invoca ingest-contract-doc.
//   • useExtractContractTerms — invoca el agente extractor RAG.
// Las tablas nuevas usan cast `as any` (types.ts no regenerado).
// ─────────────────────────────────────────────────────────────────────────────

export interface ContractDocument {
  id: string;
  client_id: string;
  contract_id: string | null;
  storage_path: string;
  filename: string;
  status: "pending" | "ingesting" | "ingested" | "failed";
  error: string | null;
  chunk_count: number;
  page_count: number | null;
  created_at: string;
}

export interface ContractStructure {
  tipo?: string;
  valor_mensual?: number;
  tarifa_hora?: number;
  horas_incluidas?: number;
  moneda?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
  renovacion_automatica?: boolean;
  terminos_pago?: string;
  es_suscripcion?: boolean;
  ciclo_facturacion?: string;
  proxima_fecha_pago?: string;
}
export interface ExtractedTerms {
  resumen: string;
  contrato?: ContractStructure;
  servicio_contratado?: string;
  version_core?: string;
  modulos?: string[];
  slas?: { prioridad: string; tipo_caso?: string; tiempo_respuesta_horas?: number; tiempo_resolucion_horas?: number; horario_habil_solo?: boolean; penalidad_monto?: number; penalidad_descripcion?: string; clausula_referencia?: string }[];
  paquetes_horas?: { descripcion: string; horas_incluidas?: number; tarifa_hora?: number; acumulacion?: string; vencimiento?: string; clausula_referencia?: string }[];
  hitos_facturacion?: { numero?: number; descripcion: string; condicion: string; clausula_referencia?: string; porcentaje?: number; monto?: number; horas?: number }[];
  disparadores_alerta?: { titulo: string; condicion: string; umbral?: string; clausula_referencia?: string }[];
  confianza: number;
}

export function useContractDocuments(clientId?: string) {
  return useQuery({
    queryKey: ["contract-documents", clientId],
    enabled: !!clientId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contract_documents" as any)
        .select("id, client_id, contract_id, storage_path, filename, status, error, chunk_count, page_count, created_at")
        .eq("client_id", clientId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as ContractDocument[];
    },
  });
}

/** Mensaje legible cuando una edge function todavía no está desplegada. */
function humanizeFnError(msg: string): string {
  if (/not found|404|Failed to send|Failed to fetch|fetch/i.test(msg)) {
    return "La función todavía no está disponible (edge function sin desplegar).";
  }
  return msg;
}

export function useIngestContractDoc(clientId?: string) {
  const qc = useQueryClient();
  return useMutation({
    // Ingesta con archivo (PDF subido) o solo texto (ej. clausulado ya registrado).
    mutationFn: async (args: { file?: File; documentText: string; contractId?: string; filename?: string }) => {
      const { file, documentText, contractId } = args;
      if (!clientId) throw new Error("clientId requerido");

      let storagePath = "";
      let filename = args.filename ?? "clausulado-registrado.txt";
      let mimeType = "text/plain";
      let byteSize = documentText.length;

      // 1) Si viene un archivo, se sube el original al bucket privado.
      if (file) {
        const safeName = file.name.replace(/[^\w.\-]+/g, "_");
        storagePath = `${clientId}/${Date.now()}-${safeName}`;
        const { error: upErr } = await supabase.storage
          .from("contract-docs")
          .upload(storagePath, file, { contentType: file.type || "application/pdf", upsert: false });
        if (upErr) throw new Error(humanizeFnError(upErr.message));
        filename = file.name;
        mimeType = file.type || "application/pdf";
        byteSize = file.size;
      }

      // 2) Ingestar el texto (chunking + embeddings) en el vector store.
      const { data, error } = await supabase.functions.invoke("ingest-contract-doc", {
        body: {
          client_id: clientId,
          contract_id: contractId ?? null,
          document_text: documentText,
          storage_path: storagePath,
          filename,
          mime_type: mimeType,
          byte_size: byteSize,
        },
      });
      if (error) throw new Error(humanizeFnError(error.message || ""));
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { document_id: string; chunk_count: number };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["contract-documents", clientId] }),
  });
}

export function useExtractContractTerms(clientId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: { contractId?: string }): Promise<ExtractedTerms> => {
      if (!clientId) throw new Error("clientId requerido");
      const { data, error } = await supabase.functions.invoke("extract-contract-terms", {
        body: { client_id: clientId, contract_id: args.contractId ?? null },
      });
      if (error) throw new Error(humanizeFnError(error.message || ""));
      if ((data as any)?.error) throw new Error((data as any).error);
      return (data as any).extraction as ExtractedTerms;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["contract-milestones"] });
      qc.invalidateQueries({ queryKey: ["contract-documents", clientId] });
    },
  });
}
