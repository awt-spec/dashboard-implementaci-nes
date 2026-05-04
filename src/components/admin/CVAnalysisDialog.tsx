import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Upload, FileText, Sparkles, CheckCircle2, Loader2, Award, Target, Briefcase, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { SysdeTeamMember } from "@/hooks/useTeamMembers";

interface Props {
  member: SysdeTeamMember & { cv_url?: string; cv_filename?: string; cv_analysis?: any; cv_skills?: string[]; cv_seniority?: string; cv_years_experience?: number; cv_recommended_clients?: any[] };
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onUpdated?: () => void;
}

async function extractTextFromFile(file: File): Promise<string> {
  if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
    // Use pdfjs via dynamic import
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
  // txt fallback
  return await file.text();
}

export function CVAnalysisDialog({ member, open, onOpenChange, onUpdated }: Props) {
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const analysis = member.cv_analysis;

  const handleUpload = async (file: File) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("El archivo no puede pasar de 10MB");
      return;
    }
    try {
      setUploading(true);
      // Upload to storage
      const path = `${member.id}/${Date.now()}-${file.name}`;
      const { error: upErr } = await supabase.storage.from("team-cvs").upload(path, file, { upsert: false });
      if (upErr) throw upErr;
      const { data: signed } = await supabase.storage.from("team-cvs").createSignedUrl(path, 60 * 60 * 24 * 365);

      // Update member with file ref
      await (supabase.from("sysde_team_members" as any).update({
        cv_url: signed?.signedUrl || path,
        cv_filename: file.name,
        cv_uploaded_at: new Date().toISOString(),
      }).eq("id", member.id) as any);

      toast.success("CV subido. Extrayendo texto...");
      setUploading(false);

      // Extract + analyze
      setAnalyzing(true);
      const text = await extractTextFromFile(file);
      if (text.length < 100) {
        toast.error("No se pudo extraer texto suficiente del CV");
        setAnalyzing(false);
        return;
      }
      toast.info("IA analizando el CV...");
      const { data, error } = await supabase.functions.invoke("analyze-cv", {
        body: { memberId: member.id, cvText: text }
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success("Análisis completado");
      onUpdated?.();
    } catch (e: any) {
      toast.error(e.message || "Error procesando CV");
    } finally {
      setUploading(false);
      setAnalyzing(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Análisis IA del CV — {member.name}
          </DialogTitle>
          <DialogDescription>
            Sube el CV (PDF o TXT) y la IA extraerá habilidades, seniority y recomendará clientes ideales.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30">
          <FileText className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm flex-1 truncate">
            {member.cv_filename || "Sin CV cargado"}
          </span>
          <input ref={fileRef} type="file" accept=".pdf,.txt" hidden onChange={e => e.target.files?.[0] && handleUpload(e.target.files[0])} />
          <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading || analyzing}>
            {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
            <span className="ml-1.5">{member.cv_url ? "Reemplazar" : "Subir CV"}</span>
          </Button>
        </div>

        {analyzing && (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> IA analizando perfil técnico...
          </div>
        )}

        {analysis && Object.keys(analysis).length > 0 && (
          <ScrollArea className="flex-1 -mx-6 px-6">
            <Tabs defaultValue="summary" className="space-y-4">
              <TabsList className="w-full justify-start">
                <TabsTrigger value="summary">Resumen</TabsTrigger>
                <TabsTrigger value="skills">Skills</TabsTrigger>
                <TabsTrigger value="match">Match Clientes</TabsTrigger>
                <TabsTrigger value="dev">Desarrollo</TabsTrigger>
              </TabsList>

              <TabsContent value="summary" className="space-y-3">
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <p className="text-sm leading-relaxed">{analysis.summary}</p>
                    <div className="grid grid-cols-3 gap-3 pt-2">
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground">Seniority</p>
                        <p className="font-bold text-base">{analysis.seniority}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground">Años exp.</p>
                        <p className="font-bold text-base">{analysis.years_experience}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase text-muted-foreground">Rol ideal</p>
                        <p className="font-medium text-sm">{analysis.ideal_role}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                {analysis.strengths?.length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1.5"><Award className="h-3 w-3" /> Fortalezas</h4>
                      <ul className="space-y-1 text-sm">
                        {analysis.strengths.map((s: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="skills" className="space-y-3">
                <Card>
                  <CardContent className="p-4">
                    <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Habilidades técnicas</h4>
                    <div className="flex flex-wrap gap-1.5">
                      {(analysis.skills || []).map((s: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">{s}</Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
                {analysis.domains?.length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Dominios</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.domains.map((d: string, i: number) => (
                          <Badge key={i} className="bg-primary/10 text-primary border-primary/30">{d}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
                {analysis.certifications?.length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2">Certificaciones</h4>
                      <div className="flex flex-wrap gap-1.5">
                        {analysis.certifications.map((c: string, i: number) => (
                          <Badge key={i} variant="outline">{c}</Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="match" className="space-y-2">
                {(analysis.recommended_clients || []).map((rc: any, i: number) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Target className="h-3.5 w-3.5 text-primary" />
                            <h4 className="font-semibold text-sm">{rc.client_name}</h4>
                          </div>
                          <p className="text-xs text-muted-foreground">{rc.reason}</p>
                        </div>
                        <Badge className={
                          rc.fit_score >= 80 ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                          rc.fit_score >= 60 ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                          "bg-muted text-muted-foreground"
                        }>{rc.fit_score}% fit</Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {(!analysis.recommended_clients || analysis.recommended_clients.length === 0) && (
                  <p className="text-sm text-muted-foreground text-center py-6">Sin coincidencias recomendadas</p>
                )}
              </TabsContent>

              <TabsContent value="dev" className="space-y-3">
                {analysis.gaps?.length > 0 && (
                  <Card>
                    <CardContent className="p-4">
                      <h4 className="text-xs font-bold uppercase text-muted-foreground mb-2 flex items-center gap-1.5"><AlertTriangle className="h-3 w-3" /> Áreas a desarrollar</h4>
                      <ul className="space-y-1 text-sm">
                        {analysis.gaps.map((g: string, i: number) => (
                          <li key={i} className="flex items-start gap-2">
                            <Briefcase className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                            <span>{g}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
            </Tabs>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
