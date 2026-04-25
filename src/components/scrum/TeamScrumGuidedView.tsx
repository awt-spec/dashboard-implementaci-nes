import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowRight, ArrowLeft, Star, Pin, PinOff, Trash2, BookmarkPlus,
  Loader2, ChevronRight, Sparkles, LayoutGrid, Workflow, Sunrise,
  ListOrdered, Target, BarChart3, TrendingUp, Brain, Flame,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { ActiveSprintHub } from "./ActiveSprintHub";
import { SprintBoard } from "./SprintBoard";
import { DailyStandupPanel } from "./DailyStandupPanel";
import { FordLineView } from "./FordLineView";
import { BacklogView } from "./BacklogView";
import { SVAStrategyPanel } from "./SVAStrategyPanel";
import { SprintManager } from "./SprintManager";
import { SprintAnalytics } from "./SprintAnalytics";
import { PMAIPanel } from "./PMAIPanel";
import { TeamWorkloadReport } from "./TeamWorkloadReport";
import { useSavedViews, useSaveView, useDeleteView, useTogglePinView } from "@/hooks/useSavedViews";
import type { ScrumWorkItem } from "@/hooks/useTeamScrum";

// ─── Tipos ───────────────────────────────────────────────────────────────

type PresetKey =
  | "sprint_activo"
  | "tablero" | "daily" | "flujo"
  | "backlog" | "estrategia"
  | "sprints"
  | "reportes" | "sprint_analytics";

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
    key: "sprint_activo", title: "Sprint activo",
    description: "Hub del sprint corriente: progreso, scope, riesgos en una vista.",
    Icon: Flame, tone: "bg-destructive/10 text-destructive border-destructive/30",
    gradient: "from-destructive/10 via-destructive/5 to-transparent",
    accent: "text-destructive ring-destructive/30", category: "diaria",
  },
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
    description: "Plan SVA, OKRs, contexto y prioridades del equipo.",
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
    description: "Métricas detalladas: throughput, ciclos, eficiencia.",
    Icon: TrendingUp, tone: "bg-cyan-500/10 text-cyan-500 border-cyan-500/30",
    gradient: "from-cyan-500/10 via-cyan-500/5 to-transparent",
    accent: "text-cyan-500 ring-cyan-500/30", category: "analisis",
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
  workloadStats: { sobrecargados: number; saludables: number; subutilizados: number; sin_carga: number };
  ownerLoad: any[];
  ownersWithoutLoad: string[];
  sourceDist: any[];
  velocityData: any[];
  burndown: any[];
  scrumStatusDist: any[];
  kpis?: { total: number; inProgress: number; avgWsjf: number; noEstimate: number; activeSprints: number };
}

// ─── Helper: chip de métrica slim ────────────────────────────────────

function MetricChip({
  Icon, label, value, tone = "text-foreground",
}: {
  Icon: any;
  label: string;
  value: number | string;
  tone?: string;
}) {
  return (
    <div className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-card/60 border border-border backdrop-blur-sm">
      <Icon className={cn("h-3.5 w-3.5", tone)} />
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={cn("text-xs font-bold tabular-nums", tone)}>{value}</span>
    </div>
  );
}

function InlineStat({ value, label, tone = "text-foreground" }: { value: number | string; label: string; tone?: string }) {
  return (
    <div className="text-right">
      <p className={cn("text-2xl font-black tabular-nums leading-none", tone)}>{value}</p>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">{label}</p>
    </div>
  );
}

// ─── Componente ───────────────────────────────────────────────────────

export function TeamScrumGuidedView(props: Props) {
  const auth = useAuth();
  const [activePreset, setActivePreset] = useState<PresetKey | null>(null);
  const [loadedFromSaved, setLoadedFromSaved] = useState<string | null>(null);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  const { data: savedViews = [] } = useSavedViews("scrum");
  const saveMutation = useSaveView();
  const deleteMutation = useDeleteView();
  const togglePinMutation = useTogglePinView();

  // Auto-cargar la vista pinned al entrar (default del usuario)
  useEffect(() => {
    if (activePreset || loadedFromSaved) return;
    const pinned = savedViews.find(v => v.is_pinned);
    if (pinned) {
      setActivePreset(pinned.preset_key as PresetKey);
      setLoadedFromSaved(pinned.name);
    }
  }, [savedViews, activePreset, loadedFromSaved]);

  const currentPreset = PRESETS.find(p => p.key === activePreset);
  const pinnedView = savedViews.find(v => v.is_pinned);
  const isCurrentPinned = pinnedView?.preset_key === activePreset;

  const renderPreset = useMemo(() => {
    if (!activePreset) return null;
    switch (activePreset) {
      case "sprint_activo":     return <ActiveSprintHub />;
      case "tablero":           return <SprintBoard items={props.sprintItems} activeSprints={props.activeSprints} onMove={props.onScrumStatusChange} />;
      case "daily":             return <DailyStandupPanel />;
      case "flujo":             return <FordLineView items={props.filteredItems} onMove={(item, status) => props.onScrumStatusChange(item, status)} title="Flujo del equipo" />;
      case "backlog":           return <BacklogView items={props.backlog} hasActiveFilters={props.hasActiveFilters} onChangeStatus={props.onScrumStatusChange} />;
      case "estrategia":        return <SVAStrategyPanel />;
      case "sprints":           return <SprintManager />;
      case "reportes":          return (
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
      case "sprint_analytics":  return <SprintAnalytics />;
      default:                  return null;
    }
  }, [activePreset, props]);

  // ── Handlers ──
  const pickPreset = (key: PresetKey) => {
    setActivePreset(key);
    setLoadedFromSaved(null);
  };

  const resetToPicker = () => {
    setActivePreset(null);
    setLoadedFromSaved(null);
  };

  const handleSave = async () => {
    if (!saveName.trim() || !activePreset) return;
    try {
      await saveMutation.mutateAsync({
        scope: "scrum",
        name: saveName.trim(),
        preset_key: activePreset,
        config: {},
      });
      toast.success(`Vista "${saveName.trim()}" guardada`);
      setSaveDialogOpen(false);
      setSaveName("");
      setLoadedFromSaved(saveName.trim());
    } catch (e: any) {
      toast.error(e.message || "Error guardando vista");
    }
  };

  const setAsDefault = async () => {
    if (!activePreset) return;
    try {
      // Si la vista actual viene de una saved, togglear ese pin
      const existing = savedViews.find(v => v.preset_key === activePreset);
      if (existing) {
        // Desanclar la pinned actual si es otra
        if (pinnedView && pinnedView.id !== existing.id) {
          await togglePinMutation.mutateAsync({ id: pinnedView.id, pinned: false });
        }
        await togglePinMutation.mutateAsync({ id: existing.id, pinned: !existing.is_pinned });
        toast.success(existing.is_pinned ? "Default removido" : "Marcado como vista predeterminada");
      } else {
        // Crear y pinnear automáticamente
        const presetTitle = currentPreset?.title || activePreset;
        if (pinnedView) {
          await togglePinMutation.mutateAsync({ id: pinnedView.id, pinned: false });
        }
        const created = await saveMutation.mutateAsync({
          scope: "scrum",
          name: presetTitle,
          preset_key: activePreset,
          config: {},
        });
        if (created?.id) {
          await togglePinMutation.mutateAsync({ id: created.id, pinned: true });
        }
        toast.success(`"${presetTitle}" es ahora tu vista predeterminada`);
      }
    } catch (e: any) {
      toast.error(e.message || "Error fijando default");
    }
  };

  const loadSaved = (view: { id: string; name: string; preset_key: string }) => {
    setActivePreset(view.preset_key as PresetKey);
    setLoadedFromSaved(view.name);
  };

  // ─── Render: picker ──
  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Buenos días";
    if (h < 19) return "Buenas tardes";
    return "Buenas noches";
  })();
  const firstName = (auth.profile?.full_name || auth.profile?.email || "").split(" ")[0].split("@")[0];
  const featured = pinnedView ? PRESETS.find(p => p.key === pinnedView.preset_key) : null;

  if (!activePreset) {
    return (
      <div className="space-y-7">
        {/* Hero compacto — saludo + stats inline (sin card grande) */}
        <div className="flex items-end justify-between gap-4 flex-wrap pt-2">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground font-bold">Equipo Scrum</p>
            <h1 className="text-2xl md:text-3xl font-black leading-tight mt-1">
              {greeting}{firstName ? `, ${firstName}` : ""}.
            </h1>
            <p className="text-sm text-muted-foreground mt-1">¿Qué querés ver hoy?</p>
          </div>
          {props.kpis && (
            <div className="flex items-center gap-4 text-right">
              <InlineStat value={props.kpis.total} label="items" />
              <div className="h-8 w-px bg-border" />
              <InlineStat value={props.kpis.activeSprints} label="sprints activos" tone="text-primary" />
              {props.kpis.noEstimate > 0 && (
                <>
                  <div className="h-8 w-px bg-border" />
                  <InlineStat value={props.kpis.noEstimate} label="sin estimar" tone="text-warning" />
                </>
              )}
            </div>
          )}
        </div>

        {/* Featured card — solo si hay pinned */}
        {featured && pinnedView && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            whileHover={{ y: -2 }}
            onClick={() => loadSaved(pinnedView)}
            className={cn(
              "group relative w-full overflow-hidden rounded-3xl border-2 text-left",
              "bg-gradient-to-br from-card via-card to-muted/20 hover:shadow-2xl transition-all",
              "border-primary/40 hover:border-primary"
            )}
          >
            <div className={cn(
              "absolute inset-0 opacity-30 group-hover:opacity-60 transition-opacity bg-gradient-to-br",
              featured.gradient
            )} />
            <div className="relative p-6 flex items-center gap-5 flex-wrap">
              <div className={cn(
                "h-16 w-16 rounded-2xl flex items-center justify-center shrink-0 border-2",
                featured.tone, "shadow-lg"
              )}>
                <featured.Icon className="h-7 w-7" />
              </div>
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2 mb-1">
                  <Badge className="bg-primary text-primary-foreground text-[10px] gap-1 h-5 px-2">
                    <Pin className="h-2.5 w-2.5" /> Tu vista predeterminada
                  </Badge>
                </div>
                <p className="text-lg font-black">{pinnedView.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{featured.description}</p>
              </div>
              <div className="flex items-center gap-2 ml-auto">
                <span className="text-xs text-muted-foreground hidden md:inline">Abrir</span>
                <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
            </div>
          </motion.button>
        )}

        {/* Vistas guardadas (excluye la pinned que ya aparece como hero featured arriba) */}
        {savedViews.filter(v => !v.is_pinned).length > 0 && (
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground mb-2.5">Otras vistas guardadas</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {savedViews.filter(v => !v.is_pinned).map(v => {
                const p = PRESETS.find(pp => pp.key === v.preset_key);
                const Icon = p?.Icon ?? Star;
                return (
                  <div key={v.id} className="group relative">
                    <button
                      onClick={() => loadSaved(v)}
                      className="w-full text-left flex items-center gap-2 p-2.5 rounded-lg border border-border bg-card hover:border-primary/40 transition-colors"
                    >
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 border", p?.tone || "")}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-sm font-semibold truncate">{v.name}</p>
                          {v.is_pinned && (
                            <Badge variant="outline" className="text-[9px] h-4 gap-0.5 bg-primary/10 text-primary border-primary/30">
                              <Pin className="h-2.5 w-2.5" /> Default
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">{p?.title ?? v.preset_key}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                    <div className="absolute top-1.5 right-8 hidden group-hover:flex items-center gap-0.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePinMutation.mutate({ id: v.id, pinned: !v.is_pinned }); }}
                        className="h-6 w-6 rounded hover:bg-muted/60 flex items-center justify-center"
                        title={v.is_pinned ? "Quitar default" : "Marcar como default"}
                      >
                        {v.is_pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); if (confirm(`Borrar "${v.name}"?`)) deleteMutation.mutate(v.id); }}
                        className="h-6 w-6 rounded hover:bg-destructive/20 text-destructive flex items-center justify-center"
                        title="Borrar"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Presets */}
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
                    onClick={() => pickPreset(p.key)}
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
        <Button size="sm" variant="ghost" onClick={resetToPicker} className="h-7 gap-1 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" /> Cambiar vista
        </Button>
        {currentPreset && (
          <>
            <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center border shrink-0", currentPreset.tone)}>
              <currentPreset.Icon className="h-3.5 w-3.5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold truncate">{loadedFromSaved || currentPreset.title}</p>
              {loadedFromSaved && (
                <p className="text-[10px] text-muted-foreground truncate">{currentPreset.title}</p>
              )}
            </div>
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant={isCurrentPinned ? "default" : "outline"}
            onClick={setAsDefault}
            className="h-7 gap-1 text-xs"
            disabled={togglePinMutation.isPending || saveMutation.isPending}
          >
            {isCurrentPinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
            {isCurrentPinned ? "Default activo" : "Fijar como default"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => { setSaveName(loadedFromSaved || currentPreset?.title || ""); setSaveDialogOpen(true); }}
            className="h-7 gap-1 text-xs"
          >
            <BookmarkPlus className="h-3.5 w-3.5" /> Guardar
          </Button>
        </div>
      </div>
      {renderPreset}

      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Guardar vista</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Ej: Mi tablero del lunes"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              Si ya existe una vista con este nombre, se actualiza.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
