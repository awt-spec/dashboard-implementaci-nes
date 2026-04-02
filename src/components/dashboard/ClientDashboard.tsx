import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  TrendingUp, CheckCircle2, Clock, FileCheck, Calendar, Building2,
  MessageSquare, ThumbsUp, Send, Bell, Plus, Loader2, AlertTriangle,
  LayoutDashboard, ListTodo, FileText, MessageCircle, BellRing,
  Settings, GripVertical, Eye, EyeOff, ChevronDown, ChevronUp,
  CheckSquare, ArrowRight, Users
} from "lucide-react";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  RadialBarChart, RadialBar, Legend, Area, AreaChart, Label
} from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { type Client, type Comment, type MeetingMinute } from "@/data/projectData";
import { useCreateComment } from "@/hooks/useClients";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

// ── Types ──────────────────────────────────────────────
type WidgetId = "progress" | "phases" | "taskChart" | "taskList" | "deliverables" | "risks" | "feedback" | "recentMinutes";

interface WidgetConfig {
  id: WidgetId;
  label: string;
  enabled: boolean;
  order: number;
}

const DEFAULT_WIDGETS: WidgetConfig[] = [
  { id: "progress", label: "Avance General", enabled: true, order: 0 },
  { id: "phases", label: "Fases del Proyecto", enabled: true, order: 1 },
  { id: "taskChart", label: "Gráfico de Actividades", enabled: true, order: 2 },
  { id: "taskList", label: "Actividades Recientes", enabled: true, order: 3 },
  { id: "deliverables", label: "Entregables", enabled: true, order: 4 },
  { id: "risks", label: "Puntos de Atención", enabled: true, order: 5 },
  { id: "recentMinutes", label: "Últimas Minutas", enabled: true, order: 6 },
  { id: "feedback", label: "Últimos Comentarios", enabled: true, order: 7 },
];

const statusLabels: Record<string, string> = {
  activo: "En Curso", "en-riesgo": "Atención Requerida", completado: "Finalizado", pausado: "En Pausa",
};
const statusStyles: Record<string, string> = {
  activo: "bg-success text-success-foreground", "en-riesgo": "bg-warning text-warning-foreground",
  completado: "bg-info text-info-foreground", pausado: "bg-muted text-muted-foreground",
};

const commentTypeConfig: Record<string, { icon: any; color: string; label: string }> = {
  comentario: { icon: MessageSquare, color: "text-info", label: "Comentario" },
  aprobacion: { icon: ThumbsUp, color: "text-success", label: "Aprobación" },
  solicitud: { icon: Send, color: "text-warning", label: "Solicitud" },
  alerta: { icon: Bell, color: "text-destructive", label: "Alerta" },
};

const tooltipStyle = {
  background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 12, fontSize: 12,
  boxShadow: "0 8px 30px -10px hsl(var(--foreground) / 0.15)", padding: "8px 12px",
};

// ── Notifications Hook ──────────────────────────────────
function useNotifications(clientId: string) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from("client_notifications").select("*").eq("client_id", clientId)
      .order("created_at", { ascending: false }).limit(20)
      .then(({ data }) => { setNotifications(data || []); setLoading(false); });
  }, [clientId]);

  const markRead = async (id: string) => {
    await supabase.from("client_notifications").update({ is_read: true }).eq("id", id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    const unread = notifications.filter(n => !n.is_read).map(n => n.id);
    if (unread.length === 0) return;
    for (const id of unread) {
      await supabase.from("client_notifications").update({ is_read: true }).eq("id", id);
    }
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  return { notifications, loading, markRead, markAllRead, unreadCount: notifications.filter(n => !n.is_read).length };
}

// ── Widget Config Hook ──────────────────────────────────
function useWidgetConfig(userId: string | undefined) {
  const [widgets, setWidgets] = useState<WidgetConfig[]>(DEFAULT_WIDGETS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!userId) return;
    supabase.from("client_dashboard_config").select("widgets").eq("user_id", userId).maybeSingle()
      .then(({ data }) => {
        if (data?.widgets) setWidgets(data.widgets as unknown as WidgetConfig[]);
        setLoaded(true);
      });
  }, [userId]);

  const saveWidgets = useCallback(async (newWidgets: WidgetConfig[]) => {
    if (!userId) return;
    setWidgets(newWidgets);
    const { data: existing } = await supabase.from("client_dashboard_config").select("id").eq("user_id", userId).maybeSingle();
    if (existing) {
      await supabase.from("client_dashboard_config").update({ widgets: newWidgets as any }).eq("user_id", userId);
    } else {
      await supabase.from("client_dashboard_config").insert({ user_id: userId, widgets: newWidgets as any });
    }
  }, [userId]);

  return { widgets, saveWidgets, loaded };
}

// ── Sub-components ──────────────────────────────────────

function ProgressWidget({ client }: { client: Client }) {
  const completedTasks = client.tasks.filter(t => t.visibility === "externa" && t.status === "completada").length;
  const totalTasks = client.tasks.filter(t => t.visibility === "externa").length;
  const taskPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const deliveredPct = client.deliverables.length > 0
    ? Math.round((client.deliverables.filter(d => ["aprobado", "entregado"].includes(d.status)).length / client.deliverables.length) * 100) : 0;

  const radialData = [
    { name: "Proyecto", value: client.progress, fill: "hsl(var(--primary))" },
    { name: "Actividades", value: taskPct, fill: "hsl(var(--info))" },
    { name: "Entregables", value: deliveredPct, fill: "hsl(var(--success))" },
  ];

  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="text-sm font-semibold text-foreground mb-2">Avance del Proyecto</h3>
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <RadialBarChart cx="50%" cy="50%" innerRadius="30%" outerRadius="90%" data={radialData} startAngle={180} endAngle={-180} barSize={12}>
              <RadialBar background={{ fill: "hsl(var(--muted))" }} dataKey="value" cornerRadius={6} />
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [`${v}%`, n]} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex justify-center gap-5 mt-1">
          {radialData.map(d => (
            <div key={d.name} className="flex items-center gap-2 text-xs">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: d.fill }} />
              <div>
                <span className="text-muted-foreground">{d.name}</span>
                <span className="font-bold text-foreground ml-1">{d.value}%</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function PhasesWidget({ client }: { client: Client }) {
  return (
    <Card className="lg:col-span-2">
      <CardHeader className="pb-2"><CardTitle className="text-sm">Fases de Implementación</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        {client.phases.map(phase => (
          <div key={phase.name} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-foreground">{phase.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground hidden sm:inline">{phase.startDate} — {phase.endDate}</span>
                <Badge variant="outline" className="text-[10px]">
                  {phase.status === "completado" ? "✅ Completado" : phase.status === "en-progreso" ? "🔄 En Progreso" : phase.status === "por-iniciar" ? "⏳ Por Iniciar" : "⏸ Pendiente"}
                </Badge>
              </div>
            </div>
            <Progress value={phase.progress} className="h-2" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function TaskChartWidget({ tasks }: { tasks: any[] }) {
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const tasksByStatus = {
    completada: tasks.filter(t => t.status === "completada").length,
    "en-progreso": tasks.filter(t => t.status === "en-progreso").length,
    pendiente: tasks.filter(t => t.status === "pendiente").length,
    bloqueada: tasks.filter(t => t.status === "bloqueada").length,
  };
  const pieData = [
    { name: "Completadas", value: tasksByStatus.completada, color: "hsl(var(--success))", emoji: "✅" },
    { name: "En Progreso", value: tasksByStatus["en-progreso"], color: "hsl(var(--info))", emoji: "🔄" },
    { name: "Pendientes", value: tasksByStatus.pendiente, color: "hsl(var(--warning))", emoji: "⏳" },
    { name: "Bloqueadas", value: tasksByStatus.bloqueada, color: "hsl(var(--destructive))", emoji: "🚫" },
  ].filter(d => d.value > 0);

  const barData = [
    { name: "Alta", value: tasks.filter(t => t.priority === "alta").length, fill: "hsl(var(--destructive))" },
    { name: "Media", value: tasks.filter(t => t.priority === "media").length, fill: "hsl(var(--warning))" },
    { name: "Baja", value: tasks.filter(t => t.priority === "baja").length, fill: "hsl(var(--success))" },
  ];

  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }: any) => {
    if (percent < 0.08) return null;
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight="bold">
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <ListTodo className="h-4 w-4 text-info" />
          <h3 className="text-sm font-semibold text-foreground">Estado de Actividades</h3>
          <Badge variant="outline" className="ml-auto text-xs">{tasks.length} total</Badge>
        </div>
        <div className="grid grid-cols-2 gap-4">
          {/* Donut with labels */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 text-center">Por Estado</p>
            <div className="h-44 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    innerRadius={32}
                    outerRadius={62}
                    dataKey="value"
                    strokeWidth={3}
                    stroke="hsl(var(--card))"
                    labelLine={false}
                    label={renderCustomLabel}
                    onMouseEnter={(_, i) => setActiveIdx(i)}
                    onMouseLeave={() => setActiveIdx(null)}
                    animationBegin={0}
                    animationDuration={800}
                    animationEasing="ease-out"
                  >
                    {pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} opacity={activeIdx !== null && activeIdx !== i ? 0.4 : 1}
                        style={{ filter: activeIdx === i ? "brightness(1.15)" : "none", transition: "all 0.2s ease", cursor: "pointer" }} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v: number, n: string) => [`${v} actividades (${tasks.length > 0 ? Math.round((v / tasks.length) * 100) : 0}%)`, n]}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center label */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-lg font-bold text-foreground">{tasks.length}</span>
                <span className="text-[9px] text-muted-foreground">Total</span>
              </div>
            </div>
          </div>
          {/* Bar chart with rounded bars and gradient feel */}
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 text-center">Por Prioridad</p>
            <div className="h-44">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} barSize={28} barGap={4}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={25} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => [`${v} actividades`]} cursor={{ fill: "hsl(var(--muted) / 0.3)", radius: 6 }} />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} animationDuration={800} animationEasing="ease-out">
                    {barData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
        {/* Legend */}
        <div className="grid grid-cols-4 gap-2 mt-4 pt-3 border-t border-border">
          {pieData.map(d => (
            <motion.div key={d.name} whileHover={{ scale: 1.05 }} className="flex items-center gap-1.5 text-xs p-1.5 rounded-md hover:bg-muted/50 transition-colors cursor-default">
              <span className="text-sm">{d.emoji}</span>
              <div className="min-w-0">
                <span className="text-muted-foreground block truncate">{d.name}</span>
                <span className="font-bold text-foreground">{d.value}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function TaskListWidget({ tasks }: { tasks: any[] }) {
  const [filter, setFilter] = useState("all");
  const filtered = filter === "all" ? tasks : tasks.filter(t => t.status === filter);
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Actividades del Proyecto</CardTitle>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-7 w-[130px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="en-progreso">En Progreso</SelectItem>
              <SelectItem value="pendiente">Pendientes</SelectItem>
              <SelectItem value="completada">Completadas</SelectItem>
              <SelectItem value="bloqueada">Bloqueadas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[350px]">
          <div className="space-y-2 pr-2">
            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No hay actividades con este filtro</p>
            ) : filtered.map(task => {
              const statusIcon = task.status === "completada" ? "✅" : task.status === "en-progreso" ? "🔄" : task.status === "bloqueada" ? "🚫" : "⏳";
              const priorityBadge = task.priority === "alta" ? "bg-destructive/10 text-destructive" : task.priority === "media" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground";
              return (
                <motion.div key={task.id} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                  <span className="text-sm mt-0.5">{statusIcon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{task.title}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">Responsable: {task.owner}</span>
                      <span className="text-[10px] text-muted-foreground">Vence: {task.dueDate}</span>
                      <Badge className={`text-[10px] ${priorityBadge}`}>{task.priority}</Badge>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function DeliverablesWidget({ deliverables }: { deliverables: any[] }) {
  const statusData = [
    { name: "Aprobados", value: deliverables.filter(d => d.status === "aprobado").length, color: "hsl(var(--success))" },
    { name: "Entregados", value: deliverables.filter(d => d.status === "entregado").length, color: "hsl(var(--info))" },
    { name: "En Revisión", value: deliverables.filter(d => d.status === "en-revision").length, color: "hsl(var(--warning))" },
    { name: "Pendientes", value: deliverables.filter(d => d.status === "pendiente").length, color: "hsl(var(--destructive))" },
  ].filter(d => d.value > 0);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <FileCheck className="h-4 w-4 text-success" />
          <CardTitle className="text-sm">Entregables</CardTitle>
          <Badge variant="outline" className="ml-auto text-xs">{deliverables.length} total</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="h-36 mb-3">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={statusData} innerRadius={30} outerRadius={50} dataKey="value" strokeWidth={2} stroke="hsl(var(--card))">
                {statusData.map((e, i) => <Cell key={i} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} formatter={(v: number, n: string) => [`${v} entregables`, n]} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <ScrollArea className="h-[200px]">
          <div className="space-y-2 pr-2">
            {deliverables.map(d => {
              const statusIcon = d.status === "aprobado" ? "✅" : d.status === "entregado" ? "📦" : d.status === "en-revision" ? "🔍" : "⏳";
              return (
                <div key={d.id} className="flex items-start gap-2 p-2 rounded-lg border border-border text-xs">
                  <span>{statusIcon}</span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-foreground truncate">{d.name}</p>
                    <p className="text-muted-foreground">Vence: {d.dueDate} {d.version && `• v${d.version}`}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

function RisksWidget({ risks }: { risks: any[] }) {
  const openRisks = risks.filter(r => r.status === "abierto");
  if (openRisks.length === 0) return null;
  return (
    <Card className="border-warning/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />Puntos de Atención
          <Badge variant="outline" className="ml-auto text-xs">{openRisks.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {openRisks.map(risk => (
          <div key={risk.id} className="p-3 rounded-lg border border-border bg-warning/5">
            <p className="text-sm font-medium text-foreground">{risk.description}</p>
            {risk.mitigation && <p className="text-xs text-muted-foreground mt-1">Plan de acción: {risk.mitigation}</p>}
            <Badge variant="outline" className="text-[10px] mt-1">Impacto: {risk.impact === "alto" ? "Alto" : risk.impact === "medio" ? "Medio" : "Bajo"}</Badge>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function RecentMinutesWidget({ minutes }: { minutes: MeetingMinute[] }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const visible = minutes.filter(m => m.visibleToClient);

  if (visible.length === 0) return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><FileText className="h-4 w-4 text-primary" /> Últimas Minutas</CardTitle></CardHeader>
      <CardContent><p className="text-sm text-muted-foreground text-center py-6">No hay minutas disponibles por el momento</p></CardContent>
    </Card>
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <FileText className="h-4 w-4 text-primary" /> Últimas Minutas
          <Badge variant="outline" className="ml-auto text-xs">{visible.length} disponibles</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {visible.slice(0, 5).map(m => {
          const isExp = expanded === m.id;
          return (
            <div key={m.id} className="rounded-lg border border-border">
              <button onClick={() => setExpanded(isExp ? null : m.id)} className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/30 transition-colors">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FileText className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{m.title}</p>
                  <div className="flex gap-2 text-[10px] text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{m.date}</span>
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" />{m.attendees.length} asistentes</span>
                  </div>
                </div>
                <motion.div animate={{ rotate: isExp ? 180 : 0 }}><ChevronDown className="h-4 w-4 text-muted-foreground" /></motion.div>
              </button>
              <AnimatePresence>
                {isExp && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                    <div className="px-3 pb-3 border-t border-border pt-2 space-y-3">
                      <div>
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Resumen</p>
                        <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{m.summary}</p>
                      </div>
                      {m.agreements.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Acuerdos</p>
                          <ul className="space-y-1">{m.agreements.map((a, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-foreground"><CheckSquare className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />{a}</li>
                          ))}</ul>
                        </div>
                      )}
                      {m.actionItems.length > 0 && (
                        <div>
                          <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Pendientes</p>
                          <ul className="space-y-1">{m.actionItems.map((item, i) => (
                            <li key={i} className="flex items-start gap-2 text-xs text-foreground"><ArrowRight className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />{item}</li>
                          ))}</ul>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function FeedbackWidget({ comments, clientId }: { comments: Comment[]; clientId: string }) {
  const { profile } = useAuth();
  const createComment = useCreateComment();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [type, setType] = useState("comentario");

  const handleSubmit = () => {
    if (!message.trim()) { toast.error("Escribe un mensaje"); return; }
    const userName = profile?.full_name || "Cliente";
    const avatar = userName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
    createComment.mutate({
      client_id: clientId, original_id: `c-${Date.now()}`, user: userName, avatar,
      message: message.trim(), date: new Date().toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" }), type,
    }, {
      onSuccess: () => { toast.success("Comentario enviado"); setOpen(false); setMessage(""); },
      onError: () => toast.error("Error al enviar"),
    });
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2"><MessageCircle className="h-4 w-4 text-info" /> Comunicación</CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button size="sm" className="gap-1.5 h-7 text-xs"><Plus className="h-3 w-3" /> Nuevo</Button></DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader><DialogTitle>Enviar Comentario</DialogTitle></DialogHeader>
              <div className="space-y-3 pt-2">
                <div>
                  <label className="text-xs font-medium text-foreground">Tipo</label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="comentario">💬 Comentario</SelectItem>
                      <SelectItem value="aprobacion">👍 Aprobación</SelectItem>
                      <SelectItem value="solicitud">📨 Solicitud</SelectItem>
                      <SelectItem value="alerta">🔔 Alerta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-medium text-foreground">Mensaje</label>
                  <Textarea value={message} onChange={e => setMessage(e.target.value)} className="mt-1 min-h-[100px]" placeholder="Escriba su comentario..." />
                </div>
                <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={handleSubmit}>Enviar</Button></div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[250px]">
          <div className="space-y-3 pr-2">
            {comments.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">¡Sea el primero en compartir su opinión!</p>
            ) : comments.map(comment => {
              const cfg = commentTypeConfig[comment.type] || commentTypeConfig.comentario;
              const TypeIcon = cfg.icon;
              return (
                <div key={comment.id} className="flex items-start gap-3">
                  <Avatar className="h-8 w-8 shrink-0"><AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{comment.avatar}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-semibold text-foreground">{comment.user}</span>
                      <TypeIcon className={`h-3.5 w-3.5 ${cfg.color}`} />
                      <span className="text-[10px] text-muted-foreground">{comment.date}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">{comment.message}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ── Notifications Panel ──────────────────────────────────
function NotificationsPanel({ clientId }: { clientId: string }) {
  const { notifications, markRead, markAllRead, unreadCount } = useNotifications(clientId);

  const typeIcon: Record<string, string> = { info: "ℹ️", success: "✅", warning: "⚠️", error: "🚨", update: "🔄" };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <BellRing className="h-4 w-4 text-primary" /> Notificaciones
            {unreadCount > 0 && <Badge className="bg-destructive text-destructive-foreground text-[10px] h-5 min-w-5 flex items-center justify-center">{unreadCount}</Badge>}
          </CardTitle>
          {unreadCount > 0 && <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={markAllRead}>Marcar todas leídas</Button>}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[300px]">
          <div className="space-y-2 pr-2">
            {notifications.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sin notificaciones</p>
            ) : notifications.map(n => (
              <motion.div key={n.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className={`p-3 rounded-lg border transition-colors cursor-pointer ${n.is_read ? 'border-border bg-background' : 'border-primary/20 bg-primary/5'}`}
                onClick={() => !n.is_read && markRead(n.id)}
              >
                <div className="flex items-start gap-2">
                  <span className="text-sm">{typeIcon[n.type] || "📌"}</span>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${n.is_read ? 'text-muted-foreground' : 'text-foreground font-medium'}`}>{n.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(n.created_at).toLocaleDateString("es", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                  </div>
                  {!n.is_read && <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                </div>
              </motion.div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

// ── Widget Configurator ──────────────────────────────────
function WidgetConfigurator({ widgets, onSave }: { widgets: WidgetConfig[]; onSave: (w: WidgetConfig[]) => void }) {
  const [open, setOpen] = useState(false);
  const [local, setLocal] = useState(widgets);

  useEffect(() => { setLocal(widgets); }, [widgets]);

  const toggle = (id: WidgetId) => {
    setLocal(prev => prev.map(w => w.id === id ? { ...w, enabled: !w.enabled } : w));
  };

  const moveUp = (idx: number) => {
    if (idx === 0) return;
    const copy = [...local];
    [copy[idx - 1], copy[idx]] = [copy[idx], copy[idx - 1]];
    copy.forEach((w, i) => w.order = i);
    setLocal(copy);
  };

  const moveDown = (idx: number) => {
    if (idx === local.length - 1) return;
    const copy = [...local];
    [copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]];
    copy.forEach((w, i) => w.order = i);
    setLocal(copy);
  };

  const handleSave = () => { onSave(local); setOpen(false); toast.success("Vista personalizada guardada"); };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs"><Settings className="h-3.5 w-3.5" /> Personalizar Vista</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Personalizar Dashboard</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">Activa o desactiva widgets y cambia su orden de aparición.</p>
        <div className="space-y-1 mt-3">
          {local.sort((a, b) => a.order - b.order).map((w, idx) => (
            <div key={w.id} className="flex items-center gap-2 p-2 rounded-lg border border-border">
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground flex-1">{w.label}</span>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveUp(idx)} disabled={idx === 0}>
                  <ChevronUp className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => moveDown(idx)} disabled={idx === local.length - 1}>
                  <ChevronDown className="h-3 w-3" />
                </Button>
              </div>
              <Switch checked={w.enabled} onCheckedChange={() => toggle(w.id)} />
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={() => { setLocal(DEFAULT_WIDGETS); }}>Restablecer</Button>
          <Button onClick={handleSave}>Guardar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Dashboard ──────────────────────────────────────
interface ClientDashboardProps {
  client: Client;
}

type Section = "dashboard" | "actividades" | "entregables" | "minutas" | "comunicacion" | "notificaciones";

export function ClientDashboard({ client }: ClientDashboardProps) {
  const { user, profile } = useAuth();
  const [section, setSection] = useState<Section>("dashboard");
  const { widgets, saveWidgets, loaded } = useWidgetConfig(user?.id);

  const tasks = client.tasks.filter(t => t.visibility === "externa");
  const { notifications, unreadCount } = useNotifications(client.id);

  const navItems: { id: Section; label: string; icon: any; badge?: number }[] = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "actividades", label: "Actividades", icon: ListTodo, badge: tasks.filter(t => t.status !== "completada").length },
    { id: "entregables", label: "Entregables", icon: FileCheck },
    { id: "minutas", label: "Minutas", icon: FileText, badge: client.meetingMinutes.filter(m => m.visibleToClient).length },
    { id: "comunicacion", label: "Comunicación", icon: MessageCircle },
    { id: "notificaciones", label: "Notificaciones", icon: BellRing, badge: unreadCount || undefined },
  ];

  const renderWidget = (w: WidgetConfig) => {
    switch (w.id) {
      case "progress": return <ProgressWidget client={client} />;
      case "phases": return <PhasesWidget client={client} />;
      case "taskChart": return <TaskChartWidget tasks={tasks} />;
      case "taskList": return <TaskListWidget tasks={tasks} />;
      case "deliverables": return <DeliverablesWidget deliverables={client.deliverables} />;
      case "risks": return <RisksWidget risks={client.risks} />;
      case "recentMinutes": return <RecentMinutesWidget minutes={client.meetingMinutes} />;
      case "feedback": return <FeedbackWidget comments={client.comments} clientId={client.id} />;
      default: return null;
    }
  };

  const enabledWidgets = [...widgets].sort((a, b) => a.order - b.order).filter(w => w.enabled);

  return (
    <div className="space-y-4">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-5">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-2xl bg-primary/15 flex items-center justify-center">
                  <Building2 className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-foreground">Portal de Proyecto — {client.name}</h1>
                  <p className="text-xs text-muted-foreground">Implementación Sysde • {client.contractStart} — {client.contractEnd}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={`${statusStyles[client.status]} text-xs px-2.5 py-0.5`}>{statusLabels[client.status]}</Badge>
                <Badge variant="outline" className="text-xs">{client.progress}% completado</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Navigation */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {navItems.map(item => (
          <Button
            key={item.id}
            variant={section === item.id ? "default" : "ghost"}
            size="sm"
            className="gap-1.5 text-xs shrink-0 h-8"
            onClick={() => setSection(item.id)}
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
            {item.badge !== undefined && item.badge > 0 && (
              <Badge className="bg-destructive/80 text-destructive-foreground text-[9px] h-4 min-w-4 flex items-center justify-center ml-1">{item.badge}</Badge>
            )}
          </Button>
        ))}
        {section === "dashboard" && <div className="ml-auto"><WidgetConfigurator widgets={widgets} onSave={saveWidgets} /></div>}
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        <motion.div key={section} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.15 }}>
          {section === "dashboard" && (
            <div className="space-y-4">
              {/* KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Avance General", value: `${client.progress}%`, icon: TrendingUp, color: "text-primary" },
                  { label: "Actividades", value: `${tasks.filter(t => t.status === "completada").length}/${tasks.length}`, icon: CheckCircle2, color: "text-success" },
                  { label: "Entregables Listos", value: `${client.deliverables.filter(d => ["aprobado", "entregado"].includes(d.status)).length}/${client.deliverables.length}`, icon: FileCheck, color: "text-info" },
                  { label: "Puntos Atención", value: client.risks.filter(r => r.status === "abierto").length.toString(), icon: AlertTriangle, color: "text-warning" },
                ].map((kpi, i) => (
                  <motion.div key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                    <Card><CardContent className="p-4 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"><kpi.icon className={`h-5 w-5 ${kpi.color}`} /></div>
                      <div><p className="text-lg font-bold text-foreground">{kpi.value}</p><p className="text-[10px] text-muted-foreground uppercase">{kpi.label}</p></div>
                    </CardContent></Card>
                  </motion.div>
                ))}
              </div>
              {/* Dynamic widgets */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {enabledWidgets.map(w => (
                  <div key={w.id} className={w.id === "phases" || w.id === "taskList" ? "lg:col-span-2" : ""}>{renderWidget(w)}</div>
                ))}
              </div>
            </div>
          )}

          {section === "actividades" && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <TaskChartWidget tasks={tasks} />
              <div className="lg:col-span-2"><TaskListWidget tasks={tasks} /></div>
            </div>
          )}

          {section === "entregables" && <DeliverablesWidget deliverables={client.deliverables} />}

          {section === "minutas" && <RecentMinutesWidget minutes={client.meetingMinutes} />}

          {section === "comunicacion" && <FeedbackWidget comments={client.comments} clientId={client.id} />}

          {section === "notificaciones" && <NotificationsPanel clientId={client.id} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
