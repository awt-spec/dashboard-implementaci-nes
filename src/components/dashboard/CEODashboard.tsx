/**
 * CEO Dashboard — Cockpit ejecutivo SYSDE.
 *
 * El CEO tiene acceso TOTAL al ERP en modo lectura. Desde el cockpit puede:
 *   1. Ver el resumen ejecutivo (esta pantalla)
 *   2. Navegar a cualquier sección (Implementación, Soporte, Scrum, IA, Config)
 *      → vistas embebidas en el shell SYSDE con back button
 *   3. Pedir diagnósticos a la IA (4 cards: casos, colaboradores, clientes, dev)
 *   4. Hacer preguntas libres al asistente IA (botón flotante)
 *
 * Paleta SYSDE oficial:
 *   #C8200F (rojo) · #A81C0C (rojo dk) · #3D3D3D (gris) · #888880 (mid)
 *   #F4F4F2 (light) · #FFFFFF (white)
 */
import { useMemo, useState, useEffect } from "react";
import { useClients } from "@/hooks/useClients";
import { useAllSupportTickets, useSupportClients } from "@/hooks/useSupportTickets";
import { useAIUsageLogs } from "@/hooks/useAIUsageLogs";
import { useSysdeTeamMembers } from "@/hooks/useTeamMembers";
import { useAllTimeEntries } from "@/hooks/useTimeTracking";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Building2, Headset, Brain, ShieldAlert, ArrowUp, ArrowDown,
  DollarSign, Activity, Layers, Target, Flame, AlertOctagon,
  LogOut, ArrowUpRight, UserX, Zap, Minus, Package, Users, Clock,
  CheckCircle2, AlertTriangle, ArrowLeft, Trophy, Settings,
  MessageSquare, ChevronRight, Sparkles, Code2,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip as ReTooltip, LineChart, Line,
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// Vistas embebidas
import { ExecutiveAIChat } from "./ExecutiveAIChat";
import { ClientList } from "@/components/clients/ClientList";
import { ClientDetail } from "@/components/clients/ClientDetail";
import { SupportDashboard } from "@/components/support/SupportDashboard";
import TeamScrumDashboard from "@/pages/TeamScrumDashboard";
import { ConfigurationHub } from "@/components/settings/ConfigurationHub";

// ─── Tokens SYSDE ─────────────────────────────────────────────────────────
const SYSDE = {
  red:    "#C8200F",
  redDk:  "#A81C0C",
  gray:   "#3D3D3D",
  mid:    "#888880",
  light:  "#F4F4F2",
  white:  "#FFFFFF",
} as const;

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

// Disparador global del AI chat con prompt seed
function askAI(question: string, autoSend = true) {
  window.dispatchEvent(new CustomEvent("ai-chat:ask", { detail: { question, autoSend } }));
}

type View = "cockpit" | "implementation" | "support" | "scrum" | "config";

// ═══════════════════════════════════════════════════════════════════════════
// CEO DASHBOARD — IDENTIDAD SYSDE
// ═══════════════════════════════════════════════════════════════════════════

export function CEODashboard() {
  const { profile, signOut } = useAuth();
  const { data: clients = [] } = useClients();
  const { data: supportTickets = [] } = useAllSupportTickets();
  const { data: supportClients = [] } = useSupportClients();
  const { data: aiLogs = [] } = useAIUsageLogs();
  const { data: teamMembers = [] } = useSysdeTeamMembers();
  const { data: timeEntries = [] } = useAllTimeEntries(30);

  const [view, setView] = useState<View>("cockpit");
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  useEffect(() => {
    document.documentElement.classList.remove("dark");
  }, []);

  const [financials, setFinancials] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("client_financials" as any).select("*").then(({ data }) => setFinancials(data || []));
  }, []);

  const now = new Date();
  const greeting = now.getHours() < 12 ? "BUENOS DÍAS" : now.getHours() < 19 ? "BUENAS TARDES" : "BUENAS NOCHES";
  const dateStr = now.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  // ─── Cálculos cross-cutting ─────────────────────────────────────────────
  const allClients = clients as any[];
  const implClients = allClients.filter(c => c.client_type === "implementacion");
  const soporteClients = allClients.filter(c => c.client_type === "soporte");
  const atRisk = allClients.filter(c => c.status === "en-riesgo").length;
  const activos = allClients.filter(c => c.status === "activo").length;

  const allDeliverables = useMemo(() => {
    return allClients.flatMap(c => (c.deliverables || []).map((d: any) => ({ ...d, _clientId: c.id, _clientName: c.name })));
  }, [allClients]);
  const delivAprobados = allDeliverables.filter(d => d.status === "aprobado").length;
  const delivVencidos = allDeliverables.filter(d => {
    if (d.status === "aprobado" || d.status === "entregado") return false;
    if (!d.dueDate) return false;
    return new Date(d.dueDate).getTime() < Date.now();
  }).length;

  const allRisks = useMemo(() => {
    return allClients.flatMap(c => (c.risks || []).map((r: any) => ({ ...r, _clientId: c.id, _clientName: c.name })));
  }, [allClients]);
  const risksOpen = allRisks.filter(r => r.status !== "cerrado" && r.status !== "mitigado").length;
  const risksHighImpact = allRisks.filter(r => /alto|critico|critic/i.test(r.impact || "") && r.status !== "cerrado").length;

  const allTasks = useMemo(() => {
    return allClients.flatMap(c => (c.tasks || []).map((t: any) => ({ ...t, _clientId: c.id, _clientName: c.name })));
  }, [allClients]);
  const tasksOpen = allTasks.filter(t => t.status !== "Completado" && t.status !== "completado").length;

  const ticketsActivos = supportTickets.filter(t => !["CERRADA", "ANULADA"].includes(t.estado));
  const ticketsCerrados = supportTickets.filter(t => ["CERRADA", "ANULADA"].includes(t.estado));
  const sinAtencion = ticketsActivos.filter(t => t.estado === "PENDIENTE" && !t.responsable).length;
  const criticos = ticketsActivos.filter(t => /critica/i.test(t.prioridad || "")).length;
  const conCausaRaiz = supportTickets.filter(t => t.ai_classification).length;

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

  const teamCount = teamMembers.length;
  const teamActivos = teamMembers.filter((m: any) => m.is_active !== false).length;

  const totalHoursLast30 = useMemo(() => {
    const sum = timeEntries.reduce((s, e: any) => s + ((e.hours || 0) || (e.duration_minutes ? e.duration_minutes / 60 : 0)), 0);
    return Math.round(sum);
  }, [timeEntries]);

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
    if (delivVencidos > 0) score -= Math.min(delivVencidos * 3, 15);
    if (totalPending > totalContractValue * 0.3) score -= 10;
    if (utilizationPct > 90) score -= 8;
    return Math.max(0, score);
  }, [atRisk, criticos, sinAtencion, delivVencidos, totalPending, totalContractValue, utilizationPct]);

  const healthLabel = healthScore >= 80 ? "ÓPTIMA" : healthScore >= 60 ? "ESTABLE" : "ATENCIÓN";

  // ─── Vista actual ───────────────────────────────────────────────────────
  const selectedClient = selectedClientId ? allClients.find(c => c.id === selectedClientId) : null;

  const renderContent = () => {
    if (view === "implementation") {
      if (selectedClient) {
        return <ClientDetail client={selectedClient as any} onBack={() => setSelectedClientId(null)} />;
      }
      return <ClientList onSelectClient={setSelectedClientId} selectedClientId={undefined} />;
    }
    if (view === "support") return <SupportDashboard />;
    if (view === "scrum") return <TeamScrumDashboard />;
    if (view === "config") return <ConfigurationHub />;
    return null;
  };

  const VIEW_LABELS: Record<View, string> = {
    cockpit: "COCKPIT",
    implementation: "IMPLEMENTACIÓN",
    support: "SOPORTE",
    scrum: "EQUIPO SCRUM",
    config: "CONFIGURACIÓN",
  };

  return (
    <div
      className="relative min-h-screen"
      style={{
        background: SYSDE.light,
        color: SYSDE.gray,
        fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
      }}
    >
      {/* ════════════════════════════════════════════════════════════════
          STICKY TOPBAR
      ════════════════════════════════════════════════════════════════ */}
      <header className="sticky top-0 z-40" style={{ background: SYSDE.white, borderBottom: `1px solid ${SYSDE.mid}33` }}>
        <div className="max-w-[1400px] mx-auto px-6 lg:px-10 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            {view !== "cockpit" && (
              <Button
                variant="ghost" size="sm"
                onClick={() => { setView("cockpit"); setSelectedClientId(null); }}
                className="gap-1.5 h-8 px-2 rounded-none text-xs uppercase tracking-wider font-bold shrink-0"
                style={{ color: SYSDE.gray, border: `1px solid ${SYSDE.mid}40` }}
              >
                <ArrowLeft className="h-3 w-3" /> Cockpit
              </Button>
            )}

            {/* Donut SYSDE */}
            <div className="relative h-9 w-9 flex items-center justify-center shrink-0">
              <div className="absolute inset-0 rounded-full" style={{ background: SYSDE.red }} />
              <div className="absolute inset-[6px] rounded-full" style={{ background: SYSDE.white }} />
              <div className="relative h-3 w-3 rounded-full" style={{ background: SYSDE.red }} />
            </div>

            <div className="min-w-0">
              <div className="text-[9px] font-bold tracking-[0.25em]" style={{ color: SYSDE.red, fontFamily: "'Montserrat', system-ui, sans-serif" }}>
                SYSDE · CEO · {VIEW_LABELS[view]}
              </div>
              <div className="text-sm font-semibold truncate" style={{ color: SYSDE.gray }}>
                {profile?.full_name || "Director Ejecutivo"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost" size="sm"
              onClick={() => askAI("Hola, ¿en qué puedo ayudarte?", false)}
              className="gap-1.5 h-8 px-3 rounded-none text-xs uppercase tracking-wider font-bold hidden md:inline-flex"
              style={{ color: SYSDE.white, background: SYSDE.red }}
            >
              <Sparkles className="h-3 w-3" /> Preguntar IA
            </Button>
            <div
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider"
              style={{ border: `1px solid ${SYSDE.mid}40`, color: SYSDE.gray }}
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: SYSDE.red }} />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: SYSDE.red }} />
              </span>
              EN VIVO
            </div>
            <Button
              variant="ghost" size="sm" onClick={signOut}
              className="gap-1.5 h-8 px-3 rounded-none text-xs uppercase tracking-wider font-bold"
              style={{ color: SYSDE.gray }}
            >
              <LogOut className="h-3 w-3" /> Salir
            </Button>
          </div>
        </div>
      </header>

      {/* ════════════════════════════════════════════════════════════════
          CONTENIDO — cockpit o vista embebida
      ════════════════════════════════════════════════════════════════ */}
      <AnimatePresence mode="wait">
        {view !== "cockpit" ? (
          <motion.main
            key={view}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.25 }}
            className="relative max-w-[1400px] mx-auto px-6 lg:px-10 pt-8 pb-24"
          >
            {/* Banner read-only para el CEO en vistas embebidas */}
            <div
              className="flex items-center gap-2 mb-4 px-3 py-2 text-[10px] font-bold uppercase tracking-wider"
              style={{ background: SYSDE.red + "0A", border: `1px solid ${SYSDE.red}40`, color: SYSDE.red, fontFamily: "'Montserrat', sans-serif" }}
            >
              <ShieldAlert className="h-3.5 w-3.5" />
              Modo CEO · solo lectura · todo lo que ves se sincroniza con el equipo en tiempo real
            </div>
            {renderContent()}
          </motion.main>
        ) : (
          <motion.main
            key="cockpit"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="relative max-w-[1400px] mx-auto px-6 lg:px-10 pt-12 pb-24 space-y-16"
          >
            {/* ════════ HERO ════════ */}
            <section className="relative overflow-hidden" style={{ background: SYSDE.red, color: SYSDE.white }}>
              <div className="absolute -top-32 -right-32 h-[400px] w-[400px] rounded-full pointer-events-none" style={{ border: `40px solid ${SYSDE.redDk}`, opacity: 0.5 }} />
              <div className="absolute -top-16 -right-16 h-[300px] w-[300px] rounded-full pointer-events-none" style={{ border: `25px solid ${SYSDE.redDk}`, opacity: 0.4 }} />

              <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 p-8 lg:p-12">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="h-px w-12" style={{ background: SYSDE.white, opacity: 0.6 }} />
                    <span className="text-[10px] font-bold tracking-[0.3em] opacity-80" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                      EXECUTIVE OVERVIEW · {dateStr.toUpperCase()}
                    </span>
                  </div>
                  <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-[0.95] tracking-tight" style={{ fontFamily: "'Montserrat', sans-serif" }}>
                    {greeting},
                    <br />
                    <span className="opacity-90">{(profile?.full_name?.split(" ")[0] || "Director").toUpperCase()}.</span>
                  </h1>
                  <p className="mt-6 text-sm md:text-base leading-relaxed opacity-90 max-w-md">
                    {atRisk > 0 ? `${atRisk} ${atRisk === 1 ? "cliente requiere" : "clientes requieren"} atención inmediata.` :
                     criticos > 0 ? `${criticos} ${criticos === 1 ? "caso crítico abierto" : "casos críticos abiertos"} en este momento.` :
                     sinAtencion > 0 ? `${sinAtencion} ${sinAtencion === 1 ? "boleta esperando" : "boletas esperando"} asignación.` :
                     "Todos los sistemas operan dentro de parámetros normales."}
                  </p>
                </div>
                <div className="relative" style={{ background: SYSDE.white, color: SYSDE.gray }}>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Activity className="h-3.5 w-3.5" style={{ color: SYSDE.red }} />
                      <span className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: SYSDE.mid, fontFamily: "'Montserrat', sans-serif" }}>
                        Salud del Negocio
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-6xl font-bold tabular-nums tracking-tighter leading-none" style={{ color: SYSDE.red, fontFamily: "'Montserrat', sans-serif" }}>
                        {healthScore}
                      </span>
                      <span className="text-base font-medium" style={{ color: SYSDE.mid }}>/ 100</span>
                    </div>
                    <div className="mt-4">
                      <div className="h-1" style={{ background: SYSDE.light }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${healthScore}%` }}
                          transition={{ duration: 0.8 }}
                          className="h-full"
                          style={{ background: SYSDE.red }}
                        />
                      </div>
                      <div className="mt-2 text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: SYSDE.red, fontFamily: "'Montserrat', sans-serif" }}>
                        {healthLabel}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* ════════ ACCESO RÁPIDO ════════ */}
            <SectionDivider num="01" title="EXPLORAR" subtitle="Acceso a las áreas operativas del ERP — todas en modo lectura" />
            <div
              className="grid grid-cols-2 lg:grid-cols-4"
              style={{ background: SYSDE.white, border: `1px solid ${SYSDE.mid}33` }}
            >
              <NavCard
                title="IMPLEMENTACIÓN"
                desc="Clientes en proyecto · entregables · riesgos"
                Icon={Building2}
                stat={implClients.length}
                statLabel="clientes activos"
                onClick={() => setView("implementation")}
                border
              />
              <NavCard
                title="SOPORTE"
                desc="Boletas · SLA · clasificación IA"
                Icon={Headset}
                stat={ticketsActivos.length}
                statLabel="boletas activas"
                onClick={() => setView("support")}
                border
              />
              <NavCard
                title="EQUIPO SCRUM"
                desc="Sprints · velocidad · retrospectivas"
                Icon={Trophy}
                stat={teamCount}
                statLabel="miembros"
                onClick={() => setView("scrum")}
                border
              />
              <NavCard
                title="CONFIGURACIÓN"
                desc="Usuarios · IA · políticas · reglas"
                Icon={Settings}
                stat={teamActivos}
                statLabel="con acceso"
                onClick={() => setView("config")}
              />
            </div>

            {/* ════════ DIAGNÓSTICOS IA ════════ */}
            <SectionDivider num="02" title="DIAGNÓSTICOS IA" subtitle="Análisis ejecutivo automático — click para que la IA te lo explique" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px" style={{ background: SYSDE.mid + "33" }}>
              <DiagnosticCard
                title="CASOS"
                desc="Estado de los casos de soporte: críticos, sin asignar, antigüedad y patrones."
                Icon={Headset}
                stat={`${ticketsActivos.length} activos`}
                onClick={() => askAI("Dame un diagnóstico ejecutivo del estado actual de los casos de soporte: identificá los críticos sin resolver, los sin asignar, los más antiguos, y los patrones más frecuentes. Dame 3 acciones recomendadas.", true)}
              />
              <DiagnosticCard
                title="COLABORADORES"
                desc="Carga de trabajo del equipo SYSDE: distribución, sobrecargas y gaps de capacidad."
                Icon={Users}
                stat={`${teamCount} personas`}
                onClick={() => askAI("Analizá la carga de trabajo del equipo SYSDE: quién tiene más casos asignados, quién está sobrecargado, dónde hay gaps de capacidad. Dame recomendaciones para balancear.", true)}
              />
              <DiagnosticCard
                title="CLIENTES"
                desc="Salud del portafolio: riesgos, churn potencial, oportunidades comerciales."
                Icon={Building2}
                stat={`${activos} activos`}
                onClick={() => askAI("Diagnosticá la salud del portafolio de clientes: cuáles están en riesgo y por qué, cuáles tienen churn potencial, dónde hay oportunidades de upsell. Dame el top 3 de prioridades.", true)}
              />
              <DiagnosticCard
                title="DESARROLLO"
                desc="Estado del trabajo: sprints, entregables, velocidad y bloqueos."
                Icon={Code2}
                stat={`${tasksOpen} tareas`}
                onClick={() => askAI("Dame un diagnóstico del estado del desarrollo: cómo va el sprint actual, entregables vencidos o por vencer, bloqueos identificados, velocidad del equipo. Recomendaciones para el próximo sprint.", true)}
              />
            </div>

            {/* ════════ PULSO DEL NEGOCIO ════════ */}
            <SectionDivider num="03" title="PULSO DEL NEGOCIO" subtitle="Métricas clave en tiempo real" />
            <div className="grid grid-cols-2 lg:grid-cols-4" style={{ background: SYSDE.white, border: `1px solid ${SYSDE.mid}33` }}>
              <Metric label="CLIENTES ACTIVOS" value={activos.toString()} sub={`${implClients.length} IMPL · ${soporteClients.length} SOPORTE`} Icon={Building2} trend={atRisk > 0 ? { dir: "down", text: `${atRisk} EN RIESGO` } : { dir: "up", text: "ESTABLE" }} border delay={0.1} />
              <Metric label="BOLETAS ACTIVAS" value={ticketsActivos.length.toString()} sub={`${ticketsCerrados.length} CERRADAS · ${supportTickets.length} TOTAL`} Icon={Headset} trend={sinAtencion > 0 ? { dir: "down", text: `${sinAtencion} SIN ASIGNAR` } : null} border delay={0.15} />
              <Metric label="CONTRATO ANUAL" value={fmtMoney(totalContractValue)} sub={`${fmtMoney(totalPaid)} COBRADO · ${collectionRate}%`} Icon={DollarSign} trend={collectionRate >= 70 ? { dir: "up", text: "SANO" } : { dir: "down", text: "ATENCIÓN" }} border delay={0.2} />
              <Metric label="EQUIPO SYSDE" value={teamCount.toString()} sub={`${teamActivos} ACTIVOS · ${totalHoursLast30}H ÚLT 30D`} Icon={Users} trend={null} delay={0.25} />
            </div>

            {/* ════════ ESTADO TRANSVERSAL ════════ */}
            <SectionDivider num="04" title="ESTADO TRANSVERSAL" subtitle="Entregables, riesgos y tareas en todo el portafolio" />
            <div className="grid grid-cols-2 lg:grid-cols-4" style={{ background: SYSDE.white, border: `1px solid ${SYSDE.mid}33` }}>
              <Metric label="ENTREGABLES" value={allDeliverables.length.toString()} sub={`${delivAprobados} APROBADOS`} Icon={Package} trend={delivVencidos > 0 ? { dir: "down", text: `${delivVencidos} VENCIDOS` } : { dir: "up", text: "AL DÍA" }} border delay={0.1} />
              <Metric label="RIESGOS ABIERTOS" value={risksOpen.toString()} sub={`${risksHighImpact} ALTO IMPACTO`} Icon={AlertTriangle} trend={risksHighImpact > 0 ? { dir: "down", text: `${risksHighImpact} CRÍTICOS` } : null} border delay={0.15} />
              <Metric label="TAREAS ABIERTAS" value={tasksOpen.toString()} sub={`DE ${allTasks.length} TOTALES`} Icon={CheckCircle2} trend={null} border delay={0.2} />
              <Metric label="HORAS · 30 DÍAS" value={fmtNumber(totalHoursLast30)} sub={`UTIL ${utilizationPct}% DEL ESTIMADO`} Icon={Clock} trend={utilizationPct > 90 ? { dir: "down", text: "SOBREUTILIZADO" } : { dir: "up", text: "EN RANGO" }} delay={0.25} />
            </div>

            {/* ════════ ALERTAS ════════ */}
            {(atRisk > 0 || criticos > 0 || sinAtencion > 0 || delivVencidos > 0) && (
              <>
                <SectionDivider num="05" title="REQUIEREN ACCIÓN" subtitle="Asuntos críticos abiertos · click para preguntar a la IA" alert />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4" style={{ background: SYSDE.white, border: `1px solid ${SYSDE.mid}33` }}>
                  {atRisk > 0 && <AlertBlock Icon={ShieldAlert} n={atRisk} label={atRisk === 1 ? "CLIENTE EN RIESGO" : "CLIENTES EN RIESGO"} hint={allClients.filter(c => c.status === "en-riesgo").map((c: any) => c.name).slice(0, 3).join(" · ") || "—"} border onClick={() => askAI(`¿Por qué ${atRisk === 1 ? "el cliente está" : "los " + atRisk + " clientes están"} en riesgo? Detalláme los motivos y qué acciones tomar.`, true)} />}
                  {criticos > 0 && <AlertBlock Icon={Flame} n={criticos} label={criticos === 1 ? "CASO CRÍTICO" : "CASOS CRÍTICOS"} hint="PRIORIDAD: CRÍTICA · IMPACTO NEGOCIO" border onClick={() => askAI(`Dame el detalle de los ${criticos} casos críticos abiertos: qué cliente, qué pasa, hace cuánto, próxima acción.`, true)} />}
                  {sinAtencion > 0 && <AlertBlock Icon={UserX} n={sinAtencion} label={sinAtencion === 1 ? "BOLETA SIN ASIGNAR" : "BOLETAS SIN ASIGNAR"} hint="ESTADO PENDIENTE · SIN RESPONSABLE" border onClick={() => askAI(`¿Qué boletas no han sido asignadas? Sugerí a quién deberían asignarse según carga del equipo.`, true)} />}
                  {delivVencidos > 0 && <AlertBlock Icon={Package} n={delivVencidos} label={delivVencidos === 1 ? "ENTREGABLE VENCIDO" : "ENTREGABLES VENCIDOS"} hint="PASARON SU FECHA LÍMITE" onClick={() => askAI(`Listáme los entregables vencidos: cliente, qué es, hace cuántos días debían entregarse, y por qué se atrasaron.`, true)} />}
                </div>
              </>
            )}

            {/* ════════ OPERACIÓN ════════ */}
            <SectionDivider num="06" title="OPERACIÓN" subtitle="Cobranza, utilización y flujo" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-px" style={{ background: SYSDE.mid + "33" }}>
              <Panel>
                <PanelHeader Icon={DollarSign} title="FINANCIERO" sub="ACUMULADO DEL AÑO · USD" />
                <div className="grid grid-cols-2 gap-px mt-5 -mx-6" style={{ background: SYSDE.mid + "33" }}>
                  <div style={{ background: SYSDE.white }} className="p-5">
                    <p className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: SYSDE.mid, fontFamily: "'Montserrat', sans-serif" }}>COBRADO</p>
                    <p className="text-3xl font-bold tabular-nums mt-2 tracking-tight" style={{ color: SYSDE.red, fontFamily: "'Montserrat', sans-serif" }}>{fmtMoney(totalPaid)}</p>
                    <Bar pct={(totalPaid / Math.max(totalBilled, 1)) * 100} />
                  </div>
                  <div style={{ background: SYSDE.white }} className="p-5">
                    <p className="text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: SYSDE.mid, fontFamily: "'Montserrat', sans-serif" }}>PENDIENTE</p>
                    <p className="text-3xl font-bold tabular-nums mt-2 tracking-tight" style={{ color: SYSDE.gray, fontFamily: "'Montserrat', sans-serif" }}>{fmtMoney(totalPending)}</p>
                    <Bar pct={(totalPending / Math.max(totalBilled, 1)) * 100} muted />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4 mt-5 pt-5" style={{ borderTop: `1px solid ${SYSDE.mid}33` }}>
                  <DataPoint label="FACTURADO" value={fmtMoney(totalBilled)} />
                  <DataPoint label="CONTRATOS" value={financials.length.toString()} />
                  <DataPoint label="UTIL HORAS" value={`${utilizationPct}%`} highlight={utilizationPct > 90} />
                </div>
              </Panel>

              <Panel>
                <PanelHeader Icon={Activity} title="FLUJO DE BOLETAS" sub="ÚLTIMOS 30 DÍAS · NUEVAS VS CERRADAS" />
                <div className="h-[200px] mt-4">
                  {ticketTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={ticketTrend} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                        <defs>
                          <linearGradient id="gNuevos" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={SYSDE.red} stopOpacity={0.3} />
                            <stop offset="100%" stopColor={SYSDE.red} stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="gCerrados" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor={SYSDE.gray} stopOpacity={0.2} />
                            <stop offset="100%" stopColor={SYSDE.gray} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 4" stroke={SYSDE.mid} opacity={0.2} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: SYSDE.mid }} stroke={SYSDE.mid + "40"} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: SYSDE.mid }} stroke={SYSDE.mid + "40"} tickLine={false} />
                        <ReTooltip contentStyle={{ fontSize: 11, background: SYSDE.white, border: `1px solid ${SYSDE.mid}40`, borderRadius: 0 }} />
                        <Area type="monotone" dataKey="nuevos" stroke={SYSDE.red} fill="url(#gNuevos)" strokeWidth={2} />
                        <Area type="monotone" dataKey="cerrados" stroke={SYSDE.gray} fill="url(#gCerrados)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : <Empty label="SIN ACTIVIDAD" />}
                </div>
                <div className="flex items-center gap-4 pt-4 mt-2" style={{ borderTop: `1px solid ${SYSDE.mid}33` }}>
                  <Legend color={SYSDE.red} label="NUEVAS" />
                  <Legend color={SYSDE.gray} label="CERRADAS" />
                </div>
              </Panel>
            </div>

            {/* ════════ INTELIGENCIA OPERATIVA ════════ */}
            <SectionDivider num="07" title="INTELIGENCIA OPERATIVA" subtitle="Distribución de boletas, productos y causas raíz" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-px" style={{ background: SYSDE.mid + "33" }}>
              <Panel>
                <PanelHeader Icon={Layers} title="ESTADOS" sub={`${supportTickets.length} BOLETAS TOTAL`} />
                <div className="space-y-2.5 mt-5">
                  {ticketsByEstado.length === 0 ? <Empty label="SIN DATOS" /> : ticketsByEstado.slice(0, 8).map((e, i) => {
                    const max = ticketsByEstado[0].value;
                    const pct = max > 0 ? Math.round((e.value / max) * 100) : 0;
                    return (
                      <div key={e.name}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: SYSDE.gray, fontFamily: "'Montserrat', sans-serif" }}>{e.name}</span>
                          <span className="text-xs tabular-nums font-bold" style={{ color: SYSDE.red, fontFamily: "'Montserrat', sans-serif" }}>{e.value}</span>
                        </div>
                        <div className="h-1.5" style={{ background: SYSDE.light }}>
                          <motion.div initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} viewport={{ once: true }} transition={{ duration: 0.6, delay: i * 0.04 }} className="h-full" style={{ background: i === 0 ? SYSDE.red : SYSDE.gray, opacity: i === 0 ? 1 : 0.6 - i * 0.06 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Panel>

              <Panel>
                <PanelHeader Icon={Target} title="PRODUCTOS" sub={`${ticketsByProducto.length} LÍNEAS`} />
                <div className="h-[200px] mt-5">
                  {ticketsByProducto.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={ticketsByProducto} layout="vertical" margin={{ left: 60, right: 20 }}>
                        <CartesianGrid strokeDasharray="2 4" stroke={SYSDE.mid} opacity={0.2} horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 9, fill: SYSDE.mid }} stroke={SYSDE.mid + "40"} tickLine={false} />
                        <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: SYSDE.gray, fontFamily: "Montserrat" }} stroke={SYSDE.mid + "40"} width={60} tickLine={false} />
                        <ReTooltip contentStyle={{ fontSize: 11, background: SYSDE.white, border: `1px solid ${SYSDE.mid}40`, borderRadius: 0 }} />
                        <Bar dataKey="value" fill={SYSDE.red} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <Empty label="SIN DATOS" />}
                </div>
              </Panel>

              <Panel>
                <PanelHeader Icon={Brain} title="CAUSAS RAÍZ · IA" sub={`${conCausaRaiz}/${supportTickets.length} CLASIFICADAS`} />
                {conCausaRaiz === 0 ? (
                  <div className="h-[200px] flex flex-col items-center justify-center text-center px-2 mt-5">
                    <Brain className="h-6 w-6 mb-3" style={{ color: SYSDE.mid }} />
                    <p className="text-[10px] font-bold tracking-wider uppercase leading-relaxed" style={{ color: SYSDE.mid, fontFamily: "'Montserrat', sans-serif" }}>
                      Sin clasificación IA aún
                      <br />
                      <span style={{ color: SYSDE.red }}>→ Ejecutar "Clasificar pendientes"</span>
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3 mt-5">
                    {topCausasRaiz.map((c, i) => {
                      const pct = conCausaRaiz > 0 ? Math.round((c.count / conCausaRaiz) * 100) : 0;
                      return (
                        <div key={c.name}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold tracking-wider uppercase truncate" style={{ color: SYSDE.gray, fontFamily: "'Montserrat', sans-serif" }}>{c.name}</span>
                            <span className="text-[10px] tabular-nums font-bold ml-2 shrink-0" style={{ color: SYSDE.red, fontFamily: "'Montserrat', sans-serif" }}>{c.count} · {pct}%</span>
                          </div>
                          <div className="h-1.5" style={{ background: SYSDE.light }}>
                            <motion.div initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} viewport={{ once: true }} transition={{ duration: 0.6, delay: i * 0.05 }} className="h-full" style={{ background: SYSDE.red }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Panel>
            </div>

            {/* ════════ TOP CLIENTES + IA ════════ */}
            <SectionDivider num="08" title="CARGA Y CONSUMO" subtitle="Top clientes por volumen y uso de IA" />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-px" style={{ background: SYSDE.mid + "33" }}>
              <Panel className="lg:col-span-2">
                <PanelHeader Icon={Building2} title="TOP CLIENTES POR CARGA" sub={`${topClientesByLoad.length} DE ${supportClients.length} CLIENTES`} />
                {topClientesByLoad.length === 0 ? <Empty label="SIN BOLETAS AÚN" /> : (
                  <div className="mt-4 -mx-6">
                    {topClientesByLoad.map((c, i) => {
                      const max = topClientesByLoad[0].count;
                      const pct = max > 0 ? Math.round((c.count / max) * 100) : 0;
                      const total = supportTickets.length;
                      const pctTotal = total > 0 ? Math.round((c.count / total) * 100) : 0;
                      return (
                        <motion.div key={c.name} initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.3, delay: i * 0.04 }} className="flex items-center gap-4 px-6 py-3 hover:bg-[#FBFAF8] transition-colors cursor-pointer" style={{ borderTop: i > 0 ? `1px solid ${SYSDE.mid}1A` : undefined }} onClick={() => askAI(`Dame un diagnóstico ejecutivo del cliente "${c.name}": estado actual, casos abiertos, salud comercial, riesgos y recomendaciones.`, true)}>
                          <div className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold tabular-nums" style={{ background: SYSDE.red, color: SYSDE.white, fontFamily: "'Montserrat', sans-serif" }}>{String(i + 1).padStart(2, "0")}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1.5 gap-2">
                              <span className="text-sm font-semibold truncate" style={{ color: SYSDE.gray }}>{c.name}</span>
                              <span className="text-[10px] tabular-nums shrink-0 font-bold" style={{ color: SYSDE.mid, fontFamily: "'Montserrat', sans-serif" }}>
                                <span style={{ color: SYSDE.red }}>{c.count}</span> · {pctTotal}%
                              </span>
                            </div>
                            <div className="h-1" style={{ background: SYSDE.light }}>
                              <motion.div initial={{ width: 0 }} whileInView={{ width: `${pct}%` }} viewport={{ once: true }} transition={{ duration: 0.7, delay: i * 0.04 + 0.1 }} className="h-full" style={{ background: SYSDE.red }} />
                            </div>
                          </div>
                          <Sparkles className="h-3 w-3 shrink-0 opacity-30 hover:opacity-100 transition-opacity" style={{ color: SYSDE.red }} />
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </Panel>

              <Panel>
                <PanelHeader Icon={Zap} title="USO DE IA" sub="ÚLTIMOS 14 DÍAS" />
                <div className="h-[140px] mt-5 -mx-2">
                  {aiTrend.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={aiTrend} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="2 4" stroke={SYSDE.mid} opacity={0.2} />
                        <XAxis dataKey="date" tick={{ fontSize: 9, fill: SYSDE.mid }} stroke={SYSDE.mid + "40"} tickLine={false} />
                        <YAxis tick={{ fontSize: 9, fill: SYSDE.mid }} stroke={SYSDE.mid + "40"} tickLine={false} width={28} />
                        <ReTooltip contentStyle={{ fontSize: 11, background: SYSDE.white, border: `1px solid ${SYSDE.mid}40`, borderRadius: 0 }} />
                        <Line type="monotone" dataKey="calls" stroke={SYSDE.red} strokeWidth={2} dot={{ r: 3, fill: SYSDE.red, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <Empty label="SIN ACTIVIDAD" />}
                </div>
                <div className="grid grid-cols-2 gap-px mt-5 -mx-6 -mb-6" style={{ background: SYSDE.mid + "33" }}>
                  <div style={{ background: SYSDE.white }} className="p-4">
                    <p className="text-[9px] font-bold tracking-[0.2em] uppercase" style={{ color: SYSDE.mid, fontFamily: "'Montserrat', sans-serif" }}>TOKENS 30D</p>
                    <p className="text-base font-bold tabular-nums mt-1 tracking-tight" style={{ color: SYSDE.gray, fontFamily: "'Montserrat', sans-serif" }}>{fmtNumber(totalAITokens)}</p>
                  </div>
                  <div style={{ background: SYSDE.white }} className="p-4">
                    <p className="text-[9px] font-bold tracking-[0.2em] uppercase" style={{ color: SYSDE.mid, fontFamily: "'Montserrat', sans-serif" }}>COSTO EST.</p>
                    <p className="text-base font-bold tabular-nums mt-1 tracking-tight" style={{ color: SYSDE.red, fontFamily: "'Montserrat', sans-serif" }}>{fmtMoney(estimatedAICost)}</p>
                  </div>
                </div>
              </Panel>
            </div>

            {/* ════════ FOOTER ════════ */}
            <footer className="pt-6" style={{ borderTop: `1px solid ${SYSDE.mid}33` }}>
              <div className="flex items-center justify-between flex-wrap gap-3 text-[10px] font-bold tracking-wider uppercase" style={{ color: SYSDE.mid, fontFamily: "'Montserrat', sans-serif" }}>
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: SYSDE.red }} />
                    EN VIVO
                  </span>
                  <span style={{ color: SYSDE.mid + "80" }}>·</span>
                  <span>Actualizado {now.toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
                <div className="flex items-center gap-1.5 px-2.5 py-1" style={{ border: `1px solid ${SYSDE.red}40`, background: SYSDE.red + "0A", color: SYSDE.red }}>
                  <span style={{ background: SYSDE.red, color: SYSDE.white }} className="px-1.5 py-0.5 text-[9px]">CEO</span>
                  <span>READ-ONLY · SYSDE INTERNACIONAL</span>
                </div>
              </div>
            </footer>
          </motion.main>
        )}
      </AnimatePresence>

      {/* ════════ AI CHAT GLOBAL — siempre disponible (botón flotante) ════════ */}
      <ExecutiveAIChat />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTES SYSDE
// ═══════════════════════════════════════════════════════════════════════════

function SectionDivider({ num, title, subtitle, alert }: { num: string; title: string; subtitle: string; alert?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.4 }}
      className="flex items-end gap-4 -mb-12"
    >
      <div className="h-12 w-12 rounded-full flex items-center justify-center shrink-0 text-sm font-bold tabular-nums shadow-sm" style={{ background: alert ? SYSDE.red : SYSDE.gray, color: SYSDE.white, fontFamily: "'Montserrat', sans-serif" }}>
        {num}
      </div>
      <div className="flex-1 min-w-0">
        <h2 className="text-2xl md:text-3xl font-bold tracking-tight uppercase" style={{ color: SYSDE.gray, fontFamily: "'Montserrat', sans-serif" }}>{title}</h2>
        <p className="text-[10px] font-bold tracking-[0.18em] uppercase mt-1" style={{ color: SYSDE.mid, fontFamily: "'Montserrat', sans-serif" }}>{subtitle}</p>
      </div>
      <div className="hidden md:block h-px flex-1" style={{ background: SYSDE.mid, opacity: 0.4 }} />
    </motion.div>
  );
}

function NavCard({
  title, desc, Icon, stat, statLabel, onClick, border,
}: {
  title: string;
  desc: string;
  Icon: typeof Building2;
  stat: string | number;
  statLabel: string;
  onClick: () => void;
  border?: boolean;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.005 }}
      whileTap={{ scale: 0.995 }}
      onClick={onClick}
      className="relative p-6 text-left group hover:bg-[#FBFAF8] transition-colors w-full"
      style={{
        background: SYSDE.white,
        borderRight: border ? `1px solid ${SYSDE.mid}33` : undefined,
        borderBottom: `3px solid ${SYSDE.red}`,
      }}
    >
      <div className="flex items-center gap-3 mb-4">
        <div className="h-9 w-9 flex items-center justify-center" style={{ background: SYSDE.red, color: SYSDE.white }}>
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 ml-auto opacity-30 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" style={{ color: SYSDE.red }} />
      </div>
      <p className="text-base font-bold tracking-tight uppercase" style={{ color: SYSDE.gray, fontFamily: "'Montserrat', sans-serif" }}>{title}</p>
      <p className="text-xs mt-1.5 leading-relaxed" style={{ color: SYSDE.mid }}>{desc}</p>
      <div className="flex items-baseline gap-2 mt-4">
        <span className="text-2xl font-bold tabular-nums tracking-tighter" style={{ color: SYSDE.red, fontFamily: "'Montserrat', sans-serif" }}>{stat}</span>
        <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: SYSDE.mid, fontFamily: "'Montserrat', sans-serif" }}>{statLabel}</span>
      </div>
    </motion.button>
  );
}

function DiagnosticCard({
  title, desc, Icon, stat, onClick,
}: {
  title: string;
  desc: string;
  Icon: typeof Building2;
  stat: string;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={onClick}
      className="relative p-5 text-left group hover:bg-[#FBFAF8] transition-colors w-full"
      style={{ background: SYSDE.white }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="h-8 w-8 flex items-center justify-center" style={{ background: SYSDE.red, color: SYSDE.white }}>
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider" style={{ border: `1px solid ${SYSDE.red}40`, color: SYSDE.red, background: SYSDE.red + "0A", fontFamily: "'Montserrat', sans-serif" }}>
          <Sparkles className="h-2.5 w-2.5" />
          DIAGNOSTICAR
        </span>
      </div>
      <p className="text-sm font-bold tracking-tight uppercase" style={{ color: SYSDE.gray, fontFamily: "'Montserrat', sans-serif" }}>{title}</p>
      <p className="text-[11px] mt-1.5 leading-relaxed line-clamp-2" style={{ color: SYSDE.mid }}>{desc}</p>
      <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${SYSDE.mid}1A` }}>
        <span className="text-[10px] font-bold tracking-wider uppercase" style={{ color: SYSDE.mid, fontFamily: "'Montserrat', sans-serif" }}>{stat}</span>
        <ChevronRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" style={{ color: SYSDE.red }} />
      </div>
    </motion.button>
  );
}

function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-50px" }} transition={{ duration: 0.4 }} className={cn("relative p-6", className)} style={{ background: SYSDE.white }}>
      {children}
    </motion.div>
  );
}

function PanelHeader({ Icon, title, sub }: { Icon: typeof Building2; title: string; sub: string }) {
  return (
    <div className="flex items-center gap-3 pb-4" style={{ borderBottom: `1px solid ${SYSDE.mid}33` }}>
      <div className="h-8 w-8 flex items-center justify-center" style={{ background: SYSDE.red, color: SYSDE.white }}>
        <Icon className="h-4 w-4" strokeWidth={2} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold tracking-tight uppercase" style={{ color: SYSDE.gray, fontFamily: "'Montserrat', sans-serif" }}>{title}</p>
        <p className="text-[9px] font-bold tracking-[0.18em] uppercase mt-0.5 truncate" style={{ color: SYSDE.mid, fontFamily: "'Montserrat', sans-serif" }}>{sub}</p>
      </div>
    </div>
  );
}

function Metric({
  label, value, sub, Icon, trend, border, delay = 0,
}: {
  label: string; value: string; sub: string; Icon: typeof Building2;
  trend: { dir: "up" | "down"; text: string } | null;
  border?: boolean; delay?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay }} className="group relative p-6 hover:bg-[#FBFAF8] transition-colors" style={{ background: SYSDE.white, borderRight: border ? `1px solid ${SYSDE.mid}33` : undefined, borderBottom: `3px solid ${SYSDE.red}` }}>
      <div className="flex items-start justify-between gap-2 mb-5">
        <div className="h-9 w-9 flex items-center justify-center" style={{ background: SYSDE.red, color: SYSDE.white }}>
          <Icon className="h-4 w-4" strokeWidth={2} />
        </div>
        {trend ? (
          <div className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider" style={{ border: `1px solid ${trend.dir === "up" ? SYSDE.gray : SYSDE.red}40`, color: trend.dir === "up" ? SYSDE.gray : SYSDE.red, background: trend.dir === "up" ? SYSDE.light : SYSDE.red + "0A", fontFamily: "'Montserrat', sans-serif" }}>
            {trend.dir === "up" ? <ArrowUp className="h-2.5 w-2.5" strokeWidth={3} /> : <ArrowDown className="h-2.5 w-2.5" strokeWidth={3} />}
            <span className="truncate max-w-[80px]">{trend.text}</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider" style={{ border: `1px solid ${SYSDE.mid}40`, color: SYSDE.mid, fontFamily: "'Montserrat', sans-serif" }}>
            <Minus className="h-2.5 w-2.5" />
            ESTABLE
          </div>
        )}
      </div>
      <p className="text-4xl md:text-5xl font-bold tabular-nums tracking-tighter leading-[0.9]" style={{ color: SYSDE.red, fontFamily: "'Montserrat', sans-serif" }}>{value}</p>
      <p className="text-[10px] font-bold tracking-[0.2em] uppercase mt-3" style={{ color: SYSDE.gray, fontFamily: "'Montserrat', sans-serif" }}>{label}</p>
      <p className="text-[10px] mt-1 truncate uppercase tracking-wider" style={{ color: SYSDE.mid }} title={sub}>{sub}</p>
    </motion.div>
  );
}

function AlertBlock({ Icon, n, label, hint, border, onClick }: { Icon: typeof Building2; n: number; label: string; hint: string; border?: boolean; onClick?: () => void }) {
  const C = onClick ? "button" : "div";
  return (
    <C onClick={onClick} className="p-5 group hover:bg-[#FBFAF8] transition-colors w-full text-left" style={{ background: SYSDE.white, borderRight: border ? `1px solid ${SYSDE.mid}33` : undefined, borderTop: `3px solid ${SYSDE.red}` }}>
      <div className="flex items-center gap-3 mb-4">
        <div className="h-7 w-7 flex items-center justify-center" style={{ background: SYSDE.red, color: SYSDE.white }}>
          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
        </div>
        <span className="text-[9px] font-bold tracking-[0.2em] uppercase" style={{ color: SYSDE.mid, fontFamily: "'Montserrat', sans-serif" }}>ALERTA</span>
        {onClick ? (
          <span className="ml-auto inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: SYSDE.red, fontFamily: "'Montserrat', sans-serif" }}>
            <Sparkles className="h-2.5 w-2.5" /> ANALIZAR
          </span>
        ) : (
          <AlertOctagon className="h-3 w-3 ml-auto" style={{ color: SYSDE.mid }} />
        )}
      </div>
      <p className="flex items-baseline gap-2">
        <span className="text-4xl font-bold tabular-nums tracking-tighter leading-none" style={{ color: SYSDE.red, fontFamily: "'Montserrat', sans-serif" }}>{n}</span>
        <span className="text-xs font-medium uppercase tracking-wider" style={{ color: SYSDE.gray, fontFamily: "'Montserrat', sans-serif" }}>{label}</span>
      </p>
      <p className="text-[10px] font-bold tracking-wider uppercase mt-3 truncate" style={{ color: SYSDE.mid, fontFamily: "'Montserrat', sans-serif" }} title={hint}>{hint}</p>
    </C>
  );
}

function Bar({ pct, muted }: { pct: number; muted?: boolean }) {
  return (
    <div className="h-1 mt-4" style={{ background: SYSDE.light }}>
      <motion.div initial={{ width: 0 }} whileInView={{ width: `${Math.min(pct, 100)}%` }} viewport={{ once: true }} transition={{ duration: 0.6 }} className="h-full" style={{ background: muted ? SYSDE.gray : SYSDE.red, opacity: muted ? 0.6 : 1 }} />
    </div>
  );
}

function DataPoint({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div>
      <p className="text-[9px] font-bold tracking-[0.2em] uppercase" style={{ color: SYSDE.mid, fontFamily: "'Montserrat', sans-serif" }}>{label}</p>
      <p className="text-base font-bold tabular-nums tracking-tight mt-1" style={{ color: highlight ? SYSDE.red : SYSDE.gray, fontFamily: "'Montserrat', sans-serif" }}>{value}</p>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider" style={{ color: SYSDE.mid, fontFamily: "'Montserrat', sans-serif" }}>
      <span className="h-1.5 w-3" style={{ background: color }} />
      {label}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className="h-full min-h-[120px] flex items-center justify-center text-[10px] font-bold uppercase tracking-wider" style={{ color: SYSDE.mid, fontFamily: "'Montserrat', sans-serif" }}>{label}</div>;
}
