import { useState } from "react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { formatDistanceToNow, format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Sparkles, Loader2, RefreshCw, Target, AlertTriangle, History, Clock,
  Gauge, CheckCircle2, ShieldAlert, TrendingDown, BookOpen, DollarSign,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AiErrorDialog } from "@/components/ui/ai-error-dialog";
import {
  useLatestCaseStrategy, useRunCaseStrategy,
  type CaseStrategyOutput, type CaseStrategyRisk, type CaseStrategySlaStatus,
} from "@/hooks/useCaseStrategy";

// ─── Helpers de estilo ───────────────────────────────────────────────────

const URGENCY_META: Record<string, { label: string; classes: string }> = {
  inmediata:   { label: "Inmediata",    classes: "bg-destructive/15 text-destructive border-destructive/30" },
  hoy:         { label: "Hoy",          classes: "bg-warning/15 text-warning border-warning/30" },
  esta_semana: { label: "Esta semana",  classes: "bg-info/15 text-info border-info/30" },
  este_mes:    { label: "Este mes",     classes: "bg-muted text-muted-foreground border-border" },
};

const SEVERITY_META: Record<CaseStrategyRisk["severidad"], { label: string; classes: string }> = {
  critico: { label: "Crítico", classes: "bg-destructive/15 text-destructive border-destructive/30" },
  alto:    { label: "Alto",    classes: "bg-warning/15 text-warning border-warning/30" },
  medio:   { label: "Medio",   classes: "bg-info/15 text-info border-info/30" },
  bajo:    { label: "Bajo",    classes: "bg-muted text-muted-foreground border-border" },
};

const SLA_META: Record<CaseStrategySlaStatus["estado"], { label: string; Icon: typeof CheckCircle2; classes: string }> = {
  ok:           { label: "En regla",      Icon: CheckCircle2, classes: "bg-success/15 text-success border-success/30" },
  en_riesgo:    { label: "En riesgo",     Icon: Clock,        classes: "bg-warning/15 text-warning border-warning/30" },
  incumplido:   { label: "Incumplido",    Icon: ShieldAlert,  classes: "bg-destructive/15 text-destructive border-destructive/30" },
  sin_sla:      { label: "Sin SLA",       Icon: Gauge,        classes: "bg-muted text-muted-foreground border-border" },
  cerrado:      { label: "Cerrado",       Icon: CheckCircle2, classes: "bg-muted text-muted-foreground border-border" },
};

// ─── Props ───────────────────────────────────────────────────────────────

interface Props {
  ticketId: string;
  canEdit: boolean;
}

// ─── Componente ──────────────────────────────────────────────────────────

export function CaseStrategyPanel({ ticketId, canEdit }: Props) {
  const { data: latest, isLoading } = useLatestCaseStrategy(ticketId);
  const run = useRunCaseStrategy();
  const [showFullAnalysis, setShowFullAnalysis] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const handleGenerate = () => {
    run.mutate(ticketId, {
      onSuccess: () => toast.success("Análisis generado"),
      onError: (e: any) => setAiError(e?.message || "No se pudo generar el análisis"),
    });
  };

  const analysis: CaseStrategyOutput | null = latest?.full_analysis ?? null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-xs text-muted-foreground">
        <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Cargando análisis previo…
      </div>
    );
  }

  // ─── Empty state: no hay análisis previo ──────────────────────────────
  if (!analysis) {
    return (
      <div className="space-y-3">
        <Card>
          <CardContent className="p-6 text-center space-y-3">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 mx-auto flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold">Estrategia IA para este caso</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                Obtené diagnóstico, acción recomendada, riesgos y lecciones aprendidas
                de casos similares. Toma ~15 segundos.
              </p>
            </div>
            <Button
              onClick={handleGenerate}
              disabled={!canEdit || run.isPending}
              className="gap-2"
            >
              {run.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {run.isPending ? "Generando…" : "Generar análisis"}
            </Button>
            {!canEdit && (
              <p className="text-[10px] text-muted-foreground italic">
                Requiere permisos de edición interna.
              </p>
            )}
          </CardContent>
        </Card>
        <AiErrorDialog open={!!aiError} onClose={() => setAiError(null)} message={aiError} onRetry={handleGenerate} />
      </div>
    );
  }

  // ─── Vista con análisis ───────────────────────────────────────────────
  const urg = URGENCY_META[analysis.accion_recomendada.urgencia] ?? URGENCY_META.este_mes;
  const slaMeta = SLA_META[analysis.sla_status.estado];
  const createdRelative = latest?.created_at
    ? formatDistanceToNow(new Date(latest.created_at), { addSuffix: true, locale: es })
    : "";
  const createdAbs = latest?.created_at
    ? format(new Date(latest.created_at), "d MMM yyyy · HH:mm", { locale: es })
    : "";

  return (
    <div className="space-y-3">
      {/* Meta: cuándo fue el último análisis + regenerar */}
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Sparkles className="h-3 w-3 text-primary" />
          <span>Análisis <span title={createdAbs}>{createdRelative}</span></span>
          <span>·</span>
          <span className="font-mono">{latest?.model?.split("/")[1] ?? "ia"}</span>
          {typeof analysis.confianza === "number" && (
            <>
              <span>·</span>
              <span>
                Confianza <span className={analysis.confianza >= 70 ? "text-success" : analysis.confianza >= 40 ? "text-warning" : "text-destructive"}>
                  {Math.round(analysis.confianza)}%
                </span>
              </span>
            </>
          )}
        </div>
        {canEdit && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerate}
            disabled={run.isPending}
            className="h-6 gap-1 text-[10px]"
          >
            {run.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            Regenerar
          </Button>
        )}
      </div>

      {/* Diagnóstico */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Target className="h-3.5 w-3.5 text-primary" /> Diagnóstico
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <p className="text-sm leading-relaxed">{analysis.diagnostico}</p>
        </CardContent>
      </Card>

      {/* SLA status */}
      <Card className={slaMeta.classes + " border-2"}>
        <CardContent className="p-3 flex items-start gap-2">
          <slaMeta.Icon className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase font-bold tracking-wide">SLA · {slaMeta.label}</span>
            </div>
            <p className="text-sm font-semibold">{analysis.sla_status.mensaje}</p>
            {analysis.sla_status.accion_sla && (
              <p className="text-xs opacity-80 mt-1">→ {analysis.sla_status.accion_sla}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Acción recomendada */}
      <Card className="border-primary/30 bg-primary/[.03]">
        <CardHeader className="pb-2">
          <CardTitle className="text-xs flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5 text-primary" /> Acción recomendada
            <Badge variant="outline" className={`text-[10px] ${urg.classes}`}>{urg.label}</Badge>
            {analysis.accion_recomendada.esfuerzo_estimado_horas != null && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <Clock className="h-2.5 w-2.5" /> ~{analysis.accion_recomendada.esfuerzo_estimado_horas}h
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-1.5">
          <p className="text-sm font-bold">{analysis.accion_recomendada.titulo}</p>
          <p className="text-xs whitespace-pre-wrap text-muted-foreground">{analysis.accion_recomendada.detalle}</p>
          {analysis.accion_recomendada.responsable_sugerido && (
            <p className="text-[11px] mt-1">
              <span className="text-muted-foreground">Sugerido: </span>
              <span className="font-semibold">{analysis.accion_recomendada.responsable_sugerido}</span>
            </p>
          )}
        </CardContent>
      </Card>

      {/* Riesgos */}
      {analysis.riesgos.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-warning" /> Riesgos
              <Badge variant="outline" className="text-[10px]">{analysis.riesgos.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {analysis.riesgos.map((r, i) => {
              const meta = SEVERITY_META[r.severidad];
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="p-2 rounded-lg border border-border/60 bg-card space-y-1"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold flex-1">{r.titulo}</p>
                    <Badge variant="outline" className={`text-[10px] shrink-0 ${meta.classes}`}>
                      {meta.label}
                    </Badge>
                  </div>
                  {r.impacto_financiero && (
                    <p className="text-[11px] flex items-center gap-1 text-destructive">
                      <DollarSign className="h-3 w-3" /> {r.impacto_financiero}
                    </p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    <span className="font-semibold">Mitigación: </span>{r.mitigacion}
                  </p>
                </motion.div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Casos similares */}
      {analysis.casos_similares.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs flex items-center gap-1.5">
              <BookOpen className="h-3.5 w-3.5 text-info" /> Aprendizaje de casos similares
              <Badge variant="outline" className="text-[10px]">{analysis.casos_similares.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-2">
            {analysis.casos_similares.map((c, i) => (
              <div key={i} className="p-2 rounded-lg border border-border/60 bg-card space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <code className="font-mono text-[10px] font-bold">{c.ticket_id}</code>
                  {c.asunto && <span className="text-[11px] text-muted-foreground truncate">{c.asunto}</span>}
                </div>
                <p className="text-[11px] text-muted-foreground">
                  <span className="font-semibold">Relevancia: </span>{c.relevancia}
                </p>
                <p className="text-[11px]">
                  <span className="font-semibold text-info">→ </span>{c.leccion_aplicable}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Ver JSON crudo (debug/transparencia) */}
      <button
        onClick={() => setShowFullAnalysis((v) => !v)}
        className="text-[10px] text-muted-foreground hover:text-foreground italic underline underline-offset-2"
      >
        {showFullAnalysis ? "Ocultar JSON" : "Ver JSON del análisis"}
      </button>
      <AnimatePresence>
        {showFullAnalysis && (
          <motion.pre
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="text-[10px] font-mono p-3 rounded-lg bg-muted/40 border border-border/60 overflow-auto max-h-64"
          >
            {JSON.stringify(analysis, null, 2)}
          </motion.pre>
        )}
      </AnimatePresence>
      <AiErrorDialog open={!!aiError} onClose={() => setAiError(null)} message={aiError} onRetry={handleGenerate} />
    </div>
  );
}
