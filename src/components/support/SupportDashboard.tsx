import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertTriangle, Search, Ticket, Clock, CheckCircle2,
  TrendingUp, BarChart3, Activity, Flame,
  ArrowUpRight, ArrowDownRight, Minus, Filter
} from "lucide-react";
import { motion } from "framer-motion";
import {
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis,
  Tooltip, CartesianGrid, AreaChart, Area, Treemap
} from "recharts";
import { useSupportClients, useAllSupportTickets, type SupportTicket, type SupportClient } from "@/hooks/useSupportTickets";

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

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))", "hsl(var(--warning))", "hsl(220,70%,55%)", "hsl(150,60%,50%)", "hsl(280,60%,60%)", "hsl(30,80%,55%)"];

interface SupportDashboardProps {
  initialClientId?: string;
}

export function SupportDashboard({ initialClientId }: SupportDashboardProps) {
  const { data: clients = [] } = useSupportClients();
  const { data: allTickets = [], isLoading } = useAllSupportTickets();
  const [selectedClient, setSelectedClient] = useState<string>(initialClientId || "all");
  const [search, setSearch] = useState("");
  const [prioridadFilter, setPrioridadFilter] = useState<string>("all");

  useEffect(() => {
    if (initialClientId) setSelectedClient(initialClientId);
  }, [initialClientId]);

  const tickets = useMemo(() => {
    let t = allTickets;
    if (selectedClient !== "all") t = t.filter(tk => tk.client_id === selectedClient);
    if (prioridadFilter !== "all") t = t.filter(tk => tk.prioridad === prioridadFilter);
    if (search) t = t.filter(tk => tk.asunto.toLowerCase().includes(search.toLowerCase()) || tk.ticket_id.toLowerCase().includes(search.toLowerCase()));
    return t;
  }, [allTickets, selectedClient, prioridadFilter, search]);

  const activeTickets = useMemo(() => allTickets.filter(t => !["CERRADA", "ANULADA"].includes(t.estado)), [allTickets]);
  const filteredActive = useMemo(() => tickets.filter(t => !["CERRADA", "ANULADA"].includes(t.estado)), [tickets]);

  // Stats
  const totalActive = activeTickets.length;
  const entregadaSinCierre = activeTickets.filter(t => t.estado === "ENTREGADA").length;
  const mayores365 = activeTickets.filter(t => t.dias_antiguedad > 365).length;
  const criticos = activeTickets.filter(t => t.prioridad === "Critica, Impacto Negocio").length;
  const cerradas = allTickets.filter(t => ["CERRADA", "ANULADA"].includes(t.estado)).length;

  // Charts data
  const estadoData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredActive.forEach(t => { counts[t.estado] = (counts[t.estado] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredActive]);

  const prioridadData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredActive.forEach(t => { counts[t.prioridad] = (counts[t.prioridad] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [filteredActive]);

  const tipoData = useMemo(() => {
    const counts: Record<string, number> = {};
    filteredActive.forEach(t => { counts[t.tipo] = (counts[t.tipo] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [filteredActive]);

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
      value: filteredActive.filter(t => t.dias_antiguedad >= r.min && t.dias_antiguedad <= r.max).length,
    }));
  }, [filteredActive]);

  // Heat map data: client × prioridad
  const heatMapData = useMemo(() => {
    return clients.map(c => {
      const ct = activeTickets.filter(t => t.client_id === c.id);
      return {
        name: c.name.length > 18 ? c.name.substring(0, 18) + "…" : c.name,
        fullName: c.name,
        activos: ct.length,
        critica: ct.filter(t => t.prioridad === "Critica, Impacto Negocio").length,
        alta: ct.filter(t => t.prioridad === "Alta").length,
        media: ct.filter(t => t.prioridad === "Media").length,
        baja: ct.filter(t => t.prioridad === "Baja").length,
        maxDias: Math.max(0, ...ct.map(t => t.dias_antiguedad)),
        entregada: ct.filter(t => t.estado === "ENTREGADA").length,
      };
    }).filter(c => c.activos > 0).sort((a, b) => b.activos - a.activos);
  }, [clients, activeTickets]);

  // Top critical cases
  const topCritical = useMemo(() => {
    return [...filteredActive]
      .sort((a, b) => {
        const prio = (p: string) => p === "Critica, Impacto Negocio" ? 0 : p === "Alta" ? 1 : p === "Media" ? 2 : 3;
        const diff = prio(a.prioridad) - prio(b.prioridad);
        return diff !== 0 ? diff : b.dias_antiguedad - a.dias_antiguedad;
      })
      .slice(0, 15);
  }, [filteredActive]);

  const clientName = (id: string) => clients.find(c => c.id === id)?.name || id;

  if (isLoading) {
    return <div className="flex items-center justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Casos Activos", value: totalActive, icon: Ticket, color: "text-blue-400" },
          { label: "Entregada S/Cierre", value: entregadaSinCierre, icon: Clock, color: "text-amber-400" },
          { label: ">365 Días", value: mayores365, icon: AlertTriangle, color: "text-red-400" },
          { label: "Críticos Negocio", value: criticos, icon: Flame, color: "text-rose-500" },
          { label: "Cerradas Total", value: cerradas, icon: CheckCircle2, color: "text-emerald-400" },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-border/50">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-black text-foreground">{kpi.value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <Filter className="h-4 w-4 text-muted-foreground" />
        <Select value={selectedClient} onValueChange={setSelectedClient}>
          <SelectTrigger className="w-[200px] h-8 text-xs"><SelectValue placeholder="Todos los clientes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
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
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Vista General</TabsTrigger>
          <TabsTrigger value="heatmap">Mapa de Calor</TabsTrigger>
          <TabsTrigger value="cases">Detalle de Casos</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 mt-4">
          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Estado Distribution */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Estado de Casos Activos</CardTitle></CardHeader>
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

            {/* Prioridad Distribution */}
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

            {/* Aging Distribution */}
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
                      <th className="text-left p-2 font-medium text-muted-foreground">Cliente</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Asunto</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Estado</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Prioridad</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">Días</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topCritical.map(t => (
                      <tr key={t.id} className="border-b border-border/50 hover:bg-muted/30">
                        <td className="p-2 font-mono font-bold">{t.ticket_id}</td>
                        <td className="p-2">{clientName(t.client_id)}</td>
                        <td className="p-2 max-w-[300px] truncate">{t.asunto}</td>
                        <td className="p-2">
                          <Badge variant="outline" className={`text-[10px] ${estadoColors[t.estado] || ""}`}>{t.estado}</Badge>
                        </td>
                        <td className="p-2">
                          <Badge className={`text-[10px] ${prioridadColors[t.prioridad] || "bg-muted"}`}>{t.prioridad}</Badge>
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

          {/* Tipo Distribution */}
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
                          filteredActive.forEach(t => { if (t.producto) counts[t.producto] = (counts[t.producto] || 0) + 1; });
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

        <TabsContent value="heatmap" className="mt-4">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Activity className="h-4 w-4" /> Mapa de Calor por Cliente</CardTitle></CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left p-2 font-medium text-muted-foreground">Cliente</th>
                      <th className="text-center p-2 font-medium text-muted-foreground">Activos</th>
                      <th className="text-center p-2 font-medium text-muted-foreground">Crítica</th>
                      <th className="text-center p-2 font-medium text-muted-foreground">Alta</th>
                      <th className="text-center p-2 font-medium text-muted-foreground">Media</th>
                      <th className="text-center p-2 font-medium text-muted-foreground">Baja</th>
                      <th className="text-center p-2 font-medium text-muted-foreground">Entregada</th>
                      <th className="text-center p-2 font-medium text-muted-foreground">Máx Días</th>
                      <th className="text-center p-2 font-medium text-muted-foreground">Riesgo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {heatMapData.map(row => {
                      const riskScore = row.critica * 10 + row.alta * 3 + row.entregada * 2 + (row.maxDias > 365 ? 5 : row.maxDias > 180 ? 3 : 0);
                      const riskLevel = riskScore >= 15 ? "Crítico" : riskScore >= 8 ? "Alto" : riskScore >= 4 ? "Medio" : "Bajo";
                      const riskColor = riskScore >= 15 ? "bg-red-500/20 text-red-400" : riskScore >= 8 ? "bg-orange-500/20 text-orange-400" : riskScore >= 4 ? "bg-yellow-500/20 text-yellow-400" : "bg-green-500/20 text-green-400";
                      const heatCell = (v: number, max: number) => {
                        if (v === 0) return "";
                        const intensity = Math.min(1, v / Math.max(1, max));
                        return `background: rgba(239,68,68,${0.1 + intensity * 0.5})`;
                      };
                      const maxCrit = Math.max(...heatMapData.map(r => r.critica));
                      const maxAlta = Math.max(...heatMapData.map(r => r.alta));
                      return (
                        <tr key={row.fullName} className="border-b border-border/50 hover:bg-muted/30">
                          <td className="p-2 font-medium">{row.fullName}</td>
                          <td className="p-2 text-center font-bold">{row.activos}</td>
                          <td className="p-2 text-center font-bold" style={{ background: row.critica > 0 ? `rgba(239,68,68,${0.2 + row.critica / Math.max(1, maxCrit) * 0.6})` : undefined }}>
                            {row.critica || "—"}
                          </td>
                          <td className="p-2 text-center" style={{ background: row.alta > 0 ? `rgba(249,115,22,${0.1 + row.alta / Math.max(1, maxAlta) * 0.4})` : undefined }}>
                            {row.alta || "—"}
                          </td>
                          <td className="p-2 text-center">{row.media || "—"}</td>
                          <td className="p-2 text-center">{row.baja || "—"}</td>
                          <td className="p-2 text-center" style={{ background: row.entregada > 0 ? `rgba(234,179,8,${0.1 + row.entregada / 10 * 0.4})` : undefined }}>
                            {row.entregada || "—"}
                          </td>
                          <td className="p-2 text-center font-mono">
                            <span className={row.maxDias > 365 ? "text-destructive font-bold" : row.maxDias > 180 ? "text-warning" : ""}>{row.maxDias}</span>
                          </td>
                          <td className="p-2 text-center">
                            <Badge variant="outline" className={`text-[10px] ${riskColor}`}>{riskLevel}</Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cases" className="mt-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center justify-between">
                <span>Todos los Casos ({tickets.length})</span>
                <Badge variant="outline">{filteredActive.length} activos</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-card z-10">
                    <tr className="border-b border-border">
                      <th className="text-left p-2 font-medium text-muted-foreground">ID</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Cliente</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Producto</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Asunto</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Tipo</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Prioridad</th>
                      <th className="text-left p-2 font-medium text-muted-foreground">Estado</th>
                      <th className="text-right p-2 font-medium text-muted-foreground">Días</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tickets.map(t => (
                      <tr key={t.id} className={`border-b border-border/50 hover:bg-muted/30 ${["CERRADA", "ANULADA"].includes(t.estado) ? "opacity-50" : ""}`}>
                        <td className="p-2 font-mono font-bold whitespace-nowrap">{t.ticket_id}</td>
                        <td className="p-2 whitespace-nowrap">{clientName(t.client_id)}</td>
                        <td className="p-2 whitespace-nowrap">{t.producto}</td>
                        <td className="p-2 max-w-[250px] truncate">{t.asunto}</td>
                        <td className="p-2 whitespace-nowrap">{t.tipo}</td>
                        <td className="p-2"><Badge className={`text-[10px] ${prioridadColors[t.prioridad] || "bg-muted"}`}>{t.prioridad}</Badge></td>
                        <td className="p-2"><Badge variant="outline" className={`text-[10px] ${estadoColors[t.estado] || ""}`}>{t.estado}</Badge></td>
                        <td className="p-2 text-right font-mono">{t.dias_antiguedad}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
