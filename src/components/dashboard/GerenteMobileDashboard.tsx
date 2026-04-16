import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp, CheckCircle2, Clock, AlertTriangle, Calendar, Activity,
  MessageSquare, Plus, Target, Flame, ChevronRight, Send, ThumbsUp,
  FileText, Users, Sparkles, ArrowUpRight, CircleDot, Loader2, Mail,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { type Client } from "@/data/projectData";
import { useCreateComment } from "@/hooks/useClients";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  client: Client;
}

const HEALTH_CONFIG = {
  excellent: { label: "Excelente", color: "from-[hsl(0_72%_45%)] via-[hsl(0_72%_51%)] to-[hsl(0_85%_60%)]", textColor: "text-primary", emoji: "🌟" },
  good: { label: "Bien", color: "from-[hsl(0_72%_42%)] via-[hsl(0_72%_51%)] to-[hsl(15_85%_55%)]", textColor: "text-primary", emoji: "✅" },
  warning: { label: "Atención", color: "from-[hsl(20_85%_45%)] via-[hsl(25_92%_50%)] to-[hsl(38_92%_55%)]", textColor: "text-amber-600", emoji: "⚠️" },
  critical: { label: "Crítico", color: "from-[hsl(0_75%_35%)] via-[hsl(0_72%_45%)] to-[hsl(0_85%_55%)]", textColor: "text-destructive", emoji: "🚨" },
};

function getHealth(client: Client): keyof typeof HEALTH_CONFIG {
  if (client.status === "en-riesgo") return "critical";
  const blockedTasks = client.tasks.filter(t => t.status === "bloqueada").length;
  const overdueDeliverables = client.deliverables.filter(d => {
    if (["aprobado", "entregado"].includes(d.status)) return false;
    return new Date(d.dueDate) < new Date();
  }).length;
  if (blockedTasks > 2 || overdueDeliverables > 1) return "warning";
  if (client.progress >= 75) return "excellent";
  return "good";
}

export function GerenteMobileDashboard({ client }: Props) {
  const { profile, user } = useAuth();
  const createComment = useCreateComment();
  const [tab, setTab] = useState("resumen");
  const [actionDialog, setActionDialog] = useState<"comment" | "request" | "risk" | null>(null);
  const [actionText, setActionText] = useState("");
  const [actionPriority, setActionPriority] = useState<"alta" | "media" | "baja">("media");
  const [submitting, setSubmitting] = useState(false);

  const health = getHealth(client);
  const healthConfig = HEALTH_CONFIG[health];

  // ── Calculations ──────────────
  const externalTasks = client.tasks.filter(t => t.visibility === "externa");
  const completedTasks = externalTasks.filter(t => t.status === "completada").length;
  const tasksProgress = externalTasks.length ? Math.round((completedTasks / externalTasks.length) * 100) : 0;
  const completedDeliverables = client.deliverables.filter(d => ["aprobado", "entregado"].includes(d.status)).length;
  const deliverablesProgress = client.deliverables.length ? Math.round((completedDeliverables / client.deliverables.length) * 100) : 0;

  const today = new Date();
  const upcomingDeliverables = useMemo(() =>
    client.deliverables
      .filter(d => !["aprobado", "entregado"].includes(d.status))
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 5),
    [client.deliverables]
  );

  const activeRisks = useMemo(() =>
    client.risks?.filter(r => r.status !== "cerrado" && r.status !== "mitigado").slice(0, 5) || [],
    [client.risks]
  );

  const recentMinutes = useMemo(() =>
    [...(client.meetingMinutes || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 3),
    [client.meetingMinutes]
  );

  const currentPhase = client.phases.find(p => p.status === "en-progreso") || client.phases[0];
  const contractEnd = new Date(client.contractEnd);
  const daysToEnd = Math.max(0, Math.ceil((contractEnd.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));

  // ── Submit handlers ──────────────
  const handleSubmitAction = async () => {
    if (!actionText.trim()) {
      toast.error("Escribe un mensaje");
      return;
    }
    setSubmitting(true);
    try {
      if (actionDialog === "comment") {
        await createComment.mutateAsync({
          client_id: client.id,
          original_id: `c-${Date.now()}`,
          user: profile?.full_name || "Cliente",
          avatar: (profile?.full_name || "?")[0].toUpperCase(),
          date: new Date().toISOString().slice(0, 10),
          type: "comentario",
          message: actionText,
        });
        toast.success("Comentario enviado");
      } else if (actionDialog === "request") {
        const { error } = await supabase.from("action_items").insert({
          original_id: `req-${Date.now()}`,
          client_id: client.id,
          title: actionText,
          assignee: "Equipo Sysde",
          due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
          status: "pendiente",
          source: "cliente",
          priority: actionPriority,
          responsible_party: "sysde",
        });
        if (error) throw error;
        // Notify
        await supabase.from("client_notifications").insert({
          client_id: client.id,
          type: "warning",
          title: `Nueva solicitud de ${profile?.full_name || "cliente"}`,
          message: actionText,
        });
        toast.success("Solicitud enviada al equipo Sysde");
      } else if (actionDialog === "risk") {
        const { error } = await supabase.from("risks").insert({
          original_id: `r-cli-${Date.now()}`,
          client_id: client.id,
          description: actionText,
          impact: actionPriority === "alta" ? "alto" : actionPriority === "media" ? "medio" : "bajo",
          status: "activo",
          category: "obstaculo",
          mitigation: `Reportado por ${profile?.full_name || "cliente"}`,
        });
        if (error) throw error;
        await supabase.from("client_notifications").insert({
          client_id: client.id,
          type: "alert",
          title: `Riesgo reportado por cliente`,
          message: actionText,
        });
        toast.success("Riesgo reportado");
      }
      setActionText("");
      setActionDialog(null);
    } catch (e: any) {
      toast.error(e.message || "Error al enviar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl lg:max-w-7xl mx-auto pb-24 md:pb-6">
      <div className="lg:grid lg:grid-cols-[380px_1fr] lg:gap-6 lg:items-start">
      <div className="lg:sticky lg:top-4 space-y-4">
      {/* ─── HEADER HERO ──────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn(
          "relative overflow-hidden rounded-2xl p-5 lg:p-6 mb-4 lg:mb-0 text-white",
          `bg-gradient-to-br ${healthConfig.color}`
        )}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-3xl -mr-10 -mt-10" />
        <div className="relative">
          <div className="flex items-start justify-between mb-3">
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-white/70 mb-0.5">
                Mi Proyecto
              </p>
              <h1 className="text-xl md:text-2xl font-black leading-tight truncate">{client.name}</h1>
            </div>
            <Badge className="bg-white/20 backdrop-blur-sm text-white border-white/30 text-[10px] shrink-0">
              {healthConfig.emoji} {healthConfig.label}
            </Badge>
          </div>

          <div className="flex items-end gap-2 mb-2">
            <span className="text-4xl md:text-5xl font-black leading-none tabular-nums">{client.progress}</span>
            <span className="text-xl font-bold text-white/80 mb-1">%</span>
            <span className="text-xs text-white/70 mb-2 ml-1">avance global</span>
          </div>

          <div className="h-2 bg-white/20 rounded-full overflow-hidden mb-3">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${client.progress}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full bg-white rounded-full"
            />
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2">
              <p className="text-[9px] uppercase text-white/70 mb-0.5">Fase actual</p>
              <p className="text-xs font-bold truncate">{currentPhase?.name || "—"}</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2">
              <p className="text-[9px] uppercase text-white/70 mb-0.5">Días restantes</p>
              <p className="text-xs font-bold tabular-nums">{daysToEnd}d</p>
            </div>
            <div className="bg-white/10 backdrop-blur-sm rounded-lg p-2">
              <p className="text-[9px] uppercase text-white/70 mb-0.5">Equipo</p>
              <p className="text-xs font-bold tabular-nums">{client.teamAssigned?.length || 0}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ─── QUICK ACTIONS ─────────────────────────── */}
      <div className="grid grid-cols-3 gap-2 mb-4 lg:mb-0">
        <QuickAction
          icon={MessageSquare}
          label="Comentar"
          onClick={() => setActionDialog("comment")}
          color="text-info"
        />
        <QuickAction
          icon={Send}
          label="Solicitar"
          onClick={() => setActionDialog("request")}
          color="text-warning"
        />
        <QuickAction
          icon={AlertTriangle}
          label="Riesgo"
          onClick={() => setActionDialog("risk")}
          color="text-destructive"
        />
      </div>

      {/* Desktop-only: stats preview in sidebar */}
      <div className="hidden lg:grid grid-cols-2 gap-3">
        <StatCard
          icon={CheckCircle2}
          label="Actividades"
          value={`${completedTasks}/${externalTasks.length}`}
          progress={tasksProgress}
          color="text-info"
        />
        <StatCard
          icon={Target}
          label="Entregables"
          value={`${completedDeliverables}/${client.deliverables.length}`}
          progress={deliverablesProgress}
          color="text-success"
        />
      </div>
      </div>

      {/* ─── MAIN CONTENT (right column on desktop) ─── */}
      <div className="min-w-0">

      {/* ─── TABS ──────────────────────────────────── */}
      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid grid-cols-4 w-full sticky top-0 z-10 bg-background/95 backdrop-blur-sm h-11">
          <TabsTrigger value="resumen" className="text-xs gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Resumen</span>
          </TabsTrigger>
          <TabsTrigger value="entregables" className="text-xs gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Entregas</span>
          </TabsTrigger>
          <TabsTrigger value="riesgos" className="text-xs gap-1.5 relative">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Riesgos</span>
            {activeRisks.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold flex items-center justify-center">
                {activeRisks.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="minutas" className="text-xs gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Minutas</span>
          </TabsTrigger>
        </TabsList>

        {/* ─── RESUMEN ────────────────────────────── */}
        <TabsContent value="resumen" className="mt-4 space-y-3">
          {/* Mini stats grid */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard
              icon={CheckCircle2}
              label="Actividades"
              value={`${completedTasks}/${externalTasks.length}`}
              progress={tasksProgress}
              color="text-info"
            />
            <StatCard
              icon={Target}
              label="Entregables"
              value={`${completedDeliverables}/${client.deliverables.length}`}
              progress={deliverablesProgress}
              color="text-success"
            />
          </div>

          {/* Phases timeline */}
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <CircleDot className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-bold">Fases del Proyecto</h3>
              </div>
              <div className="space-y-3">
                {client.phases.map((phase, idx) => {
                  const isCurrent = phase.status === "en-progreso";
                  const isDone = phase.status === "completado";
                  return (
                    <motion.div
                      key={phase.name}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      className="relative pl-6"
                    >
                      <div className={cn(
                        "absolute left-0 top-1 h-3 w-3 rounded-full border-2",
                        isDone && "bg-success border-success",
                        isCurrent && "bg-primary border-primary animate-pulse",
                        !isCurrent && !isDone && "bg-muted border-muted-foreground/40"
                      )} />
                      {idx < client.phases.length - 1 && (
                        <div className="absolute left-[5px] top-4 bottom-[-12px] w-px bg-border" />
                      )}
                      <div className="flex items-center justify-between mb-1">
                        <p className={cn("text-xs font-semibold truncate", isCurrent && "text-primary")}>
                          {phase.name}
                        </p>
                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 ml-2">
                          {phase.progress}%
                        </span>
                      </div>
                      <Progress value={phase.progress} className="h-1.5" />
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Team */}
          {client.teamAssigned && client.teamAssigned.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-info" />
                  <h3 className="text-sm font-bold">Equipo asignado</h3>
                </div>
                <div className="flex flex-wrap gap-2">
                  {client.teamAssigned.map(member => (
                    <div key={member} className="flex items-center gap-2 bg-muted/50 px-2.5 py-1.5 rounded-full">
                      <Avatar className="h-5 w-5">
                        <AvatarFallback className="text-[9px] bg-primary/15 text-primary font-bold">
                          {member.split(" ").map(n => n[0]).slice(0, 2).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-[11px] font-medium">{member}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── ENTREGABLES ────────────────────────── */}
        <TabsContent value="entregables" className="mt-4 space-y-2">
          {upcomingDeliverables.length === 0 ? (
            <EmptyState icon={CheckCircle2} message="¡Todos los entregables están al día!" />
          ) : (
            upcomingDeliverables.map((d, idx) => {
              const dueDate = new Date(d.dueDate);
              const daysLeft = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
              const isOverdue = daysLeft < 0;
              const isUrgent = daysLeft >= 0 && daysLeft <= 7;
              return (
                <motion.div
                  key={d.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  <Card className={cn(
                    "overflow-hidden",
                    isOverdue && "border-destructive/50",
                    isUrgent && "border-warning/50"
                  )}>
                    <CardContent className="p-3.5">
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          "h-10 w-10 rounded-lg flex flex-col items-center justify-center shrink-0",
                          isOverdue ? "bg-destructive/15 text-destructive" :
                            isUrgent ? "bg-warning/15 text-warning" : "bg-muted text-muted-foreground"
                        )}>
                          <span className="text-[10px] font-bold uppercase">
                            {dueDate.toLocaleDateString("es", { month: "short" })}
                          </span>
                          <span className="text-sm font-black tabular-nums leading-none">
                            {dueDate.getDate()}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold truncate">{d.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <Badge variant="outline" className="text-[9px] capitalize">{d.type}</Badge>
                            <Badge variant="outline" className="text-[9px] capitalize">{d.status}</Badge>
                            <span className={cn(
                              "text-[10px] font-medium",
                              isOverdue ? "text-destructive" : isUrgent ? "text-warning" : "text-muted-foreground"
                            )}>
                              {isOverdue ? `${Math.abs(daysLeft)}d atrasado` : daysLeft === 0 ? "Hoy" : `en ${daysLeft}d`}
                            </span>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </TabsContent>

        {/* ─── RIESGOS ────────────────────────────── */}
        <TabsContent value="riesgos" className="mt-4 space-y-2">
          {activeRisks.length === 0 ? (
            <EmptyState icon={CheckCircle2} message="Sin riesgos activos. Todo en orden." />
          ) : (
            activeRisks.map((risk, idx) => {
              const impactColor = risk.impact === "alto" ? "text-destructive bg-destructive/10 border-destructive/30" :
                risk.impact === "medio" ? "text-warning bg-warning/10 border-warning/30" :
                  "text-muted-foreground bg-muted border-border";
              return (
                <motion.div
                  key={risk.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  <Card>
                    <CardContent className="p-3.5">
                      <div className="flex items-start gap-3">
                        <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", impactColor)}>
                          <Flame className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium leading-snug">{risk.description}</p>
                          {risk.mitigation && (
                            <p className="text-[11px] text-muted-foreground mt-1.5 line-clamp-2">
                              <span className="font-semibold">Mitigación:</span> {risk.mitigation}
                            </p>
                          )}
                          <div className="flex items-center gap-2 mt-2">
                            <Badge variant="outline" className={cn("text-[9px] capitalize", impactColor)}>
                              Impacto {risk.impact}
                            </Badge>
                            <Badge variant="outline" className="text-[9px] capitalize">{risk.status}</Badge>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </TabsContent>

        {/* ─── MINUTAS ────────────────────────────── */}
        <TabsContent value="minutas" className="mt-4 space-y-2">
          {recentMinutes.length === 0 ? (
            <EmptyState icon={Calendar} message="No hay minutas recientes" />
          ) : (
            recentMinutes.map((m, idx) => (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.04 }}
              >
                <Card className="hover:border-primary/40 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-sm font-semibold leading-snug">{m.title}</p>
                      <Badge variant="outline" className="text-[10px] gap-1 shrink-0">
                        <Calendar className="h-2.5 w-2.5" />
                        {new Date(m.date).toLocaleDateString("es", { day: "2-digit", month: "short" })}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-3 mb-3">{m.summary}</p>
                    {m.agreements && m.agreements.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">Acuerdos</p>
                        {m.agreements.slice(0, 3).map((a, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-[11px]">
                            <CheckCircle2 className="h-3 w-3 text-success mt-0.5 shrink-0" />
                            <span className="line-clamp-1">{a}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* ─── ACTION SHEET ──────────────────────────── */}
      <Sheet open={actionDialog !== null} onOpenChange={(open) => !open && setActionDialog(null)}>
        <SheetContent side="bottom" className="rounded-t-2xl max-w-2xl mx-auto">
          <SheetHeader className="text-left">
            <SheetTitle className="flex items-center gap-2">
              {actionDialog === "comment" && <><MessageSquare className="h-5 w-5 text-info" /> Comentar al equipo</>}
              {actionDialog === "request" && <><Send className="h-5 w-5 text-warning" /> Solicitar al equipo Sysde</>}
              {actionDialog === "risk" && <><AlertTriangle className="h-5 w-5 text-destructive" /> Reportar un riesgo</>}
            </SheetTitle>
            <SheetDescription>
              {actionDialog === "comment" && "Tu comentario será visible para el equipo Sysde."}
              {actionDialog === "request" && "Crearemos un action item para el equipo Sysde."}
              {actionDialog === "risk" && "El equipo será notificado y agregará una mitigación."}
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 mt-4">
            <Textarea
              placeholder={
                actionDialog === "comment" ? "Escribe tu comentario..." :
                  actionDialog === "request" ? "¿Qué necesitas del equipo?" :
                    "Describe el riesgo u obstáculo..."
              }
              value={actionText}
              onChange={(e) => setActionText(e.target.value)}
              rows={4}
              className="resize-none"
            />
            {(actionDialog === "request" || actionDialog === "risk") && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                  {actionDialog === "request" ? "Prioridad" : "Impacto"}
                </label>
                <Select value={actionPriority} onValueChange={(v: any) => setActionPriority(v)}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="alta">🔥 Alta</SelectItem>
                    <SelectItem value="media">⚡ Media</SelectItem>
                    <SelectItem value="baja">🟢 Baja</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              onClick={handleSubmitAction}
              disabled={submitting || !actionText.trim()}
              className="w-full h-11"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}
              Enviar
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      </div>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────
function QuickAction({ icon: Icon, label, onClick, color }: { icon: any; label: string; onClick: () => void; color: string }) {
  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
      className="flex flex-col items-center gap-1.5 p-3 bg-card border border-border rounded-xl hover:border-primary/40 hover:bg-muted/30 transition-all active:scale-95"
    >
      <Icon className={cn("h-5 w-5", color)} />
      <span className="text-[11px] font-semibold">{label}</span>
    </motion.button>
  );
}

function StatCard({ icon: Icon, label, value, progress, color }: { icon: any; label: string; value: string; progress: number; color: string }) {
  return (
    <Card>
      <CardContent className="p-3.5">
        <div className="flex items-center justify-between mb-2">
          <Icon className={cn("h-4 w-4", color)} />
          <span className="text-[10px] font-bold tabular-nums text-muted-foreground">{progress}%</span>
        </div>
        <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-0.5">{label}</p>
        <p className="text-lg font-black tabular-nums leading-tight">{value}</p>
        <Progress value={progress} className="h-1 mt-2" />
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon: Icon, message }: { icon: any; message: string }) {
  return (
    <Card>
      <CardContent className="p-8 text-center">
        <Icon className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </CardContent>
    </Card>
  );
}
