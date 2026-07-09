import { useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Upload, FileText, Loader2, Sparkles, Database, Clock, ShieldCheck,
  Milestone, Bell, Lock, FileStack, ArrowRightLeft,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { extractTextFromFile } from "@/lib/extractPdfText";
import {
  useContractDocuments, useIngestContractDoc, useExtractContractTerms,
  type ContractDocument, type ExtractedTerms,
} from "@/hooks/useContractKb";
import { useClientSLAs, useUpsertSLA, useClientContracts } from "@/hooks/useClientContracts";

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
  const [busyStage, setBusyStage] = useState<null | "leyendo" | "ingestando">(null);
  const [terms, setTerms] = useState<ExtractedTerms | null>(null);
  const [syncing, setSyncing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Para sincronizar la extracción con el sistema (SLAs + horas del contrato).
  const { data: existingSLAs = [] } = useClientSLAs(clientId);
  const { data: contracts = [] } = useClientContracts(clientId);
  const upsertSLA = useUpsertSLA();
  const activeContract = contracts.find((c: any) => c.is_active) || contracts[0];
  const qc = useQueryClient();

  const hasIngested = docs.some((d) => d.status === "ingested");

  // Calcula la próxima fecha de pago desde el inicio + ciclo (rodada al futuro).
  const nextPaymentFrom = (start?: string, cycle?: string, explicit?: string): string | null => {
    if (explicit) return explicit;
    if (!start) return null;
    const months = cycle === "anual" ? 12 : cycle === "semestral" ? 6 : cycle === "trimestral" ? 3 : 1;
    const d = new Date(start); const now = new Date();
    if (isNaN(d.getTime())) return null;
    let guard = 0;
    while (d <= now && guard < 240) { d.setMonth(d.getMonth() + months); guard++; }
    return d.toISOString().slice(0, 10);
  };

  // Aplica TODO al sistema: contrato + SLAs + suscripción de facturación.
  const applyAll = async () => {
    if (!terms) return;
    setSyncing(true);
    try {
      const ct = terms.contrato || {};
      // 1) Contrato (crea si no existe; si existe el activo, lo actualiza).
      const contractRow: any = {
        client_id: clientId,
        contract_type: ct.tipo || activeContract?.contract_type || "fee_mensual",
        monthly_value: ct.valor_mensual ?? activeContract?.monthly_value ?? 0,
        hourly_rate: ct.tarifa_hora ?? activeContract?.hourly_rate ?? 0,
        included_hours: ct.horas_incluidas ?? (terms.paquetes_horas?.[0]?.horas_incluidas) ?? activeContract?.included_hours ?? 0,
        currency: ct.moneda || activeContract?.currency || "USD",
        start_date: ct.fecha_inicio || activeContract?.start_date || null,
        end_date: ct.fecha_fin || activeContract?.end_date || null,
        auto_renewal: ct.renovacion_automatica ?? activeContract?.auto_renewal ?? false,
        payment_terms: ct.terminos_pago || activeContract?.payment_terms || null,
        is_active: true,
      };
      let contractId = activeContract?.id as string | undefined;
      if (contractId) {
        await supabase.from("client_contracts" as any).update(contractRow).eq("id", contractId);
      } else {
        const { data, error } = await supabase.from("client_contracts" as any).insert(contractRow).select("id").single();
        if (error) throw error;
        contractId = (data as any)?.id;
      }

      // 2) SLAs → client_slas (upsert por prioridad+tipo).
      for (const s of terms.slas ?? []) {
        const caseType = s.tipo_caso || "all";
        const match = existingSLAs.find((e: any) => e.priority_level === s.prioridad && (e.case_type || "all") === caseType);
        await upsertSLA.mutateAsync({
          ...(match ? { id: match.id } : {}),
          client_id: clientId,
          priority_level: s.prioridad,
          case_type: caseType,
          response_time_hours: s.tiempo_respuesta_horas ?? 0,
          resolution_time_hours: s.tiempo_resolucion_horas ?? 0,
          business_hours_only: s.horario_habil_solo ?? true,
          penalty_amount: s.penalidad_monto ?? null,
          penalty_description: s.penalidad_descripcion ?? null,
          is_active: true,
        } as any);
      }

      // 3) Suscripción de facturación (si es recurrente).
      if (ct.es_suscripcion || ct.tipo === "fee_mensual") {
        const next = nextPaymentFrom(ct.fecha_inicio, ct.ciclo_facturacion, ct.proxima_fecha_pago);
        const { data: existingSub } = await supabase.from("billed_packages" as any)
          .select("id").eq("client_id", clientId).eq("is_subscription", true).limit(1).maybeSingle();
        // package_type ∈ {horas,servicio,licencia,proyecto,otro}; status ∈
        // {pendiente,facturado,pagado,anulado}; total_amount es columna generada
        // (quantity*unit_price) — no se envía.
        const subRow: any = {
          client_id: clientId, contract_id: contractId ?? null,
          name: terms.servicio_contratado?.slice(0, 120) || "Suscripción de servicio",
          package_type: "servicio", is_subscription: true,
          billing_cycle: ct.ciclo_facturacion || "mensual",
          next_payment_date: next,
          quantity: 1, unit_price: ct.valor_mensual ?? 0,
          currency: ct.moneda || "USD", status: "pendiente",
        };
        if ((existingSub as any)?.id) await supabase.from("billed_packages" as any).update(subRow).eq("id", (existingSub as any).id);
        else await supabase.from("billed_packages" as any).insert(subRow);
      }

      qc.invalidateQueries({ queryKey: ["client-contracts", clientId] });
      qc.invalidateQueries({ queryKey: ["client-slas", clientId] });
      qc.invalidateQueries({ queryKey: ["billed-packages", clientId] });
      qc.invalidateQueries({ queryKey: ["contract-milestones"] });
      toast.success("Contrato, SLAs y suscripción aplicados al sistema");
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
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Resultado de la extracción RAG */}
      {terms && (
        <Card>
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold flex items-center gap-1.5"><Sparkles className="h-4 w-4 text-primary" /> Términos extraídos</h4>
              <Badge variant="outline" className="text-[10px]">Confianza {terms.confianza}%</Badge>
            </div>
            <p className="text-sm">{terms.resumen}</p>

            {terms.servicio_contratado && (
              <div className="rounded-lg border border-border bg-muted/20 p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Servicio contratado</p>
                <p className="text-sm mt-0.5">{terms.servicio_contratado}</p>
              </div>
            )}

            {(terms.version_core || (terms.modulos && terms.modulos.length > 0)) && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5">
                <p className="text-[11px] font-semibold text-primary flex items-center gap-1">✓ Stack técnico actualizado desde el contrato</p>
                {terms.version_core && <p className="text-xs mt-1"><span className="text-muted-foreground">Core:</span> {terms.version_core}</p>}
                {terms.modulos && terms.modulos.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {terms.modulos.map((m, i) => <Badge key={i} variant="outline" className="text-[10px]">{m}</Badge>)}
                  </div>
                )}
              </div>
            )}

            {/* Estructura del contrato extraída */}
            {terms.contrato && (Object.keys(terms.contrato).length > 0) && (
              <div className="rounded-lg border border-border bg-muted/20 p-2.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">Estructura del contrato</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-0.5 text-xs">
                  {terms.contrato.tipo && <span><span className="text-muted-foreground">Tipo:</span> {terms.contrato.tipo}</span>}
                  {terms.contrato.moneda && <span><span className="text-muted-foreground">Moneda:</span> {terms.contrato.moneda}</span>}
                  {terms.contrato.horas_incluidas != null && <span><span className="text-muted-foreground">Horas:</span> {terms.contrato.horas_incluidas}h</span>}
                  {terms.contrato.fecha_inicio && <span><span className="text-muted-foreground">Inicio:</span> {terms.contrato.fecha_inicio}</span>}
                  {terms.contrato.fecha_fin && <span><span className="text-muted-foreground">Fin:</span> {terms.contrato.fecha_fin}</span>}
                  {terms.contrato.es_suscripcion && <span className="text-primary">Suscripción {terms.contrato.ciclo_facturacion || "mensual"}</span>}
                </div>
              </div>
            )}

            {/* Aplicar TODO al sistema */}
            {canManage && (
              <div className="rounded-lg border border-primary/40 bg-primary/5 p-3 space-y-2">
                <p className="text-xs font-semibold text-primary flex items-center gap-1.5"><ArrowRightLeft className="h-4 w-4" /> Aplicar al sistema</p>
                <p className="text-[11px] text-muted-foreground">Registra el contrato (valor, horas, tarifa, vigencia), los SLAs y —si es recurrente— la suscripción con su próxima fecha de pago. Los tabs Contratos / SLAs / Paquetes quedan sincronizados.</p>
                <Button size="sm" className="gap-1.5" onClick={applyAll} disabled={syncing}>
                  {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="h-3.5 w-3.5" />}
                  Aplicar todo al sistema
                </Button>
              </div>
            )}

            {!!terms.slas?.length && (
              <KbSection icon={<ShieldCheck className="h-3.5 w-3.5" />} title={`SLAs (${terms.slas.length})`}>
                {terms.slas.map((s, i) => (
                  <div key={i} className="rounded-lg border p-2.5 text-xs">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="text-[9px]">{s.prioridad}</Badge>
                      {s.tipo_caso && <span className="text-muted-foreground">{s.tipo_caso}</span>}
                      {s.tiempo_respuesta_horas != null && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{s.tiempo_respuesta_horas}h resp.</span>}
                      {s.tiempo_resolucion_horas != null && <span>{s.tiempo_resolucion_horas}h resol.</span>}
                    </div>
                    {s.clausula_referencia && <p className="text-[10px] text-muted-foreground mt-1">Ref: {s.clausula_referencia}</p>}
                  </div>
                ))}
              </KbSection>
            )}

            {!!terms.paquetes_horas?.length && (
              <KbSection icon={<Clock className="h-3.5 w-3.5" />} title={`Paquetes de horas (${terms.paquetes_horas.length})`}>
                {terms.paquetes_horas.map((p, i) => (
                  <div key={i} className="rounded-lg border p-2.5 text-xs">
                    <p className="font-medium">{p.descripcion}</p>
                    <div className="flex gap-3 text-[11px] text-muted-foreground mt-1 flex-wrap">
                      {p.horas_incluidas != null && <span>{p.horas_incluidas}h incluidas</span>}
                      {p.acumulacion && <span>Acum.: {p.acumulacion}</span>}
                      {p.vencimiento && <span>Venc.: {p.vencimiento}</span>}
                    </div>
                  </div>
                ))}
              </KbSection>
            )}

            {!!terms.hitos_facturacion?.length && (
              <KbSection icon={<Milestone className="h-3.5 w-3.5" />} title={`Hitos de facturación (${terms.hitos_facturacion.length}) — propuestos`}>
                {terms.hitos_facturacion.map((h, i) => (
                  <div key={i} className="rounded-lg border p-2.5 text-xs">
                    <p className="font-medium">{h.numero ? `${h.numero}. ` : ""}{h.descripcion}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Condición: {h.condicion}</p>
                    {h.clausula_referencia && <p className="text-[10px] text-muted-foreground">Ref: {h.clausula_referencia}</p>}
                  </div>
                ))}
              </KbSection>
            )}

            {!!terms.disparadores_alerta?.length && (
              <KbSection icon={<Bell className="h-3.5 w-3.5" />} title={`Disparadores de alerta (${terms.disparadores_alerta.length})`}>
                {terms.disparadores_alerta.map((a, i) => (
                  <div key={i} className="rounded-lg border p-2.5 text-xs">
                    <p className="font-medium">{a.titulo}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{a.condicion}{a.umbral ? ` · ${a.umbral}` : ""}</p>
                  </div>
                ))}
              </KbSection>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function KbSection({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h5 className="text-xs font-bold uppercase tracking-wide text-foreground/80 flex items-center gap-1.5">
        <span className="text-primary">{icon}</span>{title}
      </h5>
      <div className="space-y-1.5">{children}</div>
    </section>
  );
}
