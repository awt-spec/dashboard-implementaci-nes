/**
 * CEO Dashboard — Lovable-style cockpit ejecutivo.
 * Estética: glass-morphism, gradient text, cinematic hero, generous spacing,
 * vibrant accent glows, dramatic typography hierarchy.
 */
import { useMemo, useState, useEffect } from "react";
import { useClients } from "@/hooks/useClients";
import { useAllSupportTickets, useSupportClients } from "@/hooks/useSupportTickets";
import { useAIUsageLogs } from "@/hooks/useAIUsageLogs";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Crown, Building2, Headset, Brain, ShieldAlert,
  TrendingUp, TrendingDown, DollarSign, Activity,
  Sparkles, Layers, Target, Flame, AlertOctagon, Moon, Sun,
  LogOut, ArrowUpRight, UserX, Zap,
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

const COLORS_PIE: Record<string, string> = {
  "ENTREGADA": "hsl(150,70%,55%)",
  "EN ATENCIÓN": "hsl(199,89%,60%)",
  "PENDIENTE": "hsl(0,75%,65%)",
  "POR CERRAR": "hsl(31,95%,60%)",
  "COTIZADA": "hsl(43,95%,60%)",
  "VALORACIÓN": "hsl(270,80%,70%)",
  "ON HOLD": "hsl(220,15%,55%)",
  "APROBADA": "hsl(150,60%,70%)",
  "CERRADA": "hsl(220,15%,50%)",
  "ANULADA": "hsl(0,30%,40%)",
};

const PRODUCT_COLORS = [
  "hsl(217,91%,60%)",   // blue
  "hsl(280,80%,65%)",   // violet
  "hsl(150,65%,55%)",   // emerald
  "hsl(38,95%,60%)",    // amber
  "hsl(0,75%,65%)",     // rose
  "hsl(199,89%,60%)",   // sky
];

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

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Buenos días" : now.getHours() < 19 ? "Buenas tardes" : "Buenas noches";
  const formattedDate = now.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // ─── Cálculos ───────────────────────────────────────────────────────────
  const allClients = clients as any[];
  const implClients = allClients.filter(c => c.client_type === "implementacion");
  const soporteClients = allClients.filter(c => c.client_type === "soporte");
  const atRisk = allClients.filter(c => c.status === "en-riesgo").length;
  const activos = allClients.filter(c => c.status === "activo").length;

  const ticketsActivos = supportTickets.filter(t => !["CERRADA", "ANULADA"].includes(t.estado));
  const ticketsCerrados = supportTickets.filter(t => ["CERRADA", "ANULADA"].includes(t.estado));
  const sinAtencion = ticketsActivos.filter(t => t.estado === "PENDIENTE" && !t.responsable).length;
  const criticos = ticketsActivos.filter(t => /critica/i.test(t.prioridad || "")).length;
  const conCausaRaiz = supportTickets.filter(t => t.ai_classification).length;
  const sinCausaRaiz = supportTickets.length - conCausaRaiz;

  const topCausasRaiz = useMemo(() => {
    const counts: Record<string, number> = {};
    supportTickets.forEach(t => {
      if (!t.ai_classification) return;
      counts[t.ai_classification] = (counts[t.ai_classification] || 0) + 1;
    });
    return Object.entries(counts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [supportTickets]);

  const ticketsByEstado = useMemo(() => {
    const counts: Record<string, number> = {};
    supportTickets.forEach(t => { counts[t.estado] = (counts[t.estado] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
  }, [supportTickets]);

  const ticketsByProducto = useMemo(() => {
    const counts: Record<string, number> = {};
    supportTickets.forEach(t => { if (!t.producto) return; counts[t.producto] = (counts[t.producto] || 0) + 1; });
    return Object.entries(counts).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  }, [supportTickets]);

  const topClientesByLoad = useMemo(() => {
    const counts: Record<string, number> = {};
    supportTickets.forEach(t => { counts[t.client_id] = (counts[t.client_id] || 0) + 1; });
    return Object.entries(counts).map(([cid, n]) => {
      const client = supportClients.find((c: any) => c.id === cid) as any;
      return { name: client?.name || cid, count: n };
    }).sort((a, b) => b.count - a.count).slice(0, 7);
  }, [supportTickets, supportClients]);

  const totalContractValue = financials.reduce((s, f) => s + (f.contract_value || 0), 0);
  const totalBilled = financials.reduce((s, f) => s + (f.billed || 0), 0);
  const totalPaid = financials.reduce((s, f) => s + (f.paid || 0), 0);
  const totalPending = financials.reduce((s, f) => s + (f.pending || 0), 0);
  const totalHoursEstimated = financials.reduce((s, f) => s + (f.hours_estimated || 0), 0);
  const totalHoursUsed = financials.reduce((s, f) => s + (f.hours_used || 0), 0);
  const collectionRate = totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0;
  const utilizationPct = totalHoursEstimated > 0 ? Math.round((totalHoursUsed / totalHoursEstimated) * 100) : 0;

  const last30 = Date.now() - 30 * 86400000;
  const recent30 = aiLogs.filter(l => new Date(l.created_at).getTime() >= last30);
  const totalAICalls = recent30.length;
  const totalAITokens = recent30.reduce((s, l) => s + (l.total_tokens || 0), 0);
  const estimatedAICost = (totalAITokens / 1000) * 0.000075;

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

  const healthScore = useMemo(() => {
    let score = 100;
    if (atRisk > 0) score -= atRisk * 8;
    if (criticos > 0) score -= Math.min(criticos * 4, 20);
    if (sinAtencion > 5) score -= Math.min((sinAtencion - 5) * 2, 15);
    if (totalPending > totalContractValue * 0.3) score -= 10;
    if (utilizationPct > 90) score -= 8;
    return Math.max(0, score);
  }, [atRisk, criticos, sinAtencion, totalPending, totalContractValue, utilizationPct]);

  const healthLabel = healthScore >= 80 ? "Excelente" : healthScore >= 60 ? "Estable" : "Atención";
  const healthGradient = healthScore >= 80
    ? "from-emerald-500 to-teal-400"
    : healthScore >= 60
    ? "from-amber-500 to-orange-400"
    : "from-rose-500 to-red-400";

  const heroSubtitle =
    atRisk > 0 ? `${atRisk} ${atRisk === 1 ? "cliente requiere atención" : "clientes requieren atención"}` :
    criticos > 0 ? `${criticos} ${criticos === 1 ? "caso crítico abierto" : "casos críticos abiertos"}` :
    sinAtencion > 0 ? `${sinAtencion} ${sinAtencion === 1 ? "boleta esperando asignación" : "boletas esperando asignación"}` :
    "Todo bajo control. El negocio funciona como un reloj.";

  return (
    <TooltipProvider delayDuration={150}>
      <div className="relative min-h-screen overflow-x-hidden">
        {/* ════════════════════════════════════════════════════════════════
            BACKGROUND: gradient + animated orbs (Lovable signature)
        ════════════════════════════════════════════════════════════════ */}
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-background" />
          <div className="absolute top-0 -left-32 h-[500px] w-[500px] rounded-full bg-amber-500/10 blur-[120px] animate-pulse" style={{ animationDuration: "8s" }} />
          <div className="absolute top-1/3 -right-32 h-[600px] w-[600px] rounded-full bg-violet-500/10 blur-[140px] animate-pulse" style={{ animationDuration: "11s", animationDelay: "2s" }} />
          <div className="absolute bottom-0 left-1/3 h-[400px] w-[400px] rounded-full bg-blue-500/8 blur-[100px] animate-pulse" style={{ animationDuration: "10s", animationDelay: "4s" }} />
        </div>

        {/* ════════════════════════════════════════════════════════════════
            STICKY GLASS TOPBAR
        ════════════════════════════════════════════════════════════════ */}
        <header className="sticky top-0 z-40 backdrop-blur-2xl bg-background/40 border-b border-border/30">
          <div className="max-w-[1400px] mx-auto px-6 lg:px-10 py-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl blur-md opacity-60" />
                <div className="relative h-10 w-10 rounded-2xl bg-gradient-to-br from-amber-400 via-amber-500 to-orange-600 flex items-center justify-center shadow-2xl shadow-amber-500/40">
                  <Crown className="h-5 w-5 text-white" />
                </div>
              </div>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.25em] font-bold bg-gradient-to-r from-amber-500 to-orange-400 bg-clip-text text-transparent">
                  CEO Cockpit
                </p>
                <p className="text-sm font-bold leading-none mt-0.5 truncate">{profile?.full_name || "Director Ejecutivo"}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="icon" onClick={() => setDark(!dark)} className="h-9 w-9 rounded-xl hover:bg-foreground/5">
                {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={signOut} className="gap-2 h-9 px-3 rounded-xl text-xs font-semibold hover:bg-destructive/10 hover:text-destructive">
                <LogOut className="h-3.5 w-3.5" /> Cerrar sesión
              </Button>
            </div>
          </div>
        </header>

        <main className="relative max-w-[1400px] mx-auto px-6 lg:px-10 pt-10 pb-20 space-y-12">
          {/* ════════════════════════════════════════════════════════════════
              HERO: dramatic greeting + health pulse
          ════════════════════════════════════════════════════════════════ */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="relative"
          >
            <p className="text-xs uppercase tracking-[0.3em] font-bold text-muted-foreground mb-3">
              {formattedDate}
            </p>
            <h1 className="text-5xl md:text-7xl font-black leading-[0.95] tracking-tight">
              {greeting},
              <br />
              <span className="bg-gradient-to-br from-amber-400 via-orange-500 to-rose-500 bg-clip-text text-transparent">
                {profile?.full_name?.split(" ")[0] || "Director"}.
              </span>
            </h1>
            <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-2xl leading-relaxed">
              {heroSubtitle}
            </p>

            {/* Health pulse — gradient pill */}
            <div className="mt-8 flex items-center gap-3 flex-wrap">
              <div className={cn(
                "inline-flex items-center gap-3 px-5 py-2.5 rounded-full bg-gradient-to-r text-white shadow-2xl",
                healthGradient
              )}>
                <div className="relative">
                  <div className="absolute inset-0 bg-white rounded-full blur-sm opacity-50 animate-pulse" />
                  <Activity className="relative h-4 w-4" />
                </div>
                <div>
                  <span className="text-2xl font-black tabular-nums">{healthScore}</span>
                  <span className="text-xs font-semibold ml-1 opacity-90">/ 100</span>
                </div>
                <span className="text-xs font-bold uppercase tracking-wider opacity-90">{healthLabel}</span>
              </div>
              <span className="text-xs text-muted-foreground">Salud global del negocio</span>
            </div>
          </motion.section>

          {/* ════════════════════════════════════════════════════════════════
              HERO METRICS — 4 big cards with glow
          ════════════════════════════════════════════════════════════════ */}
          <section>
            <SectionLabel kicker="01" title="Pulso del negocio" subtitle="Métricas clave en tiempo real" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-5">
              <HeroMetric
                label="Clientes activos"
                value={activos.toString()}
                sub={`${implClients.length} implementación · ${soporteClients.length} soporte`}
                Icon={Building2}
                gradient="from-blue-500 to-cyan-400"
                trend={atRisk > 0 ? { dir: "down", text: `${atRisk} en riesgo` } : { dir: "up", text: "Estable" }}
                delay={0.1}
              />
              <HeroMetric
                label="Boletas activas"
                value={ticketsActivos.length.toString()}
                sub={`${ticketsCerrados.length} cerradas · ${supportTickets.length} total`}
                Icon={Headset}
                gradient="from-violet-500 to-fuchsia-400"
                trend={sinAtencion > 0 ? { dir: "down", text: `${sinAtencion} sin asignar` } : null}
                delay={0.2}
              />
              <HeroMetric
                label="Contrato anual"
                value={fmtMoney(totalContractValue)}
                sub={`${fmtMoney(totalPaid)} cobrado · ${collectionRate}%`}
                Icon={DollarSign}
                gradient="from-emerald-500 to-teal-400"
                trend={collectionRate >= 70 ? { dir: "up", text: "Cobranza sana" } : { dir: "down", text: "Atención" }}
                delay={0.3}
              />
              <HeroMetric
                label="Costo IA · 30d"
                value={fmtMoney(estimatedAICost)}
                sub={`${fmtNumber(totalAITokens)} tokens · ${totalAICalls} llamadas`}
                Icon={Brain}
                gradient="from-amber-500 to-orange-400"
                trend={null}
                delay={0.4}
              />
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════════
              ALERTS BAND — solo si hay
          ════════════════════════════════════════════════════════════════ */}
          {(atRisk > 0 || criticos > 0 || sinAtencion > 0) && (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5 }}
            >
              <SectionLabel kicker="02" title="Requieren tu atención" subtitle="Asuntos críticos abiertos" tone="destructive" />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {atRisk > 0 && (
                  <AlertCard
                    Icon={ShieldAlert}
                    n={atRisk}
                    label={atRisk === 1 ? "cliente en riesgo" : "clientes en riesgo"}
                    hint={allClients.filter(c => c.status === "en-riesgo").map((c: any) => c.name).slice(0, 3).join(" · ") || "—"}
                    gradient="from-rose-500 to-red-500"
                  />
                )}
                {criticos > 0 && (
                  <AlertCard
                    Icon={Flame}
                    n={criticos}
                    label={criticos === 1 ? "caso crítico" : "casos críticos"}
                    hint="Prioridad: Crítica, Impacto Negocio"
                    gradient="from-orange-500 to-rose-500"
                  />
                )}
                {sinAtencion > 0 && (
                  <AlertCard
                    Icon={UserX}
                    n={sinAtencion}
                    label={sinAtencion === 1 ? "boleta sin asignar" : "boletas sin asignar"}
                    hint="PENDIENTE sin responsable"
                    gradient="from-amber-500 to-orange-500"
                  />
                )}
              </div>
            </motion.section>
          )}

          {/* ════════════════════════════════════════════════════════════════
              FINANCIAL + TICKETS TREND
          ════════════════════════════════════════════════════════════════ */}
          <section>
            <SectionLabel kicker="03" title="Operación y finanzas" subtitle="Cobranza, utilización y flujo" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Financiero */}
              <GlassCard glow="emerald">
                <div className="flex items-start justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <IconBubble Icon={DollarSign} gradient="from-emerald-500 to-teal-400" />
                    <div>
                      <h3 className="text-lg font-black">Financiero</h3>
                      <p className="text-xs text-muted-foreground">Acumulado del año</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black tabular-nums bg-gradient-to-r from-emerald-500 to-teal-400 bg-clip-text text-transparent">
                      {collectionRate}%
                    </p>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">cobrado</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-5">
                  <BigStat label="Cobrado" value={fmtMoney(totalPaid)} pct={(totalPaid / Math.max(totalBilled, 1)) * 100} gradient="from-emerald-500 to-teal-400" />
                  <BigStat label="Pendiente" value={fmtMoney(totalPending)} pct={(totalPending / Math.max(totalBilled, 1)) * 100} gradient="from-amber-500 to-orange-400" />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-5 border-t border-border/30">
                  <MicroStat label="Facturado" value={fmtMoney(totalBilled)} />
                  <MicroStat label="Contratos" value={financials.length.toString()} />
                  <MicroStat label="Util. horas" value={`${utilizationPct}%`} highlight={utilizationPct > 90} />
                </div>
              </GlassCard>

              {/* Tickets trend */}
              <GlassCard glow="info">
                <div className="flex items-start justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <IconBubble Icon={Activity} gradient="from-blue-500 to-cyan-400" />
                    <div>
                      <h3 className="text-lg font-black">Flujo de boletas</h3>
                      <p className="text-xs text-muted-foreground">Últimos 30 días</p>
                    </div>
                  </div>
                </div>
                <div className="h-[200px]">
                  {ticketTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={ticketTrend}>
                        <defs>
                          <linearGradient id="gNuevos" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(199,89%,60%)" stopOpacity={0.5} />
                            <stop offset="100%" stopColor="hsl(199,89%,60%)" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gCerrados" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(150,70%,55%)" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="hsl(150,70%,55%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
                        <ReTooltip contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px", backdropFilter: "blur(10px)" }} />
                        <Area type="monotone" dataKey="nuevos" stroke="hsl(199,89%,60%)" fill="url(#gNuevos)" strokeWidth={2.5} />
                        <Area type="monotone" dataKey="cerrados" stroke="hsl(150,70%,55%)" fill="url(#gCerrados)" strokeWidth={2.5} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyState text="Sin actividad en últimos 30 días" />
                  )}
                </div>
                <div className="flex items-center gap-4 pt-3 mt-2 border-t border-border/30">
                  <LegendDot color="hsl(199,89%,60%)" label="Nuevas" />
                  <LegendDot color="hsl(150,70%,55%)" label="Cerradas" />
                </div>
              </GlassCard>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════════
              DISTRIBUTION TRIO — estados / productos / causas
          ════════════════════════════════════════════════════════════════ */}
          <section>
            <SectionLabel kicker="04" title="Inteligencia operativa" subtitle="Distribución, productos y análisis IA" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Estados */}
              <GlassCard glow="primary">
                <div className="flex items-center gap-3 mb-5">
                  <IconBubble Icon={Layers} gradient="from-blue-500 to-indigo-500" />
                  <div>
                    <h3 className="text-base font-black">Estados</h3>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{supportTickets.length} boletas</p>
                  </div>
                </div>
                <div className="h-[180px] flex items-center justify-center">
                  {ticketsByEstado.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={ticketsByEstado} cx="50%" cy="50%" innerRadius={45} outerRadius={75} dataKey="value" stroke="hsl(var(--background))" strokeWidth={3}>
                          {ticketsByEstado.map((entry, i) => (
                            <Cell key={i} fill={COLORS_PIE[entry.name] || PRODUCT_COLORS[i % PRODUCT_COLORS.length]} />
                          ))}
                        </Pie>
                        <ReTooltip contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px" }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <EmptyState text="Sin datos" />}
                </div>
                <div className="space-y-1.5 mt-3">
                  {ticketsByEstado.slice(0, 4).map(e => (
                    <div key={e.name} className="flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ background: COLORS_PIE[e.name] || "hsl(220,15%,50%)" }} />
                      <span className="flex-1 truncate text-muted-foreground">{e.name}</span>
                      <span className="font-black tabular-nums">{e.value}</span>
                    </div>
                  ))}
                </div>
              </GlassCard>

              {/* Productos */}
              <GlassCard glow="violet">
                <div className="flex items-center gap-3 mb-5">
                  <IconBubble Icon={Target} gradient="from-violet-500 to-fuchsia-500" />
                  <div>
                    <h3 className="text-base font-black">Productos</h3>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{ticketsByProducto.length} líneas</p>
                  </div>
                </div>
                <div className="h-[200px]">
                  {ticketsByProducto.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ticketsByProducto} layout="vertical" margin={{ left: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={60} axisLine={false} tickLine={false} />
                        <ReTooltip contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px" }} />
                        <Bar dataKey="value" radius={[0, 8, 8, 0]}>
                          {ticketsByProducto.map((_, i) => <Cell key={i} fill={PRODUCT_COLORS[i % PRODUCT_COLORS.length]} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <EmptyState text="Sin datos" />}
                </div>
              </GlassCard>

              {/* Causas raíz */}
              <GlassCard glow="amber">
                <div className="flex items-center gap-3 mb-5">
                  <IconBubble Icon={Brain} gradient="from-amber-500 to-orange-500" />
                  <div>
                    <h3 className="text-base font-black">Causas raíz</h3>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{conCausaRaiz} de {supportTickets.length} clasificadas</p>
                  </div>
                </div>
                {conCausaRaiz === 0 ? (
                  <div className="h-[200px] flex flex-col items-center justify-center text-center space-y-3 px-4">
                    <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center">
                      <Sparkles className="h-6 w-6 text-amber-500" />
                    </div>
                    <p className="text-sm font-semibold">Sin clasificación IA aún</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      Pedile al equipo PM que ejecute<br/>
                      <span className="font-mono text-amber-500 font-bold">"Clasificar pendientes"</span> en Soporte
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {topCausasRaiz.map((c, i) => {
                      const pct = conCausaRaiz > 0 ? Math.round((c.count / conCausaRaiz) * 100) : 0;
                      return (
                        <div key={c.name} className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-semibold truncate flex-1 mr-2">{c.name}</span>
                            <span className="text-[10px] tabular-nums text-muted-foreground font-bold shrink-0">
                              <span className="text-amber-500">{c.count}</span> · {pct}%
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-amber-500/10 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.8, delay: i * 0.05, ease: "easeOut" }}
                              className="h-full bg-gradient-to-r from-amber-500 to-orange-400 rounded-full"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </GlassCard>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════════
              TOP CLIENTS + AI USAGE
          ════════════════════════════════════════════════════════════════ */}
          <section>
            <SectionLabel kicker="05" title="Carga y consumo" subtitle="Top clientes y uso de inteligencia artificial" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Top clients */}
              <GlassCard glow="primary" className="lg:col-span-2">
                <div className="flex items-center justify-between mb-5">
                  <div className="flex items-center gap-3">
                    <IconBubble Icon={Building2} gradient="from-blue-500 to-cyan-400" />
                    <div>
                      <h3 className="text-lg font-black">Top clientes por carga</h3>
                      <p className="text-xs text-muted-foreground">Boletas activas + cerradas</p>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground bg-muted/40 px-3 py-1.5 rounded-full">
                    {topClientesByLoad.length} de {supportClients.length}
                  </span>
                </div>
                {topClientesByLoad.length === 0 ? (
                  <EmptyState text="Sin tickets aún" />
                ) : (
                  <div className="space-y-3">
                    {topClientesByLoad.map((c, i) => {
                      const max = topClientesByLoad[0].count;
                      const pct = max > 0 ? Math.round((c.count / max) * 100) : 0;
                      const total = supportTickets.length;
                      const pctTotal = total > 0 ? Math.round((c.count / total) * 100) : 0;
                      return (
                        <motion.div
                          key={c.name}
                          initial={{ opacity: 0, x: -10 }}
                          whileInView={{ opacity: 1, x: 0 }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.4, delay: i * 0.06 }}
                          className="flex items-center gap-4"
                        >
                          <div className={cn(
                            "h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border bg-gradient-to-br text-white font-black text-xs shadow-lg",
                            i === 0 ? "from-amber-400 to-orange-500 shadow-amber-500/30 border-amber-500/40" :
                            i === 1 ? "from-slate-300 to-slate-400 shadow-slate-400/30 border-slate-400/40" :
                            i === 2 ? "from-orange-700 to-amber-700 shadow-orange-700/30 border-orange-700/40" :
                            "from-muted/60 to-muted/40 border-border text-muted-foreground"
                          )}>
                            {i + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-bold truncate">{c.name}</span>
                              <span className="text-[10px] tabular-nums text-muted-foreground ml-2 shrink-0 font-semibold">
                                <span className="text-foreground font-black">{c.count}</span> boletas · {pctTotal}%
                              </span>
                            </div>
                            <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                whileInView={{ width: `${pct}%` }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8, delay: i * 0.05 + 0.2, ease: "easeOut" }}
                                className="h-full rounded-full bg-gradient-to-r"
                                style={{ background: `linear-gradient(to right, ${PRODUCT_COLORS[i % PRODUCT_COLORS.length]}, ${PRODUCT_COLORS[(i + 1) % PRODUCT_COLORS.length]})` }}
                              />
                            </div>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </GlassCard>

              {/* AI usage */}
              <GlassCard glow="violet">
                <div className="flex items-center gap-3 mb-5">
                  <IconBubble Icon={Zap} gradient="from-violet-500 to-fuchsia-500" />
                  <div>
                    <h3 className="text-base font-black">Inteligencia artificial</h3>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Últimos 14 días</p>
                  </div>
                </div>
                <div className="h-[140px] -mx-2">
                  {aiTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={aiTrend}>
                        <defs>
                          <linearGradient id="lineAI" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="hsl(280,80%,65%)" />
                            <stop offset="100%" stopColor="hsl(310,80%,70%)" />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.2} />
                        <XAxis dataKey="date" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" axisLine={false} tickLine={false} width={28} />
                        <ReTooltip contentStyle={{ fontSize: 11, background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "12px" }} />
                        <Line type="monotone" dataKey="calls" stroke="url(#lineAI)" strokeWidth={3} dot={{ r: 4, fill: "hsl(280,80%,65%)" }} activeDot={{ r: 6 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <EmptyState text="Sin actividad IA" />}
                </div>
                <div className="grid grid-cols-2 gap-3 pt-4 border-t border-border/30">
                  <MicroStat label="Tokens · 30d" value={fmtNumber(totalAITokens)} />
                  <MicroStat label="Costo est." value={fmtMoney(estimatedAICost)} />
                </div>
              </GlassCard>
            </div>
          </section>

          {/* ════════════════════════════════════════════════════════════════
              FOOTER — live indicator
          ════════════════════════════════════════════════════════════════ */}
          <footer className="text-center text-xs text-muted-foreground pt-8 border-t border-border/30">
            <div className="flex items-center justify-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="font-semibold">Datos en vivo</span>
              </span>
              <span>·</span>
              <span>Actualizado {now.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/30 font-bold text-[10px] uppercase tracking-wider">
                <Crown className="h-2.5 w-2.5" /> Vista CEO · Read-only
              </span>
            </div>
          </footer>
        </main>
      </div>
    </TooltipProvider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES (estilo Lovable)
// ═══════════════════════════════════════════════════════════════════════════

function SectionLabel({ kicker, title, subtitle, tone }: { kicker: string; title: string; subtitle: string; tone?: "default" | "destructive" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
      className="mb-6"
    >
      <div className="flex items-baseline gap-3">
        <span className={cn(
          "text-xs font-mono font-bold tracking-wider px-2 py-0.5 rounded",
          tone === "destructive" ? "bg-destructive/10 text-destructive" : "bg-muted/50 text-muted-foreground"
        )}>
          {kicker}
        </span>
        <h2 className="text-2xl md:text-3xl font-black tracking-tight">{title}</h2>
      </div>
      <p className="text-sm text-muted-foreground mt-1.5 ml-12">{subtitle}</p>
    </motion.div>
  );
}

function GlassCard({ children, glow = "primary", className }: { children: React.ReactNode; glow?: "primary" | "info" | "emerald" | "violet" | "amber"; className?: string }) {
  const glowColors = {
    primary: "before:bg-primary/10",
    info: "before:bg-blue-500/10",
    emerald: "before:bg-emerald-500/10",
    violet: "before:bg-violet-500/10",
    amber: "before:bg-amber-500/10",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className={cn(
        "relative rounded-3xl border border-border/40 bg-card/60 backdrop-blur-xl p-6 lg:p-7 shadow-xl overflow-hidden",
        "before:absolute before:-top-24 before:-right-24 before:h-48 before:w-48 before:rounded-full before:blur-3xl before:opacity-50 before:pointer-events-none",
        glowColors[glow],
        className
      )}
    >
      <div className="relative">{children}</div>
    </motion.div>
  );
}

function HeroMetric({
  label, value, sub, Icon, gradient, trend, delay = 0,
}: {
  label: string;
  value: string;
  sub: string;
  Icon: typeof Crown;
  gradient: string;
  trend: { dir: "up" | "down"; text: string } | null;
  delay?: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: "easeOut" }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className="group relative"
    >
      {/* Glow on hover */}
      <div className={cn("absolute inset-0 rounded-3xl bg-gradient-to-br opacity-0 group-hover:opacity-30 blur-xl transition-opacity duration-500", gradient)} />

      <div className="relative h-full rounded-3xl border border-border/40 bg-card/70 backdrop-blur-xl p-6 overflow-hidden">
        {/* Animated gradient line top */}
        <div className={cn("absolute top-0 inset-x-0 h-px bg-gradient-to-r opacity-60", gradient)} />

        <div className="flex items-start justify-between gap-2 mb-4">
          <div className={cn(
            "relative h-12 w-12 rounded-2xl bg-gradient-to-br flex items-center justify-center shadow-lg",
            gradient
          )}>
            <Icon className="h-5 w-5 text-white" />
            <div className={cn("absolute inset-0 rounded-2xl bg-gradient-to-br blur-md opacity-50 -z-10", gradient)} />
          </div>
          {trend && (
            <div className={cn(
              "inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
              trend.dir === "up" ? "bg-emerald-500/15 text-emerald-500" : "bg-rose-500/15 text-rose-500"
            )}>
              {trend.dir === "up" ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
              <span className="truncate max-w-[90px]">{trend.text}</span>
            </div>
          )}
        </div>

        <p className={cn("text-4xl md:text-5xl font-black tabular-nums tracking-tight bg-gradient-to-br bg-clip-text text-transparent leading-none", gradient)}>
          {value}
        </p>
        <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold mt-3">{label}</p>
        <p className="text-[11px] text-muted-foreground mt-1 truncate" title={sub}>{sub}</p>

        <ArrowUpRight className="absolute top-4 right-4 h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-foreground group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
      </div>
    </motion.div>
  );
}

function AlertCard({ Icon, n, label, hint, gradient }: { Icon: typeof Crown; n: number; label: string; hint: string; gradient: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      whileInView={{ opacity: 1, scale: 1 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      whileHover={{ y: -2 }}
      className="group relative"
    >
      <div className={cn("absolute inset-0 rounded-2xl bg-gradient-to-br opacity-0 group-hover:opacity-20 blur-xl transition-opacity duration-500", gradient)} />
      <div className="relative rounded-2xl border border-border/40 bg-card/60 backdrop-blur-xl p-4 flex items-center gap-3">
        <div className={cn("h-11 w-11 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg shrink-0", gradient)}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-2xl font-black tabular-nums leading-none">
            <span className={cn("bg-gradient-to-br bg-clip-text text-transparent", gradient)}>{n}</span>
          </p>
          <p className="text-xs text-foreground font-semibold mt-1 leading-tight">{label}</p>
          <p className="text-[10px] text-muted-foreground truncate mt-0.5" title={hint}>{hint}</p>
        </div>
        <AlertOctagon className="h-4 w-4 text-muted-foreground/40 shrink-0" />
      </div>
    </motion.div>
  );
}

function IconBubble({ Icon, gradient }: { Icon: typeof Crown; gradient: string }) {
  return (
    <div className={cn(
      "relative h-10 w-10 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-lg shrink-0",
      gradient
    )}>
      <Icon className="h-4 w-4 text-white" />
      <div className={cn("absolute inset-0 rounded-xl bg-gradient-to-br blur-md opacity-40 -z-10", gradient)} />
    </div>
  );
}

function BigStat({ label, value, pct, gradient }: { label: string; value: string; pct: number; gradient: string }) {
  return (
    <div className="relative rounded-2xl border border-border/40 bg-background/40 backdrop-blur p-4 overflow-hidden">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{label}</p>
      <p className={cn("text-3xl font-black tabular-nums mt-1 bg-gradient-to-r bg-clip-text text-transparent", gradient)}>{value}</p>
      <div className="h-1 rounded-full bg-muted/40 overflow-hidden mt-3">
        <motion.div
          initial={{ width: 0 }}
          whileInView={{ width: `${Math.min(pct, 100)}%` }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={cn("h-full rounded-full bg-gradient-to-r", gradient)}
        />
      </div>
    </div>
  );
}

function MicroStat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-bold truncate">{label}</p>
      <p className={cn("text-base font-black tabular-nums truncate mt-0.5", highlight && "text-amber-500")}>{value}</p>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground font-semibold">
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="h-full flex items-center justify-center text-xs text-muted-foreground">
      {text}
    </div>
  );
}
