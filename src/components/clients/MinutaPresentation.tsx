import { useState, useEffect, useCallback, useRef } from "react";
import { type Client, type ClientTask, type Phase } from "@/data/projectData";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Maximize2, Minimize2, X,
  FileText, Sparkles, ArrowRight
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ensureTaskInDb } from "@/lib/ensureTaskInDb";

interface MinutaPresentationProps {
  client: Client;
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
}

// ── Helpers ──────────────────────────────────────────────

function extractProgress(desc?: string): number | null {
  if (!desc) return null;
  const m = desc.match(/(?:avance|progreso)\s*[:=]?\s*(\d+)\s*%/i);
  return m ? parseInt(m[1], 10) : null;
}

function SysdeLogo({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <path d="M50 10C30 10 15 25 15 45C15 55 20 63 28 68L35 55C30 52 27 47 27 42C27 32 37 24 50 24C63 24 73 32 73 42C73 52 63 60 50 60L45 75C48 76 50 76 50 76C70 76 85 63 85 45C85 25 70 10 50 10Z" fill="currentColor" opacity="0.7"/>
    </svg>
  );
}

function SlideLayout({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("w-[1920px] h-[1080px] relative overflow-hidden", className)}>{children}</div>;
}

function ScaledSlide({ children, containerRef }: { children: React.ReactNode; containerRef: React.RefObject<HTMLDivElement | null> }) {
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const { width, height } = containerRef.current.getBoundingClientRect();
      setScale(Math.min(width / 1920, height / 1080));
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [containerRef]);
  return (
    <div className="absolute w-[1920px] h-[1080px]" style={{
      left: "50%", top: "50%", marginLeft: "-960px", marginTop: "-540px",
      transform: `scale(${scale})`, transformOrigin: "center center",
    }}>{children}</div>
  );
}

// ── Activity Groups Builder ──────────────────────────────

interface ActivityItem {
  label: string;
  progress: number;
  taskId?: number;
  status: "completed" | "in-progress" | "pending";
}

interface ActivityGroup {
  title: string;
  items: ActivityItem[];
}

function buildActivityGroups(client: Client): ActivityGroup[] {
  const groups: ActivityGroup[] = [];

  // For AURUM: PLANIFICACIÓN, EJECUCIÓN — INFRAESTRUCTURA, EJECUCIÓN — PARAMETRIZACIÓN
  // For others: derive from phases and tasks
  if (client.id === "aurum") {
    groups.push({
      title: "PLANIFICACIÓN",
      items: [
        { label: "Sesiones discovery generales", progress: 100, status: "completed" },
        { label: "Kickoff", progress: 100, status: "completed" },
        { label: "Planeación trabajo detallado", progress: 100, status: "completed" },
        { label: "Planeación de cronograma", progress: 100, status: "completed" },
        { label: "Envío plan y cronograma", progress: 100, status: "completed" },
      ],
    });
    groups.push({
      title: "EJECUCIÓN — INFRAESTRUCTURA",
      items: [
        { label: "Instalación ambientes Azure", progress: 100, status: "completed" },
        { label: "Registro licencias", progress: 100, status: "completed" },
        { label: "Instalación aplicativos baseline", progress: 100, status: "completed" },
        { label: "Configuración acceso VPN, RDP", progress: extractProgress(client.tasks.find(t => t.id === 1006)?.description) ?? 85, taskId: 1006, status: "in-progress" },
      ],
    });
    groups.push({
      title: "EJECUCIÓN — PARAMETRIZACIÓN",
      items: [
        { label: "Sesiones entendimiento de negocio", progress: 100, status: "completed" },
        { label: "Parametrización general", progress: extractProgress(client.tasks.find(t => t.id === 1001)?.description) ?? 30, taskId: 1001, status: "in-progress" },
        { label: "Configuración clientes", progress: extractProgress(client.tasks.find(t => t.id === 1002)?.description) ?? 35, taskId: 1002, status: "in-progress" },
        { label: "Configuración seguridad", progress: extractProgress(client.tasks.find(t => t.id === 1003)?.description) ?? 40, taskId: 1003, status: "in-progress" },
        { label: "Config. productos arrendamiento", progress: extractProgress(client.tasks.find(t => t.id === 1004)?.description) ?? 5, taskId: 1004, status: "pending" },
        { label: "Config. productos préstamos", progress: extractProgress(client.tasks.find(t => t.id === 1005)?.description) ?? 5, taskId: 1005, status: "pending" },
        { label: "Gestor de cobro / notificaciones", progress: extractProgress(client.tasks.find(t => t.id === 1008)?.description) ?? 5, taskId: 1008, status: "pending" },
      ],
    });
  } else {
    // Generic: group completed phases + in-progress tasks
    const completedPhases = client.phases.filter(p => p.status === "completado");
    if (completedPhases.length > 0) {
      groups.push({
        title: "FASES COMPLETADAS",
        items: completedPhases.map(p => ({ label: p.name, progress: 100, status: "completed" as const })),
      });
    }
    const activeTasks = client.tasks.filter(t => t.status === "en-progreso" || t.status === "pendiente");
    if (activeTasks.length > 0) {
      groups.push({
        title: "EJECUCIÓN",
        items: activeTasks.map(t => ({
          label: t.title,
          progress: extractProgress(t.description) ?? (t.status === "en-progreso" ? 50 : 0),
          taskId: t.id,
          status: t.status === "en-progreso" ? "in-progress" as const : "pending" as const,
        })),
      });
    }
  }
  return groups;
}

// ── Gantt helpers ────────────────────────────────────────

function getMonthRange(client: Client): { label: string; date: Date }[] {
  const allDates: Date[] = [];
  const parseD = (s: string) => {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  };
  client.phases.forEach(p => {
    const s = parseD(p.startDate); if (s) allDates.push(s);
    const e = parseD(p.endDate); if (e) allDates.push(e);
  });
  if (allDates.length === 0) {
    // Fallback: use contract dates
    const s = parseD(client.contractStart); if (s) allDates.push(s);
    const e = parseD(client.contractEnd); if (e) allDates.push(e);
  }
  if (allDates.length === 0) return [];
  const min = new Date(Math.min(...allDates.map(d => d.getTime())));
  const max = new Date(Math.max(...allDates.map(d => d.getTime())));
  const months: { label: string; date: Date }[] = [];
  const cur = new Date(min.getFullYear(), min.getMonth(), 1);
  while (cur <= max || months.length < 3) {
    const names = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
    months.push({ label: `${names[cur.getMonth()]} ${cur.getFullYear()}`, date: new Date(cur) });
    cur.setMonth(cur.getMonth() + 1);
    if (months.length > 12) break;
  }
  return months;
}

function getPhaseBarStyle(phase: Phase, months: { label: string; date: Date }[]): { left: string; width: string; color: string } {
  if (months.length === 0) return { left: "0%", width: "0%", color: "#ccc" };
  const parseD = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? null : d; };
  const totalStart = months[0].date.getTime();
  const lastMonth = new Date(months[months.length - 1].date);
  lastMonth.setMonth(lastMonth.getMonth() + 1);
  const totalEnd = lastMonth.getTime();
  const totalSpan = totalEnd - totalStart;

  const ps = parseD(phase.startDate);
  const pe = parseD(phase.endDate);
  if (!ps || !pe) return { left: "0%", width: "0%", color: "#ccc" };

  const left = Math.max(0, ((ps.getTime() - totalStart) / totalSpan) * 100);
  const width = Math.max(2, ((pe.getTime() - ps.getTime()) / totalSpan) * 100);

  let color = "#bbb"; // default gray
  if (phase.status === "completado") color = "#c0392b";
  else if (phase.status === "en-progreso") color = "#c0392b";
  else if (phase.name.toLowerCase().includes("capacitación") || phase.name.toLowerCase().includes("talleres")) color = "#e67e22";
  else if (phase.name.toLowerCase().includes("pruebas")) color = "#e67e22";
  else if (phase.name.toLowerCase().includes("go") || phase.name.toLowerCase().includes("producción")) color = "#27ae60";
  else color = "#e67e22";

  return { left: `${left}%`, width: `${width}%`, color };
}

function getCurrentDatePosition(months: { label: string; date: Date }[]): string | null {
  if (months.length === 0) return null;
  const now = new Date();
  const totalStart = months[0].date.getTime();
  const lastMonth = new Date(months[months.length - 1].date);
  lastMonth.setMonth(lastMonth.getMonth() + 1);
  const totalEnd = lastMonth.getTime();
  const pos = ((now.getTime() - totalStart) / (totalEnd - totalStart)) * 100;
  if (pos < 0 || pos > 100) return null;
  return `${pos}%`;
}

// ── Editable Progress Bar ───────────────────────────────

function EditableProgressBar({
  item, clientId, onUpdate
}: {
  item: ActivityItem;
  clientId: string;
  onUpdate: (taskId: number, newProgress: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(item.progress.toString());
  const barColor = item.progress === 100
    ? "#27ae60"
    : item.status === "in-progress" ? "#c0392b" : "#e67e22";

  const handleSave = () => {
    const num = Math.min(100, Math.max(0, parseInt(val, 10) || 0));
    setEditing(false);
    if (item.taskId) onUpdate(item.taskId, num);
  };

  return (
    <div className="flex items-center gap-[16px] py-[8px]">
      <span className="text-[20px] text-[#333] w-[400px] truncate">{item.label}</span>
      <div className="flex-1 relative h-[24px] bg-[#e8e8e8] rounded-[4px] overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${item.progress}%` }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="absolute inset-y-0 left-0 rounded-[4px]"
          style={{ background: barColor }}
        />
        {item.progress === 100 && (
          <span className="absolute inset-0 flex items-center justify-end pr-[8px] text-[14px] font-bold text-white">100%</span>
        )}
      </div>
      {item.progress < 100 && (
        editing ? (
          <div className="flex items-center gap-[4px] w-[80px]">
            <input
              autoFocus
              value={val}
              onChange={e => setVal(e.target.value)}
              onBlur={handleSave}
              onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
              className="w-[50px] text-[18px] text-center border border-[#ccc] rounded px-[4px] py-[2px]"
            />
            <span className="text-[16px] text-[#666]">%</span>
          </div>
        ) : (
          <button
            onClick={() => { if (item.taskId) { setVal(item.progress.toString()); setEditing(true); } }}
            className={cn(
              "text-[18px] font-bold w-[60px] text-right",
              item.taskId ? "cursor-pointer hover:text-[#c0392b] transition-colors" : "cursor-default",
              item.status === "in-progress" ? "text-[#c0392b]" : "text-[#e67e22]"
            )}
            title={item.taskId ? "Clic para editar" : ""}
          >
            {item.progress}%
          </button>
        )
      )}
    </div>
  );
}

// ── Main Component ──────────────────────────────────────

export function MinutaPresentation({ client, open, onClose, onContinue }: MinutaPresentationProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  // Build data
  const activityGroups = buildActivityGroups(client);
  const months = getMonthRange(client);
  const currentDatePos = getCurrentDatePosition(months);

  const completedTasks = client.tasks.filter(t => t.status === "completada");
  const inProgressTasks = client.tasks.filter(t => t.status === "en-progreso");
  const pendingTasks = client.tasks.filter(t => t.status === "pendiente" || t.status === "bloqueada");

  // Build coordination items from action items
  const coordinationItems = client.actionItems.map((item, i) => ({
    num: i + 1,
    subject: item.title,
    owner: item.assignee,
    start: item.dueDate,
    end: item.dueDate,
    status: item.status === "completado" ? "Hecho" : item.status === "vencido" ? "Vencido" : "Pendiente",
    statusColor: item.status === "completado" ? "#22c55e" : item.status === "vencido" ? "#ef4444" : "#f59e0b",
    fup: item.source?.replace("FUP Semanal ", "") || "",
  }));

  // Build próximos pasos
  const proximosPasos = pendingTasks.map((t, i) => ({
    id: `F${i + 1}`,
    activity: t.title,
    responsible: t.owner,
    date: t.dueDate,
    dependency: i === 0 ? "N/A" : `F${i}`,
    description: t.description,
  }));

  // Handle progress update from editable bars
  const handleProgressUpdate = async (taskId: number, newProgress: number) => {
    const task = client.tasks.find(t => t.id === taskId);
    if (!task) return;
    const dbId = await ensureTaskInDb(task, client.id);
    if (!dbId) return;
    const newDesc = task.description
      ? task.description.replace(/(?:avance|progreso)\s*[:=]?\s*\d+\s*%/i, `Avance ${newProgress}%`)
      : `Avance ${newProgress}%`;
    const newStatus = newProgress >= 100 ? "completada" : newProgress > 0 ? "en-progreso" : "pendiente";
    await supabase.from("tasks").update({ description: newDesc, status: newStatus }).eq("id", dbId);
    qc.invalidateQueries({ queryKey: ["clients"] });
    toast.success(`${task.title}: ${newProgress}%`);
  };

  // Gantt row labels (use phase names but shortened)
  const ganttRows = client.phases.map(p => ({
    label: p.name.length > 40 ? p.name.substring(0, 37) + "..." : p.name,
    phase: p,
  }));
  // Add "Gestión de proyecto" as first row spanning entire timeline
  const managementPhase: Phase = {
    name: "Gestión de proyecto",
    status: "en-progreso",
    progress: client.progress,
    startDate: client.contractStart,
    endDate: client.contractEnd,
  };

  // ── Slide definitions ─────────────────────────────────

  const slideNames = [
    "Portada", "Agenda",
    "Avance de Actividades", "Línea de Tiempo",
    "Próximos Pasos", "Coordinación",
    "Entregables", "Riesgos",
    "Cierre"
  ];
  const totalSlides = slideNames.length;

  const next = useCallback(() => setCurrentSlide(s => Math.min(s + 1, totalSlides - 1)), [totalSlides]);
  const prev = useCallback(() => setCurrentSlide(s => Math.max(s - 1, 0)), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      if (e.key === "Escape") { if (isFullscreen) toggleFullscreen(); else onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, next, prev, isFullscreen]);

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

  const slides = [
    // ═══ SLIDE 0: PORTADA ═══
    <SlideLayout key="cover" className="bg-white">
      <div className="absolute inset-0 flex">
        <div className="w-[520px] h-full bg-[#c0392b] flex flex-col justify-between py-[80px] px-[60px]">
          <div>
            <div className="text-white/80"><SysdeLogo size={64} /></div>
            <p className="text-[18px] text-white/60 uppercase tracking-[3px] mt-[20px]">Sysde</p>
          </div>
          <div>
            <p className="text-[22px] text-white font-bold">Fernando Pinto Villarreal</p>
            <p className="text-[18px] text-white/60 mt-[4px]">Project Manager</p>
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-center px-[120px] bg-white">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <p className="text-[20px] text-[#999] uppercase tracking-[4px] mb-[16px]">
              SERVICIOS Y TECNOLOGÍA QUE GENERAN VALOR A LA INDUSTRIA FINANCIERA
            </p>
            <h1 className="text-[64px] font-bold text-[#333] leading-[1.1] mb-[32px]">
              Proyecto Implementación SAF
            </h1>
            <h2 className="text-[56px] font-extrabold text-[#c0392b] mb-[40px]">{client.name}</h2>
            <div className="w-[80px] h-[4px] bg-[#c0392b] mb-[40px]" />
            <p className="text-[24px] text-[#666] mb-[8px]">
              {new Date().toLocaleDateString("es", { day: "2-digit", month: "long", year: "numeric" })}
            </p>
            <p className="text-[22px] text-[#999]">Sesión de Seguimiento</p>
          </motion.div>
        </div>
      </div>
    </SlideLayout>,

    // ═══ SLIDE 1: AGENDA ═══
    <SlideLayout key="agenda" className="bg-white">
      <div className="absolute inset-0 px-[120px] py-[80px]">
        <div className="flex items-center gap-[16px] mb-[80px]">
          <div className="text-[#999]"><SysdeLogo size={48} /></div>
        </div>
        <div className="grid grid-cols-2 gap-[80px]">
          <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-[48px] font-bold text-[#c0392b] mb-[40px]">Sincronización</h2>
            <ul className="space-y-[20px]">
              <li className="flex items-start gap-[16px]">
                <span className="text-[28px] text-[#c0392b]">•</span>
                <span className="text-[28px] text-[#333]">Avance de actividades</span>
              </li>
              <li className="flex items-start gap-[16px]">
                <span className="text-[28px] text-[#c0392b]">•</span>
                <span className="text-[28px] text-[#333]">Línea de tiempo</span>
              </li>
            </ul>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <h2 className="text-[48px] font-bold text-[#c0392b] mb-[40px]">Coordinación</h2>
            <ul className="space-y-[20px]">
              <li className="flex items-start gap-[16px]">
                <span className="text-[28px] text-[#c0392b]">•</span>
                <span className="text-[28px] text-[#333]">Próximos pasos</span>
              </li>
              <li className="flex items-start gap-[16px]">
                <span className="text-[28px] text-[#c0392b]">•</span>
                <span className="text-[28px] text-[#333]">Action Items</span>
              </li>
            </ul>
          </motion.div>
        </div>
      </div>
    </SlideLayout>,

    // ═══ SLIDE 2: SINCRONIZACIÓN — Avance de actividades (matches image 1) ═══
    <SlideLayout key="avance" className="bg-white">
      <div className="absolute inset-0 px-[80px] py-[50px]">
        {/* Header */}
        <div className="flex items-start justify-between mb-[24px]">
          <div>
            <p className="text-[20px] font-bold text-[#c0392b] uppercase tracking-[2px]">SINCRONIZACIÓN</p>
            <h2 className="text-[44px] font-bold text-[#333] mt-[8px]">Avance de actividades</h2>
          </div>
          {/* SPI Box */}
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
            className="bg-[#c0392b] text-white px-[32px] py-[16px] rounded-[4px] text-right"
          >
            <p className="text-[28px] font-extrabold">SPI 1.0</p>
            <p className="text-[16px] mt-[4px]">Planif. {client.progress}% · Real {client.progress}%</p>
          </motion.div>
        </div>

        {/* Two-column activity groups */}
        <div className="grid grid-cols-2 gap-[48px] mt-[16px]">
          {/* Left column */}
          <div className="space-y-[24px]">
            {activityGroups.filter((_, i) => i % 2 === 0).map((group, gi) => (
              <div key={gi}>
                <p className="text-[18px] font-bold text-[#c0392b] uppercase tracking-[1px] mb-[8px] border-b border-[#eee] pb-[4px]">
                  {group.title}
                </p>
                {group.items.map((item, ii) => (
                  <EditableProgressBar key={ii} item={item} clientId={client.id} onUpdate={handleProgressUpdate} />
                ))}
              </div>
            ))}
          </div>
          {/* Right column */}
          <div className="space-y-[24px]">
            {activityGroups.filter((_, i) => i % 2 === 1).map((group, gi) => (
              <div key={gi}>
                <p className="text-[18px] font-bold text-[#c0392b] uppercase tracking-[1px] mb-[8px] border-b border-[#eee] pb-[4px]">
                  {group.title}
                </p>
                {group.items.map((item, ii) => (
                  <EditableProgressBar key={ii} item={item} clientId={client.id} onUpdate={handleProgressUpdate} />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideLayout>,

    // ═══ SLIDE 3: SINCRONIZACIÓN — Línea de tiempo (matches image 2) ═══
    <SlideLayout key="timeline" className="bg-white">
      <div className="absolute inset-0 px-[80px] py-[50px]">
        <p className="text-[20px] font-bold text-[#c0392b] uppercase tracking-[2px]">SINCRONIZACIÓN</p>
        <h2 className="text-[44px] font-bold text-[#333] mt-[8px] mb-[32px]">
          Línea de tiempo — {client.industry}
        </h2>

        {/* Gantt chart */}
        <div className="relative">
          {/* Month header */}
          <div className="flex">
            <div className="w-[360px] shrink-0" />
            <div className="flex-1 flex">
              {months.map((m, i) => {
                const isCurrentMonth = new Date().getFullYear() === m.date.getFullYear() && new Date().getMonth() === m.date.getMonth();
                return (
                  <div key={i} className={cn(
                    "flex-1 text-center py-[12px] text-[16px] font-semibold",
                    isCurrentMonth ? "bg-[#c0392b] text-white" : "bg-[#666] text-white"
                  )}>
                    {m.label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Management row */}
          <div className="flex items-center border-b border-[#e0e0e0]">
            <div className="w-[360px] shrink-0 py-[20px] pr-[16px]">
              <span className="text-[20px] font-semibold text-[#333]">Gestión de proyecto</span>
            </div>
            <div className="flex-1 relative h-[48px]">
              {(() => {
                const style = getPhaseBarStyle(managementPhase, months);
                return <div className="absolute top-[10px] bottom-[10px] rounded-[4px]" style={{ left: style.left, width: style.width, background: "#999" }} />;
              })()}
            </div>
          </div>

          {/* Phase rows */}
          {ganttRows.map((row, i) => {
            const style = getPhaseBarStyle(row.phase, months);
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className={cn("flex items-center border-b border-[#e0e0e0]", i % 2 === 0 ? "bg-white" : "bg-[#f8f8f8]")}
              >
                <div className="w-[360px] shrink-0 py-[20px] pr-[16px]">
                  <span className="text-[18px] text-[#333] font-medium">{row.label}</span>
                </div>
                <div className="flex-1 relative h-[48px]">
                  <div className="absolute top-[12px] bottom-[12px] rounded-[4px]" style={{ left: style.left, width: style.width, background: style.color }} />
                </div>
              </motion.div>
            );
          })}

          {/* Current date vertical line */}
          {currentDatePos && (
            <div className="absolute top-0 bottom-0 z-10" style={{ left: `calc(360px + (100% - 360px) * ${parseFloat(currentDatePos)} / 100)` }}>
              <div className="w-[3px] h-full bg-[#c0392b]" />
            </div>
          )}
        </div>
      </div>
    </SlideLayout>,

    // ═══ SLIDE 4: COORDINACIÓN — Próximos pasos ═══
    <SlideLayout key="proximos" className="bg-white">
      <div className="absolute inset-0 px-[80px] py-[60px]">
        <div className="flex items-center gap-[16px] mb-[20px]">
          <div className="text-[#999]"><SysdeLogo size={40} /></div>
          <h2 className="text-[44px] font-bold text-[#c0392b]">Coordinación</h2>
        </div>
        <h3 className="text-[36px] font-bold text-[#333] mb-[32px]">Próximos pasos</h3>
        <div className="border-[2px] border-[#ccc] rounded-[8px] overflow-hidden">
          <div className="flex bg-white border-b-[2px] border-[#ccc]">
            <div className="flex-1 px-[24px] py-[16px] text-[24px] font-bold text-[#333]">Actividad</div>
            <div className="w-[200px] px-[24px] py-[16px] text-[24px] font-bold text-[#333] text-center border-l-[2px] border-[#ccc]">Dependencia</div>
          </div>
          {proximosPasos.slice(0, 7).map((paso, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="flex border-b border-[#ddd] last:border-b-0"
            >
              <div className="flex-1 px-[24px] py-[16px] border-r-[2px] border-[#ccc]">
                <p className="text-[20px] text-[#333]"><span className="font-bold">{paso.id})</span> {paso.activity}</p>
                <p className="text-[18px] mt-[4px]">Responsable: <span className="font-bold text-[#c0392b]">{paso.responsible}</span></p>
                <p className="text-[18px] text-[#666] italic">Fecha: {paso.date}</p>
              </div>
              <div className="w-[200px] px-[24px] py-[16px] flex items-center justify-center">
                <span className="text-[20px] text-[#333]">{paso.dependency}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </SlideLayout>,

    // ═══ SLIDE 5: COORDINACIÓN — Action Items Table ═══
    <SlideLayout key="coordination" className="bg-white">
      <div className="absolute inset-0 px-[80px] py-[60px]">
        <div className="flex items-center gap-[16px] mb-[40px]">
          <div className="text-[#999]"><SysdeLogo size={40} /></div>
          <h2 className="text-[44px] font-bold text-[#c0392b]">Coordinación</h2>
        </div>
        <div className="border-[2px] border-[#ccc] rounded-[8px] overflow-hidden">
          <div className="flex bg-[#4a6fa5] text-white">
            <div className="w-[60px] px-[12px] py-[14px] text-[18px] font-bold border-r border-white/20">Nº</div>
            <div className="flex-1 px-[16px] py-[14px] text-[18px] font-bold border-r border-white/20">Asunto</div>
            <div className="w-[180px] px-[16px] py-[14px] text-[18px] font-bold border-r border-white/20">Owner</div>
            <div className="w-[140px] px-[16px] py-[14px] text-[18px] font-bold border-r border-white/20">Fecha</div>
            <div className="w-[120px] px-[16px] py-[14px] text-[18px] font-bold border-r border-white/20">Estado</div>
            <div className="w-[160px] px-[16px] py-[14px] text-[18px] font-bold">FUP</div>
          </div>
          {coordinationItems.slice(0, 8).map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={cn("flex border-b border-[#ddd]", i % 2 === 0 ? "bg-[#d6e4f0]" : "bg-white")}
            >
              <div className="w-[60px] px-[12px] py-[14px] text-[18px] text-[#333] border-r border-[#ccc]">{item.num}</div>
              <div className="flex-1 px-[16px] py-[14px] text-[18px] text-[#333] border-r border-[#ccc]">{item.subject}</div>
              <div className="w-[180px] px-[16px] py-[14px] text-[18px] text-[#333] border-r border-[#ccc]">{item.owner}</div>
              <div className="w-[140px] px-[16px] py-[14px] text-[18px] text-[#333] border-r border-[#ccc]">{item.start}</div>
              <div className="w-[120px] px-[16px] py-[14px] border-r border-[#ccc]">
                <span className="text-[18px] font-semibold" style={{ color: item.statusColor }}>{item.status}</span>
              </div>
              <div className="w-[160px] px-[16px] py-[14px] text-[16px] text-[#666]">{item.fup}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </SlideLayout>,

    // ═══ SLIDE 6: ENTREGABLES ═══
    <SlideLayout key="entregables" className="bg-white">
      <div className="absolute inset-0 px-[80px] py-[60px]">
        <div className="flex items-center gap-[16px] mb-[40px]">
          <div className="text-[#999]"><SysdeLogo size={40} /></div>
          <h2 className="text-[44px] font-bold text-[#c0392b]">Entregables</h2>
        </div>
        <div className="border-[2px] border-[#ccc] rounded-[8px] overflow-hidden">
          <div className="flex bg-[#c0392b] text-white">
            <div className="w-[120px] px-[16px] py-[14px] text-[18px] font-bold border-r border-white/20">ID</div>
            <div className="flex-1 px-[16px] py-[14px] text-[18px] font-bold border-r border-white/20">Entregable</div>
            <div className="w-[160px] px-[16px] py-[14px] text-[18px] font-bold border-r border-white/20">Fecha</div>
            <div className="w-[160px] px-[16px] py-[14px] text-[18px] font-bold">Estado</div>
          </div>
          {client.deliverables.slice(0, 10).map((d, i) => {
            const color = d.status === "aprobado" ? "#27ae60" : d.status === "entregado" ? "#3b82f6" : d.status === "en-revision" ? "#e67e22" : "#999";
            const label = d.status === "aprobado" ? "Aprobado" : d.status === "entregado" ? "Entregado" : d.status === "en-revision" ? "En Revisión" : "Pendiente";
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className={cn("flex border-b border-[#ddd]", i % 2 === 0 ? "bg-[#fdf2f2]" : "bg-white")}
              >
                <div className="w-[120px] px-[16px] py-[14px] text-[18px] text-[#666] font-mono border-r border-[#ddd]">{d.id}</div>
                <div className="flex-1 px-[16px] py-[14px] text-[18px] text-[#333] border-r border-[#ddd]">{d.name}</div>
                <div className="w-[160px] px-[16px] py-[14px] text-[18px] text-[#666] border-r border-[#ddd]">{d.deliveredDate || d.dueDate}</div>
                <div className="w-[160px] px-[16px] py-[14px]">
                  <span className="text-[18px] font-semibold" style={{ color }}>{label}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </SlideLayout>,

    // ═══ SLIDE 7: RIESGOS ═══
    <SlideLayout key="riesgos" className="bg-white">
      <div className="absolute inset-0 px-[80px] py-[60px]">
        <div className="flex items-center gap-[16px] mb-[40px]">
          <div className="text-[#999]"><SysdeLogo size={40} /></div>
          <h2 className="text-[44px] font-bold text-[#c0392b]">Riesgos del Proyecto</h2>
        </div>
        <div className="space-y-[24px]">
          {client.risks.map((risk, i) => {
            const impactColor = risk.impact === "alto" ? "#c0392b" : risk.impact === "medio" ? "#e67e22" : "#27ae60";
            const statusLabel = risk.status === "abierto" ? "Abierto" : risk.status === "mitigado" ? "Mitigado" : "Cerrado";
            return (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="border-[2px] border-[#ddd] rounded-[8px] px-[32px] py-[24px] flex items-start gap-[24px]"
              >
                <div className="w-[80px] h-[80px] rounded-[8px] flex flex-col items-center justify-center shrink-0" style={{ background: impactColor + "20" }}>
                  <span className="text-[14px] font-bold uppercase" style={{ color: impactColor }}>Impacto</span>
                  <span className="text-[24px] font-extrabold capitalize" style={{ color: impactColor }}>{risk.impact}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-[16px] mb-[8px]">
                    <span className="text-[16px] font-mono text-[#999]">{risk.id}</span>
                    <span className="px-[12px] py-[4px] rounded-full text-[14px] font-bold" style={{ background: risk.status === "abierto" ? "#fef2f2" : "#f0fdf4", color: risk.status === "abierto" ? "#c0392b" : "#27ae60" }}>{statusLabel}</span>
                  </div>
                  <p className="text-[22px] text-[#333] leading-[1.4]">{risk.description}</p>
                  {risk.mitigation && (
                    <p className="text-[18px] text-[#666] mt-[8px] italic">Mitigación: {risk.mitigation}</p>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </SlideLayout>,

    // ═══ SLIDE 8: CIERRE ═══
    <SlideLayout key="close" className="bg-[#c0392b]">
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-center">
          <h2 className="text-[48px] text-white/80 mb-[16px]">Somos tus aliados para la</h2>
          <h2 className="text-[64px] font-extrabold text-white mb-[48px]">Transformación Digital de tu negocio</h2>
          <div className="w-[200px] h-[3px] bg-white/30 rounded-full mx-auto mb-[48px]" />
          <div className="text-white mb-[48px]"><SysdeLogo size={80} /></div>
          <p className="text-[28px] text-white/60 mb-[64px]">Sysde</p>
          <button onClick={onContinue}
            className="px-[56px] py-[20px] rounded-[16px] bg-white text-[#c0392b] text-[28px] font-bold hover:bg-white/90 transition-colors shadow-2xl flex items-center gap-[16px] mx-auto"
          >
            <FileText style={{ width: 28, height: 28 }} />
            Crear Nueva Minuta
            <ArrowRight style={{ width: 28, height: 28 }} />
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
          {/* Top bar */}
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

          {/* Slide area */}
          <div className="flex-1 relative overflow-hidden" ref={containerRef}>
            <AnimatePresence mode="wait">
              <motion.div key={currentSlide} initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }} transition={{ duration: 0.3 }} className="absolute inset-0">
                <ScaledSlide containerRef={containerRef}>{slides[currentSlide]}</ScaledSlide>
              </motion.div>
            </AnimatePresence>

            {currentSlide > 0 && (
              <button onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"><ChevronLeft className="h-6 w-6" /></button>
            )}
            {currentSlide < totalSlides - 1 && (
              <button onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"><ChevronRight className="h-6 w-6" /></button>
            )}
          </div>

          {/* Bottom nav */}
          <div className="flex items-center justify-center gap-2 px-4 py-3 bg-black/50 shrink-0">
            {slideNames.map((name, i) => (
              <button key={i} onClick={() => setCurrentSlide(i)}
                className={cn("px-3 py-1.5 rounded-lg text-xs transition-all", i === currentSlide ? "bg-white/20 text-white font-medium" : "text-white/40 hover:text-white/70 hover:bg-white/5")}
              >{name}</button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
