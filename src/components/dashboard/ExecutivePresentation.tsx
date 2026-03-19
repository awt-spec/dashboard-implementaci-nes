import { useState, useCallback, useRef, useEffect } from "react";
import { type Client } from "@/data/projectData";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Maximize2, Minimize2, X, Download,
  BarChart3, AlertTriangle, FileCheck, Users, TrendingUp, CheckCircle2
} from "lucide-react";
import sysdeLogo from "@/assets/sysde_default_logo.png";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  SlideLayout, ScaledSlide, SysdeLogo, EditDisabledContext,
} from "@/components/clients/presentation/slideHelpers";

interface ExecutivePresentationProps {
  clients: Client[];
  open: boolean;
  onClose: () => void;
}

export function ExecutivePresentation({ clients, open, onClose }: ExecutivePresentationProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const activeClients = clients.filter(c => c.status === "activo").length;
  const atRisk = clients.filter(c => c.status === "en-riesgo").length;
  const completed = clients.filter(c => c.status === "completado").length;
  const avgProgress = Math.round(clients.reduce((s, c) => s + c.progress, 0) / clients.length);
  const allTasks = clients.flatMap(c => c.tasks);
  const totalRisks = clients.reduce((s, c) => s + c.risks.filter(r => r.status === "abierto").length, 0);
  const allDeliverables = clients.flatMap(c => c.deliverables);

  const slideNames = ["Portada", "KPIs", "Progreso", "Tareas", "Entregables", "Riesgos", "Cierre"];
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
    if (!isFullscreen && wrapperRef.current) {
      await wrapperRef.current.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  const handleExportPdf = async () => {
    const html2canvas = (await import("html2canvas")).default;
    const jsPDF = (await import("jspdf")).default;
    const doc = new jsPDF({ orientation: "landscape", unit: "px", format: [1920, 1080] });
    const savedSlide = currentSlide;
    toast.info("Exportando PDF...");
    for (let i = 0; i < totalSlides; i++) {
      setCurrentSlide(i);
      await new Promise(r => setTimeout(r, 600));
      const slideEl = slideRef.current;
      if (!slideEl) continue;
      const canvas = await html2canvas(slideEl, { scale: 1, useCORS: true, width: 1920, height: 1080, windowWidth: 1920, windowHeight: 1080 });
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      if (i > 0) doc.addPage([1920, 1080], "landscape");
      doc.addImage(imgData, "JPEG", 0, 0, 1920, 1080);
    }
    setCurrentSlide(savedSlide);
    doc.save(`Resumen_Ejecutivo_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF exportado");
  };

  if (!open) return null;

  // ── SLIDES ──

  const slidePortada = (
    <SlideLayout key="cover" className="bg-white">
      <div className="absolute inset-0 flex">
        <div className="w-[520px] h-full bg-[#c0392b] flex flex-col justify-between py-[80px] px-[60px]">
          <div>
            <div className="text-white/80"><SysdeLogo size={64} /></div>
            <p className="text-[18px] text-white/60 uppercase tracking-[3px] mt-[20px]">Sysde</p>
          </div>
          <div>
            <p className="text-[22px] text-white font-bold">Resumen Ejecutivo</p>
            <p className="text-[18px] text-white/60 mt-[4px]">Todas las Implementaciones</p>
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-center px-[120px] bg-white">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <p className="text-[20px] text-[#999] uppercase tracking-[4px] mb-[16px]">SERVICIOS Y TECNOLOGÍA QUE GENERAN VALOR A LA INDUSTRIA FINANCIERA</p>
            <h1 className="text-[64px] font-bold text-[#333] leading-[1.1] mb-[32px]">Resumen Ejecutivo Global</h1>
            <h2 className="text-[48px] font-extrabold text-[#c0392b] mb-[40px]">{clients.length} Implementaciones</h2>
            <div className="w-[80px] h-[4px] bg-[#c0392b] mb-[40px]" />
            <p className="text-[24px] text-[#666] mb-[8px]">{new Date().toLocaleDateString("es", { day: "2-digit", month: "long", year: "numeric" })}</p>
          </motion.div>
        </div>
      </div>
    </SlideLayout>
  );

  const slideKpis = (
    <SlideLayout key="kpis" className="bg-white">
      <div className="absolute left-0 top-0 bottom-0 w-[12px] bg-[#c0392b]" />
      <div className="absolute inset-0 px-[100px] py-[60px]">
        <p className="text-[20px] font-bold text-[#c0392b] uppercase tracking-[2px]">INDICADORES CLAVE</p>
        <h2 className="text-[48px] font-bold text-[#333] mt-[8px] mb-[48px]">KPIs Principales</h2>
        <div className="grid grid-cols-4 gap-[32px]">
          {[
            { label: "Clientes Activos", value: activeClients.toString(), icon: Users, color: "#27ae60" },
            { label: "En Riesgo", value: atRisk.toString(), icon: AlertTriangle, color: "#c0392b" },
            { label: "Completados", value: completed.toString(), icon: CheckCircle2, color: "#3b82f6" },
            { label: "Progreso Promedio", value: `${avgProgress}%`, icon: TrendingUp, color: "#e67e22" },
            { label: "Total Tareas", value: allTasks.length.toString(), icon: BarChart3, color: "#8e44ad" },
            { label: "Tareas Completadas", value: allTasks.filter(t => t.status === "completada").length.toString(), icon: CheckCircle2, color: "#27ae60" },
            { label: "Riesgos Abiertos", value: totalRisks.toString(), icon: AlertTriangle, color: "#c0392b" },
            { label: "Total Entregables", value: allDeliverables.length.toString(), icon: FileCheck, color: "#3b82f6" },
          ].map((kpi, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }}
              className="bg-[#fafafa] border-[2px] border-[#eee] rounded-[16px] p-[32px] text-center">
              <div className="w-[64px] h-[64px] rounded-[16px] flex items-center justify-center mx-auto mb-[16px]" style={{ background: kpi.color + "15" }}>
                <kpi.icon style={{ width: 32, height: 32, color: kpi.color }} />
              </div>
              <p className="text-[48px] font-extrabold text-[#333]">{kpi.value}</p>
              <p className="text-[18px] text-[#999] mt-[8px]">{kpi.label}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </SlideLayout>
  );

  const slideProgreso = (
    <SlideLayout key="progress" className="bg-white">
      <div className="absolute left-0 top-0 bottom-0 w-[12px] bg-[#c0392b]" />
      <div className="absolute inset-0 px-[100px] py-[60px]">
        <p className="text-[20px] font-bold text-[#c0392b] uppercase tracking-[2px]">SINCRONIZACIÓN</p>
        <h2 className="text-[48px] font-bold text-[#333] mt-[8px] mb-[40px]">Progreso por Cliente</h2>
        <div className="space-y-[28px]">
          {clients.map((c, i) => {
            const barColor = c.status === "en-riesgo" ? "#c0392b" : c.progress >= 80 ? "#27ae60" : c.progress >= 40 ? "#e67e22" : "#3b82f6";
            const statusLabel = c.status === "activo" ? "Activo" : c.status === "en-riesgo" ? "En Riesgo" : c.status === "completado" ? "Completado" : "Pausado";
            const statusColor = c.status === "en-riesgo" ? "#c0392b" : c.status === "activo" ? "#27ae60" : c.status === "completado" ? "#3b82f6" : "#999";
            return (
              <motion.div key={c.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="flex items-center gap-[24px]">
                <span className="text-[22px] font-bold text-[#333] w-[300px] truncate">{c.name}</span>
                <div className="flex-1 relative h-[32px] bg-[#e8e8e8] rounded-[6px] overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${c.progress}%` }} transition={{ duration: 0.8, delay: 0.2 + i * 0.08 }}
                    className="absolute inset-y-0 left-0 rounded-[6px]" style={{ background: barColor }} />
                </div>
                <span className="text-[24px] font-extrabold w-[80px] text-right" style={{ color: barColor }}>{c.progress}%</span>
                <span className="text-[16px] font-semibold px-[16px] py-[6px] rounded-full w-[140px] text-center" style={{ background: statusColor + "15", color: statusColor }}>{statusLabel}</span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </SlideLayout>
  );

  const slideTareas = (
    <SlideLayout key="tasks" className="bg-white">
      <div className="absolute left-0 top-0 bottom-0 w-[12px] bg-[#c0392b]" />
      <div className="absolute inset-0 px-[80px] py-[50px]">
        <p className="text-[20px] font-bold text-[#c0392b] uppercase tracking-[2px]">COORDINACIÓN</p>
        <h2 className="text-[44px] font-bold text-[#333] mt-[8px] mb-[32px]">Resumen de Tareas por Cliente</h2>
        <div className="rounded-[16px] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-[#eee]">
          <div className="flex bg-gradient-to-r from-[#c0392b] to-[#a0302b]">
            <div className="flex-1 px-[24px] py-[16px] text-[20px] font-bold text-white">Cliente</div>
            <div className="w-[140px] px-[16px] py-[16px] text-[18px] font-bold text-white text-center border-l border-white/10">Total</div>
            <div className="w-[140px] px-[16px] py-[16px] text-[18px] font-bold text-white text-center border-l border-white/10">Completadas</div>
            <div className="w-[140px] px-[16px] py-[16px] text-[18px] font-bold text-white text-center border-l border-white/10">En Progreso</div>
            <div className="w-[140px] px-[16px] py-[16px] text-[18px] font-bold text-white text-center border-l border-white/10">Pendientes</div>
            <div className="w-[140px] px-[16px] py-[16px] text-[18px] font-bold text-white text-center border-l border-white/10">Bloqueadas</div>
          </div>
          {clients.map((c, i) => {
            const comp = c.tasks.filter(t => t.status === "completada").length;
            const prog = c.tasks.filter(t => t.status === "en-progreso").length;
            const pend = c.tasks.filter(t => t.status === "pendiente").length;
            const bloq = c.tasks.filter(t => t.status === "bloqueada").length;
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={cn("flex border-b border-[#f0f0f0]", i % 2 === 0 ? "bg-white" : "bg-[#fafafa]")}>
                <div className="flex-1 px-[24px] py-[18px] text-[20px] text-[#333] font-medium">{c.name}</div>
                <div className="w-[140px] px-[16px] py-[18px] text-[20px] font-bold text-[#333] text-center border-l border-[#f0f0f0]">{c.tasks.length}</div>
                <div className="w-[140px] px-[16px] py-[18px] text-[20px] font-bold text-[#27ae60] text-center border-l border-[#f0f0f0]">{comp}</div>
                <div className="w-[140px] px-[16px] py-[18px] text-[20px] font-bold text-[#3b82f6] text-center border-l border-[#f0f0f0]">{prog}</div>
                <div className="w-[140px] px-[16px] py-[18px] text-[20px] font-bold text-[#e67e22] text-center border-l border-[#f0f0f0]">{pend}</div>
                <div className="w-[140px] px-[16px] py-[18px] text-[20px] font-bold text-[#c0392b] text-center border-l border-[#f0f0f0]">{bloq}</div>
              </motion.div>
            );
          })}
          {/* Totals row */}
          <div className="flex bg-[#f5f5f5] border-t-[2px] border-[#c0392b]">
            <div className="flex-1 px-[24px] py-[18px] text-[20px] font-extrabold text-[#333]">TOTAL</div>
            <div className="w-[140px] px-[16px] py-[18px] text-[20px] font-extrabold text-[#333] text-center border-l border-[#ddd]">{allTasks.length}</div>
            <div className="w-[140px] px-[16px] py-[18px] text-[20px] font-extrabold text-[#27ae60] text-center border-l border-[#ddd]">{allTasks.filter(t => t.status === "completada").length}</div>
            <div className="w-[140px] px-[16px] py-[18px] text-[20px] font-extrabold text-[#3b82f6] text-center border-l border-[#ddd]">{allTasks.filter(t => t.status === "en-progreso").length}</div>
            <div className="w-[140px] px-[16px] py-[18px] text-[20px] font-extrabold text-[#e67e22] text-center border-l border-[#ddd]">{allTasks.filter(t => t.status === "pendiente").length}</div>
            <div className="w-[140px] px-[16px] py-[18px] text-[20px] font-extrabold text-[#c0392b] text-center border-l border-[#ddd]">{allTasks.filter(t => t.status === "bloqueada").length}</div>
          </div>
        </div>
      </div>
    </SlideLayout>
  );

  const slideEntregables = (
    <SlideLayout key="entregables" className="bg-white">
      <div className="absolute left-0 top-0 bottom-0 w-[12px] bg-[#c0392b]" />
      <div className="absolute inset-0 px-[80px] py-[50px]">
        <p className="text-[20px] font-bold text-[#c0392b] uppercase tracking-[2px]">ENTREGABLES</p>
        <h2 className="text-[44px] font-bold text-[#333] mt-[8px] mb-[32px]">Entregables por Cliente</h2>
        <div className="rounded-[16px] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-[#eee]">
          <div className="flex bg-gradient-to-r from-[#c0392b] to-[#a0302b]">
            <div className="flex-1 px-[24px] py-[16px] text-[20px] font-bold text-white">Cliente</div>
            <div className="w-[140px] px-[16px] py-[16px] text-[18px] font-bold text-white text-center border-l border-white/10">Total</div>
            <div className="w-[140px] px-[16px] py-[16px] text-[18px] font-bold text-white text-center border-l border-white/10">Aprobados</div>
            <div className="w-[140px] px-[16px] py-[16px] text-[18px] font-bold text-white text-center border-l border-white/10">Entregados</div>
            <div className="w-[140px] px-[16px] py-[16px] text-[18px] font-bold text-white text-center border-l border-white/10">En Revisión</div>
            <div className="w-[140px] px-[16px] py-[16px] text-[18px] font-bold text-white text-center border-l border-white/10">Pendientes</div>
          </div>
          {clients.map((c, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={cn("flex border-b border-[#f0f0f0]", i % 2 === 0 ? "bg-white" : "bg-[#fafafa]")}>
              <div className="flex-1 px-[24px] py-[18px] text-[20px] text-[#333] font-medium">{c.name}</div>
              <div className="w-[140px] px-[16px] py-[18px] text-[20px] font-bold text-[#333] text-center border-l border-[#f0f0f0]">{c.deliverables.length}</div>
              <div className="w-[140px] px-[16px] py-[18px] text-[20px] font-bold text-[#27ae60] text-center border-l border-[#f0f0f0]">{c.deliverables.filter(d => d.status === "aprobado").length}</div>
              <div className="w-[140px] px-[16px] py-[18px] text-[20px] font-bold text-[#3b82f6] text-center border-l border-[#f0f0f0]">{c.deliverables.filter(d => d.status === "entregado").length}</div>
              <div className="w-[140px] px-[16px] py-[18px] text-[20px] font-bold text-[#e67e22] text-center border-l border-[#f0f0f0]">{c.deliverables.filter(d => d.status === "en-revision").length}</div>
              <div className="w-[140px] px-[16px] py-[18px] text-[20px] font-bold text-[#999] text-center border-l border-[#f0f0f0]">{c.deliverables.filter(d => d.status === "pendiente").length}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </SlideLayout>
  );

  const slideRiesgos = (
    <SlideLayout key="riesgos" className="bg-white">
      <div className="absolute left-0 top-0 bottom-0 w-[12px] bg-[#c0392b]" />
      <div className="absolute inset-0 px-[80px] py-[50px]">
        <p className="text-[20px] font-bold text-[#c0392b] uppercase tracking-[2px]">ALERTAS</p>
        <h2 className="text-[44px] font-bold text-[#333] mt-[8px] mb-[32px]">Riesgos Abiertos por Cliente</h2>
        <div className="space-y-[20px]">
          {clients.filter(c => c.risks.some(r => r.status === "abierto")).map((c, ci) => (
            <motion.div key={c.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: ci * 0.08 }}>
              <div className="flex items-center gap-[16px] mb-[12px]">
                <span className="text-[24px] font-bold text-[#333]">{c.name}</span>
                <span className="text-[16px] font-semibold px-[12px] py-[4px] rounded-full bg-[#c0392b]/10 text-[#c0392b]">{c.risks.filter(r => r.status === "abierto").length} abiertos</span>
              </div>
              <div className="space-y-[8px] pl-[20px] border-l-[3px] border-[#c0392b]/20">
                {c.risks.filter(r => r.status === "abierto").slice(0, 3).map((r, ri) => {
                  const ic = r.impact === "alto" ? "#c0392b" : r.impact === "medio" ? "#e67e22" : "#27ae60";
                  return (
                    <div key={ri} className="flex items-start gap-[16px] py-[8px]">
                      <span className="text-[16px] font-bold uppercase px-[12px] py-[4px] rounded-full shrink-0" style={{ background: ic + "15", color: ic }}>{r.impact}</span>
                      <p className="text-[18px] text-[#333] leading-[1.4]">{r.description}</p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </SlideLayout>
  );

  const slideCierre = (
    <SlideLayout key="close" className="bg-[#c0392b]">
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-center">
          <h2 className="text-[48px] text-white/80 mb-[16px]">Somos tus aliados para la</h2>
          <h2 className="text-[64px] font-extrabold text-white mb-[48px]">Transformación Digital de tu negocio</h2>
          <div className="w-[200px] h-[3px] bg-white/30 rounded-full mx-auto mb-[48px]" />
          <img src={sysdeLogo} alt="Sysde" className="h-[100px] object-contain mx-auto mb-[48px]" />
          <p className="text-[28px] text-white/60">Sysde</p>
        </motion.div>
      </div>
    </SlideLayout>
  );

  const slides = [slidePortada, slideKpis, slideProgreso, slideTareas, slideEntregables, slideRiesgos, slideCierre];

  return (
    <AnimatePresence>
      {open && (
        <motion.div ref={wrapperRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          {!isFullscreen && (
            <div className="flex items-center justify-between px-4 py-2 bg-black/50 shrink-0">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/10"><X className="h-5 w-5" /></Button>
                <span className="text-white/50 text-sm">{slideNames[currentSlide]} · {currentSlide + 1}/{totalSlides}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={handleExportPdf} className="text-white/70 hover:text-white hover:bg-white/10 text-xs gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Exportar PDF
                </Button>
                <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white/70 hover:text-white hover:bg-white/10">
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <div className="flex-1 relative overflow-hidden" ref={containerRef}>
            <AnimatePresence mode="wait">
              <motion.div key={currentSlide} initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }} transition={{ duration: 0.3 }} className="absolute inset-0">
                <ScaledSlide containerRef={containerRef} slideRef={slideRef}>
                  <EditDisabledContext.Provider value={true}>
                    {slides[currentSlide]}
                  </EditDisabledContext.Provider>
                </ScaledSlide>
              </motion.div>
            </AnimatePresence>
            {currentSlide > 0 && <button onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"><ChevronLeft className="h-6 w-6" /></button>}
            {currentSlide < totalSlides - 1 && <button onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"><ChevronRight className="h-6 w-6" /></button>}
            {isFullscreen && (
              <button onClick={toggleFullscreen} className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white/50 hover:text-white transition-colors">
                <Minimize2 className="h-5 w-5" />
              </button>
            )}
          </div>

          {!isFullscreen && (
            <div className="flex items-center justify-center gap-1.5 px-4 py-3 bg-black/50 shrink-0 flex-wrap">
              {slideNames.map((name, i) => (
                <button key={i} onClick={() => setCurrentSlide(i)}
                  className={cn("px-2.5 py-1 rounded-lg text-[11px] transition-all", i === currentSlide ? "bg-white/20 text-white font-medium" : "text-white/40 hover:text-white/70 hover:bg-white/5")}>{name}</button>
              ))}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
