/**
 * CEO Dashboard — vista ejecutiva super-administrativa de todo el ERP.
 * Read-only. Diseñada para que el CEO vea pulso global, riesgos, financiero,
 * operación, equipo e IA en una sola pantalla cinematográfica.
 */
import { useMemo, useState, useEffect } from "react";
import { useClients } from "@/hooks/useClients";
import { useAllSupportTickets, useSupportClients } from "@/hooks/useSupportTickets";
import { useAIUsageLogs } from "@/hooks/useAIUsageLogs";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Crown, Building2, Headset, Users, Brain, ShieldAlert, AlertTriangle,
  TrendingUp, TrendingDown, DollarSign, Clock, CheckCircle2,
  Activity, Sparkles, Layers, Target, Flame, AlertOctagon, Moon, Sun,
  LogOut, ChevronRight, UserX, Calendar,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as ReTooltip, PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────

function fmtMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function fmtNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

const CHART_COLORS = ["hsl(var(--primary))", "hsl(280,60%,60%)", "hsl(var(--destructive))", "hsl(var(--warning))", "hsl(150,60%,50%)", "hsl(220,70%,55%)"];

// ═══════════════════════════════════════════════════════════════════════════
// CEO DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

export function CEODashboard() {
  const { profile, signOut } = useAuth();
  const { data: clients = [] } = useClients();
  const { data: supportTickets = [] } = useAllSupportTickets();
  const { data: supportClients = [] } = useSupportClients();
  const { data: aiLogs = [] } = useAIUsageLogs();

  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);

  const [financials, setFinancials] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("client_financials" as any).select("*").then(({ data }) => setFinancials(data || []));
  }, []);

  // ─── Cálculos globales ─────────────────────────────────────────────────

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Buenos días" : now.getHours() < 19 ? "Buenas tardes" : "Buenas noches";

  // Clientes
  const allClients = clients as any[];
  const implClients = allClients.filter(c => c.client_type === "implementacion");
  const soporteClients = allClients.filter(c => c.client_type === "soporte");
  const atRisk = allClients.filter(c => c.status === "en-riesgo").length;
  const activos = allClients.filter(c => c.status === "activo").length;
  const completados = allClients.filter(c => c.status === "completado").length;
  const pausados = allClients.filter(c => c.status === "pausado").length;

  // Soporte
  const ticketsActivos = supportTickets.filter(t => !["CERRADA", "ANULADA"].includes(t.estado));
  const ticketsCerrados = supportTickets.filter(t => ["CERRADA", "ANULADA"].includes(t.estado));
  const sinAtencion = ticketsActivos.filter(t => t.estado === "PENDIENTE" && !t.responsable).length;
  const criticos = ticketsActivos.filter(t => /critica/i.test(t.prioridad || "")).length;
  const conCausaRaiz = supportTickets.filter(t => t.ai_classification).length;
  const sinCausaRaiz = supportTickets.length - conCausaRaiz;

  // Top causas raíz
  const topCausasRaiz = useMemo(() => {
    const counts: Record<string, number> = {};
    supportTickets.forEach(t => {
      if (!t.ai_classification) return;
      counts[t.ai_classification] = (counts[t.ai_classification] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [supportTickets]);

  // Distribución de tickets por estado
  const ticketsByEstado = useMemo(() => {
    const counts: Record<string, number> = {};
    supportTickets.forEach(t => {
      counts[t.estado] = (counts[t.estado] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [supportTickets]);

  // Productos
  const ticketsByProducto = useMemo(() => {
    const counts: Record<string, number> = {};
    supportTickets.forEach(t => {
      if (!t.producto) return;
      counts[t.producto] = (counts[t.producto] || 0) + 1;
    });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [supportTickets]);

  // Top clientes por carga
  const topClientesByLoad = useMemo(() => {
    const counts: Record<string, number> = {};
    supportTickets.forEach(t => {
      counts[t.client_id] = (counts[t.client_id] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([cid, n]) => {
        const client = supportClients.find((c: any) => c.id === cid) as any;
        return { name: client?.name || cid, count: n };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [supportTickets, supportClients]);

  // Financiero (sumar todos los clientes)
  const totalContractValue = financials.reduce((s, f) => s + (f.contract_value || 0), 0);
  const totalBilled = financials.reduce((s, f) => s + (f.billed || 0), 0);
  const totalPaid = financials.reduce((s, f) => s + (f.paid || 0), 0);
  const totalPending = financials.reduce((s, f) => s + (f.pending || 0), 0);
  const totalHoursEstimated = financials.reduce((s, f) => s + (f.hours_estimated || 0), 0);
  const totalHoursUsed = financials.reduce((s, f) => s + (f.hours_used || 0), 0);
  const collectionRate = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0;
  const utilizationPct = totalHoursEstimated > 0 ? Math.round((totalHoursUsed / totalHoursEstimated) * 100) : 0;

  // IA — últimos 30 días
  const last30 = Date.now() - 30 * 86400000;
  const recent30 = aiLogs.filter(l => new Date(l.created_at).getTime() >= last30);
  const totalAICalls = recent30.length;
  const totalAITokens = recent30.reduce((s, l) => s + (l.total_tokens || 0), 0);
  // Estimación cost: $0.000075 / 1K tokens promedio (Gemini Flash Lite)
  const estimatedAICost = (totalAITokens / 1000) * 0.000075;

  // Trend de IA por día (últimos 14)
  const aiTrend = useMemo(() => {
    const byDay: Record<string, { date: string; calls: number; tokens: number }> = {};
    const last14 = Date.now() - 14 * 86400000;
    aiLogs.filter(l => new Date(l.created_at).getTime() >= last14).forEach(l => {
      const d = l.created_at.split("T")[0];
      if (!byDay[d]) byDay[d] = { date: d.slice(5), calls: 0, tokens: 0 };
      byDay[d].calls++;
      byDay[d].tokens += l.total_tokens || 0;
    });
    return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
  }, [aiLogs]);

  // Trend de tickets por día (últimos 30)
  const ticketTrend = useMemo(() => {
    const byDay: Record<string, { date: string; nuevos: number; cerrados: number }> = {};
    const last30Ms = Date.now() - 30 * 86400000;
    supportTickets.forEach(t => {
      const created = new Date(t.fecha_registro || t.created_at).getTime();
      if (created < last30Ms) return;
      const d = (t.fecha_registro || t.created_at).split("T")[0];
      if (!byDay[d]) byDay[d] = { date: d.slice(5), nuevos: 0, cerrados: 0 };
      byDay[d].nuevos++;
    });
    supportTickets.forEach(t => {
      if (!t.fecha_entrega) return;
      const closed = new Date(t.fecha_entrega).getTime();
      if (closed < last30Ms) return;
      const d = t.fecha_entrega.split("T")[0];
      if (!byDay[d]) byDay[d] = { date: d.slice(5), nuevos: 0, cerrados: 0 };
      byDay[d].cerrados++;
    });
    return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
  }, [supportTickets]);

  // Salud global score (0-100)
  const healthScore = useMemo(() => {
    let score = 100;
    if (atRisk > 0) score -= atRisk * 8;
    if (criticos > 0) score -= Math.min(criticos * 4, 20);
    if (sinAtencion > 5) score -= Math.min((sinAtencion - 5) * 2, 15);
    if (totalPending > totalContractValue * 0.3) score -= 10;
    if (utilizationPct > 90) score -= 8;
    return Math.max(0, score);
  }, [atRisk, criticos, sinAtencion, totalPending, totalContractValue, utilizationPct]);

  const healthColor = healthScore >= 80 ? "text-emerald-500" : healthScore >= 60 ? "text-amber-500" : "text-destructive";
  const healthBg = healthScore >= 80 ? "bg-emerald-500/10 border-emerald-500/30" : healthScore >= 60 ? "bg-amber-500/10 border-amber-500/30" : "bg-destructive/10 border-destructive/30";

  const COLORS_PIE: Record<string, string> = {
    "ENTREGADA": "hsl(150,60%,50%)",
    "EN ATENCIÓN": "hsl(199,89%,55%)",
    "PENDIENTE": "hsl(0,72%,60%)",
    "POR CERRAR": "hsl(31,95%,60%)",
    "COTIZADA": "hsl(43,95%,55%)",
    "VALORACIÓN": "hsl(270,80%,65%)",
    "ON HOLD": "hsl(220,10%,40%)",
    "APROBADA": "hsl(150,60%,65%)",
    "CERRADA": "hsl(220,15%,50%)",
    "ANULADA": "hsl(0,30%,40%)",
  };

  return (
    <TooltipProvider delayDuration={150}>
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        {/* ════════ TOPBAR ════════ */}
        <header className="sticky top-0 z-30 backdrop-blur-xl bg-background/70 border-b border-border/40">
          <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Crown className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-amber-500">CEO Cockpit</p>
                <h1 className="text-base font-black leading-none mt-0.5">{greeting}, {profile?.full_name?.split(" ")[0] || "CEO"}.</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Badge variant="outline" className={cn("gap-1.5 px-3 py-1.5 text-xs font-bold border-2", healthBg)}>
                    <Activity className={cn("h-3 w-3", healthColor)} />
                    <span className={healthColor}>{healthScore}/100</span>
                    <span className="text-muted-foreground font-normal">salud</span>
                  </Badge>
                </TooltipTrigger>
                <TooltipContent>
                  <div className="text-xs space-y-1 max-w-xs">
                    <p className="font-bold">Salud global del negocio</p>
                    <p className="text-muted-foreground">Score basado en clientes en riesgo, casos críticos, sin atención, pendientes de cobro y utilización de horas.</p>
                  </div>
                </TooltipContent>
              </Tooltip>
              <Button variant="ghost" size="icon" onClick={() => setDark(!dark)} className="h-8 w-8">
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 h-8 text-xs">
                <LogOut className="h-3.5 w-3.5" /> Salir
              </Button>
            </div>
          </div>
        </header>

        <main className="max-w-[1600px] mx-auto px-6 py-6 space-y-6">
          {/* ════════ HERO: KPIs principales ════════ */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <CEOKpi
              label="Clientes activos"
              value={activos}
              sub={`${implClients.length} impl · ${soporteClients.length} soporte`}
              Icon={Building2}
              tone="primary"
              trend={atRisk > 0 ? { dir: "down", text: `${atRisk} en riesgo` } : { dir: "up", text: "Saludable" }}
            />
            <CEOKpi
              label="Boletas de soporte"
              value={ticketsActivos.length}
              sub={`${ticketsCerrados.length} resueltas · ${supportTickets.length} total`}
              Icon={Headset}
              tone="info"
              trend={sinAtencion > 0 ? { dir: "down", text: `${sinAtencion} sin asignar` } : null}
            />
            <CEOKpi
              label="Contrato anual"
              value={fmtMoney(totalContractValue)}
              sub={`${fmtMoney(totalPaid)} cobrado · ${collectionRate}%`}
              Icon={DollarSign}
              tone="emerald"
              trend={collectionRate >= 70 ? { dir: "up", text: "Cobranza sana" } : { dir: "down", text: "Atención cobranza" }}
            />
            <CEOKpi
              label="Costo IA (30d)"
              value={fmtMoney(estimatedAICost)}
              sub={`${fmtNumber(totalAITokens)} tokens · ${totalAICalls} llamadas`}
              Icon={Brain}
              tone="violet"
              trend={null}
            />
          </div>

          {/* ════════ ALERTAS CRÍTICAS ════════ */}
          {(atRisk > 0 || criticos > 0 || sinAtencion > 0) && (
            <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
              <Card className="border-destructive/30 bg-gradient-to-br from-destructive/[0.03] via-card to-card overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertOctagon className="h-4 w-4 text-destructive" />
                    <p className="text-[11px] uppercase tracking-wider font-bold text-destructive">
                      Alertas críticas que requieren atención
                    </p>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    {atRisk > 0 && (
                      <AlertCard
                        Icon={ShieldAlert}
                        tone="destructive"
                        n={atRisk}
                        label={`${atRisk === 1 ? "cliente en riesgo" : "clientes en riesgo"}`}
                        hint={allClients.filter(c => c.status === "en-riesgo").map((c: any) => c.name).slice(0, 3).join(" · ")}
                      />
                    )}
                    {criticos > 0 && (
                      <AlertCard
                        Icon={Flame}
                        tone="destructive"
                        n={criticos}
                        label={`${criticos === 1 ? "caso crítico abierto" : "casos críticos abiertos"}`}
                        hint="Prioridad: Crítica, Impacto Negocio"
                      />
                    )}
                    {sinAtencion > 0 && (
                      <AlertCard
                        Icon={UserX}
                        tone="amber"
                        n={sinAtencion}
                        label={sinAtencion === 1 ? "boleta sin asignar" : "boletas sin asignar"}
                        hint="PENDIENTE sin responsable"
                      />
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* ════════ FINANCIERO + TICKETS TREND ════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Financiero */}
            <Card className="overflow-hidden border-emerald-500/20">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
                      <DollarSign className="h-4 w-4 text-emerald-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Financiero global</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Acumulado del año</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] gap-1 bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                    <CheckCircle2 className="h-2.5 w-2.5" />
                    {collectionRate}% cobrado
                  </Badge>
                </div>

                {/* Big numbers */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-emerald-500/[0.04] border border-emerald-500/20 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Cobrado</p>
                    <p className="text-2xl font-black tabular-nums text-emerald-500 mt-1">{fmtMoney(totalPaid)}</p>
                    <Progress value={(totalPaid / Math.max(totalBilled, 1)) * 100} className="h-1 mt-2" />
                  </div>
                  <div className="rounded-xl bg-amber-500/[0.04] border border-amber-500/20 p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pendiente</p>
                    <p className="text-2xl font-black tabular-nums text-amber-500 mt-1">{fmtMoney(totalPending)}</p>
                    <Progress value={(totalPending / Math.max(totalBilled, 1)) * 100} className="h-1 mt-2" />
                  </div>
                </div>

                {/* Mini stats */}
                <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border/40">
                  <MiniStat label="Facturado" value={fmtMoney(totalBilled)} />
                  <MiniStat label="Contratos" value={financials.length.toString()} />
                  <MiniStat label="Util. horas" value={`${utilizationPct}%`} tone={utilizationPct > 90 ? "warning" : "default"} />
                </div>
              </CardContent>
            </Card>

            {/* Tickets trend */}
            <Card className="overflow-hidden border-info/20">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-info/15 flex items-center justify-center">
                      <Activity className="h-4 w-4 text-info" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Flujo de boletas</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Últimos 30 días</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px] gap-1">
                    <Calendar className="h-2.5 w-2.5" />
                    nuevas vs cerradas
                  </Badge>
                </div>
                <div className="h-[180px]">
                  {ticketTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={ticketTrend}>
                        <defs>
                          <linearGradient id="gradNuevos" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(199,89%,55%)" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="hsl(199,89%,55%)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gradCerrados" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(150,60%,50%)" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="hsl(150,60%,50%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                        <ReTooltip contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                        <Area type="monotone" dataKey="nuevos" stroke="hsl(199,89%,55%)" fill="url(#gradNuevos)" strokeWidth={2} />
                        <Area type="monotone" dataKey="cerrados" stroke="hsl(150,60%,50%)" fill="url(#gradCerrados)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sin datos en últimos 30 días</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ════════ DISTRIBUCIÓN BOLETAS + CAUSAS RAÍZ ════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Estados pie */}
            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
                    <Layers className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Distribución por estado</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{supportTickets.length} boletas</p>
                  </div>
                </div>
                <div className="h-[180px]">
                  {ticketsByEstado.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={ticketsByEstado} cx="50%" cy="50%" innerRadius={50} outerRadius={75} dataKey="value" stroke="hsl(var(--background))" strokeWidth={2}>
                          {ticketsByEstado.map((entry, i) => (
                            <Cell key={`cell-${i}`} fill={COLORS_PIE[entry.name] || CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <ReTooltip contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sin datos</div>
                  )}
                </div>
                <div className="space-y-1">
                  {ticketsByEstado.slice(0, 4).map(e => (
                    <div key={e.name} className="flex items-center gap-2 text-[11px]">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: COLORS_PIE[e.name] || "hsl(220,15%,50%)" }} />
                      <span className="flex-1 truncate text-muted-foreground">{e.name}</span>
                      <span className="font-black tabular-nums">{e.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Productos */}
            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
                    <Target className="h-4 w-4 text-violet-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Carga por producto</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{ticketsByProducto.length} líneas</p>
                  </div>
                </div>
                <div className="h-[180px]">
                  {ticketsByProducto.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ticketsByProducto} layout="vertical" margin={{ left: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" width={60} />
                        <ReTooltip contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                        <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                          {ticketsByProducto.map((_, i) => (
                            <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sin datos</div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Causas raíz */}
            <Card className="border-violet-500/20">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
                      <Brain className="h-4 w-4 text-violet-500" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Causas raíz (IA)</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                        {conCausaRaiz} clasificadas · {sinCausaRaiz} pendientes
                      </p>
                    </div>
                  </div>
                </div>

                {conCausaRaiz === 0 ? (
                  <div className="h-[180px] flex flex-col items-center justify-center text-center space-y-2">
                    <Sparkles className="h-8 w-8 text-violet-500/40" />
                    <p className="text-xs text-muted-foreground">
                      Aún no hay clasificaciones IA.<br/>
                      Pedile al equipo PM que corra <span className="font-mono text-violet-500">"Clasificar pendientes"</span> en Soporte.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {topCausasRaiz.map((c) => {
                      const pct = conCausaRaiz > 0 ? Math.round((c.count / conCausaRaiz) * 100) : 0;
                      return (
                        <div key={c.name}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold truncate flex-1">{c.name}</span>
                            <span className="text-[10px] tabular-nums text-muted-foreground ml-2 shrink-0">
                              <span className="font-bold text-violet-500">{c.count}</span> · {pct}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-violet-500/10 overflow-hidden">
                            <div className="h-full bg-gradient-to-r from-violet-500 to-violet-400 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* ════════ CARGA POR CLIENTE + IA TREND ════════ */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Top clientes */}
            <Card className="lg:col-span-2">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/15 flex items-center justify-center">
                      <Users className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-bold">Top clientes por carga de soporte</p>
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Boletas activas + cerradas</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{topClientesByLoad.length} de {supportClients.length}</Badge>
                </div>
                <div className="space-y-2">
                  {topClientesByLoad.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-8">Sin tickets aún</p>
                  ) : topClientesByLoad.map((c, i) => {
                    const max = topClientesByLoad[0].count;
                    const pct = max > 0 ? Math.round((c.count / max) * 100) : 0;
                    const total = supportTickets.length;
                    const pctTotal = total > 0 ? Math.round((c.count / total) * 100) : 0;
                    return (
                      <div key={c.name} className="flex items-center gap-3">
                        <div className="h-7 w-7 rounded-md bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center shrink-0 border border-primary/20">
                          <span className="text-[10px] font-black text-primary tabular-nums">#{i + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-semibold truncate">{c.name}</span>
                            <span className="text-[10px] tabular-nums text-muted-foreground ml-2 shrink-0">
                              <span className="font-bold text-foreground">{c.count}</span> · {pctTotal}%
                            </span>
                          </div>
                          <div className="h-1.5 rounded-full bg-muted/40 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{ width: `${pct}%`, background: CHART_COLORS[i % CHART_COLORS.length] }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* IA usage trend */}
            <Card className="border-violet-500/20">
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
                    <Brain className="h-4 w-4 text-violet-500" />
                  </div>
                  <div>
                    <p className="text-sm font-bold">Uso IA</p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Llamadas últimos 14 días</p>
                  </div>
                </div>
                <div className="h-[140px]">
                  {aiTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={aiTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                        <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                        <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
                        <ReTooltip contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
                        <Line type="monotone" dataKey="calls" stroke="hsl(280,60%,60%)" strokeWidth={2} dot={{ r: 3 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">Sin actividad IA</div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
                  <MiniStat label="Tokens 30d" value={fmtNumber(totalAITokens)} />
                  <MiniStat label="Costo est." value={fmtMoney(estimatedAICost)} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* ════════ FOOTER — LIVE DATA INDICATOR ════════ */}
          <div className="text-center text-[10px] text-muted-foreground pt-4">
            <p>
              <span className="inline-flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                Datos en vivo
              </span>
              {" · "}
              Actualizado {now.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}
              {" · "}
              <span className="text-amber-500 font-bold">Vista CEO · Read-only</span>
            </p>
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES
// ═══════════════════════════════════════════════════════════════════════════

function CEOKpi({
  label, value, sub, Icon, tone = "primary", trend,
}: {
  label: string;
  value: string | number;
  sub: string;
  Icon: typeof Crown;
  tone?: "primary" | "info" | "emerald" | "violet" | "amber";
  trend: { dir: "up" | "down"; text: string } | null;
}) {
  const tones = {
    primary: { bg: "from-primary/10 to-primary/5 border-primary/20", icon: "bg-primary/15 text-primary", text: "text-primary" },
    info: { bg: "from-info/10 to-info/5 border-info/20", icon: "bg-info/15 text-info", text: "text-info" },
    emerald: { bg: "from-emerald-500/10 to-emerald-500/5 border-emerald-500/20", icon: "bg-emerald-500/15 text-emerald-500", text: "text-emerald-500" },
    violet: { bg: "from-violet-500/10 to-violet-500/5 border-violet-500/20", icon: "bg-violet-500/15 text-violet-500", text: "text-violet-500" },
    amber: { bg: "from-amber-500/10 to-amber-500/5 border-amber-500/20", icon: "bg-amber-500/15 text-amber-500", text: "text-amber-500" },
  };
  const t = tones[tone];
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
      <Card className={cn("relative overflow-hidden bg-gradient-to-br border h-full", t.bg)}>
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className={cn("h-9 w-9 rounded-xl flex items-center justify-center shrink-0", t.icon)}>
              <Icon className="h-4 w-4" />
            </div>
            {trend && (
              <Badge variant="outline" className={cn(
                "gap-1 text-[9px] h-5 px-1.5",
                trend.dir === "up" ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/30" : "bg-destructive/10 text-destructive border-destructive/30"
              )}>
                {trend.dir === "up" ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                <span className="truncate max-w-[100px]">{trend.text}</span>
              </Badge>
            )}
          </div>
          <p className={cn("text-2xl font-black tabular-nums truncate leading-none", t.text)}>{value}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mt-1.5">{label}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate" title={sub}>{sub}</p>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function AlertCard({ Icon, tone, n, label, hint }: { Icon: typeof Crown; tone: "destructive" | "amber"; n: number; label: string; hint: string }) {
  const styles = {
    destructive: "bg-destructive/[0.06] border-destructive/30 text-destructive",
    amber: "bg-amber-500/[0.06] border-amber-500/30 text-amber-500",
  };
  return (
    <div className={cn("p-3 rounded-lg border flex items-center gap-3", styles[tone])}>
      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
        tone === "destructive" ? "bg-destructive/15" : "bg-amber-500/15"
      )}>
        <Icon className={cn("h-4 w-4", tone === "destructive" ? "text-destructive" : "text-amber-500")} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-black tabular-nums", tone === "destructive" ? "text-destructive" : "text-amber-500")}>
          {n} <span className="text-xs font-normal text-foreground">{label}</span>
        </p>
        <p className="text-[10px] text-muted-foreground truncate mt-0.5" title={hint}>{hint}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground/40 shrink-0" />
    </div>
  );
}

function MiniStat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warning" }) {
  return (
    <div>
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold truncate">{label}</p>
      <p className={cn("text-sm font-black tabular-nums truncate", tone === "warning" && "text-amber-500")}>{value}</p>
    </div>
  );
}
