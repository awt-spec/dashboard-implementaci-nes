import { useState } from "react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Sparkles, Loader2, RefreshCw, Heart, TrendingUp, TrendingDown, ArrowUpRight,
  AlertTriangle, DollarSign, Target, CalendarDays, Activity,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AiErrorDialog } from "@/components/ui/ai-error-dialog";
import {
  useLatestClientStrategy, useRunClientStrategy,
  type ClientStrategyOutput, type ClientStrategyChurnRisk,
} from "@/hooks/useClientStrategy";

// ─── Helpers ─────────────────────────────────────────────────────────────

const SEVERITY_META: Record<ClientStrategyChurnRisk["severidad"], { label: string; classes: string }> = {
  critico: { label: "Crítico", classes: "bg-destructive/15 text-destructive border-destructive/30" },
  alto:    { label: "Alto",    classes: "bg-warning/15 text-warning border-warning/30" },
  medio:   { label: "Medio",   classes: "bg-info/15 text-info border-info/30" },
  bajo:    { label: "Bajo",    classes: "bg-muted text-muted-foreground border-border" },
};

const PROB_META = {
  alta:  { label: "Alta",  classes: "bg-success/15 text-success border-success/30" },
  media: { label: "Media", classes: "bg-info/15 text-info border-info/30" },
  baja:  { label: "Baja",  classes: "bg-muted text-muted-foreground border-border" },
} as const;

function healthColor(score: number): string {
  if (score >= 75) return "text-success";
  if (score >= 50) return "text-info";
  if (score >= 30) return "text-warning";
  return "text-destructive";
}

function healthBgColor(score: number): string {
  if (score >= 75) return "bg-success";
  if (score >= 50) return "bg-info";
  if (score >= 30) return "bg-warning";
  return "bg-destructive";
}

function trendMeta(t: ClientStrategyOutput["salud_relacion"]["tendencia"]) {
  if (t === "mejorando") return { label: "Mejorando", Icon: TrendingUp, classes: "text-success" };
  if (t === "deteriorando") return { label: "Deteriorando", Icon: TrendingDown, classes: "text-destructive" };
  return { label: "Estable", Icon: Activity, classes: "text-muted-foreground" };
}

// ─── Props ───────────────────────────────────────────────────────────────

interface Props {
  clientId: string;
  clientName?: string | null;
  canEdit: boolean;
}

// ─── Componente ──────────────────────────────────────────────────────────

export function ClientStrategyPanel({ clientId, clientName, canEdit }: Props) {
  const { data: latest, isLoading } = useLatestClientStrategy(clientId);
  const run = useRunClientStrategy();
  const [showJson, setShowJson] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleGenerate = () => {
    run.mutate(clientId, {
      onSuccess: () => toast.success("Estrategia generada"),
      onError: (e: any) => setAiError(e?.message || "No se pudo generar"),
    });
  };

  const analysis: ClientStrategyOutput | null = latest?.full_analysis ?? null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cargando análisis previo…
      </div>
    );
  }

  // Empty state
  if (!analysis) {
    return (
      <>
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 mx-auto flex items-center justify-center">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-base font-bold">Estrategia IA para {clientName || "este cliente"}</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                Análisis 360° de la cuenta: salud de la relación, top 3 dolores recurrentes,
                oportunidades de upsell, riesgos de churn y plan semana-a-semana.
              </p>
            </div>
            <Button onClick={handleGenerate} disabled={!canEdit || run.isPending} className="gap-2">
              {run.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {run.isPending ? "Generando…" : "Generar estrategia"}
            </Button>
            {!canEdit && (
              <p className="text-[10px] text-muted-foreground italic">
                Requiere permisos admin / PM / gerente.
              </p>
            )}
          </CardContent>
        </Card>
        <AiErrorDialog open={!!aiError} onClose={() => setAiError(null)} message={aiError} onRetry={handleGenerate} />
      </>
    );
  }

  // ─── Vista con análisis ───────────────────────────────────────────────
  const health = analysis.salud_relacion;
  const trend = trendMeta(health.tendencia);
  const healthScore = Math.round(health.score);
  const createdRelative = latest?.created_at
    ? formatDistanceToNow(new Date(latest.created_at), { addSuffix: true, locale: es })
    : "";
  const createdAbs = latest?.created_at
    ? format(new Date(latest.created_at), "d MMM yyyy · HH:mm", { locale: es })
    : "";

  return (
    <div className="space-y-4">
      {/* Meta */}
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" />
          <span>Estrategia <span title={createdAbs}>{createdRelative}</span></span>
          <span>·</span>
          <span className="font-mono">{latest?.model?.split("/")[1] ?? "ia"}</span>
          <span>·</span>
          <span>
            Confianza <span className={analysis.confianza >= 70 ? "text-success" : analysis.confianza >= 40 ? "text-warning" : "text-destructive"}>
              {Math.round(analysis.confianza)}%
            </span>
          </span>
        </div>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={run.isPending}
            className="h-7 gap-1 text-[11px]"
          >
            {run.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Regenerar
          </Button>
        )}
      </div>

      {/* Salud de la relación (hero card) */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="p-5 md:p-6 flex items-start gap-4">
            {/* Score circular */}
            <div className="shrink-0 relative h-24 w-24">
              <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
                <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="10" />
                <motion.circle
                  cx="50" cy="50" r="42" fill="none"
                  strokeWidth="10"
                  strokeLinecap="round"
                  className={healthBgColor(healthScore).replace("bg-", "stroke-")}
                  strokeDasharray={`${2 * Math.PI * 42}`}
                  initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                  animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - healthScore / 100) }}
                  transition={{ duration: 1, ease: "easeOut" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <Heart className={`h-4 w-4 ${healthColor(healthScore)} mb-0.5`} />
                <span className={`text-xl font-black tabular-nums ${healthColor(healthScore)}`}>{healthScore}</span>
              </div>
            </div>

            {/* Resumen */}
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground">
                  Salud de la relación
                </p>
                <Badge variant="outline" className={`text-[10px] gap-1 ${trend.classes}`}>
                  <trend.Icon className="h-3 w-3" /> {trend.label}
                </Badge>
              </div>
              <p className="text-sm leading-relaxed">{health.resumen}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grid de dolores + upsell */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Top dolores */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" /> Top dolores recurrentes
              <Badge variant="outline" className="text-[10px]">{analysis.top_3_dolores.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {analysis.top_3_dolores.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">Sin dolores recurrentes identificados.</p>
            ) : analysis.top_3_dolores.map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                className="p-2.5 rounded-lg border border-border/60 bg-card space-y-1"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-bold flex-1">{p.titulo}</p>
                  <Badge variant="outline" className="text-[10px] shrink-0">{p.categoria}</Badge>
                </div>
                {typeof p.ocurrencias === "number" && p.ocurrencias > 0 && (
                  <p className="text-[10px] text-muted-foreground">
                    ~{p.ocurrencias} {p.ocurrencias === 1 ? "ocurrencia" : "ocurrencias"}
                  </p>
                )}
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-semibold">Impacto: </span>{p.impacto}
                </p>
                <p className="text-[11px]">
                  <span className="font-semibold text-info">→ </span>{p.solucion_sugerida}
                </p>
              </motion.div>
            ))}
          </CardContent>
        </Card>

        {/* Upsell */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <ArrowUpRight className="h-3.5 w-3.5 text-success" /> Oportunidades upsell
              <Badge variant="outline" className="text-[10px]">{analysis.oportunidades_upsell.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {analysis.oportunidades_upsell.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No hay oportunidades claras de upsell en este momento.
              </p>
            ) : analysis.oportunidades_upsell.map((o, i) => {
              const prob = PROB_META[o.probabilidad] ?? PROB_META.media;
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="p-2.5 rounded-lg border border-border/60 bg-card space-y-1"
                >
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <p className="text-sm font-bold flex-1">{o.titulo}</p>
                    <div className="flex gap-1 shrink-0">
                      <Badge variant="outline" className={`text-[10px] ${prob.classes}`}>
                        P: {prob.label}
                      </Badge>
                      {typeof o.estimado_usd_mes === "number" && o.estimado_usd_mes > 0 && (
                        <Badge variant="outline" className="text-[10px] gap-0.5 bg-success/10 text-success border-success/30">
                          <DollarSign className="h-2.5 w-2.5" />
                          {o.estimado_usd_mes.toLocaleString("en-US")}/mes
                        </Badge>
                      )}
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground whitespace-pre-wrap">{o.detalle}</p>
                  {o.momento_recomendado && (
                    <p className="text-[10px] text-info italic">
                      Momento: {o.momento_recomendado}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Riesgos de churn */}
      {analysis.riesgos_churn.length > 0 && (
        <Card className="border-warning/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-destructive" /> Riesgos de churn
              <Badge variant="outline" className="text-[10px] bg-destructive/10 text-destructive border-destructive/30">
                {analysis.riesgos_churn.length}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {analysis.riesgos_churn.map((r, i) => {
              const meta = SEVERITY_META[r.severidad];
              return (
                <div key={i} className="p-2.5 rounded-lg border border-border/60 bg-card space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-bold flex-1">{r.titulo}</p>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${meta.classes}`}>
                      {meta.label}
                    </Badge>
                  </div>
                  {r.senales && r.senales.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {r.senales.map((s, j) => (
                        <span key={j} className="text-[10px] px-1.5 py-0.5 rounded-md bg-muted/50 border border-border/50">
                          {s}
                        </span>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    <span className="font-semibold">Mitigación: </span>{r.mitigacion}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Plan próximo mes */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-primary" /> Plan próximos 30 días
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {analysis.plan_proximo_mes.map((w, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex gap-2"
            >
              <div className="shrink-0 w-10 flex flex-col items-center">
                <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center">
                  S{w.semana}
                </div>
                {i < analysis.plan_proximo_mes.length - 1 && (
                  <div className="flex-1 w-px bg-border mt-1" />
                )}
              </div>
              <div className="flex-1 min-w-0 pb-3">
                <p className="text-sm font-bold flex items-center gap-2 flex-wrap">
                  <Target className="h-3 w-3 text-primary shrink-0" />
                  {w.objetivo}
                  {w.responsable && (
                    <Badge variant="outline" className="text-[10px]">{w.responsable}</Badge>
                  )}
                </p>
                <ul className="mt-1 space-y-0.5 pl-4">
                  {w.acciones.map((a, j) => (
                    <li key={j} className="text-[11px] text-muted-foreground list-disc">
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            </motion.div>
          ))}
        </CardContent>
      </Card>

      {/* Debug: JSON */}
      <button
        onClick={() => setShowJson((v) => !v)}
        className="text-[10px] text-muted-foreground hover:text-foreground italic underline underline-offset-2"
      >
        {showJson ? "Ocultar JSON" : "Ver JSON de la estrategia"}
      </button>
      {showJson && (
        <pre className="text-[10px] font-mono p-3 rounded-lg bg-muted/40 border border-border/60 overflow-auto max-h-64">
          {JSON.stringify(analysis, null, 2)}
        </pre>
      )}
      <AiErrorDialog open={!!aiError} onClose={() => setAiError(null)} message={aiError} onRetry={handleGenerate} />
    </div>
  );
}
