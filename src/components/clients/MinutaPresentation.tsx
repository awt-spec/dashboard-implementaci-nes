import { useState, useEffect, useCallback, useRef } from "react";
import { type Client, type ClientTask, type Deliverable, type Risk, type ActionItem } from "@/data/projectData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronLeft, ChevronRight, Maximize2, Minimize2, X,
  TrendingUp, AlertTriangle, Package, ListChecks,
  Clock, CheckCircle2, Circle, Users, FileText, Sparkles,
  ArrowRight, Eye, Pencil, Target, Briefcase, CalendarDays
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

interface MinutaPresentationProps {
  client: Client;
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
}

type DrilldownType = "tasks-active" | "tasks-completed" | "tasks-pending" | "tasks-blocked" | "tasks-inprogress" |
  "risks-open" | "risks-all" | "deliverables-pending" | "deliverables-all" |
  "team" | "phases" | null;

const taskStatuses = [
  { value: "completada", label: "Completada", color: "hsl(var(--success))" },
  { value: "en-progreso", label: "En Progreso", color: "hsl(var(--info))" },
  { value: "pendiente", label: "Pendiente", color: "hsl(var(--warning))" },
  { value: "bloqueada", label: "Bloqueada", color: "hsl(var(--destructive))" },
];

const riskStatuses = [
  { value: "abierto", label: "Abierto" },
  { value: "mitigado", label: "Mitigado" },
  { value: "cerrado", label: "Cerrado" },
];

const deliverableStatuses = [
  { value: "pendiente", label: "Pendiente" },
  { value: "en-revision", label: "En Revisión" },
  { value: "entregado", label: "Entregado" },
  { value: "aprobado", label: "Aprobado" },
];

function SlideLayout({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("w-[1920px] h-[1080px] relative overflow-hidden", className)}>{children}</div>;
}

function ScaledSlide({ children, containerRef }: { children: React.ReactNode; containerRef: React.RefObject<HTMLDivElement | null> }) {
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      setScale(Math.min(width / 1920, height / 1080));
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, [containerRef]);

  return (
    <div className="absolute w-[1920px] h-[1080px]" style={{
      left: "50%", top: "50%", marginLeft: "-960px", marginTop: "-540px",
      transform: `scale(${scale})`, transformOrigin: "center center",
    }}>{children}</div>
  );
}

// Editable Task Row
function EditableTaskRow({ task, clientId, i, queryClient: qc }: { task: ClientTask; clientId: string; i: number; queryClient: any }) {
  const [status, setStatus] = useState(task.status);
  const [saving, setSaving] = useState(false);
  const statusColor = taskStatuses.find(s => s.value === status)?.color || "hsl(var(--muted))";

  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus as any);
    setSaving(true);
    const { data } = await supabase.from("tasks").select("id").eq("client_id", clientId).eq("original_id", task.id).maybeSingle();
    if (data) {
      await supabase.from("tasks").update({ status: newStatus }).eq("id", data.id);
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(`Tarea #${task.id} → ${newStatus}`);
    }
    setSaving(false);
  };

  return (
    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
      className="flex items-center justify-between rounded-[16px] border-[2px] border-[hsl(var(--border))] px-[32px] py-[20px] hover:border-[hsl(var(--primary)/0.3)] transition-colors"
    >
      <div className="flex items-center gap-[20px] min-w-0 flex-1">
        <span className="text-[20px] font-mono text-[hsl(var(--muted-foreground))]">#{task.id}</span>
        <p className="text-[24px] font-medium text-[hsl(var(--foreground))] truncate">{task.title}</p>
      </div>
      <div className="flex items-center gap-[16px] shrink-0">
        <span className="text-[18px] text-[hsl(var(--muted-foreground))]">{task.owner}</span>
        <span className="text-[18px] text-[hsl(var(--muted-foreground))]">{task.dueDate}</span>
        <select
          value={status}
          onChange={e => handleStatusChange(e.target.value)}
          disabled={saving}
          className="px-[16px] py-[6px] rounded-full text-[18px] font-semibold text-white border-0 cursor-pointer"
          style={{ background: statusColor }}
        >
          {taskStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {saving && <div className="w-[24px] h-[24px] border-[3px] border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />}
      </div>
    </motion.div>
  );
}

// Editable Risk Row
function EditableRiskRow({ r, clientId, i, queryClient: qc }: { r: Risk; clientId: string; i: number; queryClient: any }) {
  const [status, setStatus] = useState(r.status);
  const [saving, setSaving] = useState(false);
  const impactColor = r.impact === "alto" ? "hsl(var(--destructive))" : r.impact === "medio" ? "hsl(var(--warning))" : "hsl(var(--success))";

  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus as any);
    setSaving(true);
    const { data } = await supabase.from("risks").select("id").eq("client_id", clientId).eq("original_id", r.id).maybeSingle();
    if (data) {
      await supabase.from("risks").update({ status: newStatus }).eq("id", data.id);
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(`Riesgo ${r.id} → ${newStatus}`);
    }
    setSaving(false);
  };

  return (
    <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
      className="rounded-[20px] border-[2px] border-[hsl(var(--border))] p-[36px] flex items-start gap-[24px] hover:border-[hsl(var(--primary)/0.3)] transition-colors"
    >
      <div className="w-[12px] h-[12px] rounded-full mt-[10px] shrink-0" style={{ background: impactColor }} />
      <div className="flex-1">
        <p className="text-[26px] font-medium text-[hsl(var(--foreground))] leading-tight mb-[8px]">{r.description}</p>
        {r.mitigation && <p className="text-[22px] text-[hsl(var(--muted-foreground))]">Mitigación: {r.mitigation}</p>}
      </div>
      <div className="flex items-center gap-[16px] shrink-0">
        <span className="px-[16px] py-[6px] rounded-full text-[18px] font-semibold text-white" style={{ background: impactColor }}>{r.impact}</span>
        <select
          value={status}
          onChange={e => handleStatusChange(e.target.value)}
          disabled={saving}
          className={cn(
            "px-[16px] py-[6px] rounded-full text-[18px] font-semibold border-0 cursor-pointer",
            status === "abierto" ? "bg-[hsl(var(--destructive)/0.15)] text-[hsl(var(--destructive))]" :
            status === "mitigado" ? "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]" :
            "bg-[hsl(var(--muted))] text-[hsl(var(--muted-foreground))]"
          )}
        >
          {riskStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {saving && <div className="w-[20px] h-[20px] border-[3px] border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />}
      </div>
    </motion.div>
  );
}

function DrilldownPanel({ title, icon: Icon, accent, onClose, children }: {
  title: string; icon: any; accent: string; onClose: () => void; children: React.ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="absolute inset-0 z-20 bg-[hsl(var(--background)/0.97)] backdrop-blur-sm flex flex-col"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="px-[80px] py-[40px] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-[20px]">
          <div className="w-[12px] h-[56px] rounded-full" style={{ background: accent }} />
          <Icon style={{ width: 40, height: 40, color: accent }} />
          <h2 className="text-[48px] font-bold text-[hsl(var(--foreground))]">{title}</h2>
        </div>
        <button onClick={onClose} className="p-[16px] rounded-full hover:bg-[hsl(var(--muted))] transition-colors">
          <X style={{ width: 32, height: 32, color: "hsl(var(--muted-foreground))" }} />
        </button>
      </div>
      <div className="flex-1 overflow-auto px-[80px] pb-[60px]">{children}</div>
    </motion.div>
  );
}

export function MinutaPresentation({ client, open, onClose, onContinue }: MinutaPresentationProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [drilldown, setDrilldown] = useState<DrilldownType>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const pendingTasks = client.tasks.filter(t => t.status === "pendiente" || t.status === "bloqueada");
  const inProgressTasks = client.tasks.filter(t => t.status === "en-progreso");
  const completedTasks = client.tasks.filter(t => t.status === "completada");
  const blockedTasks = client.tasks.filter(t => t.status === "bloqueada");
  const onlyPending = client.tasks.filter(t => t.status === "pendiente");
  const pendingDeliverables = client.deliverables.filter(d => d.status === "pendiente" || d.status === "en-revision");
  const openRisks = client.risks.filter(r => r.status === "abierto");

  // Compute activity percentages for Sincronización slide
  const activityGroups = {
    planificacion: client.tasks.filter(t => t.title.toLowerCase().includes("planificación") || t.title.toLowerCase().includes("kickoff") || t.title.toLowerCase().includes("plan")),
    infraestructura: client.tasks.filter(t => t.title.toLowerCase().includes("infraestructura") || t.title.toLowerCase().includes("azure") || t.title.toLowerCase().includes("vpn") || t.title.toLowerCase().includes("instalación") || t.title.toLowerCase().includes("licencia")),
    parametrizacion: client.tasks.filter(t => t.title.toLowerCase().includes("config") || t.title.toLowerCase().includes("parametr") || t.title.toLowerCase().includes("reglas") || t.title.toLowerCase().includes("seguridad")),
  };

  const totalSlides = 8;

  const next = useCallback(() => setCurrentSlide(s => Math.min(s + 1, totalSlides - 1)), []);
  const prev = useCallback(() => setCurrentSlide(s => Math.max(s - 1, 0)), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (drilldown) { if (e.key === "Escape") setDrilldown(null); return; }
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      if (e.key === "Escape") { if (isFullscreen) toggleFullscreen(); else onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, next, prev, isFullscreen, drilldown]);

  const toggleFullscreen = async () => {
    if (!isFullscreen && wrapperRef.current) { await wrapperRef.current.requestFullscreen?.(); setIsFullscreen(true); }
    else { await document.exitFullscreen?.(); setIsFullscreen(false); }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  if (!open) return null;

  const slideNames = ["Portada", "Agenda", "Sincronización", "Línea de Tiempo", "Coordinación", "Entregables", "Riesgos", "Cierre"];

  const renderDrilldown = () => {
    if (!drilldown) return null;
    const cid = client.id;

    switch (drilldown) {
      case "tasks-active":
        return (
          <DrilldownPanel title={`Tareas Activas (${inProgressTasks.length + pendingTasks.length})`} icon={ListChecks} accent="hsl(var(--warning))" onClose={() => setDrilldown(null)}>
            <div className="space-y-[16px]">
              {[...inProgressTasks, ...pendingTasks].map((t, i) => <EditableTaskRow key={t.id} task={t} clientId={cid} i={i} queryClient={qc} />)}
            </div>
          </DrilldownPanel>
        );
      case "tasks-completed":
        return (
          <DrilldownPanel title={`Completadas (${completedTasks.length})`} icon={CheckCircle2} accent="hsl(var(--success))" onClose={() => setDrilldown(null)}>
            <div className="space-y-[16px]">{completedTasks.map((t, i) => <EditableTaskRow key={t.id} task={t} clientId={cid} i={i} queryClient={qc} />)}</div>
          </DrilldownPanel>
        );
      case "tasks-inprogress":
        return (
          <DrilldownPanel title={`En Progreso (${inProgressTasks.length})`} icon={Clock} accent="hsl(var(--info))" onClose={() => setDrilldown(null)}>
            <div className="space-y-[16px]">{inProgressTasks.map((t, i) => <EditableTaskRow key={t.id} task={t} clientId={cid} i={i} queryClient={qc} />)}</div>
          </DrilldownPanel>
        );
      case "tasks-pending":
        return (
          <DrilldownPanel title={`Pendientes (${onlyPending.length})`} icon={Circle} accent="hsl(var(--warning))" onClose={() => setDrilldown(null)}>
            <div className="space-y-[16px]">{onlyPending.map((t, i) => <EditableTaskRow key={t.id} task={t} clientId={cid} i={i} queryClient={qc} />)}</div>
          </DrilldownPanel>
        );
      case "tasks-blocked":
        return (
          <DrilldownPanel title={`Bloqueadas (${blockedTasks.length})`} icon={AlertTriangle} accent="hsl(var(--destructive))" onClose={() => setDrilldown(null)}>
            <div className="space-y-[16px]">{blockedTasks.map((t, i) => <EditableTaskRow key={t.id} task={t} clientId={cid} i={i} queryClient={qc} />)}</div>
          </DrilldownPanel>
        );
      case "risks-open":
      case "risks-all": {
        const risks = drilldown === "risks-open" ? openRisks : client.risks;
        return (
          <DrilldownPanel title={`Riesgos ${drilldown === "risks-open" ? "Abiertos" : "Todos"} (${risks.length})`} icon={AlertTriangle} accent="hsl(var(--destructive))" onClose={() => setDrilldown(null)}>
            <div className="space-y-[16px]">{risks.map((r, i) => <EditableRiskRow key={r.id} r={r} clientId={cid} i={i} queryClient={qc} />)}</div>
          </DrilldownPanel>
        );
      }
      case "deliverables-pending":
      case "deliverables-all": {
        const dels = drilldown === "deliverables-pending" ? pendingDeliverables : client.deliverables;
        return (
          <DrilldownPanel title={`Entregables (${dels.length})`} icon={Package} accent="hsl(var(--info))" onClose={() => setDrilldown(null)}>
            <div className="space-y-[16px]">
              {dels.map((d, i) => (
                <motion.div key={d.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="rounded-[16px] border-[2px] border-[hsl(var(--border))] px-[32px] py-[20px] flex items-center justify-between"
                >
                  <div className="flex items-center gap-[20px] min-w-0 flex-1">
                    <span className="text-[20px] font-mono text-[hsl(var(--muted-foreground))]">{d.id}</span>
                    <p className="text-[24px] font-medium text-[hsl(var(--foreground))] truncate">{d.name}</p>
                  </div>
                  <div className="flex items-center gap-[16px] shrink-0">
                    <span className="text-[18px] text-[hsl(var(--muted-foreground))]">v{d.version}</span>
                    <span className="text-[18px] text-[hsl(var(--muted-foreground))]">{d.dueDate}</span>
                    <span className={cn("px-[16px] py-[6px] rounded-full text-[18px] font-semibold text-white",
                      d.status === "aprobado" ? "bg-[hsl(var(--success))]" : d.status === "entregado" ? "bg-[hsl(var(--info))]" :
                      d.status === "en-revision" ? "bg-[hsl(var(--warning))]" : "bg-[hsl(var(--muted-foreground))]"
                    )}>{d.status}</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </DrilldownPanel>
        );
      }
      case "phases":
        return (
          <DrilldownPanel title={`Fases (${client.phases.length})`} icon={TrendingUp} accent="hsl(var(--primary))" onClose={() => setDrilldown(null)}>
            <div className="space-y-[24px]">
              {client.phases.map((phase, i) => {
                const sc = phase.status === "completado" ? "hsl(var(--success))" : phase.status === "en-progreso" ? "hsl(var(--info))" : "hsl(var(--muted-foreground))";
                return (
                  <motion.div key={phase.name} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                    className="rounded-[20px] border-[2px] border-[hsl(var(--border))] p-[40px]"
                  >
                    <div className="flex items-center justify-between mb-[16px]">
                      <p className="text-[28px] font-semibold text-[hsl(var(--foreground))]">{phase.name}</p>
                      <span className="px-[16px] py-[6px] rounded-full text-[18px] font-semibold text-white" style={{ background: sc }}>{phase.status}</span>
                    </div>
                    <div className="flex items-center gap-[16px]">
                      <div className="flex-1 h-[16px] rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                        <motion.div className="h-full rounded-full" style={{ background: sc }} initial={{ width: 0 }} animate={{ width: `${phase.progress}%` }} transition={{ delay: 0.2, duration: 0.6 }} />
                      </div>
                      <span className="text-[24px] font-bold" style={{ color: sc }}>{phase.progress}%</span>
                    </div>
                    <div className="flex gap-[24px] mt-[12px] text-[20px] text-[hsl(var(--muted-foreground))]">
                      <span>Inicio: {phase.startDate}</span><span>Fin: {phase.endDate}</span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </DrilldownPanel>
        );
      case "team":
        return (
          <DrilldownPanel title={`Equipo (${client.teamAssigned.length})`} icon={Users} accent="hsl(var(--primary))" onClose={() => setDrilldown(null)}>
            <div className="grid grid-cols-2 gap-[24px]">
              {client.teamAssigned.map((member, i) => (
                <motion.div key={member} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  className="flex items-center gap-[24px] rounded-[20px] border-[2px] border-[hsl(var(--border))] p-[32px]"
                >
                  <div className="w-[64px] h-[64px] rounded-full bg-[hsl(var(--primary)/0.15)] flex items-center justify-center text-[28px] font-bold text-[hsl(var(--primary))]">
                    {member.split(" ").map(w => w[0]).join("").slice(0, 2)}
                  </div>
                  <p className="text-[26px] font-medium text-[hsl(var(--foreground))]">{member}</p>
                </motion.div>
              ))}
            </div>
          </DrilldownPanel>
        );
      default: return null;
    }
  };

  // Compute SPI-like metric
  const completedPhases = client.phases.filter(p => p.status === "completado").length;
  const spi = client.phases.length > 0 ? (completedPhases / client.phases.length * 2).toFixed(1) : "1.0";

  const slides = [
    // Slide 0: PORTADA — matching PPTX cover
    <SlideLayout key="cover" className="bg-[hsl(var(--destructive))]">
      <div className="absolute inset-0">
        {/* Left red panel */}
        <div className="absolute left-0 top-0 bottom-0 w-[480px] bg-[hsl(var(--destructive))] flex flex-col justify-between p-[80px]">
          <div>
            <p className="text-[24px] font-semibold text-white/80 tracking-[4px] uppercase">SYSDE Internacional</p>
          </div>
          <div>
            <p className="text-[20px] text-white/60 uppercase tracking-[3px] mb-[8px]">Project Manager</p>
            <p className="text-[28px] text-white font-bold">Fernando Pinto</p>
            <p className="text-[20px] text-white/60 mt-[8px]">Sesión de seguimiento</p>
            <p className="text-[20px] text-white/60">{new Date().toLocaleDateString("es", { month: "long", year: "numeric" })}</p>
          </div>
          <div>
            <p className="text-[16px] text-white/40 uppercase tracking-[2px]">Servicios y tecnología que generan valor a la industria financiera</p>
          </div>
        </div>
        {/* Right content panel */}
        <div className="absolute left-[480px] top-0 right-0 bottom-0 bg-[hsl(var(--background))] flex flex-col justify-center px-[120px]">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <p className="text-[28px] text-[hsl(var(--muted-foreground))] uppercase tracking-[4px] mb-[24px]">Proyecto de Implementación</p>
            <h1 className="text-[88px] font-extrabold text-[hsl(var(--foreground))] leading-[1.05] mb-[32px]">{client.name}</h1>
            <div className="w-[120px] h-[6px] bg-[hsl(var(--destructive))] rounded-full mb-[40px]" />
            <div className="flex flex-wrap gap-[16px]">
              <span className="px-[24px] py-[10px] rounded-full bg-[hsl(var(--destructive)/0.1)] text-[hsl(var(--destructive))] text-[22px] font-semibold">{client.industry}</span>
              <span className="px-[24px] py-[10px] rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] text-[22px] font-semibold">SAF + Cloud</span>
              <span className="px-[24px] py-[10px] rounded-full bg-[hsl(var(--muted))] text-[hsl(var(--foreground))] text-[22px] font-semibold">{client.country}</span>
            </div>
          </motion.div>
        </div>
      </div>
    </SlideLayout>,

    // Slide 1: AGENDA
    <SlideLayout key="agenda" className="bg-[hsl(var(--background))]">
      <div className="absolute inset-0 px-[160px] py-[100px]">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center gap-[16px] mb-[80px]">
            <div className="w-[8px] h-[56px] rounded-full bg-[hsl(var(--destructive))]" />
            <h2 className="text-[64px] font-extrabold text-[hsl(var(--foreground))]">AGENDA</h2>
          </div>
          <p className="text-[28px] text-[hsl(var(--muted-foreground))] mb-[64px]">Contenido de la sesión</p>
          <div className="grid grid-cols-2 gap-[64px]">
            <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
              className="flex items-start gap-[32px]"
            >
              <div className="w-[96px] h-[96px] rounded-[24px] bg-[hsl(var(--destructive)/0.1)] flex items-center justify-center shrink-0">
                <span className="text-[48px] font-extrabold text-[hsl(var(--destructive))]">01</span>
              </div>
              <div>
                <h3 className="text-[40px] font-bold text-[hsl(var(--foreground))] mb-[12px]">Sincronización</h3>
                <p className="text-[26px] text-[hsl(var(--muted-foreground))] leading-relaxed">Actividades ejecutadas · Actividades en curso · Avance del proyecto</p>
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
              className="flex items-start gap-[32px]"
            >
              <div className="w-[96px] h-[96px] rounded-[24px] bg-[hsl(var(--destructive)/0.1)] flex items-center justify-center shrink-0">
                <span className="text-[48px] font-extrabold text-[hsl(var(--destructive))]">02</span>
              </div>
              <div>
                <h3 className="text-[40px] font-bold text-[hsl(var(--foreground))] mb-[12px]">Coordinación</h3>
                <p className="text-[26px] text-[hsl(var(--muted-foreground))] leading-relaxed">Compromisos y entregables del proyecto</p>
              </div>
            </motion.div>
          </div>
        </motion.div>
      </div>
    </SlideLayout>,

    // Slide 2: SINCRONIZACIÓN — Avance de actividades
    <SlideLayout key="sync" className="bg-[hsl(var(--background))]">
      <div className="absolute inset-0 px-[100px] py-[60px]">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center justify-between mb-[40px]">
            <div className="flex items-center gap-[16px]">
              <div className="w-[8px] h-[48px] rounded-full bg-[hsl(var(--destructive))]" />
              <h2 className="text-[48px] font-bold text-[hsl(var(--foreground))]">SINCRONIZACIÓN</h2>
            </div>
            <div className="flex items-center gap-[24px]">
              <div className="text-right">
                <p className="text-[22px] text-[hsl(var(--muted-foreground))]">Avance de actividades</p>
                <p className="text-[28px] font-bold text-[hsl(var(--foreground))]">SPI {spi}</p>
              </div>
              <div className="flex items-center gap-[12px] px-[24px] py-[12px] rounded-full bg-[hsl(var(--primary)/0.1)]">
                <span className="text-[22px] text-[hsl(var(--muted-foreground))]">Planif.</span>
                <span className="text-[28px] font-bold text-[hsl(var(--primary))]">{client.progress}%</span>
                <span className="text-[22px] text-[hsl(var(--muted-foreground))]">· Real</span>
                <span className="text-[28px] font-bold text-[hsl(var(--primary))]">{client.progress}%</span>
              </div>
            </div>
          </div>

          {/* Activity table like the PPTX */}
          <div className="grid grid-cols-2 gap-[32px]">
            {/* Left column */}
            <div className="space-y-[8px]">
              <div className="rounded-[12px] bg-[hsl(var(--destructive)/0.08)] px-[28px] py-[16px] mb-[16px]">
                <p className="text-[24px] font-bold text-[hsl(var(--destructive))] uppercase">Planificación</p>
              </div>
              {client.phases.filter(p => p.status === "completado").slice(0, 4).map((p, i) => (
                <motion.div key={p.name} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                  className="flex items-center justify-between rounded-[12px] border-[2px] border-[hsl(var(--border))] px-[24px] py-[14px]"
                >
                  <p className="text-[22px] text-[hsl(var(--foreground))] truncate flex-1">{p.name}</p>
                  <span className="text-[22px] font-bold text-[hsl(var(--success))] ml-[16px]">{p.progress}%</span>
                </motion.div>
              ))}
              <div className="rounded-[12px] bg-[hsl(var(--destructive)/0.08)] px-[28px] py-[16px] mt-[24px] mb-[16px]">
                <p className="text-[24px] font-bold text-[hsl(var(--destructive))] uppercase">Ejecución — Infraestructura</p>
              </div>
              {client.tasks.filter(t => t.title.toLowerCase().includes("instalación") || t.title.toLowerCase().includes("vpn") || t.title.toLowerCase().includes("licencia") || t.title.toLowerCase().includes("azure")).slice(0, 3).map((t, i) => (
                <motion.div key={t.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: (i + 4) * 0.08 }}
                  className="flex items-center justify-between rounded-[12px] border-[2px] border-[hsl(var(--border))] px-[24px] py-[14px]"
                >
                  <p className="text-[22px] text-[hsl(var(--foreground))] truncate flex-1">{t.title}</p>
                  <span className="text-[22px] font-bold ml-[16px]" style={{ color: t.status === "completada" ? "hsl(var(--success))" : t.status === "en-progreso" ? "hsl(var(--info))" : "hsl(var(--warning))" }}>
                    {t.description?.match(/\d+%/)?.[0] || (t.status === "completada" ? "100%" : "—")}
                  </span>
                </motion.div>
              ))}
            </div>
            {/* Right column */}
            <div className="space-y-[8px]">
              <div className="rounded-[12px] bg-[hsl(var(--destructive)/0.08)] px-[28px] py-[16px] mb-[16px]">
                <p className="text-[24px] font-bold text-[hsl(var(--destructive))] uppercase">Ejecución — Parametrización</p>
              </div>
              {client.tasks.filter(t => t.title.toLowerCase().includes("config") || t.title.toLowerCase().includes("parametr") || t.title.toLowerCase().includes("reglas") || t.title.toLowerCase().includes("seguridad") || t.title.toLowerCase().includes("gestor") || t.title.toLowerCase().includes("cliente")).slice(0, 10).map((t, i) => (
                <motion.div key={t.id} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                  className="flex items-center justify-between rounded-[12px] border-[2px] border-[hsl(var(--border))] px-[24px] py-[14px] cursor-pointer hover:border-[hsl(var(--primary)/0.3)] transition-colors"
                  onClick={() => setDrilldown("tasks-active")}
                >
                  <p className="text-[22px] text-[hsl(var(--foreground))] truncate flex-1">{t.title}</p>
                  <span className="text-[22px] font-bold ml-[16px]" style={{ color: t.status === "completada" ? "hsl(var(--success))" : t.status === "en-progreso" ? "hsl(var(--info))" : "hsl(var(--warning))" }}>
                    {t.description?.match(/\d+%/)?.[0] || (t.status === "completada" ? "100%" : "0%")}
                  </span>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </SlideLayout>,

    // Slide 3: LÍNEA DE TIEMPO
    <SlideLayout key="timeline" className="bg-[hsl(var(--background))]">
      <div className="absolute inset-0 px-[100px] py-[60px]">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center gap-[16px] mb-[48px]">
            <div className="w-[8px] h-[48px] rounded-full bg-[hsl(var(--destructive))]" />
            <h2 className="text-[48px] font-bold text-[hsl(var(--foreground))]">SINCRONIZACIÓN</h2>
            <span className="text-[28px] text-[hsl(var(--muted-foreground))] ml-[16px]">Línea de tiempo — {client.industry}</span>
          </div>

          {/* Timeline phases as a Gantt-like chart */}
          <div className="space-y-[20px]" onClick={() => setDrilldown("phases")}>
            {client.phases.map((phase, i) => {
              const statusColor = phase.status === "completado" ? "hsl(var(--success))" : phase.status === "en-progreso" ? "hsl(var(--warning))" : "hsl(var(--muted-foreground))";
              const statusLabel = phase.status === "completado" ? "Completado" : phase.status === "en-progreso" ? "En Progreso" : "Pendiente";
              return (
                <motion.div key={phase.name} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-[24px] cursor-pointer hover:bg-[hsl(var(--muted)/0.3)] rounded-[16px] px-[16px] py-[12px] transition-colors"
                >
                  <div className="w-[32px] h-[32px] rounded-full border-[3px] flex items-center justify-center shrink-0" style={{ borderColor: statusColor }}>
                    {phase.status === "completado" && <CheckCircle2 style={{ width: 20, height: 20, color: statusColor }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[26px] font-semibold text-[hsl(var(--foreground))] truncate">{phase.name}</p>
                    <div className="flex items-center gap-[16px] mt-[8px]">
                      <div className="flex-1 h-[14px] rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                        <motion.div className="h-full rounded-full" style={{ background: statusColor }}
                          initial={{ width: 0 }} animate={{ width: `${phase.progress}%` }} transition={{ delay: 0.3 + i * 0.1, duration: 0.6 }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0 text-right w-[300px]">
                    <span className="text-[20px] text-[hsl(var(--muted-foreground))]">{phase.startDate} — {phase.endDate}</span>
                  </div>
                  <span className="px-[16px] py-[6px] rounded-full text-[18px] font-semibold text-white shrink-0" style={{ background: statusColor }}>{statusLabel}</span>
                  <span className="text-[24px] font-bold w-[60px] text-right shrink-0" style={{ color: statusColor }}>{phase.progress}%</span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </SlideLayout>,

    // Slide 4: COORDINACIÓN — Compromisos y entregables (action items table like PPTX page 7)
    <SlideLayout key="coordination" className="bg-[hsl(var(--background))]">
      <div className="absolute inset-0 px-[80px] py-[60px]">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center gap-[16px] mb-[40px]">
            <div className="w-[8px] h-[48px] rounded-full bg-[hsl(var(--destructive))]" />
            <h2 className="text-[48px] font-bold text-[hsl(var(--foreground))]">COORDINACIÓN</h2>
            <span className="text-[28px] text-[hsl(var(--muted-foreground))] ml-[16px]">Compromisos y entregables</span>
          </div>

          {/* Table header */}
          <div className="rounded-t-[16px] bg-[hsl(var(--destructive))] px-[28px] py-[16px] flex items-center gap-[16px]">
            <span className="text-[20px] font-bold text-white w-[60px]">#</span>
            <span className="text-[20px] font-bold text-white flex-1">Descripción</span>
            <span className="text-[20px] font-bold text-white w-[200px]">Responsable</span>
            <span className="text-[20px] font-bold text-white w-[140px]">Fecha</span>
            <span className="text-[20px] font-bold text-white w-[140px]">Estado</span>
          </div>
          {/* Table rows */}
          <div className="border-[2px] border-t-0 border-[hsl(var(--border))] rounded-b-[16px] overflow-hidden">
            {client.actionItems.slice(0, 9).map((item, i) => {
              const statusColor = item.status === "completado" ? "hsl(var(--success))" : item.status === "vencido" ? "hsl(var(--destructive))" : "hsl(var(--warning))";
              const statusLabel = item.status === "completado" ? "Hecho" : item.status === "vencido" ? "Vencido" : "Pendiente";
              return (
                <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className={cn("px-[28px] py-[16px] flex items-center gap-[16px]", i % 2 === 0 ? "bg-[hsl(var(--muted)/0.3)]" : "")}
                >
                  <span className="text-[20px] font-mono text-[hsl(var(--muted-foreground))] w-[60px]">{i + 1}</span>
                  <p className="text-[22px] text-[hsl(var(--foreground))] flex-1 truncate">{item.title}</p>
                  <span className="text-[20px] text-[hsl(var(--muted-foreground))] w-[200px] truncate">{item.assignee}</span>
                  <span className="text-[20px] text-[hsl(var(--muted-foreground))] w-[140px]">{item.dueDate}</span>
                  <span className="px-[14px] py-[4px] rounded-full text-[18px] font-semibold text-white w-[140px] text-center" style={{ background: statusColor }}>{statusLabel}</span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </SlideLayout>,

    // Slide 5: Entregables
    <SlideLayout key="deliverables" className="bg-[hsl(var(--background))]">
      <div className="absolute inset-0 px-[100px] py-[60px]">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center justify-between mb-[48px]">
            <div className="flex items-center gap-[16px]">
              <div className="w-[8px] h-[48px] rounded-full bg-[hsl(var(--info))]" />
              <h2 className="text-[48px] font-bold text-[hsl(var(--foreground))]">Entregables del Proyecto</h2>
            </div>
            <button onClick={() => setDrilldown("deliverables-all")} className="flex items-center gap-[12px] px-[24px] py-[12px] rounded-full bg-[hsl(var(--muted))] hover:bg-[hsl(var(--accent))] transition-colors text-[22px] text-[hsl(var(--foreground))]">
              Ver todos ({client.deliverables.length})
            </button>
          </div>

          {/* Deliverables table */}
          <div className="rounded-t-[16px] bg-[hsl(var(--primary))] px-[28px] py-[16px] flex items-center gap-[16px]">
            <span className="text-[20px] font-bold text-white w-[120px]">ID</span>
            <span className="text-[20px] font-bold text-white flex-1">Entregable</span>
            <span className="text-[20px] font-bold text-white w-[120px]">Versión</span>
            <span className="text-[20px] font-bold text-white w-[160px]">Fecha</span>
            <span className="text-[20px] font-bold text-white w-[160px]">Estado</span>
          </div>
          <div className="border-[2px] border-t-0 border-[hsl(var(--border))] rounded-b-[16px] overflow-hidden">
            {client.deliverables.slice(0, 8).map((d, i) => {
              const sc = d.status === "aprobado" ? "hsl(var(--success))" : d.status === "entregado" ? "hsl(var(--info))" : d.status === "en-revision" ? "hsl(var(--warning))" : "hsl(var(--muted-foreground))";
              return (
                <motion.div key={d.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className={cn("px-[28px] py-[16px] flex items-center gap-[16px]", i % 2 === 0 ? "bg-[hsl(var(--muted)/0.3)]" : "")}
                >
                  <span className="text-[20px] font-mono text-[hsl(var(--muted-foreground))] w-[120px]">{d.id}</span>
                  <p className="text-[22px] text-[hsl(var(--foreground))] flex-1 truncate">{d.name}</p>
                  <span className="text-[20px] text-[hsl(var(--muted-foreground))] w-[120px]">v{d.version}</span>
                  <span className="text-[20px] text-[hsl(var(--muted-foreground))] w-[160px]">{d.dueDate}</span>
                  <span className="px-[14px] py-[4px] rounded-full text-[18px] font-semibold text-white w-[160px] text-center" style={{ background: sc }}>{d.status}</span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </SlideLayout>,

    // Slide 6: Riesgos
    <SlideLayout key="risks" className="bg-[hsl(var(--background))]">
      <div className="absolute inset-0 px-[100px] py-[60px]">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center gap-[16px] mb-[48px]">
            <div className="w-[8px] h-[48px] rounded-full bg-[hsl(var(--destructive))]" />
            <h2 className="text-[48px] font-bold text-[hsl(var(--foreground))]">Riesgos del Proyecto</h2>
            <span className="text-[28px] text-[hsl(var(--muted-foreground))] ml-auto">{openRisks.length} abiertos de {client.risks.length}</span>
          </div>
          <div className="space-y-[20px]">
            {client.risks.slice(0, 6).map((r, i) => <EditableRiskRow key={r.id} r={r} clientId={client.id} i={i} queryClient={qc} />)}
          </div>
        </motion.div>
      </div>
    </SlideLayout>,

    // Slide 7: CIERRE — like PPTX closing slide
    <SlideLayout key="close" className="bg-[hsl(var(--destructive))]">
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-center">
          <h2 className="text-[56px] font-bold text-white/80 mb-[24px]">Somos tus aliados para la</h2>
          <h2 className="text-[72px] font-extrabold text-white mb-[48px]">Transformación Digital de tu negocio.</h2>
          <div className="w-[200px] h-[4px] bg-white/30 rounded-full mx-auto mb-[64px]" />
          <p className="text-[32px] text-white/60 mb-[48px]">SYSDE Internacional</p>
          <button onClick={onContinue}
            className="px-[64px] py-[24px] rounded-[20px] bg-white text-[hsl(var(--destructive))] text-[32px] font-bold hover:bg-white/90 transition-colors shadow-2xl flex items-center gap-[16px] mx-auto"
          >
            <FileText style={{ width: 32, height: 32 }} />
            Crear Nueva Minuta
            <ArrowRight style={{ width: 32, height: 32 }} />
          </button>
        </motion.div>
      </div>
    </SlideLayout>,
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div ref={wrapperRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/95 flex flex-col"
        >
          <div className="flex items-center justify-between px-4 py-2 bg-black/50 shrink-0">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/10"><X className="h-5 w-5" /></Button>
              <span className="text-white/50 text-sm">{slideNames[currentSlide]} · {currentSlide + 1}/{totalSlides}</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={onContinue} className="text-white/70 hover:text-white hover:bg-white/10 text-xs gap-1.5">
                <Sparkles className="h-3.5 w-3.5" /> Crear Minuta
              </Button>
              <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white/70 hover:text-white hover:bg-white/10">
                {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          <div className="flex-1 relative overflow-hidden" ref={containerRef}>
            <AnimatePresence mode="wait">
              <motion.div key={currentSlide} initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }} transition={{ duration: 0.3 }} className="absolute inset-0">
                <ScaledSlide containerRef={containerRef}>{slides[currentSlide]}</ScaledSlide>
              </motion.div>
            </AnimatePresence>

            <AnimatePresence>
              {drilldown && (
                <div className="absolute inset-0 z-30">
                  <ScaledSlide containerRef={containerRef}>
                    <div className="w-[1920px] h-[1080px] relative">{renderDrilldown()}</div>
                  </ScaledSlide>
                </div>
              )}
            </AnimatePresence>

            {currentSlide > 0 && !drilldown && (
              <button onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"><ChevronLeft className="h-6 w-6" /></button>
            )}
            {currentSlide < totalSlides - 1 && !drilldown && (
              <button onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"><ChevronRight className="h-6 w-6" /></button>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 px-4 py-3 bg-black/50 shrink-0">
            {slideNames.map((name, i) => (
              <button key={i} onClick={() => { setDrilldown(null); setCurrentSlide(i); }}
                className={cn("px-3 py-1.5 rounded-lg text-xs transition-all", i === currentSlide ? "bg-white/20 text-white font-medium" : "text-white/40 hover:text-white/70 hover:bg-white/5")}
              >{name}</button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
