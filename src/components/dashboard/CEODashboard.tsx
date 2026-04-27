/**
 * CEO Dashboard — estilo Lovable: industrial, técnico, sharp.
 * Inspirado en Linear / Vercel / Resend / Lovable.dev.
 * Características: monospace tech, hairline borders, geometric grid bg,
 * angular cards, single accent (lime), high contrast, dense data.
 */
import { useMemo, useState, useEffect } from "react";
import { useClients } from "@/hooks/useClients";
import { useAllSupportTickets, useSupportClients } from "@/hooks/useSupportTickets";
import { useAIUsageLogs } from "@/hooks/useAIUsageLogs";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Crown, Building2, Headset, Brain, ShieldAlert,
  ArrowUp, ArrowDown, DollarSign, Activity,
  Sparkles, Layers, Target, Flame, AlertOctagon, Moon, Sun,
  LogOut, ArrowUpRight, UserX, Zap, Minus,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as ReTooltip, LineChart, Line,
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

const ACCENT = "hsl(82,84%,55%)"; // lime-400 — único accent color

// ═══════════════════════════════════════════════════════════════════════════
// CEO DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

export function CEODashboard() {
  const { profile, signOut } = useAuth();
  const { data: clients = [] } = useClients();
  const { data: supportTickets = [] } = useAllSupportTickets();
  const { data: supportClients = [] } = useSupportClients();
  const { data: aiLogs = [] } = useAIUsageLogs();

  // Forzar dark mode al montar (estilo Lovable)
  const [dark, setDark] = useState(true);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  const [financials, setFinancials] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("client_financials" as any).select("*").then(({ data }) => setFinancials(data || []));
  }, []);

  const now = new Date();
  const greeting = now.getHours() < 12 ? "Buenos días" : now.getHours() < 19 ? "Buenas tardes" : "Buenas noches";
  const ts = now.toLocaleString("es", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).toUpperCase();

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
    const byDay: Record<string, { date: string; calls: number }> = {};
    const last14 = Date.now() - 14 * 86400000;
    aiLogs.filter(l => new Date(l.created_at).getTime() >= last14).forEach(l => {
      const d = l.created_at.split("T")[0];
      if (!byDay[d]) byDay[d] = { date: d.slice(5), calls: 0 };
      byDay[d].calls++;
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

  const healthState = healthScore >= 80 ? "OPTIMAL" : healthScore >= 60 ? "STABLE" : "ATTENTION";
  const healthColor = healthScore >= 80 ? "text-lime-400" : healthScore >= 60 ? "text-amber-400" : "text-rose-400";
  const healthBg = healthScore >= 80 ? "border-lime-500/40 bg-lime-500/5" : healthScore >= 60 ? "border-amber-500/40 bg-amber-500/5" : "border-rose-500/40 bg-rose-500/5";

  return (
    <div className="relative min-h-screen bg-[#0a0a0a] text-white overflow-x-hidden">
      {/* ════════════════════════════════════════════════════════════════
          GEOMETRIC GRID BG
      ════════════════════════════════════════════════════════════════ */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(to right, white 1px, transparent 1px),
            linear-gradient(to bottom, white 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
        }}
      />
      {/* Subtle ambient glow — solo uno, contenido */}
      <div className="fixed top-0 right-0 h-[600px] w-[600px] rounded-full bg-lime-500/[0.04] blur-[120px] pointer-events-none" />

      {/* ════════════════════════════════════════════════════════════════
          STICKY TOPBAR — sharp
      ════════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-md">
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* Logo cuadrado, no redondeado */}
            <div className="relative h-8 w-8 bg-lime-400 flex items-center justify-center">
              <Crown className="h-4 w-4 text-black" strokeWidth={2.5} />
              <div className="absolute inset-0 bg-lime-400 blur-sm opacity-50 -z-10" />
            </div>
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">
                ceo / cockpit
              </span>
              <span className="text-white/20">/</span>
              <span className="text-sm font-semibold truncate">{profile?.full_name || "Director Ejecutivo"}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Live indicator */}
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 border border-white/10 font-mono text-[10px] uppercase tracking-wider text-white/60">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full bg-lime-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 bg-lime-400" />
              </span>
              live
            </div>
            <span className="hidden md:inline font-mono text-[10px] text-white/40 tracking-wider">{ts}</span>
            <Button variant="ghost" size="icon" onClick={() => setDark(!dark)} className="h-8 w-8 rounded-none hover:bg-white/5">
              {dark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 h-8 px-3 rounded-none text-xs font-mono uppercase tracking-wider text-white/60 hover:text-white hover:bg-white/5">
              <LogOut className="h-3 w-3" /> exit
            </Button>
          </div>
        </div>
      </header>

      <main className="relative max-w-[1400px] mx-auto px-6 lg:px-10 pt-16 pb-24 space-y-16">
        {/* ════════════════════════════════════════════════════════════════
            HERO — flat, dramatic typography
        ════════════════════════════════════════════════════════════════ */}
        <motion.section
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="relative"
        >
          {/* Marker line */}
          <div className="flex items-center gap-3 mb-8">
            <div className="h-px w-16 bg-lime-400" />
            <span className="font-mono text-[10px] uppercase tracking-[0.3em] text-lime-400">
              Executive Overview · {ts.split(" ").slice(0, 3).join(" ")}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-8 items-end">
            <div>
              <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold leading-[0.95] tracking-tighter">
                {greeting},
                <br />
                <span className="text-white/30">{profile?.full_name?.split(" ")[0] || "Director"}</span>
                <span className="text-lime-400">.</span>
              </h1>
              <p className="mt-6 font-mono text-xs text-white/50 uppercase tracking-wider max-w-md">
                {atRisk > 0 ? `> ${atRisk} clients at risk · action required` :
                 criticos > 0 ? `> ${criticos} critical cases open · review needed` :
                 sinAtencion > 0 ? `> ${sinAtencion} tickets unassigned` :
                 "> all systems nominal · business operating normally"}
              </p>
            </div>

            {/* Health monolith — bloque industrial */}
            <div className={cn(
              "border bg-black/40 p-5 min-w-[200px]",
              healthBg
            )}>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50 mb-2">
                Health Score
              </p>
              <div className="flex items-baseline gap-2">
                <span className={cn("text-6xl font-bold tabular-nums tracking-tighter leading-none", healthColor)}>
                  {healthScore}
                </span>
                <span className="font-mono text-sm text-white/40">/100</span>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <div className={cn("h-1 flex-1", healthScore >= 80 ? "bg-lime-400" : healthScore >= 60 ? "bg-amber-400" : "bg-rose-400")} style={{ width: `${healthScore}%` }} />
                <span className={cn("font-mono text-[10px] uppercase tracking-wider font-bold", healthColor)}>
                  {healthState}
                </span>
              </div>
            </div>
          </div>
        </motion.section>

        {/* ════════════════════════════════════════════════════════════════
            METRICS GRID — flat industrial cards
        ════════════════════════════════════════════════════════════════ */}
        <section>
          <SectionLabel num="01" title="Pulse" subtitle="Real-time business metrics" />

          <div className="grid grid-cols-2 lg:grid-cols-4 border border-white/10 divide-x divide-y lg:divide-y-0 divide-white/10">
            <Metric
              label="Active Clients"
              value={activos.toString()}
              sub={`${implClients.length} impl · ${soporteClients.length} support`}
              Icon={Building2}
              trend={atRisk > 0 ? { dir: "down", text: `${atRisk} at risk` } : { dir: "up", text: "Stable" }}
              accent="lime"
              delay={0.1}
            />
            <Metric
              label="Active Tickets"
              value={ticketsActivos.length.toString()}
              sub={`${ticketsCerrados.length} closed · ${supportTickets.length} total`}
              Icon={Headset}
              trend={sinAtencion > 0 ? { dir: "down", text: `${sinAtencion} unassigned` } : null}
              accent="cyan"
              delay={0.15}
            />
            <Metric
              label="Annual Contracts"
              value={fmtMoney(totalContractValue)}
              sub={`${fmtMoney(totalPaid)} collected · ${collectionRate}%`}
              Icon={DollarSign}
              trend={collectionRate >= 70 ? { dir: "up", text: "Healthy" } : { dir: "down", text: "Watch" }}
              accent="emerald"
              delay={0.2}
            />
            <Metric
              label="AI Cost · 30d"
              value={fmtMoney(estimatedAICost)}
              sub={`${fmtNumber(totalAITokens)} tk · ${totalAICalls} calls`}
              Icon={Brain}
              trend={null}
              accent="violet"
              delay={0.25}
            />
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            ALERTS — sharp red accent
        ════════════════════════════════════════════════════════════════ */}
        {(atRisk > 0 || criticos > 0 || sinAtencion > 0) && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
          >
            <SectionLabel num="02" title="Action Required" subtitle="Critical issues open" tone="alert" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10">
              {atRisk > 0 && (
                <AlertBlock
                  Icon={ShieldAlert}
                  n={atRisk}
                  label={atRisk === 1 ? "client at risk" : "clients at risk"}
                  hint={allClients.filter(c => c.status === "en-riesgo").map((c: any) => c.name).slice(0, 3).join(" / ") || "—"}
                  tone="rose"
                />
              )}
              {criticos > 0 && (
                <AlertBlock
                  Icon={Flame}
                  n={criticos}
                  label={criticos === 1 ? "critical case" : "critical cases"}
                  hint="Priority: Critical / Business Impact"
                  tone="rose"
                />
              )}
              {sinAtencion > 0 && (
                <AlertBlock
                  Icon={UserX}
                  n={sinAtencion}
                  label={sinAtencion === 1 ? "unassigned ticket" : "unassigned tickets"}
                  hint="Status: PENDIENTE without assignee"
                  tone="amber"
                />
              )}
            </div>
          </motion.section>
        )}

        {/* ════════════════════════════════════════════════════════════════
            FINANCIAL + TICKET FLOW
        ════════════════════════════════════════════════════════════════ */}
        <section>
          <SectionLabel num="03" title="Operations" subtitle="Revenue, utilization & flow" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-px bg-white/10">
            {/* Financial */}
            <Panel>
              <PanelHeader Icon={DollarSign} title="Financial" sub="Year-to-date · USD" />
              <div className="grid grid-cols-2 gap-px bg-white/10 -mx-5 mt-5">
                <div className="bg-[#0a0a0a] p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">Collected</p>
                  <p className="text-3xl font-bold tabular-nums text-lime-400 mt-2 tracking-tighter">{fmtMoney(totalPaid)}</p>
                  <Bar pct={(totalPaid / Math.max(totalBilled, 1)) * 100} accent="lime" />
                </div>
                <div className="bg-[#0a0a0a] p-5">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50">Pending</p>
                  <p className="text-3xl font-bold tabular-nums text-amber-400 mt-2 tracking-tighter">{fmtMoney(totalPending)}</p>
                  <Bar pct={(totalPending / Math.max(totalBilled, 1)) * 100} accent="amber" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-white/10">
                <DataPoint label="Billed" value={fmtMoney(totalBilled)} />
                <DataPoint label="Contracts" value={financials.length.toString()} />
                <DataPoint label="Util." value={`${utilizationPct}%`} highlight={utilizationPct > 90} />
              </div>
            </Panel>

            {/* Ticket flow */}
            <Panel>
              <PanelHeader Icon={Activity} title="Ticket Flow" sub="Last 30 days · new vs closed" />
              <div className="h-[200px] mt-4">
                {ticketTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={ticketTrend} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="gNuevos" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(199,89%,60%)" stopOpacity={0.4} />
                          <stop offset="100%" stopColor="hsl(199,89%,60%)" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="gCerrados" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={ACCENT} stopOpacity={0.4} />
                          <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} stroke="rgba(255,255,255,0.1)" tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} stroke="rgba(255,255,255,0.1)" tickLine={false} />
                      <ReTooltip contentStyle={{ fontSize: 11, background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 0, fontFamily: "monospace" }} />
                      <Area type="monotone" dataKey="nuevos" stroke="hsl(199,89%,60%)" fill="url(#gNuevos)" strokeWidth={1.5} />
                      <Area type="monotone" dataKey="cerrados" stroke={ACCENT} fill="url(#gCerrados)" strokeWidth={1.5} />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : <Empty label="No activity in last 30 days" />}
              </div>
              <div className="flex items-center gap-4 pt-4 mt-2 border-t border-white/10">
                <Legend color="hsl(199,89%,60%)" label="new" />
                <Legend color={ACCENT} label="closed" />
              </div>
            </Panel>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            DISTRIBUTION GRID
        ════════════════════════════════════════════════════════════════ */}
        <section>
          <SectionLabel num="04" title="Intelligence" subtitle="Distribution, products & AI analysis" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-white/10">
            {/* Estados */}
            <Panel>
              <PanelHeader Icon={Layers} title="States" sub={`${supportTickets.length} tickets total`} />
              <div className="space-y-2 mt-5">
                {ticketsByEstado.length === 0 ? (
                  <Empty label="No data" />
                ) : ticketsByEstado.slice(0, 8).map((e, i) => {
                  const max = ticketsByEstado[0].value;
                  const pct = max > 0 ? Math.round((e.value / max) * 100) : 0;
                  return (
                    <div key={e.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-white/70">
                          {e.name}
                        </span>
                        <span className="font-mono text-xs tabular-nums font-bold">{e.value}</span>
                      </div>
                      <div className="h-1.5 bg-white/[0.03] border border-white/5">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: `${pct}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.6, delay: i * 0.04, ease: "easeOut" }}
                          className="h-full"
                          style={{ background: i === 0 ? ACCENT : `rgba(255,255,255,${0.6 - i * 0.07})` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </Panel>

            {/* Productos */}
            <Panel>
              <PanelHeader Icon={Target} title="Products" sub={`${ticketsByProducto.length} product lines`} />
              <div className="h-[200px] mt-5">
                {ticketsByProducto.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={ticketsByProducto} layout="vertical" margin={{ left: 60, right: 20 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} stroke="rgba(255,255,255,0.1)" tickLine={false} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.6)", fontFamily: "monospace" }} stroke="rgba(255,255,255,0.1)" width={60} tickLine={false} />
                      <ReTooltip contentStyle={{ fontSize: 11, background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 0, fontFamily: "monospace" }} />
                      <Bar dataKey="value" fill={ACCENT} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : <Empty label="No data" />}
              </div>
            </Panel>

            {/* Causas raíz */}
            <Panel>
              <PanelHeader Icon={Brain} title="Root Causes" sub={`${conCausaRaiz}/${supportTickets.length} classified · AI`} />
              {conCausaRaiz === 0 ? (
                <div className="h-[200px] flex flex-col items-center justify-center text-center px-2 mt-5">
                  <Sparkles className="h-6 w-6 text-white/20 mb-3" />
                  <p className="font-mono text-[10px] uppercase tracking-wider text-white/40 leading-relaxed">
                    No AI classification yet
                    <br />
                    <span className="text-lime-400">→ run "Classify pending"</span>
                  </p>
                </div>
              ) : (
                <div className="space-y-3 mt-5">
                  {topCausasRaiz.map((c, i) => {
                    const pct = conCausaRaiz > 0 ? Math.round((c.count / conCausaRaiz) * 100) : 0;
                    return (
                      <div key={c.name}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-white/70 truncate">{c.name}</span>
                          <span className="font-mono text-[10px] tabular-nums font-bold ml-2 shrink-0">
                            {c.count} · {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 bg-white/[0.03] border border-white/5">
                          <motion.div
                            initial={{ width: 0 }}
                            whileInView={{ width: `${pct}%` }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.6, delay: i * 0.05 }}
                            className="h-full bg-violet-400"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Panel>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            TOP CLIENTS + AI USAGE
        ════════════════════════════════════════════════════════════════ */}
        <section>
          <SectionLabel num="05" title="Workload" subtitle="Top clients & AI consumption" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-px bg-white/10">
            <Panel className="lg:col-span-2">
              <PanelHeader Icon={Building2} title="Top Clients" sub={`${topClientesByLoad.length}/${supportClients.length} clients ranked`} />
              {topClientesByLoad.length === 0 ? (
                <Empty label="No tickets yet" />
              ) : (
                <div className="mt-5 -mx-5">
                  {topClientesByLoad.map((c, i) => {
                    const max = topClientesByLoad[0].count;
                    const pct = max > 0 ? Math.round((c.count / max) * 100) : 0;
                    const total = supportTickets.length;
                    const pctTotal = total > 0 ? Math.round((c.count / total) * 100) : 0;
                    return (
                      <motion.div
                        key={c.name}
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: i * 0.04 }}
                        className="flex items-center gap-4 px-5 py-3 border-t border-white/[0.06] hover:bg-white/[0.02] transition-colors"
                      >
                        <span className="font-mono text-[10px] tabular-nums text-white/40 w-6">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1.5 gap-2">
                            <span className="text-sm font-semibold truncate">{c.name}</span>
                            <span className="font-mono text-[10px] tabular-nums text-white/60 shrink-0">
                              <span className="font-bold text-white">{c.count}</span> · {pctTotal}%
                            </span>
                          </div>
                          <div className="h-px bg-white/5">
                            <motion.div
                              initial={{ width: 0 }}
                              whileInView={{ width: `${pct}%` }}
                              viewport={{ once: true }}
                              transition={{ duration: 0.7, delay: i * 0.04 + 0.1 }}
                              className="h-full bg-lime-400"
                            />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </Panel>

            <Panel>
              <PanelHeader Icon={Zap} title="AI Usage" sub="Last 14 days" />
              <div className="h-[140px] mt-5 -mx-2">
                {aiTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={aiTrend} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="date" tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} stroke="rgba(255,255,255,0.1)" tickLine={false} />
                      <YAxis tick={{ fontSize: 9, fill: "rgba(255,255,255,0.4)" }} stroke="rgba(255,255,255,0.1)" tickLine={false} width={28} />
                      <ReTooltip contentStyle={{ fontSize: 11, background: "#0a0a0a", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 0, fontFamily: "monospace" }} />
                      <Line type="monotone" dataKey="calls" stroke="hsl(280,80%,70%)" strokeWidth={1.5} dot={{ r: 2.5, fill: "hsl(280,80%,70%)", strokeWidth: 0 }} activeDot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                ) : <Empty label="No AI activity" />}
              </div>
              <div className="grid grid-cols-2 gap-px bg-white/10 mt-5 -mx-5 -mb-5">
                <div className="bg-[#0a0a0a] p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/50">Tokens 30d</p>
                  <p className="text-base font-bold tabular-nums mt-1 tracking-tight">{fmtNumber(totalAITokens)}</p>
                </div>
                <div className="bg-[#0a0a0a] p-4">
                  <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/50">Est. Cost</p>
                  <p className="text-base font-bold tabular-nums mt-1 tracking-tight text-violet-300">{fmtMoney(estimatedAICost)}</p>
                </div>
              </div>
            </Panel>
          </div>
        </section>

        {/* ════════════════════════════════════════════════════════════════
            FOOTER — minimal, technical
        ════════════════════════════════════════════════════════════════ */}
        <footer className="pt-8 border-t border-white/10">
          <div className="flex items-center justify-between flex-wrap gap-3 font-mono text-[10px] uppercase tracking-wider text-white/40">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 bg-lime-400 animate-pulse" />
                live data
              </span>
              <span>/</span>
              <span>{ts}</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 border border-amber-500/40 bg-amber-500/5">
              <Crown className="h-2.5 w-2.5 text-amber-400" />
              <span className="text-amber-400">CEO · READ-ONLY</span>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES (industrial style)
// ═══════════════════════════════════════════════════════════════════════════

function SectionLabel({ num, title, subtitle, tone }: { num: string; title: string; subtitle: string; tone?: "default" | "alert" }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="mb-6"
    >
      <div className="flex items-center gap-3">
        <span className={cn(
          "font-mono text-[10px] font-bold tracking-[0.2em] px-2 py-0.5 border",
          tone === "alert" ? "border-rose-500/40 text-rose-400 bg-rose-500/5" : "border-white/15 text-white/50"
        )}>
          {num}
        </span>
        <h2 className="text-2xl md:text-3xl font-bold tracking-tighter">{title}</h2>
        <div className="h-px flex-1 bg-white/10 ml-2" />
      </div>
      <p className="font-mono text-[10px] uppercase tracking-wider text-white/40 mt-2 ml-12">{subtitle}</p>
    </motion.div>
  );
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.4 }}
      className={cn("relative bg-[#0a0a0a] p-5 lg:p-6", className)}
    >
      {children}
    </motion.div>
  );
}

function PanelHeader({ Icon, title, sub }: { Icon: typeof Crown; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 pb-4 border-b border-white/[0.06]">
      <div className="h-7 w-7 border border-white/15 bg-white/[0.02] flex items-center justify-center">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold tracking-tight">{title}</p>
        <p className="font-mono text-[9px] uppercase tracking-wider text-white/40 truncate">{sub}</p>
      </div>
    </div>
  );
}

function Metric({
  label, value, sub, Icon, trend, accent, delay = 0,
}: {
  label: string;
  value: string;
  sub: string;
  Icon: typeof Crown;
  trend: { dir: "up" | "down"; text: string } | null;
  accent: "lime" | "cyan" | "emerald" | "violet";
  delay?: number;
}) {
  const accentClasses = {
    lime: "text-lime-400",
    cyan: "text-cyan-400",
    emerald: "text-emerald-400",
    violet: "text-violet-400",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
      className="group relative bg-[#0a0a0a] p-5 lg:p-6 hover:bg-white/[0.02] transition-colors"
    >
      <div className="flex items-start justify-between gap-2 mb-5">
        <div className="h-8 w-8 border border-white/15 bg-white/[0.02] flex items-center justify-center">
          <Icon className="h-4 w-4 text-white/70" strokeWidth={1.8} />
        </div>
        {trend ? (
          <div className={cn(
            "inline-flex items-center gap-1 px-2 py-0.5 border font-mono text-[9px] uppercase tracking-wider font-bold",
            trend.dir === "up" ? "border-lime-500/40 text-lime-400 bg-lime-500/5" : "border-rose-500/40 text-rose-400 bg-rose-500/5"
          )}>
            {trend.dir === "up" ? <ArrowUp className="h-2.5 w-2.5" strokeWidth={2.5} /> : <ArrowDown className="h-2.5 w-2.5" strokeWidth={2.5} />}
            <span className="truncate max-w-[80px]">{trend.text}</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1 px-2 py-0.5 border border-white/10 font-mono text-[9px] uppercase tracking-wider text-white/40">
            <Minus className="h-2.5 w-2.5" />
            stable
          </div>
        )}
      </div>

      <p className={cn("text-4xl md:text-5xl font-bold tabular-nums tracking-tighter leading-[0.9]", accentClasses[accent])}>
        {value}
      </p>
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/50 mt-3 font-bold">{label}</p>
      <p className="text-[11px] text-white/40 mt-1 truncate" title={sub}>{sub}</p>

      <ArrowUpRight className="absolute top-5 right-5 h-3 w-3 text-white/20 group-hover:text-white/60 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all opacity-0 group-hover:opacity-100" />
    </motion.div>
  );
}

function AlertBlock({ Icon, n, label, hint, tone }: { Icon: typeof Crown; n: number; label: string; hint: string; tone: "rose" | "amber" }) {
  const toneClass = tone === "rose" ? "text-rose-400" : "text-amber-400";
  const borderClass = tone === "rose" ? "border-rose-500/40" : "border-amber-500/40";
  return (
    <div className="bg-[#0a0a0a] p-5 group hover:bg-white/[0.02] transition-colors">
      <div className="flex items-center gap-3 mb-4">
        <div className={cn("h-7 w-7 border bg-black flex items-center justify-center", borderClass)}>
          <Icon className={cn("h-3.5 w-3.5", toneClass)} strokeWidth={1.8} />
        </div>
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/50">Alert</span>
        <AlertOctagon className="h-3 w-3 text-white/20 ml-auto" />
      </div>
      <p className="flex items-baseline gap-2">
        <span className={cn("text-4xl font-bold tabular-nums tracking-tighter leading-none", toneClass)}>{n}</span>
        <span className="text-xs text-white/70 font-medium">{label}</span>
      </p>
      <p className="font-mono text-[10px] uppercase tracking-wider text-white/40 mt-3 truncate" title={hint}>{hint}</p>
    </div>
  );
}

function Bar({ pct, accent }: { pct: number; accent: "lime" | "amber" }) {
  return (
    <div className="h-1 bg-white/5 mt-4">
      <motion.div
        initial={{ width: 0 }}
        whileInView={{ width: `${Math.min(pct, 100)}%` }}
        viewport={{ once: true }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={cn("h-full", accent === "lime" ? "bg-lime-400" : "bg-amber-400")}
      />
    </div>
  );
}

function DataPoint({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/50">{label}</p>
      <p className={cn("text-base font-bold tabular-nums tracking-tight mt-1", highlight && "text-amber-400")}>{value}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-wider text-white/50">
      <span className="h-1.5 w-3" style={{ background: color }} />
      {label}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return (
    <div className="h-full min-h-[120px] flex items-center justify-center font-mono text-[10px] uppercase tracking-wider text-white/30">
      {label}
    </div>
  );
}
