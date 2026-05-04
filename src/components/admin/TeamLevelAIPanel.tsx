import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Loader2, TrendingUp, AlertTriangle, Trophy, GraduationCap, UserPlus, Activity, Brain } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";

interface TeamLevelAnalysis {
  id: string;
  created_at: string;
  team_health_score: number | null;
  executive_summary: string | null;
  full_analysis: any;
  model: string | null;
  scope: string | null;
}

const priorityColor: Record<string, string> = {
  alta: "bg-destructive/15 text-destructive border-destructive/30",
  media: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  baja: "bg-muted text-muted-foreground",
};

export function TeamLevelAIPanel() {
  const [latest, setLatest] = useState<TeamLevelAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase
      .from("pm_ai_analysis" as any)
      .select("*")
      .eq("analysis_type", "team_level")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle() as any);
    if (!error) setLatest(data as any);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const runAnalysis = async () => {
    setRunning(true);
    toast.info("La IA está evaluando el nivel del equipo... (~30s)");
    try {
      const { data, error } = await supabase.functions.invoke("analyze-team-level", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Análisis completado sobre ${data.roster_count} miembros`);
      await load();
    } catch (e: any) {
      toast.error(e.message || "Error al ejecutar análisis");
    } finally {
      setRunning(false);
    }
  };

  const a = latest?.full_analysis;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/5 flex items-center justify-center border border-primary/20">
            <Brain className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              Nivel del Equipo · IA
              <Sparkles className="h-4 w-4 text-warning animate-pulse" />
            </h2>
            <p className="text-sm text-muted-foreground">
              Diagnóstico global combinando CVs, skills auto-reportadas y productividad real (Scrum + Soporte).
            </p>
          </div>
        </div>
        <Button onClick={runAnalysis} disabled={running} className="gap-2 shadow-lg shadow-primary/20">
          {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {latest ? "Re-evaluar equipo" : "Evaluar equipo"}
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : !latest ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Brain className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground mb-4 max-w-md">
              Aún no hay análisis. Pulsa <span className="font-semibold text-foreground">"Evaluar equipo"</span> para que la IA combine CVs, skills y stats reales y emita un diagnóstico ejecutivo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Score hero */}
          <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-center">
                <div className="text-center lg:text-left">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-1">Score global</p>
                  <p className="text-6xl font-black text-primary leading-none">{latest.team_health_score ?? "—"}<span className="text-2xl text-muted-foreground">/100</span></p>
                  <p className="text-xs text-muted-foreground mt-2">{latest.scope} · {new Date(latest.created_at).toLocaleString("es")}</p>
                </div>
                <div className="lg:col-span-2 space-y-2">
                  <Metric label="Productividad" value={a?.metrics?.productivity_score} />
                  <Metric label="Cobertura de skills" value={a?.metrics?.skill_coverage_score} />
                  <Metric label="Seniority promedio" value={a?.metrics?.avg_seniority_score} />
                  {a?.metrics?.bus_factor !== undefined && (
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-muted-foreground">Bus factor</span>
                      <Badge variant="outline" className="font-mono">{a.metrics.bus_factor}</Badge>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Executive summary */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" /> Resumen ejecutivo
              </h3>
              <p className="text-sm leading-relaxed whitespace-pre-line text-foreground/85">
                {latest.executive_summary}
              </p>
            </CardContent>
          </Card>

          <Tabs defaultValue="performers">
            <TabsList>
              <TabsTrigger value="performers" className="gap-1.5"><Trophy className="h-3.5 w-3.5" />Top</TabsTrigger>
              <TabsTrigger value="risk" className="gap-1.5"><AlertTriangle className="h-3.5 w-3.5" />En riesgo</TabsTrigger>
              <TabsTrigger value="strengths">Fortalezas / Gaps</TabsTrigger>
              <TabsTrigger value="training" className="gap-1.5"><GraduationCap className="h-3.5 w-3.5" />Capacitación</TabsTrigger>
              <TabsTrigger value="hiring" className="gap-1.5"><UserPlus className="h-3.5 w-3.5" />Hiring</TabsTrigger>
            </TabsList>

            <TabsContent value="performers" className="space-y-2 mt-4">
              {(a?.top_performers || []).map((p: any, i: number) => (
                <Card key={i}>
                  <CardContent className="p-4 flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Trophy className={`h-4 w-4 ${i === 0 ? "text-amber-500" : "text-muted-foreground"}`} />
                        <h4 className="font-semibold text-sm">{p.name}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{p.reason}</p>
                    </div>
                    <Badge className="bg-emerald-500/15 text-emerald-500 border-emerald-500/30 font-mono">{p.score}/100</Badge>
                  </CardContent>
                </Card>
              ))}
              {(!a?.top_performers || a.top_performers.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-6">Sin datos suficientes</p>
              )}
            </TabsContent>

            <TabsContent value="risk" className="space-y-2 mt-4">
              {(a?.at_risk || []).map((r: any, i: number) => (
                <Card key={i} className="border-amber-500/30 bg-amber-500/5">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                      <h4 className="font-semibold text-sm">{r.name}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground mb-2">{r.reason}</p>
                    <div className="text-xs bg-background/60 border border-border/50 rounded-md p-2">
                      <span className="font-bold text-primary">Acción: </span>{r.action}
                    </div>
                  </CardContent>
                </Card>
              ))}
              {(!a?.at_risk || a.at_risk.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-6">Sin miembros marcados en riesgo</p>
              )}
            </TabsContent>

            <TabsContent value="strengths" className="grid md:grid-cols-2 gap-3 mt-4">
              <Card>
                <CardContent className="p-4">
                  <h4 className="text-xs font-bold uppercase text-emerald-500 mb-2">Fortalezas</h4>
                  <ul className="space-y-1.5 text-sm">
                    {(a?.strengths || []).map((s: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <TrendingUp className="h-3.5 w-3.5 text-emerald-500 mt-0.5 shrink-0" />
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <h4 className="text-xs font-bold uppercase text-amber-500 mb-2">Brechas críticas</h4>
                  <ul className="space-y-1.5 text-sm">
                    {(a?.gaps || []).map((g: string, i: number) => (
                      <li key={i} className="flex items-start gap-2">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                        <span>{g}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="training" className="space-y-2 mt-4">
              {(a?.training_plan || []).map((t: any, i: number) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <h4 className="font-semibold text-sm flex items-center gap-2">
                        <GraduationCap className="h-3.5 w-3.5 text-primary" />
                        {t.area}
                      </h4>
                      <Badge className={priorityColor[t.priority] || ""}>{t.priority}</Badge>
                    </div>
                    {t.members?.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {t.members.map((m: string, j: number) => (
                          <Badge key={j} variant="outline" className="text-[10px]">{m}</Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
              {(!a?.training_plan || a.training_plan.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-6">Sin plan de capacitación generado</p>
              )}
            </TabsContent>

            <TabsContent value="hiring" className="space-y-2 mt-4">
              {(a?.hiring_recommendations || []).map((h: string, i: number) => (
                <Card key={i}>
                  <CardContent className="p-3 flex items-start gap-2">
                    <UserPlus className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-sm">{h}</p>
                  </CardContent>
                </Card>
              ))}
              {(!a?.hiring_recommendations || a.hiring_recommendations.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-6">Sin recomendaciones de contratación</p>
              )}
            </TabsContent>
          </Tabs>
        </motion.div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | undefined }) {
  const v = Math.round(value || 0);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-semibold">{v}/100</span>
      </div>
      <Progress value={v} className="h-1.5" />
    </div>
  );
}
