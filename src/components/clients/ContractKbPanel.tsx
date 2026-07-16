import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Upload, FileText, Loader2, Database, Lock, FileStack, ArrowRightLeft,
  Layers, Trash2, Sparkles,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { extractTextFromFile } from "@/lib/extractPdfText";
import {
  useContractDocuments, useIngestContractDoc, useExtractContractTerms, useDeleteContractDoc,
  type ContractDocument, type ExtractedTerms,
} from "@/hooks/useContractKb";
import { ContractTermsEditor } from "./ContractTermsEditor";
import { ContractKbDocViewer } from "./ContractKbDocViewer";

const STATUS_TONE: Record<ContractDocument["status"], string> = {
  ingested: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  ingesting: "bg-info/15 text-info border-info/30",
  pending: "bg-muted text-muted-foreground",
  failed: "bg-destructive/15 text-destructive border-destructive/30",
};
const STATUS_LABEL: Record<ContractDocument["status"], string> = {
  ingested: "Ingestado", ingesting: "Ingestando", pending: "Pendiente", failed: "Falló",
};

interface Props {
  clientId: string;
  contractId?: string;
}

export function ContractKbPanel({ clientId, contractId }: Props) {
  const { role } = useAuth();
  const canManage = role === "admin" || role === "pm";
  const { data: docs = [], isLoading } = useContractDocuments(clientId);
  const ingest = useIngestContractDoc(clientId);
  const extract = useExtractContractTerms(clientId);
  const del = useDeleteContractDoc(clientId);
  const [busyStage, setBusyStage] = useState<null | "leyendo" | "ingestando">(null);
  const [terms, setTerms] = useState<ExtractedTerms | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [viewer, setViewer] = useState<ContractDocument | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const qc = useQueryClient();

  const hasIngested = docs.some((d) => d.status === "ingested");

  // Aplica TODO al sistema (contrato + SLAs + suscripción). Corre en una edge
  // function con service_role para no depender de la RLS del navegador — antes
  // fallaba con "row-level security policy" para roles distintos de admin/pm.
  const applyAll = async () => {
    if (!terms) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("apply-contract-terms", { body: { clientId, terms } });
      if (error) throw new Error(error.message || "No se pudo aplicar al sistema");
      if ((data as any)?.error) throw new Error((data as any).error);

      qc.invalidateQueries({ queryKey: ["client-contracts", clientId] });
      qc.invalidateQueries({ queryKey: ["client-slas", clientId] });
      qc.invalidateQueries({ queryKey: ["billed-packages", clientId] });
      qc.invalidateQueries({ queryKey: ["contract-milestones"] });
      const slas = (data as any)?.slas ?? 0;
      toast.success(`Aplicado al sistema: contrato${slas ? ` · ${slas} SLA${slas === 1 ? "" : "s"}` : ""}${(data as any)?.subscription ? " · suscripción" : ""}`);
    } catch (e: any) {
      toast.error(e?.message || "No se pudo aplicar al sistema");
    } finally {
      setSyncing(false);
    }
  };

  // Clausulado ya registrado en el contrato (permite ingestar a la KB sin subir PDF).
  const { data: clauses } = useQuery({
    queryKey: ["contract-clauses", clientId, contractId],
    enabled: canManage && (!!contractId || !!clientId),
    queryFn: async () => {
      let q = supabase.from("client_contracts").select("clauses");
      q = contractId
        ? q.eq("id", contractId)
        : q.eq("client_id", clientId).eq("is_active", true).order("included_hours", { ascending: false });
      const { data } = await q.limit(1).maybeSingle();
      return (data as any)?.clauses as string | null ?? null;
    },
  });
  const hasClauses = typeof clauses === "string" && clauses.trim().length > 100;

  const ingestClauses = async () => {
    if (!clauses) return;
    try {
      setBusyStage("ingestando");
      const res = await ingest.mutateAsync({ documentText: clauses, contractId, filename: "Clausulado registrado" });
      toast.success(`Clausulado ingestado — ${res.chunk_count} fragmentos indexados`);
    } catch (e: any) {
      toast.error(e?.message || "Error al ingestar el clausulado");
    } finally {
      setBusyStage(null);
    }
  };

  const handleUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { toast.error("El archivo no puede pasar de 15MB"); return; }
    try {
      setBusyStage("leyendo");
      const text = await extractTextFromFile(file);
      if (text.trim().length < 50) {
        toast.error("No se pudo extraer texto suficiente (¿PDF escaneado sin OCR?).");
        return;
      }
      setBusyStage("ingestando");
      const res = await ingest.mutateAsync({ file, documentText: text, contractId });
      toast.success(`Documento ingestado — ${res.chunk_count} fragmentos indexados`);
    } catch (e: any) {
      toast.error(e?.message || "Error al ingestar el documento");
    } finally {
      setBusyStage(null);
    }
  };

  const runExtraction = () => {
    setTerms(null);
    extract.mutate(
      { contractId },
      {
        onSuccess: (t) => { setTerms(t); toast.success("Términos extraídos del contrato"); },
        onError: (e: any) => toast.error(e.message),
      },
    );
  };

  const busy = busyStage !== null || ingest.isPending;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h3 className="font-semibold flex items-center gap-2"><Database className="h-4 w-4" /> Base de conocimiento de contratos</h3>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-lg">
            Subí el contrato firmado en PDF. Se indexa (RAG) y un agente extrae SLAs, paquetes de horas, hitos de facturación y disparadores de alerta desde el documento real.
          </p>
        </div>
        {canManage && (
          <Button size="sm" variant="outline" onClick={runExtraction} disabled={!hasIngested || extract.isPending} className="gap-1.5">
            {extract.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-primary" />}
            Extraer términos (RAG)
          </Button>
        )}
      </div>

      {!canManage && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Solo admin/PM pueden subir contratos y ejecutar la extracción.
        </div>
      )}

      {canManage && (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="application/pdf,.pdf,.txt,.md"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
          />
          <button
            type="button"
            onClick={() => !busy && fileRef.current?.click()}
            disabled={busy}
            className="w-full rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-colors p-6 flex flex-col items-center gap-2 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-8 w-8 text-primary animate-spin" /> : <Upload className="h-8 w-8 text-muted-foreground/60" />}
            <p className="text-sm font-medium">
              {busyStage === "leyendo" ? "Leyendo el documento…" : busyStage === "ingestando" ? "Indexando en la base de conocimiento…" : "Subir contrato firmado (PDF) e indexar"}
            </p>
            <p className="text-[11px] text-muted-foreground">El texto se extrae en tu navegador; se indexa para búsqueda semántica</p>
          </button>

          {/* Ingesta directa del clausulado ya registrado (sin subir archivo) */}
          {hasClauses && (
            <div className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg border border-border bg-muted/20">
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                <FileStack className="h-3.5 w-3.5" /> Este contrato ya tiene clausulado registrado. Podés indexarlo sin subir un PDF.
              </p>
              <Button size="sm" variant="ghost" onClick={ingestClauses} disabled={busy} className="gap-1.5 shrink-0">
                {busyStage === "ingestando" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileStack className="h-3.5 w-3.5" />}
                Ingestar clausulado
              </Button>
            </div>
          )}
        </>
      )}

      {/* Documentos ingestados */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : docs.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">Aún no se ha ingestado ningún contrato.</p>
          ) : (
            <div className="divide-y divide-border">
              {docs.map((d) => (
                <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{d.filename}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(d.created_at).toLocaleString("es-CR")}
                      {d.status === "ingested" && ` · ${d.chunk_count} fragmentos`}
                      {d.status === "failed" && d.error && ` · ${d.error}`}
                    </p>
                  </div>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${STATUS_TONE[d.status]}`}>
                    {STATUS_LABEL[d.status]}
                  </Badge>
                  {d.status === "ingested" && d.chunk_count > 0 && (
                    <Button size="sm" variant="ghost" className="h-7 gap-1 text-[11px] shrink-0" onClick={() => setViewer(d)}>
                      <Layers className="h-3.5 w-3.5" /> Fragmentos
                    </Button>
                  )}
                  {canManage && (
                    <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => { if (confirm(`¿Borrar "${d.filename}" y sus fragmentos de la base de conocimiento?`)) del.mutate(d.id, { onSuccess: () => toast.success("Documento eliminado"), onError: (e: any) => toast.error(e.message) }); }} disabled={del.isPending}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resultado de la extracción RAG — editable */}
      {terms && (
        <Card>
          <CardContent className="p-4 space-y-4">
            {canManage ? (
              <ContractTermsEditor terms={terms} onChange={setTerms} />
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold">Términos extraídos</h4>
                  <Badge variant="outline" className="text-[10px]">Confianza {terms.confianza}%</Badge>
                </div>
                <p className="text-sm">{terms.resumen}</p>
              </>
            )}

            {/* Aplicar TODO al sistema (usa los términos editados) */}
            {canManage && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2 sticky bottom-0">
                <p className="text-xs font-semibold text-primary flex items-center gap-1.5"><ArrowRightLeft className="h-4 w-4" /> Aplicar al sistema</p>
                <p className="text-[11px] text-muted-foreground">Registra el contrato (valor, horas, tarifa, vigencia), los SLAs y —si es recurrente— la suscripción con su próxima fecha de pago, con los valores editados arriba. Los tabs Contratos / SLAs / Paquetes quedan sincronizados.</p>
                <Button size="sm" className="gap-1.5" onClick={applyAll} disabled={syncing}>
                  {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="h-3.5 w-3.5" />}
                  Aplicar todo al sistema
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <ContractKbDocViewer doc={viewer} onOpenChange={(o) => !o && setViewer(null)} />
    </div>
  );
}
