import { useState, useEffect, useCallback, useRef } from "react";
import { type Client, type ClientTask, type Deliverable, type Risk } from "@/data/projectData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronLeft, ChevronRight, Maximize2, Minimize2, X,
  TrendingUp, AlertTriangle, Package, ListChecks, DollarSign,
  Clock, CheckCircle2, Circle, Users, FileText, Sparkles,
  ArrowRight, Eye, Save, Pencil
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
  "financial" | "team" | "phases" | null;

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

function KpiCard({ label, value, icon: Icon, accent, onClick, delay = 0 }: {
  label: string; value: string; icon: any; accent: string; onClick?: () => void; delay?: number;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      onClick={onClick}
      className={cn(
        "rounded-[24px] border-[2px] border-[hsl(var(--border))] p-[40px] relative overflow-hidden",
        onClick && "cursor-pointer hover:border-[3px] hover:shadow-lg transition-all group"
      )}
    >
      <div className="absolute top-0 left-0 w-full h-[4px]" style={{ background: accent }} />
      {onClick && (
        <div className="absolute top-[16px] right-[16px] opacity-0 group-hover:opacity-100 transition-opacity">
          <Eye style={{ width: 24, height: 24, color: accent }} />
        </div>
      )}
      <Icon className="mb-[16px]" style={{ color: accent, width: 36, height: 36 }} />
      <p className="text-[64px] font-extrabold text-[hsl(var(--foreground))] leading-none">{value}</p>
      <p className="text-[24px] text-[hsl(var(--muted-foreground))] mt-[8px] uppercase tracking-wide">{label}</p>
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
        <div className="flex items-center gap-[16px]">
          <div className="flex items-center gap-[8px] bg-[hsl(var(--muted))] rounded-full px-[20px] py-[10px]">
            <Pencil style={{ width: 18, height: 18, color: "hsl(var(--primary))" }} />
            <span className="text-[18px] text-[hsl(var(--primary))] font-medium">Modo editable</span>
          </div>
          <button onClick={onClose} className="p-[16px] rounded-full hover:bg-[hsl(var(--muted))] transition-colors">
            <X style={{ width: 32, height: 32, color: "hsl(var(--muted-foreground))" }} />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto px-[80px] pb-[60px]">{children}</div>
    </motion.div>
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
    const { data } = await supabase.from("tasks").select("id").eq("client_id", clientId).eq("original_id", task.id).single();
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

// Editable Deliverable Row
function EditableDeliverableRow({ d, clientId, i, queryClient: qc }: { d: Deliverable; clientId: string; i: number; queryClient: any }) {
  const [status, setStatus] = useState(d.status);
  const [saving, setSaving] = useState(false);
  const statusColors: Record<string, string> = {
    "aprobado": "hsl(var(--success))", "entregado": "hsl(var(--info))",
    "en-revision": "hsl(var(--warning))", "pendiente": "hsl(var(--muted-foreground))",
  };

  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus as any);
    setSaving(true);
    const { data } = await supabase.from("deliverables").select("id").eq("client_id", clientId).eq("original_id", d.id).single();
    if (data) {
      await supabase.from("deliverables").update({ status: newStatus }).eq("id", data.id);
      qc.invalidateQueries({ queryKey: ["clients"] });
      toast.success(`Entregable ${d.id} → ${newStatus}`);
    }
    setSaving(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
      className="rounded-[20px] border-[2px] border-[hsl(var(--border))] p-[32px] relative overflow-hidden hover:border-[hsl(var(--primary)/0.3)] transition-colors"
    >
      <div className="absolute top-0 left-0 w-full h-[4px]" style={{ background: statusColors[status] }} />
      <div className="flex items-start justify-between mb-[12px]">
        <div>
          <p className="text-[18px] font-mono text-[hsl(var(--muted-foreground))]">{d.id}</p>
          <p className="text-[26px] font-semibold text-[hsl(var(--foreground))] leading-tight">{d.name}</p>
        </div>
        <div className="flex items-center gap-[12px]">
          <select
            value={status}
            onChange={e => handleStatusChange(e.target.value)}
            disabled={saving}
            className="px-[14px] py-[6px] rounded-full text-[16px] font-semibold text-white border-0 cursor-pointer"
            style={{ background: statusColors[status] }}
          >
            {deliverableStatuses.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
          {saving && <div className="w-[20px] h-[20px] border-[3px] border-[hsl(var(--primary))] border-t-transparent rounded-full animate-spin" />}
        </div>
      </div>
      <div className="flex gap-[24px] text-[20px] text-[hsl(var(--muted-foreground))]">
        <span>v{d.version}</span><span>Fecha: {d.dueDate}</span>
        {d.deliveredDate && <span>Entregado: {d.deliveredDate}</span>}
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
    const { data } = await supabase.from("risks").select("id").eq("client_id", clientId).eq("original_id", r.id).single();
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
  const f = client.financials;
  const totalSlides = 7;

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

  const slideNames = ["Portada", "Resumen", "Tareas", "Entregables", "Riesgos", "Financiero", "Siguiente Paso"];

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
          <DrilldownPanel title={`Entregables ${drilldown === "deliverables-pending" ? "Pendientes" : "Todos"} (${dels.length})`} icon={Package} accent="hsl(var(--info))" onClose={() => setDrilldown(null)}>
            <div className="grid grid-cols-2 gap-[24px]">{dels.map((d, i) => <EditableDeliverableRow key={d.id} d={d} clientId={cid} i={i} queryClient={qc} />)}</div>
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
      case "financial":
        return (
          <DrilldownPanel title="Detalle Financiero" icon={DollarSign} accent="hsl(var(--success))" onClose={() => setDrilldown(null)}>
            <div className="space-y-[32px]">
              <div className="grid grid-cols-4 gap-[24px]">
                {[
                  { label: "Valor Contrato", value: `$${(f.contractValue / 1000).toFixed(0)}K` },
                  { label: "Facturado", value: `$${(f.billed / 1000).toFixed(0)}K` },
                  { label: "Cobrado", value: `$${(f.paid / 1000).toFixed(0)}K` },
                  { label: "Pendiente", value: `$${(f.pending / 1000).toFixed(0)}K` },
                ].map((item, i) => (
                  <motion.div key={item.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                    className="rounded-[20px] border-[2px] border-[hsl(var(--border))] p-[32px] text-center"
                  >
                    <p className="text-[48px] font-extrabold text-[hsl(var(--foreground))]">{item.value}</p>
                    <p className="text-[22px] text-[hsl(var(--muted-foreground))] uppercase">{item.label}</p>
                  </motion.div>
                ))}
              </div>
              <div className="rounded-[20px] border-[2px] border-[hsl(var(--border))] p-[40px]">
                <p className="text-[28px] font-semibold text-[hsl(var(--foreground))] mb-[24px]">Horas</p>
                <div className="flex items-center gap-[24px]">
                  <div className="flex-1 h-[24px] rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                    <motion.div className="h-full rounded-full bg-[hsl(var(--primary))]"
                      initial={{ width: 0 }} animate={{ width: `${f.hoursEstimated > 0 ? Math.round((f.hoursUsed / f.hoursEstimated) * 100) : 0}%` }}
                      transition={{ delay: 0.3, duration: 0.8 }} />
                  </div>
                  <span className="text-[28px] font-bold text-[hsl(var(--foreground))]">{f.hoursUsed}h / {f.hoursEstimated}h</span>
                </div>
              </div>
            </div>
          </DrilldownPanel>
        );
      default: return null;
    }
  };

  const slides = [
    // Slide 0: Cover
    <SlideLayout key="cover" className="bg-gradient-to-br from-[hsl(var(--primary))] via-[hsl(var(--primary)/0.85)] to-[hsl(var(--primary)/0.7)]">
      <div className="absolute inset-0 flex flex-col justify-center px-[160px]">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <p className="text-[28px] font-medium text-white/70 tracking-[6px] uppercase mb-[20px]">SYSDE · Gestión de Soporte</p>
          <h1 className="text-[96px] font-extrabold text-white leading-[1.05] mb-[40px]">{client.name}</h1>
          <div className="w-[200px] h-[6px] bg-white/40 rounded-full mb-[40px]" />
          <p className="text-[36px] text-white/80 mb-[16px]">Informe de Estado</p>
          <p className="text-[28px] text-white/60">{new Date().toLocaleDateString("es", { day: "2-digit", month: "long", year: "numeric" })}</p>
        </motion.div>
        <div className="absolute bottom-[80px] right-[160px] text-right">
          <p className="text-[22px] text-white/60">Contacto</p>
          <p className="text-[26px] text-white font-medium">{client.contactName}</p>
          <p className="text-[22px] text-white/60">{client.contactEmail}</p>
        </div>
        <p className="absolute bottom-[80px] left-[160px] text-[20px] text-white/40">Clic en métricas para ver detalle · Editable en vivo</p>
      </div>
    </SlideLayout>,

    // Slide 1: Executive Summary
    <SlideLayout key="summary" className="bg-[hsl(var(--background))]">
      <div className="absolute inset-0 px-[120px] py-[80px]">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center gap-[16px] mb-[60px]">
            <div className="w-[8px] h-[48px] rounded-full bg-[hsl(var(--primary))]" />
            <h2 className="text-[56px] font-bold text-[hsl(var(--foreground))]">Resumen Ejecutivo</h2>
          </div>
          <div className="grid grid-cols-4 gap-[32px] mb-[60px]">
            <KpiCard label="Progreso" value={`${client.progress}%`} icon={TrendingUp} accent="hsl(var(--primary))" onClick={() => setDrilldown("phases")} delay={0.1} />
            <KpiCard label="Tareas Activas" value={`${inProgressTasks.length + pendingTasks.length}`} icon={ListChecks} accent="hsl(var(--warning))" onClick={() => setDrilldown("tasks-active")} delay={0.2} />
            <KpiCard label="Riesgos Abiertos" value={`${openRisks.length}`} icon={AlertTriangle} accent="hsl(var(--destructive))" onClick={() => setDrilldown("risks-open")} delay={0.3} />
            <KpiCard label="Entregables Pend." value={`${pendingDeliverables.length}`} icon={Package} accent="hsl(var(--info))" onClick={() => setDrilldown("deliverables-pending")} delay={0.4} />
          </div>
          <div className="rounded-[20px] border-[2px] border-[hsl(var(--border))] p-[40px] cursor-pointer hover:border-[3px] transition-all" onClick={() => setDrilldown("phases")}>
            <div className="flex justify-between items-center mb-[16px]">
              <span className="text-[28px] font-semibold text-[hsl(var(--foreground))]">Progreso General</span>
              <span className="text-[36px] font-bold text-[hsl(var(--primary))]">{client.progress}%</span>
            </div>
            <div className="w-full h-[20px] rounded-full bg-[hsl(var(--muted))] overflow-hidden">
              <motion.div className="h-full rounded-full bg-[hsl(var(--primary))]" initial={{ width: 0 }} animate={{ width: `${client.progress}%` }} transition={{ delay: 0.3, duration: 0.8 }} />
            </div>
            <div className="mt-[32px] grid grid-cols-3 gap-[24px]">
              {client.phases.map(phase => (
                <div key={phase.name} className="space-y-[8px]">
                  <p className="text-[20px] font-medium text-[hsl(var(--foreground))] truncate">{phase.name}</p>
                  <div className="flex items-center gap-[12px]">
                    <div className="flex-1 h-[8px] rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                      <div className="h-full rounded-full bg-[hsl(var(--primary))]" style={{ width: `${phase.progress}%` }} />
                    </div>
                    <span className="text-[18px] text-[hsl(var(--muted-foreground))]">{phase.progress}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </SlideLayout>,

    // Slide 2: Tasks
    <SlideLayout key="tasks" className="bg-[hsl(var(--background))]">
      <div className="absolute inset-0 px-[120px] py-[80px]">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center gap-[16px] mb-[48px]">
            <div className="w-[8px] h-[48px] rounded-full bg-[hsl(var(--warning))]" />
            <h2 className="text-[56px] font-bold text-[hsl(var(--foreground))]">Estado de Tareas</h2>
          </div>
          <div className="grid grid-cols-4 gap-[24px] mb-[48px]">
            {[
              { label: "Completadas", count: completedTasks.length, color: "hsl(var(--success))", icon: CheckCircle2, drill: "tasks-completed" as DrilldownType },
              { label: "En Progreso", count: inProgressTasks.length, color: "hsl(var(--info))", icon: Clock, drill: "tasks-inprogress" as DrilldownType },
              { label: "Pendientes", count: onlyPending.length, color: "hsl(var(--warning))", icon: Circle, drill: "tasks-pending" as DrilldownType },
              { label: "Bloqueadas", count: blockedTasks.length, color: "hsl(var(--destructive))", icon: AlertTriangle, drill: "tasks-blocked" as DrilldownType },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
                className="rounded-[20px] p-[32px] text-center border-[2px] border-[hsl(var(--border))] cursor-pointer hover:border-[3px] hover:shadow-lg transition-all group"
                onClick={() => setDrilldown(s.drill)}
              >
                <div className="relative">
                  <s.icon style={{ color: s.color, width: 32, height: 32, margin: "0 auto 12px" }} />
                  <div className="absolute top-0 right-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Pencil style={{ width: 18, height: 18, color: s.color }} />
                  </div>
                </div>
                <p className="text-[56px] font-extrabold" style={{ color: s.color }}>{s.count}</p>
                <p className="text-[22px] text-[hsl(var(--muted-foreground))] uppercase">{s.label}</p>
              </motion.div>
            ))}
          </div>
          <div className="space-y-[12px] max-h-[500px] overflow-hidden">
            {[...pendingTasks, ...inProgressTasks].slice(0, 7).map((t, i) => <EditableTaskRow key={t.id} task={t} clientId={client.id} i={i} queryClient={qc} />)}
          </div>
        </motion.div>
      </div>
    </SlideLayout>,

    // Slide 3: Deliverables
    <SlideLayout key="deliverables" className="bg-[hsl(var(--background))]">
      <div className="absolute inset-0 px-[120px] py-[80px]">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center justify-between mb-[48px]">
            <div className="flex items-center gap-[16px]">
              <div className="w-[8px] h-[48px] rounded-full bg-[hsl(var(--info))]" />
              <h2 className="text-[56px] font-bold text-[hsl(var(--foreground))]">Entregables</h2>
            </div>
            <button onClick={() => setDrilldown("deliverables-all")} className="flex items-center gap-[12px] px-[24px] py-[12px] rounded-full bg-[hsl(var(--muted))] hover:bg-[hsl(var(--accent))] transition-colors text-[22px] text-[hsl(var(--foreground))]">
              <Pencil style={{ width: 22, height: 22 }} /> Editar todos ({client.deliverables.length})
            </button>
          </div>
          <div className="grid grid-cols-2 gap-[32px]">
            {client.deliverables.slice(0, 6).map((d, i) => <EditableDeliverableRow key={d.id} d={d} clientId={client.id} i={i} queryClient={qc} />)}
          </div>
        </motion.div>
      </div>
    </SlideLayout>,

    // Slide 4: Risks
    <SlideLayout key="risks" className="bg-[hsl(var(--background))]">
      <div className="absolute inset-0 px-[120px] py-[80px]">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center justify-between mb-[48px]">
            <div className="flex items-center gap-[16px]">
              <div className="w-[8px] h-[48px] rounded-full bg-[hsl(var(--destructive))]" />
              <h2 className="text-[56px] font-bold text-[hsl(var(--foreground))]">Riesgos</h2>
            </div>
            <button onClick={() => setDrilldown("risks-all")} className="flex items-center gap-[12px] px-[24px] py-[12px] rounded-full bg-[hsl(var(--muted))] hover:bg-[hsl(var(--accent))] transition-colors text-[22px] text-[hsl(var(--foreground))]">
              <Pencil style={{ width: 22, height: 22 }} /> Editar todos ({client.risks.length})
            </button>
          </div>
          <div className="space-y-[20px]">
            {client.risks.slice(0, 6).map((r, i) => <EditableRiskRow key={r.id} r={r} clientId={client.id} i={i} queryClient={qc} />)}
          </div>
        </motion.div>
      </div>
    </SlideLayout>,

    // Slide 5: Financial
    <SlideLayout key="financial" className="bg-[hsl(var(--background))]">
      <div className="absolute inset-0 px-[120px] py-[80px]">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center gap-[16px] mb-[48px]">
            <div className="w-[8px] h-[48px] rounded-full bg-[hsl(var(--success))]" />
            <h2 className="text-[56px] font-bold text-[hsl(var(--foreground))]">Financiero & Recursos</h2>
          </div>
          <div className="grid grid-cols-2 gap-[32px] mb-[48px]">
            {[
              { label: "Valor Contrato", value: `$${(f.contractValue / 1000).toFixed(0)}K`, icon: DollarSign },
              { label: "Facturado", value: `$${(f.billed / 1000).toFixed(0)}K`, icon: DollarSign, pct: f.contractValue > 0 ? Math.round((f.billed / f.contractValue) * 100) : 0 },
              { label: "Cobrado", value: `$${(f.paid / 1000).toFixed(0)}K`, icon: DollarSign, pct: f.contractValue > 0 ? Math.round((f.paid / f.contractValue) * 100) : 0 },
              { label: "Horas", value: `${f.hoursUsed}h / ${f.hoursEstimated}h`, icon: Clock, pct: f.hoursEstimated > 0 ? Math.round((f.hoursUsed / f.hoursEstimated) * 100) : 0 },
            ].map((item, i) => (
              <motion.div key={item.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.1 }}
                className="rounded-[24px] border-[2px] border-[hsl(var(--border))] p-[48px] cursor-pointer hover:border-[3px] hover:shadow-lg transition-all"
                onClick={() => setDrilldown("financial")}
              >
                <item.icon style={{ width: 32, height: 32, color: "hsl(var(--primary))", marginBottom: 12 }} />
                <p className="text-[56px] font-extrabold text-[hsl(var(--foreground))] leading-none">{item.value}</p>
                <p className="text-[24px] text-[hsl(var(--muted-foreground))] mt-[8px] uppercase">{item.label}</p>
                {item.pct !== undefined && (
                  <div className="mt-[16px]">
                    <div className="w-full h-[12px] rounded-full bg-[hsl(var(--muted))] overflow-hidden">
                      <motion.div className="h-full rounded-full bg-[hsl(var(--primary))]" initial={{ width: 0 }} animate={{ width: `${item.pct}%` }} transition={{ delay: 0.4, duration: 0.6 }} />
                    </div>
                    <p className="text-[18px] text-[hsl(var(--muted-foreground))] mt-[6px]">{item.pct}%</p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
          <div className="rounded-[20px] border-[2px] border-[hsl(var(--border))] p-[40px] cursor-pointer hover:border-[3px] transition-all" onClick={() => setDrilldown("team")}>
            <div className="flex items-center gap-[12px] mb-[24px]">
              <Users style={{ width: 28, height: 28, color: "hsl(var(--primary))" }} />
              <span className="text-[28px] font-semibold text-[hsl(var(--foreground))]">Equipo Asignado</span>
              <Eye style={{ width: 20, height: 20, color: "hsl(var(--muted-foreground))" }} className="ml-auto" />
            </div>
            <div className="flex flex-wrap gap-[16px]">
              {client.teamAssigned.map(member => (
                <div key={member} className="flex items-center gap-[12px] bg-[hsl(var(--secondary))] rounded-full px-[24px] py-[12px]">
                  <div className="w-[36px] h-[36px] rounded-full bg-[hsl(var(--primary)/0.15)] flex items-center justify-center text-[16px] font-bold text-[hsl(var(--primary))]">
                    {member.split(" ").map(w => w[0]).join("").slice(0, 2)}
                  </div>
                  <span className="text-[22px] text-[hsl(var(--foreground))]">{member}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </SlideLayout>,

    // Slide 6: CTA
    <SlideLayout key="cta" className="bg-gradient-to-br from-[hsl(var(--primary))] via-[hsl(var(--primary)/0.9)] to-[hsl(var(--primary)/0.7)]">
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-center">
          <div className="mx-auto mb-[48px] w-[120px] h-[120px] rounded-[32px] bg-white/20 flex items-center justify-center backdrop-blur-sm">
            <Sparkles style={{ width: 56, height: 56, color: "white" }} />
          </div>
          <h2 className="text-[72px] font-extrabold text-white mb-[24px]">¿Listo para documentar?</h2>
          <p className="text-[32px] text-white/70 mb-[64px] max-w-[900px]">
            Crea una minuta con transcripción inteligente y actualiza las tareas en un solo paso
          </p>
          <button onClick={onContinue}
            className="px-[64px] py-[24px] rounded-[20px] bg-white text-[hsl(var(--primary))] text-[32px] font-bold hover:bg-white/90 transition-colors shadow-2xl flex items-center gap-[16px] mx-auto"
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
