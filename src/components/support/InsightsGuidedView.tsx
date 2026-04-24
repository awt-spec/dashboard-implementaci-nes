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
import { SupportScrumPanel } from "./SupportScrumPanel";
import { SupportCaseTable } from "./SupportCaseTable";
import { SupportMinutas } from "./SupportMinutas";
import { FileText, Ticket as TicketIcon } from "lucide-react";
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
  | "ia_clasificacion";

interface Preset {
  key: PresetKey;
  title: string;
  description: string;
  Icon: typeof Activity;
  tone: string;
  needsClient?: boolean;
}

const PRESETS: Preset[] = [
  {
    key: "resumen",
    title: "Resumen ejecutivo",
    description: "SLA, acciones recomendadas y distribuciones en una sola vista.",
    Icon: LayoutDashboard,
    tone: "bg-primary/10 text-primary border-primary/30",
  },
  {
    key: "tabla_casos",
    title: "Tabla de casos",
    description: "Todos los casos con filtros, búsqueda y edición inline.",
    Icon: TicketIcon,
    tone: "bg-sky-500/10 text-sky-500 border-sky-500/30",
  },
  {
    key: "minutas",
    title: "Minutas",
    description: "Generar minutas con IA, compartir con cliente y ver feedback.",
    Icon: FileText,
    tone: "bg-emerald-500/10 text-emerald-500 border-emerald-500/30",
  },
  {
    key: "criticos",
    title: "Casos críticos ahora",
    description: "Solo prioridad Crítica abiertos, con acciones priorizadas.",
    Icon: Flame,
    tone: "bg-destructive/10 text-destructive border-destructive/30",
  },
  {
    key: "sla_riesgo",
    title: "SLA en riesgo",
    description: "Casos con ≥70% del SLA consumido o vencidos.",
    Icon: ShieldAlert,
    tone: "bg-warning/10 text-warning border-warning/30",
  },
  {
    key: "por_cliente",
    title: "Análisis por cliente",
    description: "SLA + mapa de calor del cliente seleccionado.",
    Icon: Building2,
    tone: "bg-info/10 text-info border-info/30",
    needsClient: true,
  },
  {
    key: "actividad_ia",
    title: "Estrategia IA por cliente",
    description: "Análisis IA con acciones, riesgos y upsells detectados.",
    Icon: Sparkles,
    tone: "bg-violet-500/10 text-violet-400 border-violet-500/30",
    needsClient: true,
  },
  {
    key: "ia_clasificacion",
    title: "Distribuciones globales",
    description: "Gráficos de prioridad, estado, producto y tipo.",
    Icon: Brain,
    tone: "bg-muted text-foreground border-border",
  },
];

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

        {/* Presets */}
        <div>
          {savedViews.length > 0 && (
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 mt-4">Presets disponibles</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => pickPreset(p.key)}
                className="group text-left rounded-xl border border-border bg-card p-3 hover:border-primary/40 hover:bg-muted/20 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0 border", p.tone)}>
                    <p.Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <p className="text-sm font-bold">{p.title}</p>
                      {p.needsClient && (
                        <Badge variant="outline" className="text-[9px] h-4">Por cliente</Badge>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5 line-clamp-2">{p.description}</p>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0 mt-1" />
                </div>
              </button>
            ))}
          </div>
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
  clientId, clientName, selectedClientObj, isClientView, onOpenTicket,
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
    return (
      <SupportCaseTable
        tickets={scopedTickets}
        clientName={clientName || (isClientView ? (selectedClientObj?.name || "") : "Todos los clientes")}
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

  return null;
}
