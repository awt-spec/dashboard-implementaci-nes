import { useState, useMemo, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle, Search, Ticket, Clock, CheckCircle2,
  Flame, Activity, Filter, Brain, Loader2, Sparkles, RefreshCw,
  ArrowLeft, Building2, MapPin, Mail, User, FileText, ArrowRightLeft, UserX
} from "lucide-react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, AreaChart, Area
} from "recharts";
import { useSupportClients, useAllSupportTickets, type SupportTicket } from "@/hooks/useSupportTickets";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { SupportChartBuilder } from "./SupportChartBuilder";
import { SupportPanoramaPanel } from "./SupportPanoramaPanel";
import { InsightsGuidedView } from "./InsightsGuidedView";
import { SupportCaseTable } from "./SupportCaseTable";
import { SupportClientHeatmap } from "./SupportClientHeatmap";
import { SupportDataLoader } from "./SupportDataLoader";
import { SupportMinutas } from "./SupportMinutas";
import { SupportAgreementsTab } from "./SupportAgreementsTab";
import { ContractsSLATab } from "@/components/clients/ContractsSLATab";
import { SupportScrumPanel } from "./SupportScrumPanel";
import { ClientStrategyPanel } from "./ClientStrategyPanel";
import { DevOpsPanel } from "./DevOpsPanel";
import { NewTicketForm } from "./NewTicketForm";
import { SupportInbox } from "./SupportInbox";
import { ExportTicketsMenu } from "./ExportTicketsMenu";
import { Plus, Inbox, Settings, BarChart3, Database, Briefcase } from "lucide-react";
import { ActivePolicyBar } from "@/components/policy/ActivePolicyBar";

const prioridadColors: Record<string, string> = {
  "Critica, Impacto Negocio": "bg-red-600 text-white",
  "Alta": "bg-destructive text-destructive-foreground",
  "Media": "bg-warning text-warning-foreground",
  "Baja": "bg-muted text-muted-foreground",
};

const estadoColors: Record<string, string> = {
  "EN ATENCIÓN": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "ENTREGADA": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "PENDIENTE": "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "POR CERRAR": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "CERRADA": "bg-green-500/20 text-green-400 border-green-500/30",
  "ANULADA": "bg-gray-500/20 text-gray-400 border-gray-500/30",
  "COTIZADA": "bg-violet-500/20 text-violet-400 border-violet-500/30",
  "APROBADA": "bg-indigo-500/20 text-indigo-400 border-indigo-500/30",
  "ON HOLD": "bg-slate-500/20 text-slate-400 border-slate-500/30",
  "VALORACIÓN": "bg-pink-500/20 text-pink-400 border-pink-500/30",
};

const aiRiskColors: Record<string, string> = {
  critical: "bg-red-600/20 text-red-400 border-red-600/40",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/40",
  medium: "bg-yellow-500/20 text-yellow-400 border-yellow-500/40",
  low: "bg-green-500/20 text-green-400 border-green-500/40",
};

const aiRiskLabels: Record<string, string> = {
  critical: "Crítico", high: "Alto", medium: "Medio", low: "Bajo",
};

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--warning))", "hsl(220,70%,55%)", "hsl(150,60%,50%)", "hsl(280,60%,60%)", "hsl(30,80%,55%)"];

function heatBg(value: number, max: number, baseR: number, baseG: number, baseB: number) {
  if (value === 0) return undefined;
  const intensity = Math.min(1, value / Math.max(1, max));
  const alpha = 0.15 + intensity * 0.65;
  return { background: `rgba(${baseR},${baseG},${baseB},${alpha})`, color: intensity > 0.5 ? "white" : undefined };
}

interface SupportDashboardProps {
  initialClientId?: string;
  onBack?: () => void;
}

export function SupportDashboard({ initialClientId, onBack }: SupportDashboardProps) {
  const { data: clients = [] } = useSupportClients();
  const { data: allTickets = [], isLoading, refetch } = useAllSupportTickets();
  const [selectedClient, setSelectedClient] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [prioridadFilter, setPrioridadFilter] = useState<string>("all");
  const [classifying, setClassifying] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferring, setTransferring] = useState(false);
  const [newTicketOpen, setNewTicketOpen] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("inbox");

  const isClientView = !!initialClientId;


  const tickets = useMemo(() => {
    let t = allTickets;
    // In client view, ALWAYS scope to this client
    if (isClientView) {
      t = t.filter(tk => tk.client_id === initialClientId);
    } else if (selectedClient !== "all") {
      t = t.filter(tk => tk.client_id === selectedClient);
    }
    if (prioridadFilter !== "all") t = t.filter(tk => tk.prioridad === prioridadFilter);
    if (search) t = t.filter(tk => tk.asunto.toLowerCase().includes(search.toLowerCase()) || tk.ticket_id.toLowerCase().includes(search.toLowerCase()));
    return t;
  }, [allTickets, selectedClient, prioridadFilter, search, isClientView, initialClientId]);

  // Scoped tickets: respect both initialClientId AND selectedClient dropdown
  const scopedTickets = useMemo(() => {
    if (isClientView) return allTickets.filter(t => t.client_id === initialClientId);
    if (selectedClient !== "all") return allTickets.filter(t => t.client_id === selectedClient);
    return allTickets;
  }, [allTickets, initialClientId, isClientView, selectedClient]);

  const activeTickets = useMemo(() => scopedTickets.filter(t => !["CERRADA", "ANULADA"].includes(t.estado)), [scopedTickets]);
  const filteredActive = useMemo(() => tickets.filter(t => !["CERRADA", "ANULADA"].includes(t.estado)), [tickets]);

  // Stats - always scoped to scopedTickets (which respects client selection)
  const totalActive = activeTickets.length;
  const sinAtencion = activeTickets.filter(t => t.estado === "PENDIENTE" && !t.responsable).length;
  const entregadaSinCierre = activeTickets.filter(t => t.estado === "ENTREGADA").length;
  const mayores365 = activeTickets.filter(t => t.dias_antiguedad > 365).length;
  const criticos = activeTickets.filter(t => t.prioridad === "Critica, Impacto Negocio").length;
  const cerradas = scopedTickets.filter(t => ["CERRADA", "ANULADA"].includes(t.estado)).length;
  const classifiedCount = scopedTickets.filter(t => t.ai_classification).length;
  const sinCausaRaiz = scopedTickets.filter(t => !t.ai_classification).length;

  // Top causas raíz (categorías detectadas por IA)
  const topCausasRaiz = useMemo(() => {
    const counts: Record<string, number> = {};
    scopedTickets.forEach(t => {
      if (!t.ai_classification) return;
      counts[t.ai_classification] = (counts[t.ai_classification] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [scopedTickets]);

  // Charts data — fallback to all tickets when no active ones exist
  const chartTickets = useMemo(() => filteredActive.length > 0 ? filteredActive : tickets, [filteredActive, tickets]);
  const showingAllInCharts = filteredActive.length === 0 && tickets.length > 0;

  const estadoData = useMemo(() => {
    const counts: Record<string, number> = {};
    chartTickets.forEach(t => { counts[t.estado] = (counts[t.estado] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [chartTickets]);

  const prioridadData = useMemo(() => {
    const counts: Record<string, number> = {};
    chartTickets.forEach(t => { counts[t.prioridad] = (counts[t.prioridad] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [chartTickets]);

  const tipoData = useMemo(() => {
    const counts: Record<string, number> = {};
    chartTickets.forEach(t => { counts[t.tipo] = (counts[t.tipo] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [chartTickets]);

  const agingData = useMemo(() => {
    const ranges = [
      { name: "0-30d", min: 0, max: 30 },
      { name: "31-90d", min: 31, max: 90 },
      { name: "91-180d", min: 91, max: 180 },
      { name: "181-365d", min: 181, max: 365 },
      { name: ">365d", min: 366, max: 99999 },
    ];
    return ranges.map(r => ({
      name: r.name,
      value: chartTickets.filter(t => t.dias_antiguedad >= r.min && t.dias_antiguedad <= r.max).length,
    }));
  }, [chartTickets]);

  // Heat map data for general view
  const heatMapData = useMemo(() => {
    if (isClientView) return [];
    const allActiveTickets = allTickets.filter(t => !["CERRADA", "ANULADA"].includes(t.estado));
    return clients.map(c => {
      const ct = allActiveTickets.filter(t => t.client_id === c.id);
      const total = allTickets.filter(t => t.client_id === c.id).length;
      return {
        id: c.id, name: c.name, total, activos: ct.length,
        critica: ct.filter(t => t.prioridad === "Critica, Impacto Negocio").length,
        alta: ct.filter(t => t.prioridad === "Alta").length,
        media: ct.filter(t => t.prioridad === "Media").length,
        baja: ct.filter(t => t.prioridad === "Baja").length,
        enAtencion: ct.filter(t => t.estado === "EN ATENCIÓN").length,
        entregada: ct.filter(t => t.estado === "ENTREGADA").length,
        pendiente: ct.filter(t => t.estado === "PENDIENTE").length,
        maxDias: Math.max(0, ...ct.map(t => t.dias_antiguedad)),
        avgDias: ct.length > 0 ? Math.round(ct.reduce((s, t) => s + t.dias_antiguedad, 0) / ct.length) : 0,
      };
    }).sort((a, b) => b.activos - a.activos);
  }, [clients, allTickets, isClientView]);

  const aiClassData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredActive.filter(t => t.ai_classification).forEach(t => {
      counts[t.ai_classification!] = (counts[t.ai_classification!] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredActive]);

  const topCritical = useMemo(() => {
    return [...chartTickets]
      .sort((a, b) => {
        const prio = (p: string) => p === "Critica, Impacto Negocio" ? 0 : p === "Alta" ? 1 : p === "Media" ? 2 : 3;
        const diff = prio(a.prioridad) - prio(b.prioridad);
        return diff !== 0 ? diff : b.dias_antiguedad - a.dias_antiguedad;
      })
      .slice(0, 15);
  }, [chartTickets]);

  const clientName = (id: string) => clients.find(c => c.id === id)?.name || id;

  const ticketsWithClientName = useMemo(() =>
    tickets.map(t => ({ ...t, client_name: clientName(t.client_id) })),
    [tickets, clients]
  );

  const selectedClientObj = clients.find(c => c.id === initialClientId);
  const selectedClientName = selectedClient !== "all" ? clientName(selectedClient) : "";

  const handleClassify = useCallback(async () => {
    setClassifying(true);
    try {
      const ticketIds = isClientView
        ? scopedTickets.filter(t => !t.ai_classification).map(t => t.id)
        : undefined;
      const { data, error } = await supabase.functions.invoke("classify-tickets", {
        body: ticketIds ? { ticketIds } : {},
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success(`${data?.classified || 0} tickets clasificados con IA`);
        refetch();
      }
    } catch (e: any) {
      toast.error(e.message || "Error al clasificar tickets");
    } finally {
      setClassifying(false);
    }
  }, [refetch, isClientView, scopedTickets]);

  const handleTransferToImplementation = useCallback(async () => {
    if (!initialClientId) return;
    setTransferring(true);
    try {
      const { error } = await supabase.from("clients").update({ client_type: "implementacion" } as any).eq("id", initialClientId);
      if (error) throw error;
      toast.success("Cliente transferido a Implementación");
      setTransferOpen(false);
      if (onBack) onBack();
    } catch (e: any) {
      toast.error(e.message || "Error al transferir");
    } finally {
      setTransferring(false);
    }
  }, [initialClientId, onBack]);

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  const maxCrit = Math.max(1, ...heatMapData.map(r => r.critica));
  const maxAlta = Math.max(1, ...heatMapData.map(r => r.alta));
  const maxMedia = Math.max(1, ...heatMapData.map(r => r.media));
  const maxActivos = Math.max(1, ...heatMapData.map(r => r.activos));
  const maxEntregada = Math.max(1, ...heatMapData.map(r => r.entregada));
  const maxPendiente = Math.max(1, ...heatMapData.map(r => r.pendiente));

  return (
    <div className="space-y-5">
      {/* Client Header - only in client view */}
      {isClientView && selectedClientObj && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-4">
                {onBack && (
                  <button onClick={onBack} className="p-1.5 rounded-md hover:bg-secondary transition-colors">
                    <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Building2 className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h2 className="text-base font-bold text-foreground">{selectedClientObj.name}</h2>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {selectedClientObj.country}</span>
                    <span className="flex items-center gap-1"><User className="h-3 w-3" /> {selectedClientObj.contact_name}</span>
                    <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {selectedClientObj.contact_email}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Dialog open={transferOpen} onOpenChange={setTransferOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10">
                        <ArrowRightLeft className="h-3.5 w-3.5" /> A Implementación
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Transferir a Implementación</DialogTitle>
                      </DialogHeader>
                      <p className="text-sm text-muted-foreground">
                        ¿Transferir <strong>{selectedClientObj.name}</strong> de Soporte a Implementación?
                      </p>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setTransferOpen(false)}>Cancelar</Button>
                        <Button onClick={handleTransferToImplementation} disabled={transferring} className="gap-1.5">
                          {transferring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRightLeft className="h-3.5 w-3.5" />}
                          Transferir
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Badge className={selectedClientObj.status === "activo" ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"}>
                    {selectedClientObj.status}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* KPI Cards + Filtros — ocultos en Bandeja (que tiene su propio header
          dedicado y se beneficia de menos ruido visual). Visibles en Explorar. */}
      {activeTab !== "inbox" && (
      <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        {[
          { label: "Casos Activos", value: totalActive, icon: Ticket, color: "text-blue-400", iconBg: "bg-primary/10" },
          {
            label: "Sin Atención", value: sinAtencion, icon: UserX,
            color: "text-amber-500",
            iconBg: "bg-amber-500/15",
            highlight: sinAtencion > 0,
            hint: "PENDIENTE sin responsable asignado · click para ir a la Bandeja",
            onClick: () => setActiveTab("inbox"),
          },
          { label: "Entregada S/Cierre", value: entregadaSinCierre, icon: Clock, color: "text-amber-400", iconBg: "bg-primary/10" },
          { label: ">365 Días", value: mayores365, icon: AlertTriangle, color: "text-red-400", iconBg: "bg-primary/10" },
          { label: "Críticos Negocio", value: criticos, icon: Flame, color: "text-rose-500", iconBg: "bg-primary/10" },
          { label: "Cerradas Total", value: cerradas, icon: CheckCircle2, color: "text-emerald-400", iconBg: "bg-primary/10" },
          {
            label: "Con Causa Raíz", value: classifiedCount, icon: Brain,
            color: "text-violet-400", iconBg: "bg-violet-500/10",
            hint: sinCausaRaiz > 0 ? `${classifiedCount} con análisis · ${sinCausaRaiz} sin clasificar` : "Tickets clasificados por IA",
          },
        ].map((kpi, i) => {
          const Wrapper: any = (kpi as any).onClick ? "button" : "div";
          return (
            <motion.div key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
              <Wrapper
                onClick={(kpi as any).onClick}
                className={(kpi as any).onClick ? "w-full text-left" : ""}
                title={(kpi as any).hint}
              >
                <Card className={`border-border/50 transition-all h-full ${
                  (kpi as any).highlight ? "border-amber-500/40 bg-amber-500/[0.04] hover:border-amber-500/60 hover:shadow-md" :
                  (kpi as any).onClick ? "hover:border-primary/40 hover:shadow-sm" : ""
                }`}>
                  <CardContent className="p-3 flex items-center gap-2.5 min-w-0">
                    <div className={`h-9 w-9 rounded-lg ${kpi.iconBg} flex items-center justify-center shrink-0 relative`}>
                      <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                      {(kpi as any).highlight && (
                        <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className={`text-xl font-black tabular-nums truncate ${(kpi as any).highlight ? "text-amber-500" : "text-foreground"}`}>{kpi.value}</p>
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wide leading-tight truncate">{kpi.label}</p>
                    </div>
                  </CardContent>
                </Card>
              </Wrapper>
            </motion.div>
          );
        })}
      </div>

      {/* ════ Mini-banda de TOP CAUSAS RAÍZ — sólo si hay clasificaciones IA ════ */}
      {topCausasRaiz.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/[0.04] via-card to-card">
            <CardContent className="p-3">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 shrink-0">
                  <Brain className="h-3.5 w-3.5 text-violet-400" />
                  <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
                    Top causas raíz
                  </span>
                  <Badge variant="outline" className="text-[9px] h-4 px-1 tabular-nums border-violet-500/30 text-violet-400 bg-violet-500/10">
                    IA
                  </Badge>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap flex-1 min-w-0">
                  {topCausasRaiz.map((c) => {
                    const pct = classifiedCount > 0 ? Math.round((c.count / classifiedCount) * 100) : 0;
                    return (
                      <div
                        key={c.name}
                        className="inline-flex items-center gap-1.5 h-7 px-2 rounded-md border border-violet-500/20 bg-violet-500/[0.06] text-xs"
                        title={`${c.count} de ${classifiedCount} con causa raíz · ${pct}%`}
                      >
                        <span className="font-semibold text-foreground truncate max-w-[120px]">{c.name}</span>
                        <span className="text-violet-400 font-black tabular-nums">{c.count}</span>
                        <span className="text-muted-foreground tabular-nums text-[10px]">· {pct}%</span>
                      </div>
                    );
                  })}
                </div>
                {sinCausaRaiz > 0 && (
                  <Badge
                    variant="outline"
                    className="text-[10px] gap-1 border-amber-500/30 text-amber-500 bg-amber-500/[0.06] shrink-0 tabular-nums"
                    title="Tickets sin clasificación IA — corre 'Clasificar pendientes' para asignarles una causa raíz"
                  >
                    <AlertTriangle className="h-2.5 w-2.5" />
                    {sinCausaRaiz} sin causa raíz
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        {/* Only show client selector in general dashboard mode */}
        {!isClientView && (
          <Select value={selectedClient} onValueChange={setSelectedClient}>
            <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Todos los clientes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los clientes</SelectItem>
              {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        <Select value={prioridadFilter} onValueChange={setPrioridadFilter}>
          <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Prioridad" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas</SelectItem>
            <SelectItem value="Critica, Impacto Negocio">Crítica</SelectItem>
            <SelectItem value="Alta">Alta</SelectItem>
            <SelectItem value="Media">Media</SelectItem>
            <SelectItem value="Baja">Baja</SelectItem>
          </SelectContent>
        </Select>
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input className="pl-8 h-8 text-xs" placeholder="Buscar por ID o asunto..." value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <Badge variant="outline" className="text-xs">{filteredActive.length} activos de {tickets.length} total</Badge>
        <Button
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 text-xs border-violet-500/50 text-violet-400 hover:bg-violet-500/10"
          onClick={handleClassify}
          disabled={classifying}
        >
          {classifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          Clasificar con IA
        </Button>
        <ExportTicketsMenu
          tickets={allTickets}
          clients={clients}
          currentClientId={isClientView ? initialClientId : (selectedClient !== "all" ? selectedClient : undefined)}
        />
        <Button
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={() => setNewTicketOpen(true)}
        >
          <Plus className="h-3.5 w-3.5" />
          Nuevo caso
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-8 w-8 p-0 shrink-0"
          onClick={() => setConfigOpen(true)}
          title="Configuración (Comercial · Datos & Sync)"
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </div>
      </>
      )}

      <NewTicketForm
        open={newTicketOpen}
        onOpenChange={setNewTicketOpen}
        defaultClientId={isClientView ? initialClientId : (selectedClient !== "all" ? selectedClient : undefined)}
        mode="admin"
      />

      {/* Política activa v4.5 — siempre visible en cancha (SLA + checklist) */}
      <ActivePolicyBar
        ruleTypes={["sla", "checklist", "signature"]}
        compact
        title="Política v4.5 aplicada a esta operación"
      />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="inbox" className="gap-1.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
            <Inbox className="h-3.5 w-3.5" /> Bandeja
            {(() => {
              const inboxCount = allTickets.filter(t =>
                ["PENDIENTE", "EN ATENCIÓN"].includes(t.estado) &&
                (!isClientView || t.client_id === initialClientId) &&
                (selectedClient === "all" || t.client_id === selectedClient)
              ).length;
              return inboxCount > 0 ? (
                <Badge variant="outline" className="ml-1 text-[10px] h-4 px-1 tabular-nums">{inboxCount}</Badge>
              ) : null;
            })()}
          </TabsTrigger>
          <TabsTrigger value="explorar" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" /> Explorar
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inbox" className="mt-4">
          <SupportInbox
            clientId={isClientView ? initialClientId : (selectedClient !== "all" ? selectedClient : undefined)}
            onNewTicket={() => setNewTicketOpen(true)}
          />
        </TabsContent>

        {/* ============ 1. OPERACIÓN: KPIs visuales + tabla de casos ============ */}
        {/* ============ EXPLORAR: operación + insights + minutas unificados ============ */}
        <TabsContent value="explorar" className="mt-4">
          <InsightsGuidedView
            tickets={filteredActive}
            ticketsWithClientName={ticketsWithClientName}
            allTickets={allTickets}
            clients={clients}
            selectedClient={selectedClient}
            selectedClientName={selectedClientName}
            selectedClientObj={selectedClientObj}
            isClientView={isClientView}
            initialClientId={initialClientId}
            scopedTickets={scopedTickets}
          />
        </TabsContent>


      </Tabs>

      {/* ============ CONFIGURACIÓN (gear button): Comercial + Datos & Sync ============ */}
      <Sheet open={configOpen} onOpenChange={setConfigOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="flex items-center gap-2">
              <Settings className="h-4 w-4" /> Configuración
            </SheetTitle>
            <SheetDescription className="text-xs">
              Contratos, SLAs, importación de datos y sync con Azure DevOps.
            </SheetDescription>
          </SheetHeader>

          <Tabs defaultValue={(isClientView || selectedClient !== "all") ? "comercial" : "datos"}>
            <TabsList className="h-8 w-full grid grid-cols-2">
              {(isClientView || selectedClient !== "all") && (
                <TabsTrigger value="comercial" className="text-xs h-6 gap-1"><Briefcase className="h-3 w-3" /> Comercial</TabsTrigger>
              )}
              {!isClientView && (
                <TabsTrigger value="datos" className="text-xs h-6 gap-1"><Database className="h-3 w-3" /> Datos & Sync</TabsTrigger>
              )}
            </TabsList>

            {/* Comercial */}
            {(isClientView || selectedClient !== "all") && (
              <TabsContent value="comercial" className="mt-4 space-y-3">
                <Tabs defaultValue="contrato">
                  <TabsList className="h-8">
                    <TabsTrigger value="contrato" className="text-xs h-6">Contrato & SLA</TabsTrigger>
                    <TabsTrigger value="acuerdos" className="text-xs h-6">Acuerdos</TabsTrigger>
                  </TabsList>
                  <TabsContent value="contrato" className="mt-4">
                    <ContractsSLATab clientId={isClientView ? initialClientId! : selectedClient} />
                  </TabsContent>
                  <TabsContent value="acuerdos" className="mt-4">
                    <SupportAgreementsTab clientId={isClientView ? initialClientId! : selectedClient} />
                  </TabsContent>
                </Tabs>
              </TabsContent>
            )}

            {/* Datos & Sync */}
            {!isClientView && (
              <TabsContent value="datos" className="mt-4 space-y-3">
                <Tabs defaultValue="importar">
                  <TabsList className="h-8">
                    <TabsTrigger value="importar" className="text-xs h-6">Importar CSV/Excel</TabsTrigger>
                    {selectedClient !== "all" && <TabsTrigger value="devops" className="text-xs h-6">Azure DevOps</TabsTrigger>}
                  </TabsList>
                  <TabsContent value="importar" className="mt-4">
                    <SupportDataLoader clientId={selectedClient !== "all" ? selectedClient : undefined} />
                  </TabsContent>
                  {selectedClient !== "all" && (
                    <TabsContent value="devops" className="mt-4">
                      <DevOpsPanel clientId={selectedClient} clientName={selectedClientName} />
                    </TabsContent>
                  )}
                </Tabs>
              </TabsContent>
            )}
          </Tabs>
        </SheetContent>
      </Sheet>

    </div>
  );
}
