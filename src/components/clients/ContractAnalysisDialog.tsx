import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, AlertTriangle, ScrollText, CheckCircle2, ListChecks, ShieldAlert, Upload, FileText } from "lucide-react";
import { toast } from "sonner";
import { useAnalyzeContract, type ContractAnalysis } from "@/hooks/useContractAnalysis";

/** Extrae texto de un PDF (pdfjs) o de un archivo de texto. */
async function extractTextFromFile(file: File): Promise<string> {
  if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
    const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs" as any);
    pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.mjs`;
    const buf = await file.arrayBuffer();
    const pdf = await pdfjs.getDocument({ data: buf }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      text += content.items.map((it: any) => it.str).join(" ") + "\n";
    }
    return text;
  }
  return await file.text();
}

const SEV_TONE: Record<string, string> = {
  critico: "bg-destructive/15 text-destructive border-destructive/30",
  alto: "bg-warning/15 text-warning border-warning/30",
  medio: "bg-info/15 text-info border-info/30",
  bajo: "bg-muted text-muted-foreground",
};

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  contract: { id: string; contract_type: string; clauses?: string | null; ai_analysis?: ContractAnalysis | null };
}

export function ContractAnalysisDialog({ open, onOpenChange, contract }: Props) {
  const analyze = useAnalyzeContract();
  const [result, setResult] = useState<ContractAnalysis | null>(contract.ai_analysis ?? null);
  const [extracting, setExtracting] = useState(false);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const run = (documentText?: string) => {
    analyze.mutate(
      documentText ? { contractId: contract.id, documentText } : contract.id,
      {
        onSuccess: (a) => { setResult(a); toast.success("Análisis generado"); },
        onError: (e: any) => toast.error(e.message),
      },
    );
  };

  const handleUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) { toast.error("El archivo no puede pasar de 15MB"); return; }
    try {
      setExtracting(true);
      const text = await extractTextFromFile(file);
      if (text.trim().length < 50) {
        toast.error("No se pudo extraer texto suficiente del documento (¿es un PDF escaneado?).");
        return;
      }
      setUploadedName(file.name);
      toast.success("Documento leído. Analizando con IA...");
      run(text);
    } catch (e: any) {
      toast.error(e?.message || "Error al leer el documento");
    } finally {
      setExtracting(false);
    }
  };

  const busy = analyze.isPending || extracting;
  const a = result;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" /> Análisis IA del contrato
          </DialogTitle>
        </DialogHeader>

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf,.txt,.md"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleUpload(f); e.target.value = ""; }}
        />

        {!a ? (
          <div className="py-6 space-y-4">
            {/* Zona de carga: subir el documento del contrato para analizarlo */}
            <button
              type="button"
              onClick={() => !busy && fileRef.current?.click()}
              disabled={busy}
              className="w-full rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-colors p-6 flex flex-col items-center gap-2 disabled:opacity-60"
            >
              {extracting ? <Loader2 className="h-8 w-8 text-primary animate-spin" /> : <Upload className="h-8 w-8 text-muted-foreground/60" />}
              <p className="text-sm font-medium">Subir contrato (PDF o texto) y analizar</p>
              <p className="text-[11px] text-muted-foreground">Se extrae el texto y la IA lo analiza automáticamente</p>
              {uploadedName && (
                <span className="text-[11px] text-primary flex items-center gap-1 mt-1"><FileText className="h-3 w-3" /> {uploadedName}</span>
              )}
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] uppercase text-muted-foreground">o</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="text-center space-y-2">
              <p className="text-xs text-muted-foreground">
                Analizar con el clausulado ya registrado en el contrato.
              </p>
              <Button variant="outline" onClick={() => run()} disabled={busy} className="gap-1.5">
                {analyze.isPending && !extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                Analizar clausulado registrado
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <Badge variant="outline" className="text-[10px]">Confianza {a.confianza}%</Badge>
              <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={busy} className="gap-1.5">
                {extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                Subir otro
              </Button>
              <Button size="sm" variant="outline" onClick={() => run()} disabled={busy} className="gap-1.5">
                {analyze.isPending && !extracting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                Reanalizar
              </Button>
            </div>

            <Section icon={<ScrollText className="h-3.5 w-3.5" />} title="Resumen ejecutivo">
              <p className="text-sm">{a.resumen_ejecutivo}</p>
            </Section>

            {a.riesgos?.length > 0 && (
              <Section icon={<ShieldAlert className="h-3.5 w-3.5" />} title={`Riesgos (${a.riesgos.length})`}>
                <div className="space-y-2">
                  {a.riesgos.map((r, i) => (
                    <div key={i} className="rounded-lg border p-2.5">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`text-[9px] uppercase ${SEV_TONE[r.severidad] || ""}`}>{r.severidad}</Badge>
                        <span className="text-xs font-semibold">{r.titulo}</span>
                      </div>
                      {r.impacto && <p className="text-[11px] text-muted-foreground mt-1">Impacto: {r.impacto}</p>}
                      <p className="text-[11px] mt-1"><span className="text-muted-foreground">Mitigación:</span> {r.mitigacion}</p>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {a.obligaciones?.length > 0 && (
              <Section icon={<ListChecks className="h-3.5 w-3.5" />} title="Obligaciones">
                <div className="space-y-1">
                  {a.obligaciones.map((o, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <Badge variant="secondary" className="text-[9px] shrink-0">{o.parte}</Badge>
                      <span>{o.obligacion}</span>
                    </div>
                  ))}
                </div>
              </Section>
            )}

            {a.vacios_o_ambiguedades && a.vacios_o_ambiguedades.length > 0 && (
              <Section icon={<AlertTriangle className="h-3.5 w-3.5" />} title="Vacíos o ambigüedades">
                <ul className="list-disc pl-5 space-y-0.5 text-xs">
                  {a.vacios_o_ambiguedades.map((v, i) => <li key={i}>{v}</li>)}
                </ul>
              </Section>
            )}

            {a.recomendaciones?.length > 0 && (
              <Section icon={<CheckCircle2 className="h-3.5 w-3.5" />} title="Recomendaciones">
                <ul className="space-y-1 text-xs">
                  {a.recomendaciones.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5"><CheckCircle2 className="h-3 w-3 text-success mt-0.5 shrink-0" />{r}</li>
                  ))}
                </ul>
              </Section>
            )}

            {a.generated_at && (
              <p className="text-[10px] text-muted-foreground italic text-center">Generado {new Date(a.generated_at).toLocaleString("es-CR")}</p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-1.5">
      <h3 className="text-xs font-bold uppercase tracking-wide text-foreground/80 flex items-center gap-1.5">
        <span className="text-primary">{icon}</span>{title}
      </h3>
      {children}
    </section>
  );
}
