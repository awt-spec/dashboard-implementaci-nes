import { useState, useEffect, useCallback, useRef } from "react";
import { type Client, type ClientTask, type ActionItem } from "@/data/projectData";
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

const taskStatuses = [
  { value: "completada", label: "Completada", color: "hsl(var(--success))" },
  { value: "en-progreso", label: "Progreso", color: "hsl(var(--info))" },
  { value: "pendiente", label: "Pendiente", color: "hsl(var(--warning))" },
  { value: "bloqueada", label: "Bloqueada", color: "hsl(var(--destructive))" },
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

// SYSDE logo icon (simplified gear/spiral)
function SysdeLogo({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      <path d="M50 10C30 10 15 25 15 45C15 55 20 63 28 68L35 55C30 52 27 47 27 42C27 32 37 24 50 24C63 24 73 32 73 42C73 52 63 60 50 60L45 75C48 76 50 76 50 76C70 76 85 63 85 45C85 25 70 10 50 10Z" fill="currentColor" opacity="0.7"/>
    </svg>
  );
}

// Editable Task Row for coordination slide
function EditableTaskRow({ task, clientId, i, queryClient: qc }: { task: ClientTask; clientId: string; i: number; queryClient: any }) {
  const [status, setStatus] = useState(task.status);
  const [saving, setSaving] = useState(false);
  const statusColor = taskStatuses.find(s => s.value === status)?.color || "hsl(var(--muted))";

  const handleStatusChange = async (newStatus: string) => {
    setStatus(newStatus as any);
    setSaving(true);
    const dbId = await ensureTaskInDb(task, clientId);
    if (dbId) {
      await supabase.from("tasks").update({ status: newStatus }).eq("id", dbId);
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

export function MinutaPresentation({ client, open, onClose, onContinue }: MinutaPresentationProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [drilldownTasks, setDrilldownTasks] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  const completedTasks = client.tasks.filter(t => t.status === "completada");
  const inProgressTasks = client.tasks.filter(t => t.status === "en-progreso");
  const pendingTasks = client.tasks.filter(t => t.status === "pendiente" || t.status === "bloqueada");

  const totalSlides = 7;
  const slideNames = ["Portada", "Agenda", "Sincronización", "Cronograma", "Próximos Pasos", "Coordinación", "Cierre"];

  const next = useCallback(() => setCurrentSlide(s => Math.min(s + 1, totalSlides - 1)), []);
  const prev = useCallback(() => setCurrentSlide(s => Math.max(s - 1, 0)), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (drilldownTasks) { if (e.key === "Escape") setDrilldownTasks(false); return; }
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      if (e.key === "Escape") { if (isFullscreen) toggleFullscreen(); else onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, next, prev, isFullscreen, drilldownTasks]);

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

  // Build "Actividades realizadas" with responsible party info from tasks/phases
  const actividadesRealizadas = [
    ...client.phases.filter(p => p.status === "completado").map(p => ({
      text: p.name,
      responsible: "SYSDE",
      dates: `${p.startDate} — ${p.endDate}`,
    })),
    ...completedTasks.map(t => ({
      text: t.title,
      responsible: t.owner,
      dates: t.dueDate,
    })),
  ];

  const actividadesEnCurso = inProgressTasks.map(t => ({
    text: t.title,
    responsible: t.owner,
    dates: t.description || t.dueDate,
    subItems: t.description?.includes("•") ? t.description.split("•").filter(Boolean).map(s => s.trim()) : undefined,
  }));

  // Build próximos pasos from pending tasks as dependency chain
  const proximosPasos = pendingTasks.map((t, i) => ({
    id: `F${i + 1}`,
    activity: t.title,
    responsible: t.owner,
    date: t.dueDate,
    dependency: i === 0 ? "N/A" : `F${i}`,
    description: t.description,
  }));

  // Build coordination items from action items
  const coordinationItems = client.actionItems.map((item, i) => ({
    num: i + 1,
    subject: item.title,
    owner: item.assignee,
    start: item.dueDate,
    end: item.dueDate,
    status: item.status === "completado" ? "Hecho" : item.status === "vencido" ? "Vencido" : "Pendiente",
    statusColor: item.status === "completado" ? "#22c55e" : item.status === "vencido" ? "#ef4444" : "#f59e0b",
    fup: "",
  }));

  // Compute month labels for cronograma
  const monthLabels = (() => {
    const phases = client.phases;
    const months: string[] = [];
    phases.forEach(p => {
      const parts = p.startDate.split(" ");
      if (parts.length >= 3) {
        const label = `${parts[1]} ${parts[2]}`;
        if (!months.includes(label)) months.push(label);
      }
      const partsE = p.endDate.split(" ");
      if (partsE.length >= 3) {
        const label = `${partsE[1]} ${partsE[2]}`;
        if (!months.includes(label)) months.push(label);
      }
    });
    return months.slice(0, 6);
  })();

  const slides = [
    // ===== SLIDE 0: PORTADA (matches PPTX page 1 exactly) =====
    <SlideLayout key="cover" className="bg-white">
      <div className="absolute inset-0 flex">
        {/* Left red panel */}
        <div className="w-[520px] h-full bg-[#c0392b] flex flex-col justify-between py-[80px] px-[60px]">
          <div>
            <div className="text-white/80 mb-[20px]">
              <SysdeLogo size={64} />
            </div>
            <p className="text-[18px] text-white/60 uppercase tracking-[3px] mt-[20px]">Sysde</p>
          </div>
          <div>
            <p className="text-[22px] text-white font-bold">Fernando Pinto Villarreal</p>
            <p className="text-[18px] text-white/60 mt-[4px]">Project Manager</p>
          </div>
        </div>
        {/* Right content panel */}
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

    // ===== SLIDE 1: AGENDA (matches PPTX page 2) =====
    <SlideLayout key="agenda" className="bg-white">
      <div className="absolute inset-0 px-[120px] py-[80px]">
        {/* Header bar */}
        <div className="flex items-center gap-[16px] mb-[80px]">
          <div className="text-[#999]"><SysdeLogo size={48} /></div>
          <div className="flex-1" />
        </div>
        <div className="grid grid-cols-2 gap-[80px]">
          {/* Left: Sincronización */}
          <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <h2 className="text-[48px] font-bold text-[#c0392b] mb-[40px]">Sincronización</h2>
            <ul className="space-y-[20px]">
              <li className="text-[28px] text-[#333]">Actividades realizadas, en curso</li>
            </ul>
          </motion.div>
          {/* Right: AGENDA list */}
          <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <h2 className="text-[48px] font-bold text-[#c0392b] mb-[40px]">AGENDA</h2>
            <ul className="space-y-[20px]">
              <li className="flex items-start gap-[16px]">
                <span className="text-[28px] text-[#c0392b] mt-[2px]">•</span>
                <span className="text-[28px] text-[#333]">Cronograma y estado del proyecto</span>
              </li>
              <li className="flex items-start gap-[16px]">
                <span className="text-[28px] text-[#c0392b] mt-[2px]">•</span>
                <span className="text-[28px] text-[#333]">Próximos pasos</span>
              </li>
              <li className="flex items-start gap-[16px]">
                <span className="text-[28px] text-[#c0392b] mt-[2px]">•</span>
                <span className="text-[28px] text-[#333]">Coordinación</span>
              </li>
            </ul>
          </motion.div>
        </div>
      </div>
    </SlideLayout>,

    // ===== SLIDE 2: SINCRONIZACIÓN — Two columns (matches PPTX page 3 exactly) =====
    <SlideLayout key="sync" className="bg-white">
      <div className="absolute inset-0 px-[80px] py-[60px]">
        {/* Header */}
        <div className="flex items-center gap-[16px] mb-[32px]">
          <div className="text-[#999]"><SysdeLogo size={40} /></div>
          <h2 className="text-[44px] font-bold text-[#c0392b]">Sincronización</h2>
        </div>

        <div className="grid grid-cols-2 gap-[40px]">
          {/* Left: Actividades realizadas */}
          <div>
            <div className="flex items-center gap-[12px] mb-[24px]">
              <h3 className="text-[32px] font-bold text-[#333]">Actividades realizadas</h3>
              <span className="text-[32px]">✅</span>
            </div>
            <div className="border-l-[3px] border-[#ddd] pl-[20px] space-y-[20px]">
              {actividadesRealizadas.slice(0, 8).map((a, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <div className="flex items-start gap-[10px]">
                    <span className="text-[20px] text-[#c0392b] mt-[4px]">➤</span>
                    <div>
                      <p className="text-[20px] text-[#333] leading-[1.4]">{a.text}</p>
                      <p className="text-[18px] mt-[2px]">
                        <span className="font-bold text-[#c0392b]">{a.responsible}</span>
                        {a.dates && a.dates !== a.responsible && (
                          <span className="text-[#666] italic"> – {a.dates}</span>
                        )}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right: Actividades en curso */}
          <div>
            <div className="flex items-center gap-[12px] mb-[24px]">
              <h3 className="text-[32px] font-bold text-[#333]">Actividades en curso</h3>
              <span className="text-[32px]">⚙️</span>
            </div>
            <div className="space-y-[20px]">
              {actividadesEnCurso.slice(0, 5).map((a, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                  <div className="flex items-start gap-[10px]">
                    <span className="text-[20px] text-[#c0392b] mt-[4px]">➤</span>
                    <div>
                      <p className="text-[20px] text-[#333] leading-[1.4]">{a.text}</p>
                      {a.subItems && a.subItems.map((sub, si) => (
                        <p key={si} className="text-[18px] text-[#666] italic ml-[16px]">• {sub}</p>
                      ))}
                      <p className="text-[18px] mt-[2px]">
                        <span className="font-bold text-[#c0392b]">{a.responsible}</span>
                        {a.dates && <span className="text-[#666] italic"> – {a.dates}</span>}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SlideLayout>,

    // ===== SLIDE 3: CRONOGRAMA "re-planificado" (matches PPTX page 4 exactly) =====
    <SlideLayout key="cronograma" className="bg-white">
      <div className="absolute inset-0 px-[80px] py-[60px]">
        <div className="flex items-center gap-[16px] mb-[20px]">
          <div className="text-[#999]"><SysdeLogo size={40} /></div>
          <h2 className="text-[44px] font-bold text-[#c0392b]">Sincronización</h2>
        </div>
        <h3 className="text-[36px] font-bold text-[#333] mb-[32px]">Cronograma "re-planificado"</h3>

        {/* Gantt-style table */}
        <div className="border-[2px] border-[#ccc] rounded-[8px] overflow-hidden">
          {/* Header row */}
          <div className="flex bg-[#c0392b] text-white">
            <div className="w-[80px] px-[16px] py-[14px] text-[18px] font-bold border-r border-white/20">ETAPA</div>
            <div className="flex-1 px-[16px] py-[14px] text-[18px] font-bold border-r border-white/20 text-center">ACTIVIDAD</div>
            {monthLabels.slice(0, 5).map((m, i) => (
              <div key={i} className="w-[140px] px-[8px] py-[14px] text-[16px] font-bold text-center border-r border-white/20 last:border-r-0">
                M{i}<br/><span className="text-[14px] font-normal">{m}</span>
              </div>
            ))}
            {/* Progress column */}
            <div className="w-[120px] px-[8px] py-[14px] text-[16px] font-bold text-center" />
          </div>

          {/* "Gestión de proyecto" row */}
          <div className="flex border-b border-[#ddd] bg-[#e8e8e8]">
            <div className="w-[80px] px-[16px] py-[12px] text-[16px] font-bold text-[#666] border-r border-[#ddd]">Nº</div>
            <div className="flex-1 px-[16px] py-[12px] text-[18px] font-bold text-[#333] text-right border-r border-[#ddd]">Gestión de proyecto</div>
            {monthLabels.slice(0, 5).map((_, i) => (
              <div key={i} className="w-[140px] border-r border-[#ddd] last:border-r-0 relative">
                <div className="absolute inset-y-[8px] left-[8px] right-[8px] bg-[#c0392b]/40 rounded-[4px]" />
              </div>
            ))}
            <div className="w-[120px]" />
          </div>

          {/* Phase rows */}
          {client.phases.map((phase, i) => {
            const isCompleted = phase.status === "completado";
            const isInProgress = phase.status === "en-progreso";
            const barColor = isCompleted ? "#e8b4b4" : isInProgress ? "#e8b4b4" : "#f0d0d0";
            return (
              <motion.div key={phase.name} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className={cn("flex border-b border-[#ddd]", i % 2 === 0 ? "bg-white" : "bg-[#f8f8f8]")}
              >
                <div className="w-[80px] px-[16px] py-[12px] text-[18px] text-[#666] border-r border-[#ddd] text-center">{i + 1}</div>
                <div className="flex-1 px-[16px] py-[12px] text-[18px] text-[#333] border-r border-[#ddd] text-right">{phase.name}</div>
                {monthLabels.slice(0, 5).map((_, mi) => {
                  // Simple bar placement based on phase index
                  const showBar = mi >= Math.floor(i * 0.7) && mi <= Math.floor(i * 0.7) + 1;
                  return (
                    <div key={mi} className="w-[140px] border-r border-[#ddd] last:border-r-0 relative">
                      {showBar && (
                        <div className="absolute inset-y-[10px] left-[8px] right-[8px] rounded-[4px]" style={{ background: barColor }} />
                      )}
                    </div>
                  );
                })}
                <div className="w-[120px] flex items-center justify-center">
                  {i === 0 && (
                    <div className="text-right px-[8px]">
                      <p className="text-[14px] text-[#666]">Planificado</p>
                      <p className="text-[16px] font-bold text-[#333]">{client.progress}%</p>
                      <p className="text-[14px] text-[#666]">Real</p>
                      <p className="text-[16px] font-bold text-[#333]">{client.progress}%</p>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Current date indicator label */}
        <div className="flex justify-end mt-[8px]">
          <div className="flex items-center gap-[8px]">
            <div className="w-[3px] h-[20px] bg-[#0891b2]" />
            <span className="text-[16px] text-[#666]">Fecha actual</span>
          </div>
        </div>
      </div>
    </SlideLayout>,

    // ===== SLIDE 4: COORDINACIÓN — Próximos pasos (matches PPTX page 5) =====
    <SlideLayout key="proximos-pasos" className="bg-white">
      <div className="absolute inset-0 px-[80px] py-[60px]">
        <div className="flex items-center gap-[16px] mb-[20px]">
          <div className="text-[#999]"><SysdeLogo size={40} /></div>
          <h2 className="text-[44px] font-bold text-[#c0392b]">Coordinación</h2>
        </div>
        <h3 className="text-[36px] font-bold text-[#333] mb-[32px]">Próximos pasos</h3>

        {/* Table with Actividad | Dependencia */}
        <div className="border-[2px] border-[#ccc] rounded-[8px] overflow-hidden">
          {/* Header */}
          <div className="flex bg-white border-b-[2px] border-[#ccc]">
            <div className="flex-1 px-[24px] py-[16px] text-[24px] font-bold text-[#333]">Actividad</div>
            <div className="w-[200px] px-[24px] py-[16px] text-[24px] font-bold text-[#333] text-center border-l-[2px] border-[#ccc]">Dependencia</div>
          </div>

          {/* Rows */}
          {proximosPasos.slice(0, 6).map((paso, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="flex border-b border-[#ddd] last:border-b-0"
            >
              <div className="flex-1 px-[24px] py-[16px] border-r-[2px] border-[#ccc]">
                <p className="text-[20px] text-[#333]">
                  <span className="font-bold">{paso.id})</span> {paso.activity}
                </p>
                <p className="text-[18px] mt-[4px]">
                  Responsable: <span className="font-bold text-[#c0392b]">{paso.responsible}</span>
                </p>
                <p className="text-[18px] text-[#666] italic">Fecha: {paso.date}</p>
                {paso.description && (
                  <p className="text-[16px] text-[#999] mt-[4px]">{paso.description}</p>
                )}
              </div>
              <div className="w-[200px] px-[24px] py-[16px] flex items-center justify-center">
                <span className="text-[20px] text-[#333]">{paso.dependency}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </SlideLayout>,

    // ===== SLIDE 5: COORDINACIÓN — Table (matches PPTX page 6 exactly) =====
    <SlideLayout key="coordination-table" className="bg-white">
      <div className="absolute inset-0 px-[80px] py-[60px]">
        <div className="flex items-center gap-[16px] mb-[40px]">
          <div className="text-[#999]"><SysdeLogo size={40} /></div>
          <h2 className="text-[44px] font-bold text-[#c0392b]">Coordinación:</h2>
        </div>

        {/* Blue-header table like PPTX */}
        <div className="border-[2px] border-[#ccc] rounded-[8px] overflow-hidden">
          {/* Header row - dark blue */}
          <div className="flex bg-[#4a6fa5] text-white">
            <div className="w-[60px] px-[12px] py-[14px] text-[18px] font-bold border-r border-white/20">Nº</div>
            <div className="flex-1 px-[16px] py-[14px] text-[18px] font-bold border-r border-white/20">Asunto</div>
            <div className="w-[160px] px-[16px] py-[14px] text-[18px] font-bold border-r border-white/20">Owner</div>
            <div className="w-[120px] px-[16px] py-[14px] text-[18px] font-bold border-r border-white/20">Inicio</div>
            <div className="w-[120px] px-[16px] py-[14px] text-[18px] font-bold border-r border-white/20">Fin</div>
            <div className="w-[120px] px-[16px] py-[14px] text-[18px] font-bold border-r border-white/20">Estado</div>
            <div className="w-[100px] px-[16px] py-[14px] text-[18px] font-bold">FUP</div>
          </div>

          {/* Data rows - alternating light blue / white */}
          {coordinationItems.slice(0, 8).map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={cn("flex border-b border-[#ddd]", i % 2 === 0 ? "bg-[#d6e4f0]" : "bg-white")}
            >
              <div className="w-[60px] px-[12px] py-[14px] text-[18px] text-[#333] border-r border-[#ccc]">{item.num}</div>
              <div className="flex-1 px-[16px] py-[14px] text-[18px] text-[#333] border-r border-[#ccc]">{item.subject}</div>
              <div className="w-[160px] px-[16px] py-[14px] text-[18px] text-[#333] border-r border-[#ccc]">{item.owner}</div>
              <div className="w-[120px] px-[16px] py-[14px] text-[18px] text-[#333] border-r border-[#ccc]">{item.start}</div>
              <div className="w-[120px] px-[16px] py-[14px] text-[18px] text-[#333] border-r border-[#ccc]">{item.end}</div>
              <div className="w-[120px] px-[16px] py-[14px] border-r border-[#ccc]">
                <span className="text-[18px] font-semibold" style={{ color: item.statusColor }}>{item.status}</span>
              </div>
              <div className="w-[100px] px-[16px] py-[14px] text-[18px] text-[#333]">{item.fup}</div>
            </motion.div>
          ))}

          {/* Empty rows to match PPTX feel */}
          {Array.from({ length: Math.max(0, 5 - coordinationItems.length) }).map((_, i) => (
            <div key={`empty-${i}`} className={cn("flex border-b border-[#ddd]", (coordinationItems.length + i) % 2 === 0 ? "bg-[#d6e4f0]" : "bg-white")}>
              <div className="w-[60px] px-[12px] py-[14px] border-r border-[#ccc]">&nbsp;</div>
              <div className="flex-1 px-[16px] py-[14px] border-r border-[#ccc]">&nbsp;</div>
              <div className="w-[160px] px-[16px] py-[14px] border-r border-[#ccc]">&nbsp;</div>
              <div className="w-[120px] px-[16px] py-[14px] border-r border-[#ccc]">&nbsp;</div>
              <div className="w-[120px] px-[16px] py-[14px] border-r border-[#ccc]">&nbsp;</div>
              <div className="w-[120px] px-[16px] py-[14px] border-r border-[#ccc]">&nbsp;</div>
              <div className="w-[100px] px-[16px] py-[14px]">&nbsp;</div>
            </div>
          ))}
        </div>
      </div>
    </SlideLayout>,

    // ===== SLIDE 6: CIERRE (matches PPTX page 7) =====
    <SlideLayout key="close" className="bg-[#c0392b]">
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-center">
          <h2 className="text-[48px] text-white/80 mb-[16px]">Somos tus aliados para la</h2>
          <h2 className="text-[64px] font-extrabold text-white mb-[48px]">Transformación Digital de tu negocio</h2>
          <div className="w-[200px] h-[3px] bg-white/30 rounded-full mx-auto mb-[48px]" />
          <div className="text-white mb-[48px]">
            <SysdeLogo size={80} />
          </div>
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

            {/* Drilldown for tasks */}
            <AnimatePresence>
              {drilldownTasks && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-30"
                  onClick={e => { if (e.target === e.currentTarget) setDrilldownTasks(false); }}
                >
                  <ScaledSlide containerRef={containerRef}>
                    <div className="w-[1920px] h-[1080px] relative bg-white flex flex-col">
                      <div className="px-[80px] py-[40px] flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-[20px]">
                          <div className="w-[12px] h-[56px] rounded-full bg-[#c0392b]" />
                          <h2 className="text-[48px] font-bold text-[#333]">Todas las Tareas ({client.tasks.length})</h2>
                        </div>
                        <button onClick={() => setDrilldownTasks(false)} className="p-[16px] rounded-full hover:bg-[#f0f0f0] transition-colors">
                          <X style={{ width: 32, height: 32, color: "#999" }} />
                        </button>
                      </div>
                      <div className="flex-1 overflow-auto px-[80px] pb-[60px] space-y-[16px]">
                        {client.tasks.map((t, i) => (
                          <EditableTaskRow key={t.id} task={t} clientId={client.id} i={i} queryClient={qc} />
                        ))}
                      </div>
                    </div>
                  </ScaledSlide>
                </motion.div>
              )}
            </AnimatePresence>

            {currentSlide > 0 && !drilldownTasks && (
              <button onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"><ChevronLeft className="h-6 w-6" /></button>
            )}
            {currentSlide < totalSlides - 1 && !drilldownTasks && (
              <button onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"><ChevronRight className="h-6 w-6" /></button>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 px-4 py-3 bg-black/50 shrink-0">
            {slideNames.map((name, i) => (
              <button key={i} onClick={() => { setDrilldownTasks(false); setCurrentSlide(i); }}
                className={cn("px-3 py-1.5 rounded-lg text-xs transition-all", i === currentSlide ? "bg-white/20 text-white font-medium" : "text-white/40 hover:text-white/70 hover:bg-white/5")}
              >{name}</button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
