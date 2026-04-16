import { useState, useMemo, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle, Search, Ticket, Clock, CheckCircle2,
  Flame, Activity, Filter, Brain, Loader2, Sparkles, RefreshCw,
  ArrowLeft, Building2, MapPin, Mail, User, FileText, ArrowRightLeft
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
import { SupportCaseTable } from "./SupportCaseTable";
import { SupportClientHeatmap } from "./SupportClientHeatmap";
import { SupportDataLoader } from "./SupportDataLoader";
import { SupportMinutas } from "./SupportMinutas";
import { SupportAgreementsTab } from "./SupportAgreementsTab";
import { SupportScrumPanel } from "./SupportScrumPanel";

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
  const entregadaSinCierre = activeTickets.filter(t => t.estado === "ENTREGADA").length;
  const mayores365 = activeTickets.filter(t => t.dias_antiguedad > 365).length;
  const criticos = activeTickets.filter(t => t.prioridad === "Critica, Impacto Negocio").length;
  const cerradas = scopedTickets.filter(t => ["CERRADA", "ANULADA"].includes(t.estado)).length;
  const classifiedCount = scopedTickets.filter(t => t.ai_classification).length;

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

      {/* KPI Cards - scoped */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: "Casos Activos", value: totalActive, icon: Ticket, color: "text-blue-400" },
          { label: "Entregada S/Cierre", value: entregadaSinCierre, icon: Clock, color: "text-amber-400" },
          { label: ">365 Días", value: mayores365, icon: AlertTriangle, color: "text-red-400" },
          { label: "Críticos Negocio", value: criticos, icon: Flame, color: "text-rose-500" },
          { label: "Cerradas Total", value: cerradas, icon: CheckCircle2, color: "text-emerald-400" },
          { label: "IA Clasificados", value: classifiedCount, icon: Brain, color: "text-violet-400" },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-border/50">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-xl font-black text-foreground">{kpi.value}</p>
                  <p className="text-[9px] text-muted-foreground uppercase tracking-wide leading-tight">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

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
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap">
          <TabsTrigger value="overview">Vista General</TabsTrigger>
          {!isClientView && <TabsTrigger value="heatmap">Mapa de Calor</TabsTrigger>}
          <TabsTrigger value="charts">Gráficos</TabsTrigger>
          <TabsTrigger value="ai">Clasificación IA</TabsTrigger>
          <TabsTrigger value="cases">Detalle de Casos</TabsTrigger>
          <TabsTrigger value="minutas">Minutas</TabsTrigger>
          {(isClientView || selectedClient !== "all") && <TabsTrigger value="acuerdos">Acuerdos</TabsTrigger>}
          {(isClientView || selectedClient !== "all") && <TabsTrigger value="scrum">Estrategia Scrum</TabsTrigger>}
          {!isClientView && <TabsTrigger value="import">Cargar Datos</TabsTrigger>}
        </TabsList>

        <TabsContent value="scrum" className="mt-4">
          <SupportScrumPanel
            clientId={isClientView ? initialClientId! : selectedClient}
            clientName={isClientView ? selectedClientObj?.name : selectedClientName}
          />
        </TabsContent>

        <TabsContent value="overview" className="space-y-4 mt-4">
          {showingAllInCharts && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-info/10 border border-info/20 text-xs text-info">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>Todos los casos están cerrados. Mostrando datos históricos completos.</span>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">{showingAllInCharts ? "Estado de Todos los Casos" : "Estado de Casos Activos"}</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={estadoData} innerRadius={50} outerRadius={80} dataKey="value" nameKey="name" strokeWidth={0}>
                        {estadoData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`${v} casos`, ""]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {estadoData.map((d, i) => (
                    <span key={d.name} className="text-[10px] flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      {d.name} ({d.value})
                    </span>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Distribución por Prioridad</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={prioridadData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis type="category" dataKey="name" width={60} tick={{ fontSize: 9 }} />
                      <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                      <Tooltip />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Antigüedad de Casos</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={agingData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Area type="monotone" dataKey="value" fill="hsl(var(--destructive)/0.2)" stroke="hsl(var(--destructive))" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Top Critical Cases */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Flame className="h-4 w-4 text-destructive" /> Top Casos Críticos</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 font-medium text-muted-foreground">ID</th>
                      {!isClientView && <th className="text-left p-2 font-medium text-muted-foreground">Cliente</th>}
                      <th className="text-left p-2 font-medium text-muted-foreground">Asunto</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Estado</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Prioridad</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">IA</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">Días</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCritical.map(t => (
                      <tr key={t.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="p-2 font-mono font-bold">{t.ticket_id}</td>
                        {!isClientView && <td className="p-2">{clientName(t.client_id)}</td>}
                        <td className="p-2 max-w-[250px] truncate">{t.asunto}</td>
                        <td className="p-2"><Badge variant="outline" className={`text-[10px] ${estadoColors[t.estado] || ""}`}>{t.estado}</Badge></td>
                        <td className="p-2"><Badge className={`text-[10px] ${prioridadColors[t.prioridad] || "bg-muted"}`}>{t.prioridad}</Badge></td>
                        <td className="p-2">
                          {t.ai_risk_level ? (
                            <Badge variant="outline" className={`text-[10px] ${aiRiskColors[t.ai_risk_level] || ""}`}>
                              {aiRiskLabels[t.ai_risk_level] || t.ai_risk_level}
                            </Badge>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                        <td className="p-2 text-right font-mono font-bold">
                          <span className={t.dias_antiguedad > 365 ? "text-destructive" : t.dias_antiguedad > 90 ? "text-warning" : ""}>{t.dias_antiguedad}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Tipo + Producto */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Distribución por Tipo</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={tipoData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                      <YAxis tick={{ fontSize: 10 }} />
                      <Bar dataKey="value" fill="hsl(220,70%,55%)" radius={[4, 4, 0, 0]} />
                      <Tooltip />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Producto</CardTitle></CardHeader>
              <CardContent>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={(() => {
                          const counts: Record<string, number> = {};
                          chartTickets.forEach(t => { if (t.producto) counts[t.producto] = (counts[t.producto] || 0) + 1; });
                          return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
                        })()}
                        innerRadius={50} outerRadius={80} dataKey="value" strokeWidth={0}
                      >
                        {Array.from({ length: 10 }).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v: number) => [`${v} casos`, ""]} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* HEATMAP TAB */}
        <TabsContent value="heatmap" className="mt-4 space-y-4">
          {isClientView || selectedClient !== "all" ? (
            <SupportClientHeatmap tickets={isClientView ? scopedTickets : tickets} clientName={isClientView ? (selectedClientObj?.name || "") : selectedClientName} />
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="h-4 w-4" /> Mapa de Calor — Prioridad por Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr>
                          <th className="text-left p-2 font-medium text-muted-foreground border-b border-border min-w-[160px]">Cliente</th>
                          <th className="text-center p-2 font-medium text-muted-foreground border-b border-border w-16">Total</th>
                          <th className="text-center p-2 font-medium border-b border-border w-16" style={{ color: "rgb(239,68,68)" }}>Crítica</th>
                          <th className="text-center p-2 font-medium border-b border-border w-16" style={{ color: "rgb(249,115,22)" }}>Alta</th>
                          <th className="text-center p-2 font-medium border-b border-border w-16" style={{ color: "rgb(234,179,8)" }}>Media</th>
                          <th className="text-center p-2 font-medium border-b border-border w-14" style={{ color: "rgb(148,163,184)" }}>Baja</th>
                          <th className="text-center p-2 font-medium text-muted-foreground border-b border-border w-16">Prom Días</th>
                          <th className="text-center p-2 font-medium text-muted-foreground border-b border-border w-16">Máx Días</th>
                        </tr>
                      </thead>
                      <tbody>
                        {heatMapData.map(row => (
                          <tr key={row.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setSelectedClient(row.id)}>
                            <td className="p-2 font-medium border-b border-border/30 truncate max-w-[200px]">{row.name}</td>
                            <td className="p-2 text-center font-bold border-b border-border/30" style={heatBg(row.activos, maxActivos, 59, 130, 246)}>
                              {row.activos}{row.total > row.activos && <span className="text-muted-foreground font-normal">/{row.total}</span>}
                            </td>
                            <td className="p-2 text-center font-bold border-b border-border/30 rounded-sm" style={heatBg(row.critica, maxCrit, 239, 68, 68)}>{row.critica || ""}</td>
                            <td className="p-2 text-center font-bold border-b border-border/30 rounded-sm" style={heatBg(row.alta, maxAlta, 249, 115, 22)}>{row.alta || ""}</td>
                            <td className="p-2 text-center border-b border-border/30 rounded-sm" style={heatBg(row.media, maxMedia, 234, 179, 8)}>{row.media || ""}</td>
                            <td className="p-2 text-center text-muted-foreground border-b border-border/30">{row.baja || ""}</td>
                            <td className="p-2 text-center font-mono border-b border-border/30">
                              <span className={row.avgDias > 180 ? "text-destructive font-bold" : row.avgDias > 90 ? "text-warning" : "text-muted-foreground"}>{row.activos > 0 ? row.avgDias : "—"}</span>
                            </td>
                            <td className="p-2 text-center font-mono border-b border-border/30">
                              <span className={row.maxDias > 365 ? "text-destructive font-bold" : row.maxDias > 180 ? "text-warning" : ""}>{row.activos > 0 ? row.maxDias : "—"}</span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2 italic">Clic en un cliente para ver mapa de calor por caso individual</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Activity className="h-4 w-4" /> Mapa de Calor — Estado por Cliente
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr>
                          <th className="text-left p-2 font-medium text-muted-foreground border-b border-border min-w-[160px]">Cliente</th>
                          <th className="text-center p-2 font-medium border-b border-border w-20" style={{ color: "rgb(59,130,246)" }}>En Atención</th>
                          <th className="text-center p-2 font-medium border-b border-border w-20" style={{ color: "rgb(234,179,8)" }}>Entregada</th>
                          <th className="text-center p-2 font-medium border-b border-border w-20" style={{ color: "rgb(249,115,22)" }}>Pendiente</th>
                          <th className="text-center p-2 font-medium text-muted-foreground border-b border-border w-16">Activos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {heatMapData.filter(r => r.activos > 0).map(row => (
                          <tr key={row.id} className="hover:bg-muted/20 transition-colors cursor-pointer" onClick={() => setSelectedClient(row.id)}>
                            <td className="p-2 font-medium border-b border-border/30 truncate max-w-[200px]">{row.name}</td>
                            <td className="p-2 text-center font-bold border-b border-border/30" style={heatBg(row.enAtencion, Math.max(1, ...heatMapData.map(r => r.enAtencion)), 59, 130, 246)}>{row.enAtencion || ""}</td>
                            <td className="p-2 text-center font-bold border-b border-border/30" style={heatBg(row.entregada, maxEntregada, 234, 179, 8)}>{row.entregada || ""}</td>
                            <td className="p-2 text-center font-bold border-b border-border/30" style={heatBg(row.pendiente, maxPendiente, 249, 115, 22)}>{row.pendiente || ""}</td>
                            <td className="p-2 text-center font-bold border-b border-border/30">{row.activos}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="charts" className="mt-4">
          <SupportChartBuilder tickets={ticketsWithClientName} />
        </TabsContent>

        {/* AI Classification Tab */}
        <TabsContent value="ai" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-violet-400" />
              <span className="text-sm font-medium">Inteligencia Artificial</span>
              <Badge variant="outline" className="text-xs">{classifiedCount}/{scopedTickets.length} clasificados</Badge>
            </div>
            <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={handleClassify} disabled={classifying}>
              {classifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {classifying ? "Clasificando..." : "Clasificar pendientes"}
            </Button>
          </div>

          <Tabs defaultValue="clasificacion">
            <TabsList className="h-8">
              <TabsTrigger value="clasificacion" className="text-xs h-6 gap-1"><Brain className="h-3 w-3" /> Clasificación</TabsTrigger>
              <TabsTrigger value="seguimiento" className="text-xs h-6 gap-1"><AlertTriangle className="h-3 w-3" /> Seguimiento IA</TabsTrigger>
              <TabsTrigger value="agentes" className="text-xs h-6 gap-1"><Sparkles className="h-3 w-3" /> Agentes IA</TabsTrigger>
            </TabsList>

            {/* Sub-tab: Clasificación */}
            <TabsContent value="clasificacion" className="mt-4 space-y-4">
              {aiClassData.length > 0 && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Categorías IA</CardTitle></CardHeader>
                    <CardContent>
                      <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={aiClassData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis type="number" tick={{ fontSize: 10 }} />
                            <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 9 }} />
                            <Bar dataKey="value" fill="hsl(280,60%,60%)" radius={[0, 4, 4, 0]} />
                            <Tooltip />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Nivel de Riesgo IA</CardTitle></CardHeader>
                    <CardContent>
                      <div className="h-[220px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={(() => {
                                const counts: Record<string, number> = {};
                                filteredActive.filter(t => t.ai_risk_level).forEach(t => {
                                  const label = aiRiskLabels[t.ai_risk_level!] || t.ai_risk_level!;
                                  counts[label] = (counts[label] || 0) + 1;
                                });
                                return Object.entries(counts).map(([name, value]) => ({ name, value }));
                              })()}
                              innerRadius={50} outerRadius={80} dataKey="value" strokeWidth={0}
                            >
                              <Cell fill="rgb(239,68,68)" />
                              <Cell fill="rgb(249,115,22)" />
                              <Cell fill="rgb(234,179,8)" />
                              <Cell fill="rgb(34,197,94)" />
                            </Pie>
                            <Tooltip formatter={(v: number) => [`${v} casos`, ""]} />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Tickets con Clasificación IA</CardTitle></CardHeader>
                <CardContent>
                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-card z-10">
                        <tr className="border-b border-border">
                          <th className="text-left p-2 font-medium text-muted-foreground">ID</th>
                          {!isClientView && <th className="text-left p-2 font-medium text-muted-foreground">Cliente</th>}
                          <th className="text-left p-2 font-medium text-muted-foreground">Asunto</th>
                          <th className="text-left p-2 font-medium text-muted-foreground">Categoría IA</th>
                          <th className="text-left p-2 font-medium text-muted-foreground">Riesgo IA</th>
                          <th className="text-left p-2 font-medium text-muted-foreground">Resumen IA</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tickets.filter(t => t.ai_classification).map(t => (
                          <tr key={t.id} className="border-b border-border/50 hover:bg-muted/30">
                            <td className="p-2 font-mono font-bold whitespace-nowrap">{t.ticket_id}</td>
                            {!isClientView && <td className="p-2 whitespace-nowrap">{clientName(t.client_id)}</td>}
                            <td className="p-2 max-w-[200px] truncate">{t.asunto}</td>
                            <td className="p-2"><Badge variant="outline" className="text-[10px] border-violet-500/40 text-violet-400">{t.ai_classification}</Badge></td>
                            <td className="p-2">
                              <Badge variant="outline" className={`text-[10px] ${aiRiskColors[t.ai_risk_level || ""] || ""}`}>
                                {aiRiskLabels[t.ai_risk_level || ""] || t.ai_risk_level || "—"}
                              </Badge>
                            </td>
                            <td className="p-2 max-w-[300px] truncate text-muted-foreground">{t.ai_summary || "—"}</td>
                          </tr>
                        ))}
                        {tickets.filter(t => t.ai_classification).length === 0 && (
                          <tr><td colSpan={isClientView ? 5 : 6} className="p-8 text-center text-muted-foreground">
                            No hay tickets clasificados. Presiona "Clasificar con IA" para comenzar.
                          </td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Sub-tab: Seguimiento IA — actionable recommendations */}
            <TabsContent value="seguimiento" className="mt-4 space-y-4">
              {/* Old cases needing attention */}
              {(() => {
                const oldCases = filteredActive.filter(t => t.dias_antiguedad > 180).sort((a, b) => b.dias_antiguedad - a.dias_antiguedad);
                const stuckCases = filteredActive.filter(t => t.estado === "ENTREGADA" && t.dias_antiguedad > 30).sort((a, b) => b.dias_antiguedad - a.dias_antiguedad);
                const unassigned = filteredActive.filter(t => !t.responsable || t.responsable.trim() === "").sort((a, b) => b.dias_antiguedad - a.dias_antiguedad);
                const noNotes = filteredActive.filter(t => !t.notas && !t.ai_summary).sort((a, b) => b.dias_antiguedad - a.dias_antiguedad);

                return (
                  <>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      {[
                        { label: "Casos >180 días", value: oldCases.length, color: "text-destructive", desc: "Requieren cierre o escalación" },
                        { label: "Entregados sin cerrar", value: stuckCases.length, color: "text-amber-400", desc: "Necesitan confirmación de cierre" },
                        { label: "Sin responsable", value: unassigned.length, color: "text-orange-400", desc: "Asignar de inmediato" },
                        { label: "Sin notas ni IA", value: noNotes.length, color: "text-muted-foreground", desc: "Documentar estado actual" },
                      ].map((item, i) => (
                        <Card key={i}>
                          <CardContent className="p-3">
                            <p className={`text-2xl font-black ${item.color}`}>{item.value}</p>
                            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{item.label}</p>
                            <p className="text-[9px] text-muted-foreground/60 mt-1">{item.desc}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>

                    {/* Actionable table: old cases */}
                    {oldCases.length > 0 && (
                      <Card className="border-destructive/20">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-4 w-4" /> Casos Antiguos — Acción Requerida
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="overflow-x-auto max-h-[400px] overflow-y-auto">
                            <table className="w-full text-xs">
                              <thead className="sticky top-0 bg-card z-10">
                                <tr className="border-b border-border">
                                  <th className="text-left p-2 font-medium text-muted-foreground">ID</th>
                                  {!isClientView && <th className="text-left p-2 font-medium text-muted-foreground">Cliente</th>}
                                  <th className="text-left p-2 font-medium text-muted-foreground">Asunto</th>
                                  <th className="text-left p-2 font-medium text-muted-foreground">Estado</th>
                                  <th className="text-left p-2 font-medium text-muted-foreground">Responsable</th>
                                  <th className="text-right p-2 font-medium text-muted-foreground">Días</th>
                                  <th className="text-left p-2 font-medium text-muted-foreground">Acción Sugerida</th>
                                </tr>
                              </thead>
                              <tbody>
                                {oldCases.slice(0, 20).map(t => {
                                  let action = "Revisar y cerrar";
                                  if (t.estado === "ENTREGADA") action = "Confirmar cierre con cliente";
                                  else if (t.estado === "EN ATENCIÓN") action = "Escalar a líder técnico";
                                  else if (t.estado === "PENDIENTE") action = "Reactivar o cerrar como inactivo";
                                  else if (t.estado === "COTIZADA") action = "Confirmar aprobación";
                                  else if (t.dias_antiguedad > 365) action = "⚠ Cierre urgente recomendado";
                                  return (
                                    <tr key={t.id} className="border-b border-border/50 hover:bg-muted/30">
                                      <td className="p-2 font-mono font-bold">{t.ticket_id}</td>
                                      {!isClientView && <td className="p-2">{clientName(t.client_id)}</td>}
                                      <td className="p-2 max-w-[180px] truncate">{t.asunto}</td>
                                      <td className="p-2"><Badge variant="outline" className={`text-[10px] ${estadoColors[t.estado] || ""}`}>{t.estado}</Badge></td>
                                      <td className="p-2">{t.responsable || <span className="text-destructive">Sin asignar</span>}</td>
                                      <td className="p-2 text-right font-mono font-bold text-destructive">{t.dias_antiguedad}</td>
                                      <td className="p-2 text-[10px] font-medium text-amber-400">{action}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Stuck cases */}
                    {stuckCases.length > 0 && (
                      <Card className="border-amber-500/20">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm flex items-center gap-2 text-amber-400">
                            <Clock className="h-4 w-4" /> Entregados sin Cierre
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-2">
                            {stuckCases.slice(0, 10).map(t => (
                              <div key={t.id} className="flex items-center gap-3 p-2 rounded-lg bg-amber-500/5 border border-amber-500/10 text-xs">
                                <span className="font-mono font-bold text-amber-400">{t.ticket_id}</span>
                                <span className="flex-1 truncate">{t.asunto}</span>
                                <span className="text-muted-foreground">{t.responsable || "—"}</span>
                                <span className="font-mono font-bold">{t.dias_antiguedad}d</span>
                                <Badge variant="outline" className="text-[9px] border-amber-500/30 text-amber-400">Cerrar</Badge>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </>
                );
              })()}
            </TabsContent>

            {/* Sub-tab: Agentes IA */}
            <TabsContent value="agentes" className="mt-4 space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <Card className="border-violet-500/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-violet-400" /> Clasificador de Tickets
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Analiza tickets automáticamente y asigna categoría, nivel de riesgo y resumen ejecutivo.
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Modelo</span><span className="font-mono">Gemini 3 Flash</span></div>
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Función</span><span>classify-tickets</span></div>
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Tickets procesados</span><span className="font-bold text-violet-400">{classifiedCount}</span></div>
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Estado</span>
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Activo</Badge>
                      </div>
                    </div>
                    <Button size="sm" variant="outline" className="w-full text-xs gap-1.5 border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
                      onClick={handleClassify} disabled={classifying}>
                      {classifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                      Ejecutar clasificación
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" /> Generador de Minutas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Genera minutas ejecutivas a partir de casos activos o transcripciones de reuniones.
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Modelo</span><span className="font-mono">Gemini 3 Flash</span></div>
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Función</span><span>summarize-transcript</span></div>
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Modos</span><span>Casos / Transcripción / Archivo</span></div>
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Estado</span>
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Activo</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-blue-500/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Brain className="h-4 w-4 text-blue-400" /> Análisis Individual de Caso
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Analiza un caso específico y genera resumen, clasificación de riesgo y recomendaciones.
                    </p>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Modelo</span><span className="font-mono">Gemini 3 Flash</span></div>
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Acceso</span><span>Detalle de Caso → Tab IA</span></div>
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Estado</span>
                        <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Activo</Badge>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2 text-muted-foreground">
                      <Activity className="h-4 w-4" /> Uso de IA — Resumen
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Gateway</span><span className="font-mono">Lovable AI</span></div>
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Modelo principal</span><span>google/gemini-3-flash-preview</span></div>
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Total agentes</span><span className="font-bold">3</span></div>
                      <div className="flex justify-between text-xs"><span className="text-muted-foreground">Funciones edge</span><span>classify-tickets, summarize-transcript</span></div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </TabsContent>

        {/* Cases Detail Tab */}
        <TabsContent value="cases" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>{isClientView ? "Casos del Cliente" : "Todos los Casos"} ({tickets.length})</span>
                <Badge variant="outline">{filteredActive.length} activos</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <SupportCaseTable tickets={tickets} clientName={clientName} teamMembers={selectedClientObj?.team_assigned || []} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Minutas Tab */}
        <TabsContent value="minutas" className="mt-4">
          {(isClientView || selectedClient !== "all") ? (
            <SupportMinutas
              tickets={scopedTickets}
              clientName={isClientView ? (selectedClientObj?.name || "") : selectedClientName}
              clientId={isClientView ? initialClientId! : selectedClient}
              teamMembers={isClientView ? (selectedClientObj?.team_assigned || []) : (clients.find(c => c.id === selectedClient)?.team_assigned || [])}
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Selecciona un cliente para ver sus minutas</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Acuerdos Tab */}
        <TabsContent value="acuerdos" className="mt-4">
          {(isClientView || selectedClient !== "all") ? (
            <SupportAgreementsTab clientId={isClientView ? initialClientId! : selectedClient} />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Selecciona un cliente para ver acuerdos y acciones</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        <TabsContent value="import" className="mt-4">
          <SupportDataLoader clientId={isClientView ? initialClientId : (selectedClient !== "all" ? selectedClient : undefined)} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
