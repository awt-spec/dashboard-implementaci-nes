import { useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowRight, Activity, Flame, ShieldAlert, Building2, Brain, Sparkles,
  BookmarkPlus, Pin, PinOff, Trash2, ChevronRight, Loader2, LayoutDashboard,
  ArrowLeft, Star,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { SupportPanoramaPanel } from "./SupportPanoramaPanel";
import { SupportChartBuilder } from "./SupportChartBuilder";
import { SupportClientHeatmap } from "./SupportClientHeatmap";
import { ClientStrategyPanel } from "./ClientStrategyPanel";
import { SupportCaseTable } from "./SupportCaseTable";
import { SupportMinutas } from "./SupportMinutas";
import { SupportGlobalHeatmap } from "./SupportGlobalHeatmap";
import { FileText, Ticket as TicketIcon, Grid3x3 } from "lucide-react";
import { motion } from "framer-motion";
import type { SupportTicket } from "@/hooks/useSupportTickets";
import { useSavedViews, useSaveView, useDeleteView, useTogglePinView } from "@/hooks/useSavedViews";
import { isTicketClosed } from "@/lib/ticketStatus";

// ─── Presets ─────────────────────────────────────────────────────────────

type PresetKey =
  | "resumen"
  | "tabla_casos"
  | "minutas"
  | "criticos"
  | "sla_riesgo"
  | "por_cliente"
  | "actividad_ia"
  | "ia_clasificacion"
  | "heatmap_global";

interface Preset {
  key: PresetKey;
  title: string;
  description: string;
  Icon: typeof Activity;
  tone: string;
  /** Gradient para el card visual. Formato Tailwind: "from-X to-Y". */
  gradient: string;
  /** Color del icono y border. */
  accent: string;
  category: "operativo" | "estrategico" | "analisis" | "ia";
  needsClient?: boolean;
}

const PRESETS: Preset[] = [
  // ── OPERATIVO ──
  {
    key: "tabla_casos",
    title: "Tabla de casos",
    description: "Todos los casos con filtros, búsqueda y edición inline.",
    Icon: TicketIcon,
    tone: "bg-sky-500/10 text-sky-500 border-sky-500/30",
    gradient: "from-sky-500/10 via-sky-500/5 to-transparent",
    accent: "text-sky-500 ring-sky-500/30",
    category: "operativo",
  },
  {
    key: "minutas",
    title: "Minutas",
    description: "Generar con IA, compartir con cliente y ver feedback.",
    Icon: FileText,
    tone: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
    gradient: "from-emerald-500/10 via-emerald-500/5 to-transparent",
    accent: "text-emerald-500 ring-emerald-500/30",
    category: "operativo",
  },
  // ── ESTRATÉGICO ──
  {
    key: "resumen",
    title: "Resumen ejecutivo",
    description: "SLA, acciones recomendadas y distribuciones.",
    Icon: LayoutDashboard,
    tone: "bg-primary/10 text-primary border-primary/30",
    gradient: "from-primary/10 via-primary/5 to-transparent",
    accent: "text-primary ring-primary/30",
    category: "estrategico",
  },
  {
    key: "criticos",
    title: "Casos críticos",
    description: "Solo prioridad Crítica abiertos, con acciones.",
    Icon: Flame,
    tone: "bg-destructive/10 text-destructive border-destructive/30",
    gradient: "from-destructive/10 via-destructive/5 to-transparent",
    accent: "text-destructive ring-destructive/30",
    category: "estrategico",
  },
  {
    key: "sla_riesgo",
    title: "SLA en riesgo",
    description: "Casos con ≥70% del SLA consumido o vencidos.",
    Icon: ShieldAlert,
    tone: "bg-warning/10 text-warning border-warning/30",
    gradient: "from-warning/10 via-warning/5 to-transparent",
    accent: "text-warning ring-warning/30",
    category: "estrategico",
  },
  // ── ANÁLISIS ──
  {
    key: "heatmap_global",
    title: "Mapa de calor",
    description: "Matriz cliente × prioridad/estado/edad/producto, en vivo.",
    Icon: Grid3x3,
    tone: "bg-rose-500/10 text-rose-500 border-rose-500/30",
    gradient: "from-rose-500/10 via-rose-500/5 to-transparent",
    accent: "text-rose-500 ring-rose-500/30",
    category: "analisis",
  },
  {
    key: "por_cliente",
    title: "Análisis por cliente",
    description: "SLA + mapa de calor del cliente elegido.",
    Icon: Building2,
    tone: "bg-info/10 text-info border-info/30",
    gradient: "from-info/10 via-info/5 to-transparent",
    accent: "text-info ring-info/30",
    category: "analisis",
    needsClient: true,
  },
  {
    key: "ia_clasificacion",
    title: "Distribuciones globales",
    description: "Gráficos de prioridad, estado, producto y tipo.",
    Icon: Brain,
    tone: "bg-muted text-foreground border-border",
    gradient: "from-muted/40 via-muted/20 to-transparent",
    accent: "text-foreground ring-border",
    category: "analisis",
  },
  // ── IA ──
  {
    key: "actividad_ia",
    title: "Estrategia IA",
    description: "Análisis IA con acciones, riesgos y upsells.",
    Icon: Sparkles,
    tone: "bg-violet-500/10 text-violet-400 border-violet-500/30",
    gradient: "from-violet-500/10 via-violet-500/5 to-transparent",
    accent: "text-violet-400 ring-violet-500/30",
    category: "ia",
    needsClient: true,
  },
];

const CATEGORY_LABELS: Record<Preset["category"], string> = {
  operativo: "Operativo · día a día",
  estrategico: "Estratégico · prioridades",
  analisis: "Análisis · datos",
  ia: "IA · automatización",
};

// ─── Props ───────────────────────────────────────────────────────────────

interface Props {
  tickets: SupportTicket[];
  ticketsWithClientName: SupportTicket[];
  allTickets: SupportTicket[];
  clients: Array<{ id: string; name: string; nivel_servicio?: string; team_assigned?: any }>;
  selectedClient: string;
  selectedClientName: string;
  selectedClientObj?: any;
  isClientView: boolean;
  initialClientId?: string;
  onOpenTicket?: (t: SupportTicket) => void;
  /** Required para la preset de minutas y tabla (misma lista ya filtrada). */
  scopedTickets?: SupportTicket[];
}

// ─── Componente principal ────────────────────────────────────────────────

export function InsightsGuidedView(props: Props) {
  const {
    tickets, ticketsWithClientName, allTickets, clients, selectedClient, selectedClientName,
    selectedClientObj, isClientView, initialClientId, onOpenTicket,
    scopedTickets = tickets,
  } = props;

  const [activePreset, setActivePreset] = useState<PresetKey | null>(null);
  const [selectedClientLocal, setSelectedClientLocal] = useState<string>(
    isClientView && initialClientId ? initialClientId : (selectedClient !== "all" ? selectedClient : "")
  );
  const [loadedFromSaved, setLoadedFromSaved] = useState<string | null>(null);

  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveName, setSaveName] = useState("");

  const { data: savedViews = [], isLoading: loadingSaved } = useSavedViews("insights");
  const saveMutation = useSaveView();
  const deleteMutation = useDeleteView();
  const togglePinMutation = useTogglePinView();

  const currentPreset = PRESETS.find(p => p.key === activePreset);
  const clientIdForView = activePreset === "por_cliente" || activePreset === "actividad_ia"
    ? selectedClientLocal
    : (isClientView ? initialClientId : selectedClient !== "all" ? selectedClient : "");

  const clientNameForView = useMemo(() => {
    const id = clientIdForView;
    return clients.find(c => c.id === id)?.name || selectedClientName || "";
  }, [clientIdForView, clients, selectedClientName]);

  // Filtros según preset
  const filteredTickets = useMemo(() => {
    if (!activePreset) return tickets;
    if (activePreset === "criticos") return tickets.filter(t => /critica/i.test(t.prioridad || "") && !isTicketClosed(t.estado));
    if (activePreset === "por_cliente" || activePreset === "actividad_ia") {
      if (!selectedClientLocal) return [];
      return tickets.filter(t => t.client_id === selectedClientLocal);
    }
    return tickets;
  }, [activePreset, tickets, selectedClientLocal]);

  // ── Handlers ──
  const pickPreset = (key: PresetKey) => {
    setActivePreset(key);
    setLoadedFromSaved(null);
  };

  const resetWizard = () => {
    setActivePreset(null);
    setLoadedFromSaved(null);
  };

  const loadSaved = (view: { id: string; name: string; preset_key: string; config: any }) => {
    setActivePreset(view.preset_key as PresetKey);
    if (view.config?.client_id) setSelectedClientLocal(view.config.client_id);
    setLoadedFromSaved(view.name);
  };

  const handleSave = async () => {
    if (!saveName.trim()) { toast.error("Ponele un nombre"); return; }
    if (!activePreset) return;
    try {
      await saveMutation.mutateAsync({
        scope: "insights",
        name: saveName.trim(),
        preset_key: activePreset,
        config: currentPreset?.needsClient ? { client_id: selectedClientLocal } : {},
      });
      toast.success(`Vista "${saveName.trim()}" guardada`);
      setSaveDialogOpen(false);
      setSaveName("");
      setLoadedFromSaved(saveName.trim());
    } catch (e: any) {
      toast.error(e.message || "Error guardando vista");
    }
  };

  // ─── Render: picker inicial ───────────────────────────────────
  if (!activePreset) {
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Star className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-bold">¿Qué querés ver hoy?</h3>
            <p className="text-xs text-muted-foreground">
              Elegí un preset para armar una vista compuesta. Guardá la que uses seguido para abrirla en un click.
            </p>
          </div>
        </div>

        {/* Vistas guardadas */}
        {loadingSaved ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" /> Cargando tus vistas…
          </div>
        ) : savedViews.length > 0 ? (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Mis vistas</p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {savedViews.map(v => {
                const p = PRESETS.find(pp => pp.key === v.preset_key);
                const Icon = p?.Icon ?? Activity;
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
                          {v.is_pinned && <Pin className="h-3 w-3 text-primary fill-current" />}
                        </div>
                        <p className="text-[10px] text-muted-foreground truncate">{p?.title ?? v.preset_key}</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    </button>
                    <div className="absolute top-1.5 right-8 hidden group-hover:flex items-center gap-0.5">
                      <button
                        onClick={(e) => { e.stopPropagation(); togglePinMutation.mutate({ id: v.id, pinned: !v.is_pinned }); }}
                        className="h-6 w-6 rounded hover:bg-muted/60 flex items-center justify-center"
                        title={v.is_pinned ? "Desanclar" : "Anclar"}
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
        ) : null}

        {/* Presets agrupados por categoría — visualmente más punzante */}
        <div className="space-y-5">
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
                        p.accent.split(" ").pop(), // ring-color clase
                      )}
                    >
                      {/* Gradient background */}
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
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <p className="text-sm font-bold">{p.title}</p>
                            {p.needsClient && (
                              <Badge variant="outline" className="text-[9px] h-4 px-1.5">Por cliente</Badge>
                            )}
                          </div>
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
      </div>
    );
  }

  // ─── Render: vista compuesta ───────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Breadcrumb + controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="ghost" onClick={resetWizard} className="h-7 gap-1 text-xs">
          <ArrowLeft className="h-3.5 w-3.5" /> Cambiar vista
        </Button>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {currentPreset && (
            <>
              <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center border shrink-0", currentPreset.tone)}>
                <currentPreset.Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold truncate">
                  {loadedFromSaved || currentPreset.title}
                </p>
                {loadedFromSaved && (
                  <p className="text-[10px] text-muted-foreground truncate">{currentPreset.title}</p>
                )}
              </div>
            </>
          )}
        </div>

        {currentPreset?.needsClient && (
          <Select value={selectedClientLocal} onValueChange={setSelectedClientLocal}>
            <SelectTrigger className="h-7 w-[200px] text-xs">
              <SelectValue placeholder="Selecciona cliente…" />
            </SelectTrigger>
            <SelectContent>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        <Button
          size="sm"
          variant="outline"
          onClick={() => { setSaveName(loadedFromSaved || currentPreset?.title || ""); setSaveDialogOpen(true); }}
          className="h-7 gap-1 text-xs"
        >
          <BookmarkPlus className="h-3.5 w-3.5" /> Guardar vista
        </Button>
      </div>

      {/* Cliente requerido pero no seleccionado */}
      {currentPreset?.needsClient && !selectedClientLocal ? (
        <Card>
          <CardContent className="py-10 text-center space-y-2">
            <Building2 className="h-8 w-8 text-muted-foreground mx-auto" />
            <p className="text-sm font-semibold">Seleccioná un cliente</p>
            <p className="text-[11px] text-muted-foreground">
              Este preset requiere scope por cliente para armar la vista.
            </p>
          </CardContent>
        </Card>
      ) : (
        <PresetContent
          preset={activePreset}
          tickets={filteredTickets}
          ticketsWithClientName={ticketsWithClientName}
          allTickets={allTickets}
          clients={clients}
          scopedTickets={scopedTickets}
          clientId={clientIdForView || ""}
          clientName={clientNameForView}
          selectedClientObj={selectedClientObj}
          isClientView={isClientView}
          onOpenTicket={onOpenTicket}
        />
      )}

      {/* Save dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Guardar vista</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Ej: SLA en riesgo lunes"
              autoFocus
            />
            <p className="text-[11px] text-muted-foreground">
              Si ya existe una vista con este nombre, se actualiza.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Guardando…" : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Render de contenido por preset ─────────────────────────────

function PresetContent({
  preset, tickets, ticketsWithClientName, allTickets, clients, scopedTickets,
  clientId, clientName, selectedClientObj, onOpenTicket,
}: {
  preset: PresetKey;
  tickets: SupportTicket[];
  ticketsWithClientName: SupportTicket[];
  allTickets: SupportTicket[];
  clients: Array<{ id: string; name: string; nivel_servicio?: string; team_assigned?: any }>;
  scopedTickets: SupportTicket[];
  clientId: string;
  clientName: string;
  selectedClientObj?: any;
  isClientView: boolean;
  onOpenTicket?: (t: SupportTicket) => void;
}) {
  if (preset === "resumen") {
    return (
      <div className="space-y-4">
        <SupportPanoramaPanel
          tickets={scopedTickets}
          clientName={clientName || undefined}
          onOpenTicket={onOpenTicket}
        />
        <SupportChartBuilder tickets={ticketsWithClientName} />
      </div>
    );
  }

  if (preset === "tabla_casos") {
    // SupportCaseTable espera clientName como función (id → nombre),
    // no como string. Construimos el lookup desde clients.
    const clientNameFn = (id: string) => clients.find(c => c.id === id)?.name || id;
    return (
      <SupportCaseTable
        tickets={scopedTickets}
        clientName={clientNameFn}
        teamMembers={selectedClientObj?.team_assigned || []}
      />
    );
  }

  if (preset === "minutas") {
    return (
      <SupportMinutas
        tickets={scopedTickets}
        clientName={clientName || "Soporte General"}
        clientId={clientId || "all"}
        teamMembers={selectedClientObj?.team_assigned || []}
        availableClients={clients.map(c => ({ id: c.id, name: c.name }))}
        allTickets={allTickets}
      />
    );
  }

  if (preset === "criticos") {
    const critical = scopedTickets.filter(t => /critica/i.test(t.prioridad || "") && !isTicketClosed(t.estado));
    return (
      <SupportPanoramaPanel
        tickets={critical}
        clientName={clientName || undefined}
        onOpenTicket={onOpenTicket}
      />
    );
  }

  if (preset === "sla_riesgo") {
    const slaRisky = scopedTickets.filter(t => !isTicketClosed(t.estado));
    return (
      <SupportPanoramaPanel
        tickets={slaRisky}
        clientName={clientName || undefined}
        onOpenTicket={onOpenTicket}
      />
    );
  }

  if (preset === "por_cliente") {
    return (
      <div className="space-y-4">
        <SupportPanoramaPanel
          tickets={tickets}
          clientName={clientName}
          onOpenTicket={onOpenTicket}
        />
        <SupportClientHeatmap tickets={tickets} clientName={clientName} />
      </div>
    );
  }

  if (preset === "actividad_ia" && clientId) {
    return (
      <ClientStrategyPanel
        clientId={clientId}
        clientName={clientName}
        canEdit={true}
      />
    );
  }

  if (preset === "ia_clasificacion") {
    return <SupportChartBuilder tickets={ticketsWithClientName} />;
  }

  if (preset === "heatmap_global") {
    return (
      <SupportGlobalHeatmap
        tickets={scopedTickets}
        clients={clients}
        onOpenTicket={onOpenTicket}
      />
    );
  }

  return null;
}
