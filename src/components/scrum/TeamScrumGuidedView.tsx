import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowRight, ArrowLeft, Star,
  LayoutGrid, Workflow, Sunrise, ListOrdered, Sparkles,
  Target, BarChart3, TrendingUp, Brain,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { SprintBoard } from "./SprintBoard";
import { DailyStandupPanel } from "./DailyStandupPanel";
import { FordLineView } from "./FordLineView";
import { BacklogView } from "./BacklogView";
import { SVAStrategyPanel } from "./SVAStrategyPanel";
import { SprintManager } from "./SprintManager";
import { SprintAnalytics } from "./SprintAnalytics";
import { PMAIPanel } from "./PMAIPanel";
import { TeamWorkloadReport } from "./TeamWorkloadReport";
import type { ScrumWorkItem } from "@/hooks/useTeamScrum";

// ─── Tipos ───────────────────────────────────────────────────────────────

type PresetKey =
  | "tablero" | "daily" | "flujo"
  | "backlog" | "estrategia"
  | "sprints"
  | "reportes" | "sprint_analytics"
  | "pm_ai";

interface Preset {
  key: PresetKey;
  title: string;
  description: string;
  Icon: any;
  tone: string;
  gradient: string;
  accent: string;
  category: "diaria" | "planificacion" | "sprints" | "analisis" | "ia";
}

const PRESETS: Preset[] = [
  // ── DIARIA ──
  {
    key: "tablero", title: "Tablero del sprint",
    description: "Kanban del sprint activo: arrastrá items entre columnas.",
    Icon: LayoutGrid, tone: "bg-primary/10 text-primary border-primary/30",
    gradient: "from-primary/10 via-primary/5 to-transparent",
    accent: "text-primary ring-primary/30", category: "diaria",
  },
  {
    key: "daily", title: "Daily standup",
    description: "Reunión diaria asistida con check-ins por persona.",
    Icon: Sunrise, tone: "bg-amber-500/10 text-amber-500 border-amber-500/30",
    gradient: "from-amber-500/10 via-amber-500/5 to-transparent",
    accent: "text-amber-500 ring-amber-500/30", category: "diaria",
  },
  {
    key: "flujo", title: "Flujo del equipo",
    description: "Vista lineal por persona con bloqueos y dependencias.",
    Icon: Workflow, tone: "bg-sky-500/10 text-sky-500 border-sky-500/30",
    gradient: "from-sky-500/10 via-sky-500/5 to-transparent",
    accent: "text-sky-500 ring-sky-500/30", category: "diaria",
  },
  // ── PLANIFICACIÓN ──
  {
    key: "backlog", title: "Backlog",
    description: "Items priorizados por WSJF, listos para próximo sprint.",
    Icon: ListOrdered, tone: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
    gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    accent: "text-emerald-500 ring-emerald-500/30", category: "planificacion",
  },
  {
    key: "estrategia", title: "Estrategia del equipo",
    description: "Plan SVA, OKRs, contexto del equipo y prioridades.",
    Icon: Sparkles, tone: "bg-violet-500/10 text-violet-400 border-violet-500/30",
    gradient: "from-violet-500/10 via-violet-500/5 to-transparent",
    accent: "text-violet-400 ring-violet-500/30", category: "planificacion",
  },
  // ── SPRINTS ──
  {
    key: "sprints", title: "Gestión de sprints",
    description: "Listado histórico, crear/cerrar/editar sprints.",
    Icon: Target, tone: "bg-rose-500/10 text-rose-500 border-rose-500/30",
    gradient: "from-rose-500/10 via-rose-500/5 to-transparent",
    accent: "text-rose-500 ring-rose-500/30", category: "sprints",
  },
  // ── ANÁLISIS ──
  {
    key: "reportes", title: "Reportes del equipo",
    description: "Carga por persona, velocity, burndown y distribución.",
    Icon: BarChart3, tone: "bg-info/10 text-info border-info/30",
    gradient: "from-info/10 via-info/5 to-transparent",
    accent: "text-info ring-info/30", category: "analisis",
  },
  {
    key: "sprint_analytics", title: "Sprint analytics",
    description: "Métricas detalladas del sprint: throughput, ciclos.",
    Icon: TrendingUp, tone: "bg-cyan-500/10 text-cyan-500 border-cyan-500/30",
    gradient: "from-cyan-500/10 via-cyan-500/5 to-transparent",
    accent: "text-cyan-500 ring-cyan-500/30", category: "analisis",
  },
  // ── IA ──
  {
    key: "pm_ai", title: "PM IA",
    description: "Asistente IA para gestión: sugerencias, riesgos, plan.",
    Icon: Brain, tone: "bg-fuchsia-500/10 text-fuchsia-500 border-fuchsia-500/30",
    gradient: "from-fuchsia-500/10 via-fuchsia-500/5 to-transparent",
    accent: "text-fuchsia-500 ring-fuchsia-500/30", category: "ia",
  },
];

const CATEGORY_LABELS: Record<Preset["category"], string> = {
  diaria: "Día a día",
  planificacion: "Planificación",
  sprints: "Sprints",
  analisis: "Análisis · datos",
  ia: "IA · automatización",
};

// ─── Props ────────────────────────────────────────────────────────────

interface Props {
  filteredItems: ScrumWorkItem[];
  backlog: ScrumWorkItem[];
  sprintItems: ScrumWorkItem[];
  activeSprints: any[];
  hasActiveFilters: boolean;
  onScrumStatusChange: (item: ScrumWorkItem, status: string) => void;
  // Reportes data
  workloadStats: { sobrecargados: number; saludables: number; subutilizados: number; sin_carga: number };
  ownerLoad: any[];
  ownersWithoutLoad: string[];
  sourceDist: any[];
  velocityData: any[];
  burndown: any[];
  scrumStatusDist: any[];
}

// ─── Componente ───────────────────────────────────────────────────────

export function TeamScrumGuidedView(props: Props) {
  const [activePreset, setActivePreset] = useState<PresetKey | null>(null);

  const currentPreset = PRESETS.find(p => p.key === activePreset);

  const renderPreset = useMemo(() => {
    if (!activePreset) return null;
    switch (activePreset) {
      case "tablero":
        return <SprintBoard items={props.sprintItems} activeSprints={props.activeSprints} onMove={props.onScrumStatusChange} />;
      case "daily":
        return <DailyStandupPanel />;
      case "flujo":
        return <FordLineView items={props.filteredItems} onMove={(item, status) => props.onScrumStatusChange(item, status)} title="Flujo del equipo" />;
      case "backlog":
        return <BacklogView items={props.backlog} hasActiveFilters={props.hasActiveFilters} onChangeStatus={props.onScrumStatusChange} />;
      case "estrategia":
        return <SVAStrategyPanel />;
      case "sprints":
        return <SprintManager />;
      case "reportes":
        return (
          <TeamWorkloadReport
            workloadStats={props.workloadStats}
            ownerLoad={props.ownerLoad}
            ownersWithoutLoad={props.ownersWithoutLoad}
            sourceDist={props.sourceDist}
            velocityData={props.velocityData}
            burndown={props.burndown}
            scrumStatusDist={props.scrumStatusDist}
          />
        );
      case "sprint_analytics":
        return <SprintAnalytics />;
      case "pm_ai":
        return <PMAIPanel />;
      default:
        return null;
    }
  }, [activePreset, props]);

  // ─── Render: picker ──
  if (!activePreset) {
    return (
      <div className="space-y-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Star className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-bold">¿Qué querés ver hoy?</h3>
            <p className="text-xs text-muted-foreground">
              Elegí una vista del equipo. Volvés al picker desde el botón "Cambiar vista".
            </p>
          </div>
        </div>

        {(Object.keys(CATEGORY_LABELS) as Preset["category"][]).map(cat => {
          const items = PRESETS.filter(p => p.category === cat);
          if (items.length === 0) return null;
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                  {CATEGORY_LABELS[cat]}
                </span>
                <div className="flex-1 h-px bg-border/60" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {items.map((p, idx) => (
                  <motion.button
                    key={p.key}
                    onClick={() => setActivePreset(p.key)}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.04, duration: 0.25 }}
                    whileHover={{ y: -3, transition: { duration: 0.15 } }}
                    whileTap={{ scale: 0.98 }}
                    className={cn(
                      "group relative text-left rounded-2xl border border-border overflow-hidden",
                      "bg-card hover:border-transparent hover:shadow-lg hover:ring-1 transition-all",
                      p.accent.split(" ").pop(),
                    )}
                  >
                    <div className={cn(
                      "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity",
                      p.gradient
                    )} />
                    <div className="relative p-4 flex items-start gap-3">
                      <div className={cn(
                        "h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border-2",
                        p.tone, "group-hover:scale-110 transition-transform"
                      )}>
                        <p.Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold">{p.title}</p>
                        <p className="text-[11px] text-muted-foreground leading-snug mt-1 line-clamp-2">
                          {p.description}
                        </p>
                      </div>
                      <ArrowRight className={cn(
                        "h-4 w-4 text-muted-foreground/50 shrink-0 mt-1 transition-all",
                        "group-hover:translate-x-0.5", p.accent.split(" ")[0]
                      )} />
                    </div>
                  </motion.button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // ─── Render: vista activa ──
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="ghost" onClick={() => setActivePreset(null)} className="h-7 gap-1 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" /> Cambiar vista
        </Button>
        {currentPreset && (
          <>
            <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center border shrink-0", currentPreset.tone)}>
              <currentPreset.Icon className="h-3.5 w-3.5" />
            </div>
            <p className="text-sm font-bold">{currentPreset.title}</p>
          </>
        )}
      </div>
      {renderPreset}
    </div>
  );
}
