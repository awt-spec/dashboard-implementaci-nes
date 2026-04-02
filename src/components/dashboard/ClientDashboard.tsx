import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  TrendingUp, CheckCircle2, Clock, FileCheck, Calendar, Building2,
  MessageSquare, ThumbsUp, Send, Bell, Plus, Loader2, Star, AlertTriangle
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { type Client, type Comment } from "@/data/projectData";
import { useCreateComment } from "@/hooks/useClients";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";

const statusLabels: Record<string, string> = {
  activo: "En Curso",
  "en-riesgo": "Atención Requerida",
  completado: "Finalizado",
  pausado: "En Pausa",
};

const statusStyles: Record<string, string> = {
  activo: "bg-success text-success-foreground",
  "en-riesgo": "bg-warning text-warning-foreground",
  completado: "bg-info text-info-foreground",
  pausado: "bg-muted text-muted-foreground",
};

const commentTypeConfig = {
  comentario: { icon: MessageSquare, color: "text-info", label: "Comentario" },
  aprobacion: { icon: ThumbsUp, color: "text-success", label: "Aprobación" },
  solicitud: { icon: Send, color: "text-warning", label: "Solicitud" },
  alerta: { icon: Bell, color: "text-destructive", label: "Alerta" },
};

interface ClientDashboardProps {
  client: Client;
}

export function ClientDashboard({ client }: ClientDashboardProps) {
  const { profile } = useAuth();
  const createComment = useCreateComment();
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [type, setType] = useState("comentario");

  // Only external tasks (but don't label them as such)
  const tasks = client.tasks.filter(t => t.visibility === "externa");
  const tasksByStatus = {
    completada: tasks.filter(t => t.status === "completada").length,
    "en-progreso": tasks.filter(t => t.status === "en-progreso").length,
    pendiente: tasks.filter(t => t.status === "pendiente").length,
    bloqueada: tasks.filter(t => t.status === "bloqueada").length,
  };
  const taskCompletion = tasks.length > 0 ? Math.round((tasksByStatus.completada / tasks.length) * 100) : 0;

  const deliverables = client.deliverables;
  const deliverablesByStatus = {
    aprobado: deliverables.filter(d => d.status === "aprobado").length,
    entregado: deliverables.filter(d => d.status === "entregado").length,
    "en-revision": deliverables.filter(d => d.status === "en-revision").length,
    pendiente: deliverables.filter(d => d.status === "pendiente").length,
  };

  const gaugeData = [{ value: client.progress }, { value: 100 - client.progress }];

  const taskPieData = [
    { name: "Completadas", value: tasksByStatus.completada, color: "hsl(var(--success))" },
    { name: "En Progreso", value: tasksByStatus["en-progreso"], color: "hsl(var(--info))" },
    { name: "Pendientes", value: tasksByStatus.pendiente, color: "hsl(var(--warning))" },
    { name: "Bloqueadas", value: tasksByStatus.bloqueada, color: "hsl(var(--destructive))" },
  ].filter(d => d.value > 0);

  const handleFeedback = () => {
    if (!message.trim()) { toast.error("Escribe un mensaje"); return; }
    const userName = profile?.full_name || "Cliente";
    const avatar = userName.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
    createComment.mutate({
      client_id: client.id, original_id: `c-${Date.now()}`, user: userName, avatar,
      message: message.trim(), date: new Date().toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" }), type,
    }, {
      onSuccess: () => { toast.success("Comentario enviado"); setFeedbackOpen(false); setMessage(""); },
      onError: () => toast.error("Error al enviar"),
    });
  };

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div className="flex items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-primary/15 flex items-center justify-center">
                  <Building2 className="h-7 w-7 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-foreground">Bienvenido a su Panel de Proyecto</h1>
                  <p className="text-sm text-muted-foreground">{client.name} — Implementación Sysde</p>
                </div>
              </div>
              <Badge className={`${statusStyles[client.status]} text-sm px-3 py-1`}>
                {statusLabels[client.status]}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Avance General", value: `${client.progress}%`, icon: TrendingUp, color: "text-primary" },
          { label: "Actividades Completadas", value: `${tasksByStatus.completada}/${tasks.length}`, icon: CheckCircle2, color: "text-success" },
          { label: "Entregables Listos", value: `${deliverablesByStatus.aprobado + deliverablesByStatus.entregado}/${deliverables.length}`, icon: FileCheck, color: "text-info" },
          { label: "Vigencia del Proyecto", value: `${client.contractStart} — ${client.contractEnd}`, icon: Calendar, color: "text-muted-foreground", small: true },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                </div>
                <div>
                  <p className={`${kpi.small ? 'text-xs' : 'text-lg'} font-bold text-foreground`}>{kpi.value}</p>
                  <p className="text-[10px] text-muted-foreground uppercase">{kpi.label}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Progress + Phases */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5 flex flex-col items-center">
            <h3 className="text-sm font-semibold text-foreground mb-3">Avance del Proyecto</h3>
            <div className="relative w-32 h-32">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={gaugeData} innerRadius={42} outerRadius={58} startAngle={90} endAngle={-270} dataKey="value" strokeWidth={0}>
                    <Cell fill="hsl(var(--primary))" />
                    <Cell fill="hsl(var(--muted))" />
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-foreground">{client.progress}%</span>
            </div>
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="text-sm">Fases de Implementación</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {client.phases.map(phase => (
              <div key={phase.name} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-foreground">{phase.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{phase.startDate} — {phase.endDate}</span>
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
      </div>

      {/* Tabs: Activities, Deliverables, Feedback */}
      <Tabs defaultValue="actividades">
        <TabsList>
          <TabsTrigger value="actividades">Actividades</TabsTrigger>
          <TabsTrigger value="entregables">Entregables</TabsTrigger>
          <TabsTrigger value="feedback">Comunicación</TabsTrigger>
        </TabsList>

        <TabsContent value="actividades">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-5">
                <h3 className="text-sm font-semibold text-foreground mb-3">Estado de Actividades</h3>
                <div className="h-44">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={taskPieData} innerRadius={40} outerRadius={65} dataKey="value" strokeWidth={2} stroke="hsl(var(--card))">
                        {taskPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-2 mt-2">
                  {taskPieData.map(d => (
                    <div key={d.name} className="flex items-center gap-1.5 text-xs">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
                      <span className="text-muted-foreground">{d.name}</span>
                      <span className="font-bold text-foreground ml-auto">{d.value}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card className="lg:col-span-2">
              <CardHeader className="pb-2"><CardTitle className="text-sm">Detalle de Actividades</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-[400px] overflow-auto">
                  {tasks.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No hay actividades registradas</p>
                  ) : tasks.map(task => {
                    const statusIcon = task.status === "completada" ? "✅" : task.status === "en-progreso" ? "🔄" : task.status === "bloqueada" ? "🚫" : "⏳";
                    const priorityBadge = task.priority === "alta" ? "bg-destructive/10 text-destructive" : task.priority === "media" ? "bg-warning/10 text-warning" : "bg-muted text-muted-foreground";
                    return (
                      <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                        <span className="text-sm mt-0.5">{statusIcon}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">{task.title}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className="text-[10px] text-muted-foreground">Responsable: {task.owner}</span>
                            <span className="text-[10px] text-muted-foreground">Vence: {task.dueDate}</span>
                            <Badge className={`text-[10px] ${priorityBadge}`}>{task.priority}</Badge>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="entregables">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Entregables del Proyecto</CardTitle></CardHeader>
            <CardContent>
              <div className="space-y-2">
                {deliverables.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">No hay entregables registrados</p>
                ) : deliverables.map(d => {
                  const statusIcon = d.status === "aprobado" ? "✅" : d.status === "entregado" ? "📦" : d.status === "en-revision" ? "🔍" : "⏳";
                  const statusLabel = d.status === "aprobado" ? "Aprobado" : d.status === "entregado" ? "Entregado" : d.status === "en-revision" ? "En Revisión" : "Pendiente";
                  return (
                    <div key={d.id} className="flex items-start gap-3 p-3 rounded-lg border border-border">
                      <span className="text-sm mt-0.5">{statusIcon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{d.name}</p>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                          <span>Tipo: {d.type}</span>
                          <span>Vence: {d.dueDate}</span>
                          {d.deliveredDate && <span>Entregado: {d.deliveredDate}</span>}
                          <Badge variant="outline" className="text-[10px]">{statusLabel}</Badge>
                          {d.version && <span>v{d.version}</span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="feedback">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Comunicación y Feedback</CardTitle>
                <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" className="gap-1.5 h-7 text-xs"><Plus className="h-3 w-3" /> Nuevo Comentario</Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md">
                    <DialogHeader><DialogTitle>Enviar Comentario</DialogTitle></DialogHeader>
                    <div className="space-y-3 pt-2">
                      <div>
                        <label className="text-xs font-medium text-foreground">Tipo de mensaje</label>
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
                        <Textarea value={message} onChange={e => setMessage(e.target.value)} className="mt-1 min-h-[100px]" placeholder="Escriba su comentario o feedback..." />
                      </div>
                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" onClick={() => setFeedbackOpen(false)}>Cancelar</Button>
                        <Button onClick={handleFeedback}>Enviar</Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {client.comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No hay comentarios aún. ¡Sea el primero en compartir su opinión!</p>
              ) : client.comments.map(comment => {
                const typeConfig = commentTypeConfig[comment.type as keyof typeof commentTypeConfig] || commentTypeConfig.comentario;
                const TypeIcon = typeConfig.icon;
                return (
                  <div key={comment.id} className="flex items-start gap-3">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{comment.avatar}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-sm font-semibold text-foreground">{comment.user}</span>
                        <TypeIcon className={`h-3.5 w-3.5 ${typeConfig.color}`} />
                        <span className="text-[10px] text-muted-foreground">{comment.date}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{comment.message}</p>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Risks summary - commercial tone */}
      {client.risks.filter(r => r.status === "abierto").length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <Card className="border-warning/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-warning" />
                Puntos de Atención
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {client.risks.filter(r => r.status === "abierto").map(risk => (
                <div key={risk.id} className="p-3 rounded-lg border border-border bg-warning/5">
                  <p className="text-sm font-medium text-foreground">{risk.description}</p>
                  {risk.mitigation && (
                    <p className="text-xs text-muted-foreground mt-1">Plan de acción: {risk.mitigation}</p>
                  )}
                  <Badge variant="outline" className="text-[10px] mt-1">
                    Impacto: {risk.impact === "alto" ? "Alto" : risk.impact === "medio" ? "Medio" : "Bajo"}
                  </Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
