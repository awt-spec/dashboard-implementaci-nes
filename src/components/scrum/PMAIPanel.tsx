import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Brain, TrendingUp, AlertTriangle, Target, Lightbulb, Clock, DollarSign, Loader2, RefreshCw, Award } from "lucide-react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useLatestPMAnalysis, useRunPMAnalysis } from "@/hooks/usePMAnalysis";

const URGENCY_COLOR: Record<string, string> = {
  inmediata: "bg-red-500/20 text-red-400 border-red-500/30",
  esta_semana: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  este_mes: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};
const SEVERITY_COLOR: Record<string, string> = {
  crítico: "bg-red-500/20 text-red-400 border-red-500/30",
  alto: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  medio: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};
const REC_TYPE_LABEL: Record<string, string> = {
  reasignar: "Reasignar",
  contratar: "Contratar",
  escalar: "Escalar",
  renegociar: "Renegociar",
  priorizar: "Priorizar",
  desescalar: "Desescalar",
};

export function PMAIPanel() {
  const { data: analysis, isLoading } = useLatestPMAnalysis();
  const runAnalysis = useRunPMAnalysis();

  const handleRun = () => {
    toast.info("PM IA analizando todo el portafolio...");
    runAnalysis.mutate(undefined, {
      onSuccess: () => toast.success("Análisis completado"),
      onError: (e: any) => toast.error(e.message || "Error al analizar"),
    });
  };

  return (
    <div className="space-y-6">
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <Brain className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold">PM IA — 40+ años de experiencia</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Analiza todo el portafolio: clientes, contratos, SLAs, equipo y backlog. Calcula prioridades por valor financiero y urgencia de SLA.
                </p>
                {analysis && (
                  <p className="text-[10px] text-muted-foreground mt-2">
                    Último análisis: {new Date(analysis.created_at).toLocaleString()} · Modelo: {analysis.model}
                  </p>
                )}
              </div>
            </div>
            <Button onClick={handleRun} disabled={runAnalysis.isPending} className="gap-2 shrink-0">
              {runAnalysis.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {analysis ? "Re-analizar" : "Ejecutar análisis"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading && <p className="text-center text-muted-foreground py-12">Cargando...</p>}

      {!isLoading && !analysis && (
        <Card><CardContent className="p-12 text-center">
          <Brain className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">Sin análisis previo. Ejecuta el primer análisis del PM IA.</p>
        </CardContent></Card>
      )}

      {analysis && (
        <>
          {/* KPI Row */}
          <div className="grid grid-cols-4 gap-3">
            <Card><CardContent className="p-4">
              <p className="text-[10px] uppercase text-muted-foreground">Salud del equipo</p>
              <p className="text-3xl font-bold mt-1">{analysis.team_health_score}<span className="text-base text-muted-foreground">/100</span></p>
              <Progress value={analysis.team_health_score || 0} className="mt-2 h-1.5" />
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-[10px] uppercase text-muted-foreground">Duración estimada</p>
              <p className="text-3xl font-bold mt-1">{analysis.duration_estimate_weeks}<span className="text-base text-muted-foreground"> sem</span></p>
              <p className="text-[10px] text-muted-foreground mt-1">para limpiar backlog</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-[10px] uppercase text-muted-foreground">Revenue mensual</p>
              <p className="text-2xl font-bold mt-1">${(analysis.metrics?.total_monthly_revenue || 0).toLocaleString()}</p>
            </CardContent></Card>
            <Card><CardContent className="p-4">
              <p className="text-[10px] uppercase text-muted-foreground">Items activos</p>
              <p className="text-3xl font-bold mt-1">{analysis.metrics?.total_active_items || 0}</p>
            </CardContent></Card>
          </div>

          {/* Executive Summary */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Award className="h-4 w-4 text-primary" /> Resumen ejecutivo</CardTitle></CardHeader>
            <CardContent><p className="text-sm leading-relaxed">{analysis.executive_summary}</p></CardContent>
          </Card>

          <Tabs defaultValue="priorities" className="space-y-4">
            <TabsList>
              <TabsTrigger value="priorities" className="gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Prioridad clientes</TabsTrigger>
              <TabsTrigger value="recommendations" className="gap-1.5"><Lightbulb className="h-3.5 w-3.5" /> Recomendaciones</TabsTrigger>
              <TabsTrigger value="risks" className="gap-1.5"><AlertTriangle className="h-3.5 w-3.5" /> Riesgos</TabsTrigger>
            </TabsList>

            <TabsContent value="priorities" className="space-y-2">
              {(analysis.client_priorities || []).map((cp: any, i: number) => (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3 mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
                            <h4 className="font-semibold">{cp.client_name}</h4>
                            {cp.monthly_value > 0 && <Badge variant="outline" className="text-[10px]">${cp.monthly_value.toLocaleString()}/mes</Badge>}
                          </div>
                          <p className="text-xs text-muted-foreground">{cp.reasoning}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-2xl font-bold">{cp.priority_score}</p>
                          <p className="text-[9px] text-muted-foreground uppercase">Score</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 mt-2 p-2 rounded-md bg-primary/5 border border-primary/10">
                        <Target className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                        <p className="text-xs"><span className="font-semibold">Acción: </span>{cp.action}</p>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </TabsContent>

            <TabsContent value="recommendations" className="space-y-2">
              {(analysis.recommendations || []).map((r: any, i: number) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1.5">
                          <Badge variant="outline" className="text-[10px]">{REC_TYPE_LABEL[r.type] || r.type}</Badge>
                          <Badge className={`text-[10px] ${URGENCY_COLOR[r.urgency] || ""}`}>{r.urgency.replace("_", " ")}</Badge>
                          <Badge variant="secondary" className="text-[10px]">Impacto {r.impact}</Badge>
                        </div>
                        <h4 className="font-semibold text-sm">{r.title}</h4>
                        <p className="text-xs text-muted-foreground mt-1">{r.detail}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="risks" className="space-y-2">
              {(analysis.risks || []).map((risk: any, i: number) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className={`h-4 w-4 mt-0.5 shrink-0 ${risk.severity === "crítico" ? "text-red-500" : risk.severity === "alto" ? "text-amber-500" : "text-blue-500"}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-sm">{risk.title}</h4>
                          <Badge className={`text-[10px] ${SEVERITY_COLOR[risk.severity] || ""}`}>{risk.severity}</Badge>
                          {risk.client_name && <Badge variant="outline" className="text-[10px]">{risk.client_name}</Badge>}
                        </div>
                        {risk.financial_impact && <p className="text-xs text-amber-400 mb-1">💰 {risk.financial_impact}</p>}
                        <p className="text-xs text-muted-foreground"><span className="font-semibold">Mitigación: </span>{risk.mitigation}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
