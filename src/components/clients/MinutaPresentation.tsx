import { useState, useEffect, useCallback, useRef } from "react";
import { type Client, type ClientTask, type Risk, type ActionItem } from "@/data/projectData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Maximize2, Minimize2, X,
  CheckCircle2, FileText, Sparkles, ArrowRight
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
  { value: "en-progreso", label: "En Progreso", color: "hsl(var(--info))" },
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

// Editable Task Row for presentation
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

  // Categorize tasks
  const completedTasks = client.tasks.filter(t => t.status === "completada");
  const inProgressTasks = client.tasks.filter(t => t.status === "en-progreso");
  const pendingTasks = client.tasks.filter(t => t.status === "pendiente" || t.status === "bloqueada");

  // Compute SPI
  const completedPhases = client.phases.filter(p => p.status === "completado").length;
  const spi = client.phases.length > 0 ? (completedPhases / client.phases.length * 2).toFixed(1) : "1.0";

  const totalSlides = 7;
  const slideNames = ["Portada", "Agenda", "Sincronización", "Avance", "Línea de Tiempo", "Coordinación", "Cierre"];

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

  // Build activity data for "Avance" slide from tasks
  const activityCategories = [
    {
      title: "PLANIFICACIÓN",
      items: client.phases.filter(p => p.status === "completado").map(p => ({
        name: p.name,
        percent: p.progress,
      })),
    },
    {
      title: "EJECUCIÓN — INFRAESTRUCTURA",
      items: client.tasks
        .filter(t => /instalación|vpn|licencia|azure|infra|servidor|ambiente|rdp|acceso/i.test(t.title))
        .map(t => ({
          name: t.title,
          percent: parseInt(t.description?.match(/(\d+)%/)?.[1] || (t.status === "completada" ? "100" : "0")),
        })),
    },
    {
      title: "EJECUCIÓN — PARAMETRIZACIÓN",
      items: client.tasks
        .filter(t => /config|parametr|reglas|seguridad|gestor|cliente|producto|contab|catálogo/i.test(t.title))
        .map(t => ({
          name: t.title,
          percent: parseInt(t.description?.match(/(\d+)%/)?.[1] || (t.status === "completada" ? "100" : "0")),
        })),
    },
  ];

  // Build "Actividades realizadas y en curso" for Sincronización slide
  const actividadesRealizadas = [
    ...client.phases.filter(p => p.status === "completado").map(p => p.name),
    ...completedTasks.map(t => t.title),
  ];
  const actividadesEnCurso = inProgressTasks.map(t => {
    let text = t.title;
    if (t.description) text += ` — ${t.description}`;
    return text;
  });
  const proximosPasos = pendingTasks.map(t => {
    let text = t.title;
    if (t.dueDate) text += ` (${t.dueDate})`;
    return text;
  });

  const slides = [
    // ===== SLIDE 0: PORTADA =====
    <SlideLayout key="cover" className="bg-[hsl(var(--destructive))]">
      <div className="absolute inset-0">
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

    // ===== SLIDE 1: AGENDA =====
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
                <p className="text-[26px] text-[hsl(var(--muted-foreground))] leading-relaxed">Actividades realizadas · Actividades en curso · Avance del proyecto · Cronograma</p>
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

    // ===== SLIDE 2: SINCRONIZACIÓN — Actividades realizadas y en curso (two-column table like PPTX) =====
    <SlideLayout key="sync-activities" className="bg-[hsl(var(--background))]">
      <div className="absolute inset-0 px-[80px] py-[60px]">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center gap-[16px] mb-[40px]">
            <div className="w-[8px] h-[48px] rounded-full bg-[hsl(var(--destructive))]" />
            <h2 className="text-[48px] font-bold text-[hsl(var(--foreground))]">SINCRONIZACIÓN</h2>
          </div>

          {/* Two-column table: Actividades realizadas | Actividades en curso / Próximos pasos */}
          <div className="grid grid-cols-2 gap-0 border-[2px] border-[hsl(var(--border))] rounded-[16px] overflow-hidden">
            {/* Header */}
            <div className="bg-[hsl(var(--destructive))] px-[28px] py-[18px]">
              <p className="text-[24px] font-bold text-white">Actividades realizadas</p>
            </div>
            <div className="bg-[hsl(var(--destructive))] px-[28px] py-[18px] border-l-[2px] border-white/20">
              <p className="text-[24px] font-bold text-white">Actividades en curso / Próximos pasos</p>
            </div>

            {/* Content */}
            <div className="px-[28px] py-[20px] space-y-[12px] border-r-[2px] border-[hsl(var(--border))]">
              {actividadesRealizadas.slice(0, 10).map((a, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-[12px]"
                >
                  <CheckCircle2 style={{ width: 20, height: 20, color: "hsl(var(--success))", marginTop: 4, flexShrink: 0 }} />
                  <p className="text-[20px] text-[hsl(var(--foreground))] leading-[1.4]">{a}</p>
                </motion.div>
              ))}
            </div>
            <div className="px-[28px] py-[20px] space-y-[12px]">
              {actividadesEnCurso.slice(0, 5).map((a, i) => (
                <motion.div key={`cur-${i}`} initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  className="flex items-start gap-[12px]"
                >
                  <div className="w-[20px] h-[20px] rounded-full border-[3px] border-[hsl(var(--info))] mt-[4px] shrink-0" />
                  <p className="text-[20px] text-[hsl(var(--foreground))] leading-[1.4]">{a}</p>
                </motion.div>
              ))}
              {proximosPasos.length > 0 && (
                <>
                  <div className="border-t-[2px] border-[hsl(var(--border))] pt-[12px] mt-[12px]">
                    <p className="text-[18px] font-bold text-[hsl(var(--muted-foreground))] uppercase mb-[12px]">Próximos pasos</p>
                  </div>
                  {proximosPasos.slice(0, 4).map((a, i) => (
                    <motion.div key={`next-${i}`} initial={{ opacity: 0, x: 15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: (i + 5) * 0.05 }}
                      className="flex items-start gap-[12px]"
                    >
                      <div className="w-[20px] h-[20px] rounded-full border-[3px] border-[hsl(var(--warning))] mt-[4px] shrink-0" />
                      <p className="text-[20px] text-[hsl(var(--foreground))] leading-[1.4]">{a}</p>
                    </motion.div>
                  ))}
                </>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </SlideLayout>,

    // ===== SLIDE 3: SINCRONIZACIÓN — Avance de actividades (percentage table like PPTX page 4) =====
    <SlideLayout key="sync-progress" className="bg-[hsl(var(--background))]">
      <div className="absolute inset-0 px-[80px] py-[60px]">
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

          {/* Activity percentage table — two columns like the PPTX */}
          <div className="grid grid-cols-2 gap-[32px]" onClick={() => setDrilldownTasks(true)}>
            {activityCategories.filter(c => c.items.length > 0).map((cat, ci) => (
              <div key={cat.title} className="space-y-[8px]">
                <div className="rounded-[12px] bg-[hsl(var(--destructive)/0.08)] px-[28px] py-[16px]">
                  <p className="text-[22px] font-bold text-[hsl(var(--destructive))] uppercase">{cat.title}</p>
                </div>
                {cat.items.slice(0, 8).map((item, i) => {
                  const pColor = item.percent >= 100 ? "hsl(var(--success))" : item.percent > 0 ? "hsl(var(--info))" : "hsl(var(--warning))";
                  return (
                    <motion.div key={i} initial={{ opacity: 0, x: ci === 0 ? -20 : 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                      className="flex items-center justify-between rounded-[12px] border-[2px] border-[hsl(var(--border))] px-[24px] py-[14px] cursor-pointer hover:border-[hsl(var(--primary)/0.3)] transition-colors"
                    >
                      <p className="text-[20px] text-[hsl(var(--foreground))] truncate flex-1 mr-[16px]">{item.name}</p>
                      <span className="text-[20px] font-bold shrink-0" style={{ color: pColor }}>{item.percent}%</span>
                    </motion.div>
                  );
                })}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </SlideLayout>,

    // ===== SLIDE 4: SINCRONIZACIÓN — Línea de tiempo / Cronograma (Gantt-like) =====
    <SlideLayout key="timeline" className="bg-[hsl(var(--background))]">
      <div className="absolute inset-0 px-[80px] py-[60px]">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center justify-between mb-[48px]">
            <div className="flex items-center gap-[16px]">
              <div className="w-[8px] h-[48px] rounded-full bg-[hsl(var(--destructive))]" />
              <h2 className="text-[48px] font-bold text-[hsl(var(--foreground))]">SINCRONIZACIÓN</h2>
              <span className="text-[28px] text-[hsl(var(--muted-foreground))] ml-[16px]">Línea de tiempo — {client.industry}</span>
            </div>
            <div className="flex items-center gap-[12px] px-[24px] py-[12px] rounded-full bg-[hsl(var(--primary)/0.1)]">
              <span className="text-[22px] text-[hsl(var(--muted-foreground))]">Planif.</span>
              <span className="text-[28px] font-bold text-[hsl(var(--primary))]">{client.progress}%</span>
              <span className="text-[22px] text-[hsl(var(--muted-foreground))]">· Real</span>
              <span className="text-[28px] font-bold text-[hsl(var(--primary))]">{client.progress}%</span>
            </div>
          </div>

          {/* Cronograma table header */}
          <div className="rounded-t-[16px] bg-[hsl(var(--destructive))] px-[28px] py-[14px] flex items-center gap-[16px]">
            <span className="text-[20px] font-bold text-white w-[60px]">#</span>
            <span className="text-[20px] font-bold text-white flex-1">Etapa / Actividad</span>
            <span className="text-[20px] font-bold text-white w-[100px] text-center">%</span>
            <span className="text-[20px] font-bold text-white w-[200px] text-center">Período</span>
            <span className="text-[20px] font-bold text-white w-[160px] text-center">Estado</span>
          </div>
          <div className="border-[2px] border-t-0 border-[hsl(var(--border))] rounded-b-[16px] overflow-hidden">
            {client.phases.map((phase, i) => {
              const statusColor = phase.status === "completado" ? "hsl(var(--success))" : phase.status === "en-progreso" ? "hsl(var(--warning))" : "hsl(var(--muted-foreground))";
              const statusLabel = phase.status === "completado" ? "Completado" : phase.status === "en-progreso" ? "En Progreso" : "Pendiente";
              return (
                <motion.div key={phase.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                  className={cn("px-[28px] py-[16px] flex items-center gap-[16px]", i % 2 === 0 ? "bg-[hsl(var(--muted)/0.3)]" : "")}
                >
                  <span className="text-[20px] font-mono text-[hsl(var(--muted-foreground))] w-[60px]">{String(i).padStart(2, "0")}</span>
                  <div className="flex-1 min-w-0 flex items-center gap-[16px]">
                    <p className="text-[22px] text-[hsl(var(--foreground))] truncate">{phase.name}</p>
                    <div className="flex-1 h-[10px] rounded-full bg-[hsl(var(--muted))] overflow-hidden min-w-[100px]">
                      <motion.div className="h-full rounded-full" style={{ background: statusColor }}
                        initial={{ width: 0 }} animate={{ width: `${phase.progress}%` }} transition={{ delay: 0.3 + i * 0.1, duration: 0.6 }}
                      />
                    </div>
                  </div>
                  <span className="text-[22px] font-bold w-[100px] text-center" style={{ color: statusColor }}>{phase.progress}%</span>
                  <span className="text-[18px] text-[hsl(var(--muted-foreground))] w-[200px] text-center">{phase.startDate} — {phase.endDate}</span>
                  <span className="px-[14px] py-[4px] rounded-full text-[16px] font-semibold text-white w-[160px] text-center" style={{ background: statusColor }}>{statusLabel}</span>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </SlideLayout>,

    // ===== SLIDE 5: COORDINACIÓN — Compromisos y entregables (action items table like PPTX page 7) =====
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
            <span className="text-[20px] font-bold text-white w-[50px]">#</span>
            <span className="text-[20px] font-bold text-white flex-1">Descripción</span>
            <span className="text-[20px] font-bold text-white w-[200px]">Responsable</span>
            <span className="text-[20px] font-bold text-white w-[140px]">Fecha</span>
            <span className="text-[20px] font-bold text-white w-[140px]">Estado</span>
          </div>
          <div className="border-[2px] border-t-0 border-[hsl(var(--border))] rounded-b-[16px] overflow-hidden">
            {client.actionItems.slice(0, 10).map((item, i) => {
              const statusColor = item.status === "completado" ? "hsl(var(--success))" : item.status === "vencido" ? "hsl(var(--destructive))" : "hsl(var(--warning))";
              const statusLabel = item.status === "completado" ? "Hecho" : item.status === "vencido" ? "Vencido" : "Pendiente";
              return (
                <motion.div key={item.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className={cn("px-[28px] py-[16px] flex items-center gap-[16px]", i % 2 === 0 ? "bg-[hsl(var(--muted)/0.3)]" : "")}
                >
                  <span className="text-[20px] font-mono text-[hsl(var(--muted-foreground))] w-[50px]">{i + 1}</span>
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

    // ===== SLIDE 6: CIERRE =====
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

            {/* Drilldown for tasks */}
            <AnimatePresence>
              {drilldownTasks && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 z-30"
                  onClick={e => { if (e.target === e.currentTarget) setDrilldownTasks(false); }}
                >
                  <ScaledSlide containerRef={containerRef}>
                    <div className="w-[1920px] h-[1080px] relative bg-[hsl(var(--background)/0.97)] backdrop-blur-sm flex flex-col">
                      <div className="px-[80px] py-[40px] flex items-center justify-between shrink-0">
                        <div className="flex items-center gap-[20px]">
                          <div className="w-[12px] h-[56px] rounded-full bg-[hsl(var(--primary))]" />
                          <h2 className="text-[48px] font-bold text-[hsl(var(--foreground))]">Todas las Tareas ({client.tasks.length})</h2>
                        </div>
                        <button onClick={() => setDrilldownTasks(false)} className="p-[16px] rounded-full hover:bg-[hsl(var(--muted))] transition-colors">
                          <X style={{ width: 32, height: 32, color: "hsl(var(--muted-foreground))" }} />
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
