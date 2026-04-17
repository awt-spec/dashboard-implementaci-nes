import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sparkles, CheckCircle2, AlertTriangle, TrendingUp, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useClients } from "@/hooks/useClients";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function TeamRecommenderDialog({ open, onOpenChange }: Props) {
  const { data: clients = [] } = useClients();
  const [clientId, setClientId] = useState("");
  const [brief, setBrief] = useState("");
  const [requiredSkills, setRequiredSkills] = useState("");
  const [teamSize, setTeamSize] = useState(3);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleAnalyze = async () => {
    if (!clientId && !brief.trim()) {
      toast.error("Selecciona un cliente o describe el proyecto");
      return;
    }
    setLoading(true);
    setResult(null);
    const res = await supabase.functions.invoke("recommend-team-for-client", {
      body: {
        client_id: clientId || null,
        project_brief: brief.trim() || null,
        required_skills: requiredSkills.split(",").map(s => s.trim()).filter(Boolean),
        team_size: teamSize,
      },
    });
    setLoading(false);
    if (res.error || res.data?.error) {
      toast.error(res.data?.error || res.error?.message || "Error al recomendar");
      return;
    }
    setResult(res.data);
    toast.success("Recomendación generada");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" /> Recomendador de Equipo IA
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Cliente (opcional)</label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger><SelectValue placeholder="Selecciona cliente" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Tamaño del equipo</label>
              <Input type="number" value={teamSize} onChange={e => setTeamSize(Number(e.target.value))} min={1} max={10} />
            </div>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Descripción del proyecto</label>
            <Textarea rows={3} value={brief} onChange={e => setBrief(e.target.value)} placeholder="Implementación de módulo financiero con integración a SAP, foco en performance..." />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">Skills requeridas (separadas por coma)</label>
            <Input value={requiredSkills} onChange={e => setRequiredSkills(e.target.value)} placeholder="React, SQL Server, IFS Cloud..." />
          </div>
          <Button onClick={handleAnalyze} disabled={loading} className="w-full gap-2">
            <Sparkles className="h-4 w-4" /> {loading ? "Analizando equipo..." : "Recomendar candidatos"}
          </Button>

          {result && (
            <div className="space-y-3 pt-3 border-t">
              {result.team_summary && (
                <Card className="p-3 bg-primary/5 border-primary/20">
                  <div className="text-xs font-semibold mb-1">Resumen del equipo propuesto</div>
                  <p className="text-xs text-muted-foreground">{result.team_summary}</p>
                </Card>
              )}

              <div className="space-y-2">
                <div className="text-xs font-semibold">Candidatos rankeados ({result.recommendations?.length || 0})</div>
                {(result.recommendations || []).map((r: any, i: number) => (
                  <Card key={r.member_id} className="p-3">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-primary text-primary-foreground">#{i + 1}</Badge>
                          <Link to={`/team/${r.member_id}`} className="font-semibold text-sm hover:text-primary inline-flex items-center gap-1">
                            {r.member_name} <ExternalLink className="h-3 w-3" />
                          </Link>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5">Rol propuesto: {r.role_in_project}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-emerald-500">{r.match_score}%</div>
                        <div className="text-[9px] text-muted-foreground uppercase">match</div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{r.justification}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <div className="text-[10px] font-semibold text-emerald-500 flex items-center gap-1 mb-1"><CheckCircle2 className="h-3 w-3" /> Fortalezas</div>
                        <div className="flex flex-wrap gap-1">
                          {(r.strengths || []).map((s: string, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600">{s}</Badge>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-[10px] font-semibold text-amber-500 flex items-center gap-1 mb-1"><AlertTriangle className="h-3 w-3" /> Gaps</div>
                        <div className="flex flex-wrap gap-1">
                          {(r.gaps || []).map((s: string, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-[10px] border-amber-500/30 text-amber-600">{s}</Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {(result.missing_skills?.length > 0 || result.hiring_recommendations?.length > 0) && (
                <Card className="p-3 border-amber-500/30 bg-amber-500/5">
                  <div className="text-xs font-semibold mb-2 flex items-center gap-1.5"><TrendingUp className="h-3.5 w-3.5 text-amber-500" /> Brechas del equipo</div>
                  {result.missing_skills?.length > 0 && (
                    <div className="mb-2">
                      <div className="text-[10px] text-muted-foreground mb-1">Skills faltantes:</div>
                      <div className="flex flex-wrap gap-1">
                        {result.missing_skills.map((s: string, i: number) => <Badge key={i} variant="outline" className="text-[10px]">{s}</Badge>)}
                      </div>
                    </div>
                  )}
                  {result.hiring_recommendations?.length > 0 && (
                    <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                      {result.hiring_recommendations.map((r: string, i: number) => <li key={i}>{r}</li>)}
                    </ul>
                  )}
                </Card>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
