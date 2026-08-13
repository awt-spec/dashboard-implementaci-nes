import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { useClients } from "@/hooks/useClients";
import { useAllSupportTickets, useSupportClients } from "@/hooks/useSupportTickets";
import { useAuth } from "@/hooks/useAuth";
// DB is the single source of truth — no static fallback
import { TrendingUp, CheckCircle, AlertTriangle, Users, Clock, ShieldAlert, Filter, Target, FileCheck, Layers, Loader2, Presentation, AlertOctagon, UserX, Rocket } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExecutivePresentation } from "./ExecutivePresentation";
import { ProjectKPIs } from "./ProjectKPIs";
import { UpcomingDeliverables } from "./UpcomingDeliverables";
import { ExecutiveComposer, type WidgetDef } from "./ExecutiveComposer";
import { ExecutiveAIChat } from "./ExecutiveAIChat";
import { ActionQueue } from "./ActionQueue";
import { ActivePolicyBar } from "@/components/policy/ActivePolicyBar";
import { HeroBanner, greeting } from "@/components/common/HeroBanner";
import { KpiTile, SectionLabel, StatusChip, type Tone } from "@/components/common/StatCard";

interface ExecutiveOverviewProps {
  /** Callback opcional para navegar desde la ActionQueue */
  onNavigate?: (section: string) => void;
}

const WIDGETS: WidgetDef[] = [
  { key: "actions",     label: "Acciones del día",     description: "Decisiones priorizadas con botones one-click",                  group: "salud", defaultOn: true },
  { key: "policy",      label: "Política activa v4.5", description: "Reglas vigentes: SLA, checklist de cierre, métricas",          group: "salud", defaultOn: true },
  { key: "pulso",       label: "Pulso del día",        description: "Saludo + insights más urgentes (críticos, vencidos, alertas)", group: "salud", defaultOn: true },
  { key: "kpis",        label: "KPIs principales",     description: "8 indicadores: clientes, tareas, riesgos, equipo",            group: "salud", defaultOn: true },
  { key: "status_pie",  label: "Estado de Clientes",   description: "Pie chart: activos, en riesgo, completados, pausados",         group: "salud", defaultOn: true },
  { key: "progress",    label: "Progreso por Cliente", description: "Barras: implementación (%) y soporte (% cierre tickets)",      group: "salud", defaultOn: true },
  { key: "tasks",       label: "Tareas",               description: "Distribución por estado y prioridad",                          group: "tareas" },
  { key: "deliverables",label: "Entregables",          description: "Estado de los entregables del portafolio",                     group: "tareas", defaultOn: true },
  { key: "alerts",      label: "Alertas activas",      description: "Riesgos + tareas bloqueadas con filtros",                      group: "alertas", defaultOn: true },
  { key: "country",     label: "Distribución geográfica", description: "Clientes por país",                                         group: "tiempo" },
  { key: "team",        label: "Equipo por Cliente",   description: "Personas asignadas a cada proyecto",                           group: "tiempo" },
  { key: "project_kpis",label: "KPIs por proyecto",    description: "ProjectKPIs panel con métricas detalladas",                    group: "tiempo" },
  { key: "upcoming",    label: "Próximos entregables", description: "Calendario de lo que vence pronto",                            group: "tareas", defaultOn: true },
];

export function ExecutiveOverview({ onNavigate }: ExecutiveOverviewProps = {}) {
  const { data: clientsData, isLoading } = useClients();
  const { data: allSupportTickets } = useAllSupportTickets();
  const { data: supportClientsData } = useSupportClients();
  const { role } = useAuth();
  const clients = clientsData || [];
  const supportTickets = allSupportTickets || [];
  const supportClients = (supportClientsData || []).map(c => ({ id: c.id, name: c.name }));

  // Vista limpia para admin: menos widgets default + hero compacto + KPIs reducidos.
  // El admin ya tiene "Configuración" para detalle profundo — el Resumen es para
  // tomar el pulso rápido, no para analizar. Mantener PM/gerente con la vista
  // anterior (más completa) ya que para ellos esto ES su workspace.
  const isAdminView = role === "admin";

  // Set inicial de widgets activos:
  //  - admin → solo actions + pulso + kpis + alerts (4 esenciales)
  //  - resto → todos los marcados defaultOn:true (vista actual)
  const [activeWidgets, setActiveWidgets] = useState<Set<string>>(() =>
    isAdminView
      ? new Set(["actions", "pulso", "kpis", "alerts"])
      : new Set(WIDGETS.filter(w => w.defaultOn).map(w => w.key))
  );

  const [filterClient, setFilterClient] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterImpact, setFilterImpact] = useState<string>("all");
  const [showPresentation, setShowPresentation] = useState(false);
  const show = (k: string) => activeWidgets.has(k);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const activeClients = clients.filter(c => c.status === "activo").length;
  const atRisk = clients.filter(c => c.status === "en-riesgo").length;
  const completed = clients.filter(c => c.status === "completado").length;
  const paused = clients.filter(c => c.status === "pausado").length;
  const avgProgress = Math.round(clients.reduce((s, c) => s + c.progress, 0) / clients.length);
  const totalRisks = clients.reduce((s, c) => s + c.risks.filter(r => r.status === "abierto").length, 0);

  const allTasks = clients.flatMap(c => c.tasks);
  const tasksByStatus = {
    completada: allTasks.filter(t => t.status === "completada").length,
    "en-progreso": allTasks.filter(t => t.status === "en-progreso").length,
    pendiente: allTasks.filter(t => t.status === "pendiente").length,
    bloqueada: allTasks.filter(t => t.status === "bloqueada").length,
  };
  const tasksByPriority = {
    alta: allTasks.filter(t => t.priority === "alta").length,
    media: allTasks.filter(t => t.priority === "media").length,
    baja: allTasks.filter(t => t.priority === "baja").length,
  };

  const allDeliverables = clients.flatMap(c => c.deliverables);
  const deliverablesByStatus = {
    aprobado: allDeliverables.filter(d => d.status === "aprobado").length,
    entregado: allDeliverables.filter(d => d.status === "entregado").length,
    "en-revision": allDeliverables.filter(d => d.status === "en-revision").length,
    pendiente: allDeliverables.filter(d => d.status === "pendiente").length,
  };

  const riskAlerts = clients.flatMap(c =>
    c.risks.filter(r => r.status === "abierto").map(r => ({ clientName: c.name, clientId: c.id, type: (r.category === "obstaculo" ? "obstacle" : "risk") as "risk" | "obstacle" | "blocked", impact: r.impact, description: r.description, mitigation: r.mitigation }))
  );
  const blockedTasks = clients.flatMap(c =>
    c.tasks.filter(t => t.status === "bloqueada").map(t => ({ clientName: c.name, clientId: c.id, type: "blocked" as const, impact: "alto" as const, description: t.title, mitigation: `Responsable: ${t.owner} — Vence: ${t.dueDate}` }))
  );
  const allAlerts = [...riskAlerts, ...blockedTasks];
  const filteredAlerts = allAlerts.filter(a => {
    if (filterClient !== "all" && a.clientId !== filterClient) return false;
    if (filterType !== "all" && a.type !== filterType) return false;
    if (filterImpact !== "all" && a.impact !== filterImpact) return false;
    return true;
  });
  const uniqueClients = [...new Map(allAlerts.map(a => [a.clientId, a.clientName])).entries()];

  const statusData = [
    { name: "Activos", value: activeClients, color: "hsl(var(--success))" },
    { name: "En Riesgo", value: atRisk, color: "hsl(var(--destructive))" },
    { name: "Completados", value: completed, color: "hsl(var(--info))" },
    { name: "Pausados", value: paused, color: "hsl(var(--muted-foreground))" },
  ].filter(d => d.value > 0);

  const taskStatusData = [
    { name: "Completadas", value: tasksByStatus.completada, color: "hsl(var(--success))" },
    { name: "Progreso", value: tasksByStatus["en-progreso"], color: "hsl(var(--info))" },
    { name: "Pendientes", value: tasksByStatus.pendiente, color: "hsl(var(--warning))" },
    { name: "Bloqueadas", value: tasksByStatus.bloqueada, color: "hsl(var(--destructive))" },
  ];

  const deliverableStatusData = [
    { name: "Aprobados", value: deliverablesByStatus.aprobado, color: "hsl(var(--success))" },
    { name: "Entregados", value: deliverablesByStatus.entregado, color: "hsl(var(--info))" },
    { name: "En Revisión", value: deliverablesByStatus["en-revision"], color: "hsl(var(--warning))" },
    { name: "Pendientes", value: deliverablesByStatus.pendiente, color: "hsl(var(--destructive))" },
  ];

  const countryMap = clients.reduce((acc, c) => {
    acc[c.country] = (acc[c.country] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const countryData = Object.entries(countryMap).map(([name, value]) => ({ name, value }));
  const countryColors = ["hsl(var(--primary))", "hsl(var(--info))", "hsl(var(--success))", "hsl(var(--warning))", "hsl(var(--destructive))"];

  const teamByClient = clients.map(c => ({
    name: c.name.split(" ").slice(0, 2).join(" "),
    personas: c.teamAssigned.length,
  }));

  // KPIs:
  //  - admin → 4 esenciales (clientes, riesgos, tareas, entregables)
  //    foco en negocio, sin datos operativos del día a día
  //  - resto → 8 KPIs detallados (vista de operación PM)
  const kpisAll: { title: string; value: string | number; icon: typeof Users; tone: Tone }[] = [
    { title: "Clientes Activos", value: activeClients, icon: Users, tone: "success" },
    { title: "Progreso Promedio", value: `${avgProgress}%`, icon: TrendingUp, tone: "info" },
    { title: "Total Tareas", value: allTasks.length, icon: Layers, tone: "primary" },
    { title: "Completadas", value: tasksByStatus.completada, icon: CheckCircle, tone: "success" },
    { title: "Progreso", value: tasksByStatus["en-progreso"], icon: Clock, tone: "warning" },
    { title: "Riesgos Abiertos", value: totalRisks, icon: AlertTriangle, tone: "destructive" },
    { title: "Entregables", value: allDeliverables.length, icon: FileCheck, tone: "info" },
    { title: "Equipo Total", value: [...new Set(clients.flatMap(c => c.teamAssigned))].length, icon: Target, tone: "success" },
  ];
  const kpisAdmin: typeof kpisAll = [
    { title: "Clientes Activos", value: activeClients, icon: Users, tone: "success" },
    { title: "En Riesgo", value: atRisk, icon: AlertTriangle, tone: "destructive" },
    { title: "Progreso", value: `${avgProgress}%`, icon: TrendingUp, tone: "info" },
    { title: "Equipo", value: [...new Set(clients.flatMap(c => c.teamAssigned))].length, icon: Target, tone: "primary" },
  ];
  const kpis = isAdminView ? kpisAdmin : kpisAll;

  const impactColor: Record<string, string> = {
    alto: "bg-destructive",
    medio: "bg-warning",
    bajo: "bg-muted-foreground",
  };

  const tooltipStyle = {
    background: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: 8,
    fontSize: 12,
  };

  // ─── Pulso del día — insights accionables ───
  const now = new Date();
  const criticalSupportOpen = supportTickets.filter(t =>
    /critica/i.test(t.prioridad || "") && !["CERRADA", "ANULADA"].includes(t.estado)
  ).length;
  // Casos sin atención = PENDIENTE sin responsable asignado
  const unattendedSupport = supportTickets.filter(t =>
    t.estado === "PENDIENTE" && !t.responsable
  ).length;
  const dueSoonDeliverables = allDeliverables.filter(d => {
    if (d.status === "aprobado" || d.status === "entregado") return false;
    if (!d.dueDate) return false;
    const days = (new Date(d.dueDate).getTime() - now.getTime()) / 86400000;
    return days >= 0 && days <= 7;
  }).length;
  const overdueDeliverables = allDeliverables.filter(d => {
    if (d.status === "aprobado" || d.status === "entregado") return false;
    if (!d.dueDate) return false;
    return new Date(d.dueDate).getTime() < now.getTime();
  }).length;

  // Línea de contexto del hero: sólo se arman fragmentos cuyo conteo real es > 0,
  // así nunca se muestra una métrica inventada ni un "0" sin sentido.
  const contextParts: string[] = [];
  if (atRisk > 0) contextParts.push(`${atRisk} cliente${atRisk === 1 ? "" : "s"} en riesgo`);
  if (criticalSupportOpen > 0) contextParts.push(`${criticalSupportOpen} caso${criticalSupportOpen === 1 ? "" : "s"} crítico${criticalSupportOpen === 1 ? "" : "s"} abierto${criticalSupportOpen === 1 ? "" : "s"}`);
  if (overdueDeliverables > 0) contextParts.push(`${overdueDeliverables} entregable${overdueDeliverables === 1 ? "" : "s"} vencido${overdueDeliverables === 1 ? "" : "s"}`);
  if (unattendedSupport > 0) contextParts.push(`${unattendedSupport} caso${unattendedSupport === 1 ? "" : "s"} sin atender`);
  const contextList =
    contextParts.length <= 1
      ? contextParts.join("")
      : `${contextParts.slice(0, -1).join(", ")} y ${contextParts[contextParts.length - 1]}`;
  // Concordancia del verbo: singular sólo si hay un único fragmento y vale 1.
  const contextSingular = contextParts.length === 1 && contextParts[0].startsWith("1 ");
  const heroSubtitle =
    contextParts.length === 0
      ? "Sin alertas abiertas — el portafolio está bajo control."
      : `Hay ${contextList} que ${contextSingular ? "necesita" : "necesitan"} decisión hoy.`;

  return (
    <div className="space-y-6 animate-fadein">
      {/* Botón flotante de chat IA — abre Sheet con asistente conversacional */}
      <ExecutiveAIChat />

      {/* ════ HERO: Pulso del día ════
          Admin = variante compacta (rounded-2xl, título 22px) y SOLO los chips
          más críticos, para no duplicar lo que ya muestra ActionQueue arriba.
          Resto = hero completo con todos los chips. */}
      {show("pulso") && (
        <HeroBanner
          compact={isAdminView}
          eyebrow={<>Resumen ejecutivo · {now.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" })}</>}
          title={`${greeting(now)}.`}
          subtitle={
            contextParts.length === 0 ? (
              <span className="inline-flex items-center gap-1.5">
                {heroSubtitle} <Rocket className="h-3.5 w-3.5" />
              </span>
            ) : (
              heroSubtitle
            )
          }
          action={
            <Button
              onClick={() => setShowPresentation(true)}
              variant={isAdminView ? "outline" : "default"}
              size={isAdminView ? "sm" : "default"}
              className="gap-2"
            >
              <Presentation className="h-4 w-4" /> Presentación
            </Button>
          }
          chips={
            <>
              {atRisk > 0 && (
                <StatusChip tone="destructive" icon={AlertOctagon}>{atRisk} en riesgo</StatusChip>
              )}
              {criticalSupportOpen > 0 && (
                <StatusChip tone="destructive" icon={ShieldAlert}>{criticalSupportOpen} críticos abiertos</StatusChip>
              )}
              {/* Resto de chips: solo en vista NO-admin (ya están en ActionQueue) */}
              {!isAdminView && unattendedSupport > 0 && (
                <StatusChip tone="warning" icon={UserX}>
                  {unattendedSupport} sin atender
                  {/* El punto que late marca que la cola sigue creciendo sin dueño */}
                  <span className="relative ml-0.5 flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-75" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-warning" />
                  </span>
                </StatusChip>
              )}
              {!isAdminView && overdueDeliverables > 0 && (
                <StatusChip tone="warning" icon={AlertTriangle}>{overdueDeliverables} entregables vencidos</StatusChip>
              )}
              {!isAdminView && dueSoonDeliverables > 0 && (
                <StatusChip tone="info" icon={Clock}>{dueSoonDeliverables} vencen en 7 días</StatusChip>
              )}
              {!isAdminView && totalRisks > 0 && (
                <StatusChip tone="muted" icon={FileCheck}>{totalRisks} alertas activas</StatusChip>
              )}
              {atRisk === 0 && criticalSupportOpen === 0 && unattendedSupport === 0 && overdueDeliverables === 0 && totalRisks === 0 && (
                <StatusChip tone="success" icon={CheckCircle}>Sin alertas</StatusChip>
              )}
            </>
          }
        />
      )}
      <ExecutivePresentation clients={clients} supportTickets={supportTickets} supportClients={supportClients} open={showPresentation} onClose={() => setShowPresentation(false)} />

      {/* Tira de KPIs — hasta 8 columnas en xl, 4 en md, 2x2 en móvil.
          Admin ve 4 KPIs con el valor grande; PM ve 8 en modo compacto. */}
      {show("kpis") && (
      <div className={
        isAdminView
          ? "grid grid-cols-2 md:grid-cols-4 gap-3"
          : "grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3"
      }>
        {kpis.map((kpi, i) => (
          <motion.div key={kpi.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <KpiTile
              icon={kpi.icon}
              value={kpi.value}
              label={kpi.title}
              tone={kpi.tone}
              compact={!isAdminView}
              className="h-full transition-colors hover:border-primary/30"
            />
          </motion.div>
        ))}
      </div>
      )}

      {/* ════ COMPOSER: ¿Qué querés ver hoy? — debajo del hero/KPIs ════
          Permite al user activar/desactivar widgets y guardar vistas. */}
      <ExecutiveComposer
        widgets={WIDGETS}
        selected={activeWidgets}
        onChange={setActiveWidgets}
      />

      {/* ════ ACCIONES DEL DÍA — vista accionable, one-click ════ */}
      {show("actions") && (
        <ActionQueue onNavigate={onNavigate} />
      )}

      {/* ════ POLÍTICA ACTIVA — reglas v4.5 visibles en cancha ════ */}
      {show("policy") && (
        <ActivePolicyBar
          ruleTypes={["sla", "checklist", "metric"]}
          title="Política activa v4.5 · reglas en operación"
        />
      )}

      {/* Row 1: Status Pie + Progress by Client */}
      {(show("status_pie") || show("progress")) && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="rounded-xl border-border">
          <CardContent className="p-5">
            <SectionLabel className="mb-3">Estado de Clientes</SectionLabel>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} innerRadius={50} outerRadius={75} dataKey="value" strokeWidth={2} stroke="hsl(var(--card))">
                    {statusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Tooltip formatter={(value: number, name: string) => [`${value} clientes`, name]} contentStyle={tooltipStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {statusData.map(d => (
                <div key={d.name} className="flex items-center gap-1.5 text-xs">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-muted-foreground">{d.name} ({d.value})</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2 rounded-xl border-border">
          <CardContent className="p-5">
            <SectionLabel className="mb-3">Progreso por Cliente</SectionLabel>
            {(() => {
              const CLOSED = new Set(["CERRADA", "ANULADA"]);
              const impl = clients.filter((c: any) => c.client_type === "implementacion");
              const sup = clients.filter((c: any) => c.client_type === "soporte");
              const other = clients.filter((c: any) => !["implementacion", "soporte"].includes(c.client_type));

              // Para soporte, calcular tasa de cierre de tickets (closed / total).
              // Si no tiene tickets, ponemos 100% (no hay nada pendiente = sano).
              const supportProgress = (clientId: string) => {
                const myTickets = supportTickets.filter((t: any) => t.client_id === clientId);
                if (myTickets.length === 0) return { pct: 100, label: "sin tickets", total: 0 };
                const closed = myTickets.filter((t: any) => CLOSED.has(t.estado)).length;
                return { pct: Math.round((closed / myTickets.length) * 100), label: `${closed}/${myTickets.length} cerrados`, total: myTickets.length };
              };

              const ImplRow = ({ c }: { c: any }) => {
                const pct = c.progress ?? 0;
                return (
                  <div key={c.id}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-foreground font-medium truncate mr-2">{c.name}</span>
                      <span className="text-muted-foreground shrink-0 tabular-nums">{pct}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct > 80 ? 'bg-success' : pct > 40 ? 'bg-primary' : 'bg-warning'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              };

              const SupportRow = ({ c }: { c: any }) => {
                const { pct, label, total } = supportProgress(c.id);
                return (
                  <div key={c.id}>
                    <div className="flex justify-between items-baseline text-xs mb-1 gap-2">
                      <span className="text-foreground font-medium truncate">{c.name}</span>
                      <div className="flex items-baseline gap-1.5 shrink-0">
                        <span className="text-[10px] text-muted-foreground/70 whitespace-nowrap">{label}</span>
                        <span className="text-muted-foreground tabular-nums">{pct}%</span>
                      </div>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${pct >= 80 ? 'bg-success' : pct >= 50 ? 'bg-primary' : total === 0 ? 'bg-muted-foreground/30' : 'bg-warning'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              };

              const Section = ({ title, subtitle, count, items, Row }: { title: string; subtitle?: string; count: number; items: any[]; Row: (p: { c: any }) => JSX.Element }) => (
                items.length === 0 ? null : (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 pb-1 border-b border-border/50">
                      <SectionLabel>{title}</SectionLabel>
                      <span className="text-[10px] font-mono tabular-nums text-muted-foreground/70">({count})</span>
                      {subtitle && <span className="text-[10px] text-muted-foreground/60 ml-auto italic">{subtitle}</span>}
                    </div>
                    <div className="space-y-2.5">
                      {items.map((c) => <Row key={c.id} c={c} />)}
                    </div>
                  </div>
                )
              );

              return (
                <div className="space-y-4">
                  <Section title="Implementación" subtitle="% avance del proyecto" count={impl.length} items={impl} Row={ImplRow} />
                  <Section title="Soporte" subtitle="% tickets cerrados" count={sup.length} items={sup} Row={SupportRow} />
                  <Section title="Otros" count={other.length} items={other} Row={ImplRow} />
                </div>
              );
            })()}
          </CardContent>
        </Card>
      </div>
      )}

      {/* Row 2: Tasks + Deliverables + Priority */}
      {(show("tasks") || show("deliverables")) && (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="rounded-xl border-border">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="h-4 w-4 text-info" />
                <SectionLabel>Tareas por Estado</SectionLabel>
                <Badge variant="outline" className="ml-auto text-[11.5px] tabular-nums">{allTasks.length} total</Badge>
              </div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={taskStatusData} innerRadius={40} outerRadius={65} dataKey="value" strokeWidth={2} stroke="hsl(var(--card))">
                      {taskStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [`${value} tareas`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {taskStatusData.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-muted-foreground">{d.name}</span>
                    <span className="font-bold text-foreground tabular-nums ml-auto">{d.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Card className="rounded-xl border-border">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <FileCheck className="h-4 w-4 text-success" />
                <SectionLabel>Entregables</SectionLabel>
                <Badge variant="outline" className="ml-auto text-[11.5px] tabular-nums">{allDeliverables.length} total</Badge>
              </div>
              <div className="h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={deliverableStatusData} innerRadius={40} outerRadius={65} dataKey="value" strokeWidth={2} stroke="hsl(var(--card))">
                      {deliverableStatusData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number, name: string) => [`${value} entregables`, name]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {deliverableStatusData.map(d => (
                  <div key={d.name} className="flex items-center gap-1.5 text-xs">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                    <span className="text-muted-foreground">{d.name}</span>
                    <span className="font-bold text-foreground tabular-nums ml-auto">{d.value}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="rounded-xl border-border">
            <CardContent className="p-5">
              <SectionLabel className="mb-3">Prioridad de Tareas</SectionLabel>
              <div className="space-y-4 mt-4">
                {[
                  { label: "Alta", count: tasksByPriority.alta, pct: allTasks.length > 0 ? Math.round((tasksByPriority.alta / allTasks.length) * 100) : 0, color: "bg-destructive" },
                  { label: "Media", count: tasksByPriority.media, pct: allTasks.length > 0 ? Math.round((tasksByPriority.media / allTasks.length) * 100) : 0, color: "bg-warning" },
                  { label: "Baja", count: tasksByPriority.baja, pct: allTasks.length > 0 ? Math.round((tasksByPriority.baja / allTasks.length) * 100) : 0, color: "bg-success" },
                ].map(p => (
                  <div key={p.label}>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="font-medium text-foreground">{p.label}</span>
                      <span className="text-muted-foreground tabular-nums">{p.count} ({p.pct}%)</span>
                    </div>
                    <div className="h-3 bg-muted rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${p.color}`} style={{ width: `${p.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6">
                <SectionLabel className="mb-2">Por País</SectionLabel>
                <div className="space-y-2">
                  {countryData.map((c, i) => (
                    <div key={c.name} className="flex items-center gap-2 text-xs">
                      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: countryColors[i % countryColors.length] }} />
                      <span className="text-muted-foreground flex-1">{c.name}</span>
                      <span className="font-bold text-foreground tabular-nums">{c.value}</span>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
      )}

      {/* Row 3: Team workload */}
      {show("team") && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="rounded-xl border-border">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-4 w-4 text-primary" />
                <SectionLabel>Equipo Asignado por Cliente</SectionLabel>
              </div>
              <div className="h-48">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={teamByClient} layout="vertical" barSize={16}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} width={90} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(value: number) => [`${value} personas`]} />
                    <Bar dataKey="personas" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} name="Personas" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
          <Card className="rounded-xl border-border">
            <CardContent className="p-5">
              <SectionLabel className="mb-4">Resumen de Implementaciones</SectionLabel>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Proyectos Activos", value: activeClients.toString(), sub: `${clients.length} total` },
                  { label: "Tareas Activas", value: tasksByStatus["en-progreso"].toString(), sub: `${tasksByStatus.pendiente} pendientes` },
                  { label: "Entregables Aprobados", value: deliverablesByStatus.aprobado.toString(), sub: `${deliverablesByStatus.pendiente} pendientes` },
                  { label: "Riesgos Abiertos", value: totalRisks.toString(), sub: totalRisks > 3 ? "Atención requerida" : "Normal" },
                ].map(item => (
                  <div key={item.label} className="p-3 rounded-xl bg-muted/50 border border-border">
                    <SectionLabel>{item.label}</SectionLabel>
                    <p className="text-[18px] font-bold text-foreground tabular-nums mt-1">{item.value}</p>
                    <p className="text-[11.5px] text-muted-foreground mt-0.5">{item.sub}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
      )}

      {/* KPIs & Upcoming Deliverables */}
      {(show("project_kpis") || show("upcoming")) && (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {show("project_kpis") && <ProjectKPIs clients={clients} />}
        {show("upcoming") && <UpcomingDeliverables clients={clients} />}
      </div>
      )}

      {/* Critical Alerts with Filters */}
      {show("alerts") && allAlerts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <Card className="rounded-xl border-destructive/30 bg-destructive/5">
            <CardContent className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <ShieldAlert className="h-5 w-5 text-destructive" />
                <SectionLabel className="text-destructive">Alertas Críticas</SectionLabel>
                <Badge variant="destructive" className="ml-auto tabular-nums">{filteredAlerts.length} / {allAlerts.length}</Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-4 p-3 rounded-xl bg-card border border-border">
                <Filter className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <Select value={filterClient} onValueChange={setFilterClient}>
                  <SelectTrigger className="h-8 w-[160px] text-xs"><SelectValue placeholder="Cliente" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los clientes</SelectItem>
                    {uniqueClients.map(([id, name]) => <SelectItem key={id} value={id}>{name.split(" ").slice(0, 2).join(" ")}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue placeholder="Tipo" /></SelectTrigger>
                  <SelectContent>
                     <SelectItem value="all">Todos los tipos</SelectItem>
                     <SelectItem value="risk">Riesgo Abierto</SelectItem>
                     <SelectItem value="obstacle">Obstáculo</SelectItem>
                     <SelectItem value="blocked">Tarea Bloqueada</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterImpact} onValueChange={setFilterImpact}>
                  <SelectTrigger className="h-8 w-[130px] text-xs"><SelectValue placeholder="Impacto" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todo impacto</SelectItem>
                    <SelectItem value="alto">Alto</SelectItem>
                    <SelectItem value="medio">Medio</SelectItem>
                    <SelectItem value="bajo">Bajo</SelectItem>
                  </SelectContent>
                </Select>
                {(filterClient !== "all" || filterType !== "all" || filterImpact !== "all") && (
                  <button onClick={() => { setFilterClient("all"); setFilterType("all"); setFilterImpact("all"); }} className="text-[10px] text-primary hover:underline ml-1">Limpiar filtros</button>
                )}
              </div>

              <div className="space-y-3">
                {filteredAlerts.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No hay alertas con los filtros seleccionados.</p>
                ) : (
                  filteredAlerts.map((alert, i) => (
                    <div key={i} className="flex gap-3 p-3 rounded-xl bg-card border border-border">
                      <div className={`mt-0.5 shrink-0 w-2 h-2 rounded-full ${impactColor[alert.impact] || "bg-muted-foreground"}`} />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-xs font-bold text-foreground truncate">{alert.clientName}</span>
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">{alert.type === "risk" ? "Riesgo" : alert.type === "obstacle" ? "Obstáculo" : "Bloqueada"}</Badge>
                          <Badge variant={alert.impact === "alto" ? "destructive" : "secondary"} className="text-[10px] px-1.5 py-0 shrink-0">{alert.impact.charAt(0).toUpperCase() + alert.impact.slice(1)}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{alert.description}</p>
                        {alert.mitigation && <p className="text-[10px] text-primary mt-1 font-medium">→ {alert.mitigation}</p>}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Client progress cards */}
      <div>
        <SectionLabel className="mb-3">Detalle por Cliente</SectionLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {clients.map((client) => {
            const statusColors: Record<string, string> = {
              activo: "bg-success",
              "en-riesgo": "bg-destructive",
              completado: "bg-info",
              pausado: "bg-muted-foreground",
            };
            return (
              <Card key={client.id} className="rounded-xl border-border hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-[13.5px] font-bold text-foreground">{client.name}</h4>
                      <p className="text-[11.5px] text-muted-foreground">{client.country} · {client.industry}</p>
                    </div>
                    <div className={`w-2.5 h-2.5 rounded-full mt-1 ${statusColors[client.status]}`} />
                  </div>
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Progreso</span>
                      <span className="font-bold text-foreground tabular-nums">{client.progress}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${client.progress}%` }} />
                    </div>
                  </div>
                  <div className="flex justify-between mt-3 text-xs text-muted-foreground">
                    <span>{client.tasks.length} tareas</span>
                    <span>{client.risks.filter(r => r.status === "abierto").length} riesgos</span>
                    <span>{client.deliverables.length} entregables</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
