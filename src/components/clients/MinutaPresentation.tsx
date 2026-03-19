import { useState, useEffect, useCallback, useRef, createContext, useContext } from "react";
import { type Client, type ClientTask, type Phase } from "@/data/projectData";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Maximize2, Minimize2, X,
  FileText, Sparkles, ArrowRight, Pencil, Table2, Download,
  BarChart3, Target, Zap, Clock, CheckCircle2, AlertTriangle, ListChecks
} from "lucide-react";
import sysdeLogo from "@/assets/sysde_default_logo.png";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ensureTaskInDb } from "@/lib/ensureTaskInDb";
import {
  SlideLayout, ScaledSlide, SysdeLogo, EditableText, EditableCell,
  EditDisabledContext,
  loadSlideTexts, saveSlideTexts, extractProgress,
  getMonthRange, getPhaseBarStyle, getCurrentDatePosition,
  type SlideTexts,
} from "./presentation/slideHelpers";
import { aurumCronogramaRows, aurumCompromisosRows, type CronogramaRow, type CompromisoRow } from "./presentation/aurumCronogramaData";
import {
  TableEditorPanel, CronogramaEditor, CompromisosEditor, CoordinationEditor,
  TimelineEditor, ActivityEditor, EntregablesEditor, RiesgosEditor,
  type CoordinationRow, type TimelineRow, type ActivityEditorItem, type EntregableRow, type RiesgoRow,
} from "./presentation/TableEditorPanel";

interface MinutaPresentationProps {
  client: Client;
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
}

// Context for fullscreen state (disables editing)
const PresentationModeContext = createContext(false);

// ── Activity Groups ─────────────────────────────────────

interface ActivityItem { label: string; progress: number; taskId?: number; status: "completed" | "in-progress" | "pending"; }
interface ActivityGroup { title: string; items: ActivityItem[]; }

function buildActivityGroups(client: Client): ActivityGroup[] {
  const groups: ActivityGroup[] = [];
  if (client.id === "aurum") {
    groups.push({ title: "PLANIFICACIÓN", items: [
      { label: "Sesiones discovery generales", progress: 100, status: "completed" },
      { label: "Kickoff", progress: 100, status: "completed" },
      { label: "Planeación trabajo detallado", progress: 100, status: "completed" },
      { label: "Planeación de cronograma", progress: 100, status: "completed" },
      { label: "Envío plan y cronograma", progress: 100, status: "completed" },
    ]});
    groups.push({ title: "EJECUCIÓN — INFRAESTRUCTURA", items: [
      { label: "Instalación ambientes Azure", progress: 100, status: "completed" },
      { label: "Registro licencias", progress: 100, status: "completed" },
      { label: "Instalación aplicativos baseline", progress: 100, status: "completed" },
      { label: "Configuración acceso VPN, RDP", progress: extractProgress(client.tasks.find(t => t.id === 1006)?.description) ?? 85, taskId: 1006, status: "in-progress" },
    ]});
    groups.push({ title: "EJECUCIÓN — PARAMETRIZACIÓN", items: [
      { label: "Sesiones entendimiento de negocio", progress: 100, status: "completed" },
      { label: "Parametrización general", progress: extractProgress(client.tasks.find(t => t.id === 1001)?.description) ?? 30, taskId: 1001, status: "in-progress" },
      { label: "Configuración clientes", progress: extractProgress(client.tasks.find(t => t.id === 1002)?.description) ?? 35, taskId: 1002, status: "in-progress" },
      { label: "Configuración seguridad", progress: extractProgress(client.tasks.find(t => t.id === 1003)?.description) ?? 40, taskId: 1003, status: "in-progress" },
      { label: "Config. productos arrendamiento", progress: extractProgress(client.tasks.find(t => t.id === 1004)?.description) ?? 5, taskId: 1004, status: "pending" },
      { label: "Config. productos préstamos", progress: extractProgress(client.tasks.find(t => t.id === 1005)?.description) ?? 5, taskId: 1005, status: "pending" },
      { label: "Gestor de cobro / notificaciones", progress: extractProgress(client.tasks.find(t => t.id === 1008)?.description) ?? 5, taskId: 1008, status: "pending" },
    ]});
  } else {
    const cp = client.phases.filter(p => p.status === "completado");
    if (cp.length > 0) groups.push({ title: "FASES COMPLETADAS", items: cp.map(p => ({ label: p.name, progress: 100, status: "completed" as const })) });
    const at = client.tasks.filter(t => t.status === "en-progreso" || t.status === "pendiente");
    if (at.length > 0) groups.push({ title: "EJECUCIÓN", items: at.map(t => ({
      label: t.title, progress: extractProgress(t.description) ?? (t.status === "en-progreso" ? 50 : 0), taskId: t.id,
      status: t.status === "en-progreso" ? "in-progress" as const : "pending" as const,
    }))});
  }
  return groups;
}

// ── Editable Progress Bar ───────────────────────────────

function EditableProgressBar({ item, clientId, onUpdate }: { item: ActivityItem; clientId: string; onUpdate: (taskId: number, newProgress: number) => void }) {
  const isFullscreenMode = useContext(PresentationModeContext);
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(item.progress.toString());
  const barColor = item.progress === 100 ? "#27ae60" : item.status === "in-progress" ? "#c0392b" : "#e67e22";
  const handleSave = () => { const n = Math.min(100, Math.max(0, parseInt(val, 10) || 0)); setEditing(false); if (item.taskId) onUpdate(item.taskId, n); };
  return (
    <div className="flex items-center gap-[16px] py-[8px]">
      <span className="text-[20px] text-[#333] w-[400px] truncate">{item.label}</span>
      <div className="flex-1 relative h-[24px] bg-[#e8e8e8] rounded-[4px] overflow-hidden">
        <motion.div initial={{ width: 0 }} animate={{ width: `${item.progress}%` }} transition={{ duration: 0.6, delay: 0.1 }}
          className="absolute inset-y-0 left-0 rounded-[4px]" style={{ background: barColor }} />
        {item.progress === 100 && <span className="absolute inset-0 flex items-center justify-end pr-[8px] text-[14px] font-bold text-white">100%</span>}
      </div>
      {item.progress < 100 && (
        editing ? (
          <div className="flex items-center gap-[4px] w-[80px]">
            <input autoFocus value={val} onChange={e => setVal(e.target.value)} onBlur={handleSave}
              onKeyDown={e => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setEditing(false); }}
              className="w-[50px] text-[18px] text-center border border-[#ccc] rounded px-[4px] py-[2px]" />
            <span className="text-[16px] text-[#666]">%</span>
          </div>
        ) : (
          <button onClick={() => { if (item.taskId && !isFullscreenMode) { setVal(item.progress.toString()); setEditing(true); } }}
            className={cn("text-[18px] font-bold w-[60px] text-right", item.taskId && !isFullscreenMode ? "cursor-pointer hover:text-[#c0392b]" : "cursor-default",
              item.status === "in-progress" ? "text-[#c0392b]" : "text-[#e67e22]")}>{item.progress}%</button>
        )
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// ── MAIN COMPONENT ──────────────────────────────────────
// ══════════════════════════════════════════════════════════

export function MinutaPresentation({ client, open, onClose, onContinue }: MinutaPresentationProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  // Text state
  const [texts, setTexts] = useState<SlideTexts>(() => loadSlideTexts(client.id));
  useEffect(() => { setTexts(loadSlideTexts(client.id)); }, [client.id]);
  const txt = (key: string, fb: string): string => texts[key] ?? fb;
  const setTxt = (key: string, v: string) => { const n = { ...texts, [key]: v }; setTexts(n); saveSlideTexts(client.id, n); toast.success("Guardado"); };

  // Cronograma data
  const [cronograma, setCronograma] = useState<CronogramaRow[]>(() => {
    try { const r = localStorage.getItem(`ppt-crono-${client.id}`); return r ? JSON.parse(r) : (client.id === "aurum" ? aurumCronogramaRows : []); } catch { return client.id === "aurum" ? aurumCronogramaRows : []; }
  });
  const saveCrono = (rows: CronogramaRow[]) => { setCronograma(rows); localStorage.setItem(`ppt-crono-${client.id}`, JSON.stringify(rows)); };

  // Compromisos data
  const [compromisos, setCompromisos] = useState<CompromisoRow[]>(() => {
    try { const r = localStorage.getItem(`ppt-comp-${client.id}`); return r ? JSON.parse(r) : (client.id === "aurum" ? aurumCompromisosRows : []); } catch { return client.id === "aurum" ? aurumCompromisosRows : []; }
  });
  const saveComp = (rows: CompromisoRow[]) => { setCompromisos(rows); localStorage.setItem(`ppt-comp-${client.id}`, JSON.stringify(rows)); };

  // Coordination data (editable action items)
  const [coordItems, setCoordItems] = useState<CoordinationRow[]>(() => {
    try {
      const r = localStorage.getItem(`ppt-coord-${client.id}`);
      if (r) return JSON.parse(r);
    } catch {}
    return client.actionItems.map((item, i) => ({
      num: i + 1, subject: item.title, owner: item.assignee, date: item.dueDate,
      status: item.status === "completado" ? "Hecho" : item.status === "vencido" ? "Vencido" : "Pendiente",
      fup: item.source?.replace("FUP Semanal ", "") || "",
    }));
  });
  const saveCoord = (rows: CoordinationRow[]) => { setCoordItems(rows); localStorage.setItem(`ppt-coord-${client.id}`, JSON.stringify(rows)); };

  // Próximos pasos (editable)
  const pendingTasks = client.tasks.filter(t => t.status === "pendiente" || t.status === "bloqueada");
  const [proxPasos, setProxPasos] = useState<CoordinationRow[]>(() => {
    try { const r = localStorage.getItem(`ppt-prox-${client.id}`); if (r) return JSON.parse(r); } catch {}
    return pendingTasks.map((t, i) => ({
      num: i + 1, subject: t.title, owner: t.owner, date: t.dueDate,
      status: i === 0 ? "N/A" : `F${i}`, fup: "",
    }));
  });
  const saveProx = (rows: CoordinationRow[]) => { setProxPasos(rows); localStorage.setItem(`ppt-prox-${client.id}`, JSON.stringify(rows)); };

  // Timeline / Gantt data (editable)
  const [timelineRows, setTimelineRows] = useState<TimelineRow[]>(() => {
    try { const r = localStorage.getItem(`ppt-timeline-${client.id}`); if (r) return JSON.parse(r); } catch {}
    return client.phases.map(p => ({ name: p.name, startDate: p.startDate, endDate: p.endDate, status: p.status, progress: p.progress }));
  });
  const saveTimeline = (rows: TimelineRow[]) => { setTimelineRows(rows); localStorage.setItem(`ppt-timeline-${client.id}`, JSON.stringify(rows)); };

  // Activity / Avance data (editable)
  const [activityItems, setActivityItems] = useState<ActivityEditorItem[]>(() => {
    try { const r = localStorage.getItem(`ppt-activity-${client.id}`); if (r) return JSON.parse(r); } catch {}
    const groups = buildActivityGroups(client);
    return groups.flatMap(g => g.items.map(it => ({ label: it.label, progress: it.progress, status: it.status, group: g.title })));
  });
  const saveActivity = (items: ActivityEditorItem[]) => { setActivityItems(items); localStorage.setItem(`ppt-activity-${client.id}`, JSON.stringify(items)); };

  // Entregables data (editable)
  const [entregableRows, setEntregableRows] = useState<EntregableRow[]>(() => {
    try { const r = localStorage.getItem(`ppt-entreg-${client.id}`); if (r) return JSON.parse(r); } catch {}
    return client.deliverables.map(d => ({ id: d.id, name: d.name, date: d.deliveredDate || d.dueDate, status: d.status }));
  });
  const saveEntregables = (rows: EntregableRow[]) => { setEntregableRows(rows); localStorage.setItem(`ppt-entreg-${client.id}`, JSON.stringify(rows)); };

  // Riesgos data (editable)
  const [riesgoRows, setRiesgoRows] = useState<RiesgoRow[]>(() => {
    try { const r = localStorage.getItem(`ppt-riesgos-${client.id}`); if (r) return JSON.parse(r); } catch {}
    return client.risks.map(r => ({ id: r.id, description: r.description, impact: r.impact, status: r.status, mitigation: r.mitigation || "" }));
  });
  const saveRiesgos = (rows: RiesgoRow[]) => { setRiesgoRows(rows); localStorage.setItem(`ppt-riesgos-${client.id}`, JSON.stringify(rows)); };

  // Build data from editable activity items
  const activityGroups = (() => {
    const groups: ActivityGroup[] = [];
    const groupMap = new Map<string, ActivityItem[]>();
    for (const item of activityItems) {
      if (!groupMap.has(item.group)) groupMap.set(item.group, []);
      groupMap.get(item.group)!.push({ label: item.label, progress: item.progress, status: item.status });
    }
    for (const [title, items] of groupMap) groups.push({ title, items });
    return groups;
  })();

  const months = getMonthRange(client.phases, client.contractStart, client.contractEnd);
  const currentDatePos = getCurrentDatePosition(months);

  const handleProgressUpdate = async (taskId: number, newProgress: number) => {
    const task = client.tasks.find(t => t.id === taskId);
    if (!task) return;
    const dbId = await ensureTaskInDb(task, client.id);
    if (!dbId) return;
    const newDesc = task.description ? task.description.replace(/(?:avance|progreso)\s*[:=]?\s*\d+\s*%/i, `Avance ${newProgress}%`) : `Avance ${newProgress}%`;
    const newStatus = newProgress >= 100 ? "completada" : newProgress > 0 ? "en-progreso" : "pendiente";
    await supabase.from("tasks").update({ description: newDesc, status: newStatus }).eq("id", dbId);
    qc.invalidateQueries({ queryKey: ["clients"] });
    toast.success(`${task.title}: ${newProgress}%`);
  };

  // Build gantt rows from editable timeline data
  const ganttRows = timelineRows.map(r => ({
    label: r.name.length > 40 ? r.name.substring(0, 37) + "..." : r.name,
    phase: { name: r.name, status: r.status, progress: r.progress, startDate: r.startDate, endDate: r.endDate } as Phase,
  }));
  const managementPhase: Phase = { name: "Gestión de proyecto", status: "en-progreso", progress: client.progress, startDate: client.contractStart, endDate: client.contractEnd };

  const isAurum = client.id === "aurum";
  const slideNames = isAurum
    ? ["Portada", "Agenda", "Avance", "Cronograma", "Línea de Tiempo", "Próximos Pasos", "Compromisos", "Coordinación", "Entregables", "Riesgos", "Cierre"]
    : ["Portada", "Agenda", "Avance", "Línea de Tiempo", "Próximos Pasos", "Coordinación", "Entregables", "Riesgos", "Cierre"];
  const totalSlides = slideNames.length;

  // Determine which slides have an editor panel
  const currentSlideName = slideNames[currentSlide];
  const hasEditor = ["Cronograma", "Compromisos", "Coordinación", "Próximos Pasos", "Línea de Tiempo", "Avance", "Entregables", "Riesgos"].includes(currentSlideName);

  const next = useCallback(() => setCurrentSlide(s => Math.min(s + 1, totalSlides - 1)), [totalSlides]);
  const prev = useCallback(() => setCurrentSlide(s => Math.max(s - 1, 0)), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      if (e.key === "Escape") { if (editorOpen) setEditorOpen(false); else if (isFullscreen) toggleFullscreen(); else onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, next, prev, isFullscreen, editorOpen]);

  const toggleFullscreen = async () => {
    if (!isFullscreen && wrapperRef.current) {
      setEditorOpen(false); // Close editor when going fullscreen
      await wrapperRef.current.requestFullscreen?.();
      setIsFullscreen(true);
    } else {
      await document.exitFullscreen?.();
      setIsFullscreen(false);
    }
  };

  // PDF export using html2canvas
  const handleExportPdf = async () => {
    const html2canvas = (await import("html2canvas")).default;
    const jsPDF = (await import("jspdf")).default;
    const doc = new jsPDF({ orientation: "landscape", unit: "px", format: [1920, 1080] });
    const savedSlide = currentSlide;
    toast.info("Exportando PDF...");

    for (let i = 0; i < slides.length; i++) {
      setCurrentSlide(i);
      await new Promise(r => setTimeout(r, 600)); // wait for animation + render
      const slideEl = slideRef.current;
      if (!slideEl) continue;
      const canvas = await html2canvas(slideEl, { scale: 1, useCORS: true, width: 1920, height: 1080, windowWidth: 1920, windowHeight: 1080 });
      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      if (i > 0) doc.addPage([1920, 1080], "landscape");
      doc.addImage(imgData, "JPEG", 0, 0, 1920, 1080);
    }

    setCurrentSlide(savedSlide);
    doc.save(`Presentacion_${client.name.replace(/\s+/g, "_")}_${new Date().toISOString().split("T")[0]}.pdf`);
    toast.success("PDF exportado");
  };

  useEffect(() => {
    const h = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", h);
    return () => document.removeEventListener("fullscreenchange", h);
  }, []);

  if (!open) return null;

  // ════════════════════════════════════════════════════════
  // ── SLIDES ─────────────────────────────────────────────
  // ════════════════════════════════════════════════════════

  const slidePortada = (
    <SlideLayout key="cover" className="bg-white">
      <div className="absolute inset-0 flex">
        <div className="w-[520px] h-full bg-[#c0392b] flex flex-col justify-between py-[80px] px-[60px]">
          <div>
            <div className="text-white/80"><SysdeLogo size={64} /></div>
            <EditableText value={txt("cover-company", "Sysde")} onChange={v => setTxt("cover-company", v)} className="text-[18px] text-white/60 uppercase tracking-[3px] mt-[20px] block" tag="p" />
          </div>
          <div>
            <EditableText value={txt("cover-pm", "Fernando Pinto Villarreal")} onChange={v => setTxt("cover-pm", v)} className="text-[22px] text-white font-bold" tag="p" />
            <EditableText value={txt("cover-role", "Project Manager")} onChange={v => setTxt("cover-role", v)} className="text-[18px] text-white/60 mt-[4px]" tag="p" />
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-center px-[120px] bg-white">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <EditableText value={txt("cover-tagline", "SERVICIOS Y TECNOLOGÍA QUE GENERAN VALOR A LA INDUSTRIA FINANCIERA")} onChange={v => setTxt("cover-tagline", v)} className="text-[20px] text-[#999] uppercase tracking-[4px] mb-[16px]" tag="p" />
            <EditableText value={txt("cover-title", "Proyecto Implementación SAF")} onChange={v => setTxt("cover-title", v)} className="text-[64px] font-bold text-[#333] leading-[1.1] mb-[32px]" tag="h1" />
            <EditableText value={txt("cover-client", client.name)} onChange={v => setTxt("cover-client", v)} className="text-[56px] font-extrabold text-[#c0392b] mb-[40px]" tag="h2" />
            <div className="w-[80px] h-[4px] bg-[#c0392b] mb-[40px]" />
            <p className="text-[24px] text-[#666] mb-[8px]">{new Date().toLocaleDateString("es", { day: "2-digit", month: "long", year: "numeric" })}</p>
            <EditableText value={txt("cover-session", "Sesión de Seguimiento")} onChange={v => setTxt("cover-session", v)} className="text-[22px] text-[#999]" tag="p" />
          </motion.div>
        </div>
      </div>
    </SlideLayout>
  );

  // ═══ REDESIGNED AGENDA ═══
  const slideAgenda = (
    <SlideLayout key="agenda" className="bg-white">
      {/* Left red accent strip */}
      <div className="absolute left-0 top-0 bottom-0 w-[12px] bg-[#c0392b]" />
      {/* Background decorative elements */}
      <div className="absolute right-0 top-0 w-[600px] h-[600px] rounded-full bg-[#c0392b]/[0.03] -translate-y-[200px] translate-x-[200px]" />
      <div className="absolute left-[400px] bottom-0 w-[400px] h-[400px] rounded-full bg-[#c0392b]/[0.02] translate-y-[200px]" />

      <div className="absolute inset-0 px-[120px] py-[80px] flex flex-col">
        {/* Top bar with logo and title */}
        <div className="flex items-center justify-between mb-[60px]">
          <div className="flex items-center gap-[20px]">
            <div className="text-[#c0392b]"><SysdeLogo size={56} /></div>
            <div className="h-[40px] w-[3px] bg-[#c0392b]/20" />
            <div>
              <EditableText value={txt("agenda-header", "Agenda")} onChange={v => setTxt("agenda-header", v)} className="text-[52px] font-extrabold text-[#1a1a2e] tracking-tight" tag="h2" />
            </div>
          </div>
          <div className="bg-[#c0392b] text-white px-[32px] py-[12px] rounded-[8px]">
            <p className="text-[16px] font-bold">{client.name}</p>
          </div>
        </div>

        {/* Two-column agenda with numbered cards */}
        <div className="flex-1 grid grid-cols-2 gap-[60px]">
          {/* Sincronización */}
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <div className="flex items-center gap-[16px] mb-[36px]">
              <div className="h-[64px] w-[64px] rounded-[16px] bg-gradient-to-br from-[#c0392b] to-[#a0302b] flex items-center justify-center shadow-lg shadow-[#c0392b]/20">
                <BarChart3 className="text-white" style={{ width: 32, height: 32 }} />
              </div>
              <div>
                <span className="text-[14px] font-bold text-[#c0392b] uppercase tracking-[3px]">01</span>
                <EditableText value={txt("agenda-sync", "Sincronización")} onChange={v => setTxt("agenda-sync", v)} className="text-[36px] font-bold text-[#1a1a2e] leading-tight" tag="h2" />
              </div>
            </div>
            <div className="space-y-[16px] pl-[20px] border-l-[3px] border-[#c0392b]/15">
              {[
                { key: "agenda-s1", def: "Actividades ejecutadas", icon: CheckCircle2, color: "#27ae60" },
                { key: "agenda-s2", def: "Actividades en curso", icon: Clock, color: "#e67e22" },
              ].map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.1 }}
                  className="flex items-center gap-[16px] bg-white rounded-[12px] px-[24px] py-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-[#f0f0f0] hover:shadow-[0_4px_20px_rgba(192,57,43,0.1)] transition-shadow">
                  <div className="h-[44px] w-[44px] rounded-[10px] flex items-center justify-center shrink-0" style={{ background: item.color + "15" }}>
                    <item.icon style={{ width: 22, height: 22, color: item.color }} />
                  </div>
                  <EditableText value={txt(item.key, item.def)} onChange={v => setTxt(item.key, v)} className="text-[26px] text-[#333] font-medium" />
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Coordinación */}
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
            <div className="flex items-center gap-[16px] mb-[36px]">
              <div className="h-[64px] w-[64px] rounded-[16px] bg-gradient-to-br from-[#1a1a2e] to-[#2d2d44] flex items-center justify-center shadow-lg shadow-[#1a1a2e]/20">
                <Target className="text-white" style={{ width: 32, height: 32 }} />
              </div>
              <div>
                <span className="text-[14px] font-bold text-[#1a1a2e] uppercase tracking-[3px]">02</span>
                <EditableText value={txt("agenda-coord", "Coordinación")} onChange={v => setTxt("agenda-coord", v)} className="text-[36px] font-bold text-[#1a1a2e] leading-tight" tag="h2" />
              </div>
            </div>
            <div className="space-y-[16px] pl-[20px] border-l-[3px] border-[#1a1a2e]/15">
              {[
                { key: "agenda-c1", def: "Compromisos y entregables del proyecto", icon: ListChecks, color: "#c0392b" },
                { key: "agenda-c2", def: "Action items & seguimiento", icon: Zap, color: "#8e44ad" },
              ].map((item, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 + i * 0.1 }}
                  className="flex items-center gap-[16px] bg-white rounded-[12px] px-[24px] py-[20px] shadow-[0_2px_12px_rgba(0,0,0,0.06)] border border-[#f0f0f0] hover:shadow-[0_4px_20px_rgba(192,57,43,0.1)] transition-shadow">
                  <div className="h-[44px] w-[44px] rounded-[10px] flex items-center justify-center shrink-0" style={{ background: item.color + "15" }}>
                    <item.icon style={{ width: 22, height: 22, color: item.color }} />
                  </div>
                  <EditableText value={txt(item.key, item.def)} onChange={v => setTxt(item.key, v)} className="text-[26px] text-[#333] font-medium" />
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Bottom decorative bar */}
        <div className="flex items-center gap-[12px] mt-[40px]">
          <div className="flex-1 h-[2px] bg-gradient-to-r from-[#c0392b] to-transparent" />
          <span className="text-[14px] text-[#999] font-medium">FUP Semanal</span>
          <div className="flex-1 h-[2px] bg-gradient-to-l from-[#c0392b] to-transparent" />
        </div>
      </div>
    </SlideLayout>
  );

  const slideAvance = (
    <SlideLayout key="avance" className="bg-white">
      <div className="absolute inset-0 px-[80px] py-[50px]">
        <div className="flex items-start justify-between mb-[24px]">
          <div>
            <p className="text-[20px] font-bold text-[#c0392b] uppercase tracking-[2px]">SINCRONIZACIÓN</p>
            <EditableText value={txt("avance-title", "Avance de actividades")} onChange={v => setTxt("avance-title", v)} className="text-[44px] font-bold text-[#333] mt-[8px]" tag="h2" />
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}
            className="bg-[#c0392b] text-white px-[32px] py-[16px] rounded-[4px] text-right">
            <p className="text-[28px] font-extrabold">SPI 1.0</p>
            <p className="text-[16px] mt-[4px]">Planif. {client.progress}% · Real {client.progress}%</p>
          </motion.div>
        </div>
        <div className="grid grid-cols-2 gap-[48px] mt-[16px]">
          <div className="space-y-[24px]">
            {activityGroups.filter((_, i) => i % 2 === 0).map((g, gi) => (
              <div key={gi}><p className="text-[18px] font-bold text-[#c0392b] uppercase tracking-[1px] mb-[8px] border-b border-[#eee] pb-[4px]">{g.title}</p>
                {g.items.map((it, ii) => <EditableProgressBar key={ii} item={it} clientId={client.id} onUpdate={handleProgressUpdate} />)}</div>))}
          </div>
          <div className="space-y-[24px]">
            {activityGroups.filter((_, i) => i % 2 === 1).map((g, gi) => (
              <div key={gi}><p className="text-[18px] font-bold text-[#c0392b] uppercase tracking-[1px] mb-[8px] border-b border-[#eee] pb-[4px]">{g.title}</p>
                {g.items.map((it, ii) => <EditableProgressBar key={ii} item={it} clientId={client.id} onUpdate={handleProgressUpdate} />)}</div>))}
          </div>
        </div>
      </div>
    </SlideLayout>
  );

  // ═══ CRONOGRAMA (now shows live data from editor) ═══
  const slideCronograma = (
    <SlideLayout key="cronograma" className="bg-white">
      <div className="absolute inset-0 px-[60px] py-[40px] flex flex-col">
        <div className="flex items-start justify-between mb-[16px]">
          <div>
            <p className="text-[20px] font-bold text-[#c0392b] uppercase tracking-[2px]">SINCRONIZACIÓN</p>
            <EditableText value={txt("crono-title", 'Cronograma detallado "Arrendamiento y préstamos"')} onChange={v => setTxt("crono-title", v)} className="text-[38px] font-bold text-[#333] mt-[8px]" tag="h2" />
          </div>
          <div className="text-right text-[16px] text-[#333] space-y-[4px]">
            <p>Planificado: <strong>{client.progress}%</strong></p><p>Real: <strong>{client.progress}%</strong></p><p><strong>SPI: 1</strong></p>
          </div>
        </div>
        <div className="flex-1 overflow-hidden border border-[#ccc] rounded-[4px]">
          <div className="flex bg-[#f5f5f5] border-b border-[#ccc] text-[14px] font-bold text-[#333]">
            <div className="flex-1 px-[12px] py-[8px]">Nombre de tarea</div>
            <div className="w-[100px] px-[8px] py-[8px] text-center border-l border-[#ccc]">Duración</div>
            <div className="w-[80px] px-[8px] py-[8px] text-center border-l border-[#ccc]">%</div>
            <div className="w-[100px] px-[8px] py-[8px] text-center border-l border-[#ccc]">Comienzo</div>
            <div className="w-[100px] px-[8px] py-[8px] text-center border-l border-[#ccc]">Fin</div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: "850px" }}>
            {cronograma.map((row, i) => (
              <div key={i} className={cn("flex border-b border-[#eee] text-[14px]",
                row.isRed ? "bg-[#fef2f2]" : row.isBold ? "bg-[#f8f8f8]" : i % 2 === 0 ? "bg-white" : "bg-[#fafafa]")}>
                <div className="flex-1 px-[12px] py-[6px] truncate" style={{ paddingLeft: `${12 + row.indent * 24}px` }}>
                  <span className={cn("text-[14px]", row.isBold && "font-bold", row.isItalic && "italic", row.isRed && "text-[#c0392b]")}>{row.name}</span>
                </div>
                <div className="w-[100px] px-[8px] py-[6px] text-center border-l border-[#eee] text-[14px]">{row.duration}</div>
                <div className="w-[80px] px-[8px] py-[6px] text-center border-l border-[#eee]">
                  <span className={cn("text-[14px] font-bold", parseInt(row.percent) === 100 ? "text-[#16a34a]" : parseInt(row.percent) > 0 ? "text-[#c0392b]" : "text-[#999]")}>{row.percent}</span>
                </div>
                <div className="w-[100px] px-[8px] py-[6px] text-center border-l border-[#eee] text-[14px]">{row.start}</div>
                <div className="w-[100px] px-[8px] py-[6px] text-center border-l border-[#eee] text-[14px]">{row.end}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideLayout>
  );

  const slideTimeline = (
    <SlideLayout key="timeline" className="bg-white">
      <div className="absolute inset-0 px-[80px] py-[50px]">
        <p className="text-[20px] font-bold text-[#c0392b] uppercase tracking-[2px]">SINCRONIZACIÓN</p>
        <EditableText value={txt("timeline-title", `Línea de tiempo — ${client.industry}`)} onChange={v => setTxt("timeline-title", v)} className="text-[44px] font-bold text-[#333] mt-[8px] mb-[32px]" tag="h2" />
        <div className="relative">
          <div className="flex"><div className="w-[360px] shrink-0" /><div className="flex-1 flex">
            {months.map((m, i) => {
              const isCur = new Date().getFullYear() === m.date.getFullYear() && new Date().getMonth() === m.date.getMonth();
              return <div key={i} className={cn("flex-1 text-center py-[12px] text-[16px] font-semibold", isCur ? "bg-[#c0392b] text-white" : "bg-[#666] text-white")}>{m.label}</div>;
            })}
          </div></div>
          <div className="flex items-center border-b border-[#e0e0e0]">
            <div className="w-[360px] shrink-0 py-[20px] pr-[16px]"><span className="text-[20px] font-semibold text-[#333]">Gestión de proyecto</span></div>
            <div className="flex-1 relative h-[48px]">{(() => { const s = getPhaseBarStyle(managementPhase, months); return <div className="absolute top-[10px] bottom-[10px] rounded-[4px]" style={{ left: s.left, width: s.width, background: "#999" }} />; })()}</div>
          </div>
          {ganttRows.map((row, i) => { const s = getPhaseBarStyle(row.phase, months); return (
            <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className={cn("flex items-center border-b border-[#e0e0e0]", i % 2 === 0 ? "bg-white" : "bg-[#f8f8f8]")}>
              <div className="w-[360px] shrink-0 py-[20px] pr-[16px]"><span className="text-[18px] text-[#333] font-medium">{row.label}</span></div>
              <div className="flex-1 relative h-[48px]"><div className="absolute top-[12px] bottom-[12px] rounded-[4px]" style={{ left: s.left, width: s.width, background: s.color }} /></div>
            </motion.div>); })}
          {currentDatePos && <div className="absolute top-0 bottom-0 z-10" style={{ left: `calc(360px + (100% - 360px) * ${parseFloat(currentDatePos)} / 100)` }}><div className="w-[3px] h-full bg-[#c0392b]" /></div>}
        </div>
      </div>
    </SlideLayout>
  );

  // ═══ REDESIGNED PRÓXIMOS PASOS ═══
  const slideProximos = (
    <SlideLayout key="proximos" className="bg-white">
      <div className="absolute left-0 top-0 bottom-0 w-[12px] bg-[#c0392b]" />
      <div className="absolute inset-0 px-[80px] py-[50px]">
        <div className="flex items-center gap-[20px] mb-[32px]">
          <div className="h-[56px] w-[56px] rounded-[14px] bg-gradient-to-br from-[#c0392b] to-[#a0302b] flex items-center justify-center shadow-lg shadow-[#c0392b]/20">
            <ArrowRight className="text-white" style={{ width: 28, height: 28 }} />
          </div>
          <div>
            <p className="text-[14px] font-bold text-[#c0392b] uppercase tracking-[3px]">COORDINACIÓN</p>
            <EditableText value={txt("proximos-title", "Próximos pasos")} onChange={v => setTxt("proximos-title", v)} className="text-[40px] font-extrabold text-[#1a1a2e]" tag="h2" />
          </div>
        </div>
        {/* Modern card-based table */}
        <div className="rounded-[16px] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-[#eee]">
          <div className="flex bg-gradient-to-r from-[#c0392b] to-[#a0302b]">
            <div className="w-[60px] px-[16px] py-[16px] text-[16px] font-bold text-white/80">#</div>
            <div className="flex-1 px-[20px] py-[16px] text-[18px] font-bold text-white">Actividad</div>
            <div className="w-[200px] px-[20px] py-[16px] text-[18px] font-bold text-white border-l border-white/10">Responsable</div>
            <div className="w-[160px] px-[20px] py-[16px] text-[18px] font-bold text-white border-l border-white/10">Fecha</div>
            <div className="w-[160px] px-[20px] py-[16px] text-[18px] font-bold text-white border-l border-white/10">Dependencia</div>
          </div>
          {proxPasos.slice(0, 8).map((paso, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
              className={cn("flex border-b border-[#f0f0f0] group hover:bg-[#c0392b]/[0.03] transition-colors", i % 2 === 0 ? "bg-white" : "bg-[#fafafa]")}>
              <div className="w-[60px] px-[16px] py-[18px] text-[16px] font-bold text-[#c0392b]">{paso.num}</div>
              <div className="flex-1 px-[20px] py-[18px] text-[18px] text-[#333] font-medium">{paso.subject}</div>
              <div className="w-[200px] px-[20px] py-[18px] text-[18px] font-semibold text-[#c0392b] border-l border-[#f0f0f0]">{paso.owner}</div>
              <div className="w-[160px] px-[20px] py-[18px] text-[18px] text-[#666] border-l border-[#f0f0f0]">{paso.date}</div>
              <div className="w-[160px] px-[20px] py-[18px] border-l border-[#f0f0f0]">
                <span className="text-[16px] px-[12px] py-[4px] rounded-full bg-[#c0392b]/10 text-[#c0392b] font-medium">{paso.status}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </SlideLayout>
  );

  // ═══ COMPROMISOS ═══
  const slideCompromisos = (
    <SlideLayout key="compromisos" className="bg-white">
      <div className="absolute left-0 top-0 bottom-0 w-[12px] bg-[#c0392b]" />
      <div className="absolute inset-0 px-[60px] py-[40px]">
        <p className="text-[20px] font-bold text-[#c0392b] uppercase tracking-[2px]">COORDINACIÓN</p>
        <EditableText value={txt("comp-title", "Compromisos y entregables")} onChange={v => setTxt("comp-title", v)} className="text-[44px] font-bold text-[#333] mt-[8px] mb-[24px]" tag="h2" />
        <div className="rounded-[12px] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-[#eee]">
          <div className="flex bg-gradient-to-r from-[#c0392b] to-[#a0302b] text-white text-[16px] font-bold">
            <div className="w-[50px] px-[12px] py-[14px]">#</div>
            <div className="flex-1 px-[12px] py-[14px]">Descripción</div>
            <div className="w-[160px] px-[12px] py-[14px] border-l border-white/10">Responsable</div>
            <div className="w-[120px] px-[12px] py-[14px] border-l border-white/10">Fecha</div>
            <div className="w-[120px] px-[12px] py-[14px] border-l border-white/10 text-center">Estado</div>
            <div className="flex-1 px-[12px] py-[14px] border-l border-white/10">Comentarios</div>
          </div>
          {compromisos.map((row, i) => {
            const sc: Record<string, { bg: string; text: string }> = { "Hecho": { bg: "#dcfce7", text: "#16a34a" }, "En progreso": { bg: "#fef3c7", text: "#d97706" }, "Pendiente": { bg: "#fee2e2", text: "#dc2626" } };
            const c = sc[row.status] || sc["Pendiente"];
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                className={cn("flex border-b border-[#f0f0f0] text-[16px] hover:bg-[#c0392b]/[0.02] transition-colors", i % 2 === 0 ? "bg-white" : "bg-[#fafafa]")}>
                <div className="w-[50px] px-[12px] py-[12px] text-[#333] font-bold">{row.num}</div>
                <div className="flex-1 px-[12px] py-[12px] text-[#333]">{row.description}</div>
                <div className="w-[160px] px-[12px] py-[12px] font-semibold text-[#c0392b] border-l border-[#f0f0f0]">{row.responsible}</div>
                <div className="w-[120px] px-[12px] py-[12px] text-[#666] border-l border-[#f0f0f0]">{row.date}</div>
                <div className="w-[120px] px-[12px] py-[12px] border-l border-[#f0f0f0] flex items-center justify-center">
                  <span className="px-[12px] py-[4px] rounded-full text-[14px] font-semibold" style={{ background: c.bg, color: c.text }}>{row.status}</span>
                </div>
                <div className="flex-1 px-[12px] py-[12px] text-[#666] border-l border-[#f0f0f0]">{row.comments}</div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </SlideLayout>
  );

  // ═══ REDESIGNED COORDINACIÓN ═══
  const slideCoordination = (
    <SlideLayout key="coordination" className="bg-white">
      <div className="absolute left-0 top-0 bottom-0 w-[12px] bg-[#1a1a2e]" />
      <div className="absolute inset-0 px-[80px] py-[50px]">
        <div className="flex items-center gap-[20px] mb-[32px]">
          <div className="h-[56px] w-[56px] rounded-[14px] bg-gradient-to-br from-[#1a1a2e] to-[#2d2d44] flex items-center justify-center shadow-lg shadow-[#1a1a2e]/20">
            <Zap className="text-white" style={{ width: 28, height: 28 }} />
          </div>
          <div>
            <p className="text-[14px] font-bold text-[#c0392b] uppercase tracking-[3px]">SEGUIMIENTO</p>
            <EditableText value={txt("coord-title", "Action Items")} onChange={v => setTxt("coord-title", v)} className="text-[40px] font-extrabold text-[#1a1a2e]" tag="h2" />
          </div>
        </div>
        <div className="rounded-[16px] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-[#eee]">
          <div className="flex bg-gradient-to-r from-[#1a1a2e] to-[#2d2d44]">
            <div className="w-[50px] px-[12px] py-[16px] text-[16px] font-bold text-white/60">Nº</div>
            <div className="flex-1 px-[16px] py-[16px] text-[18px] font-bold text-white">Asunto</div>
            <div className="w-[180px] px-[16px] py-[16px] text-[18px] font-bold text-white border-l border-white/10">Owner</div>
            <div className="w-[140px] px-[16px] py-[16px] text-[18px] font-bold text-white border-l border-white/10">Fecha</div>
            <div className="w-[130px] px-[16px] py-[16px] text-[18px] font-bold text-white border-l border-white/10">Estado</div>
            <div className="w-[140px] px-[16px] py-[16px] text-[18px] font-bold text-white border-l border-white/10">FUP</div>
          </div>
          {coordItems.slice(0, 8).map((item, i) => {
            const sc: Record<string, string> = { "Hecho": "#22c55e", "Pendiente": "#f59e0b", "Vencido": "#ef4444" };
            const color = sc[item.status] || "#f59e0b";
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={cn("flex border-b border-[#f0f0f0] hover:bg-[#1a1a2e]/[0.02] transition-colors", i % 2 === 0 ? "bg-[#f8f9fc]" : "bg-white")}>
                <div className="w-[50px] px-[12px] py-[16px] text-[18px] text-[#1a1a2e] font-bold">{item.num}</div>
                <div className="flex-1 px-[16px] py-[16px] text-[18px] text-[#333]">{item.subject}</div>
                <div className="w-[180px] px-[16px] py-[16px] text-[18px] font-semibold text-[#1a1a2e] border-l border-[#f0f0f0]">{item.owner}</div>
                <div className="w-[140px] px-[16px] py-[16px] text-[18px] text-[#666] border-l border-[#f0f0f0]">{item.date}</div>
                <div className="w-[130px] px-[16px] py-[16px] border-l border-[#f0f0f0]">
                  <span className="text-[16px] font-semibold px-[12px] py-[4px] rounded-full" style={{ background: color + "18", color }}>{item.status}</span>
                </div>
                <div className="w-[140px] px-[16px] py-[16px] text-[16px] text-[#999] border-l border-[#f0f0f0]">{item.fup}</div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </SlideLayout>
  );

  const slideEntregables = (
    <SlideLayout key="entregables" className="bg-white">
      <div className="absolute inset-0 px-[80px] py-[60px]">
        <div className="flex items-center gap-[16px] mb-[40px]"><div className="text-[#999]"><SysdeLogo size={40} /></div>
          <EditableText value={txt("entregables-title", "Entregables")} onChange={v => setTxt("entregables-title", v)} className="text-[44px] font-bold text-[#c0392b]" tag="h2" /></div>
        <div className="border-[2px] border-[#ccc] rounded-[8px] overflow-hidden">
          <div className="flex bg-[#c0392b] text-white">
            <div className="w-[120px] px-[16px] py-[14px] text-[18px] font-bold border-r border-white/20">ID</div>
            <div className="flex-1 px-[16px] py-[14px] text-[18px] font-bold border-r border-white/20">Entregable</div>
            <div className="w-[160px] px-[16px] py-[14px] text-[18px] font-bold border-r border-white/20">Fecha</div>
            <div className="w-[160px] px-[16px] py-[14px] text-[18px] font-bold">Estado</div>
          </div>
          {entregableRows.slice(0, 10).map((d, i) => {
            const color = d.status === "aprobado" ? "#27ae60" : d.status === "entregado" ? "#3b82f6" : d.status === "en-revision" ? "#e67e22" : "#999";
            const label = d.status === "aprobado" ? "Aprobado" : d.status === "entregado" ? "Entregado" : d.status === "en-revision" ? "En Revisión" : "Pendiente";
            return (<motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className={cn("flex border-b border-[#ddd]", i % 2 === 0 ? "bg-[#fdf2f2]" : "bg-white")}>
              <div className="w-[120px] px-[16px] py-[14px] text-[18px] text-[#666] font-mono border-r border-[#ddd]">{d.id}</div>
              <div className="flex-1 px-[16px] py-[14px] text-[18px] text-[#333] border-r border-[#ddd]">{d.name}</div>
              <div className="w-[160px] px-[16px] py-[14px] text-[18px] text-[#666] border-r border-[#ddd]">{d.date}</div>
              <div className="w-[160px] px-[16px] py-[14px]"><span className="text-[18px] font-semibold" style={{ color }}>{label}</span></div>
            </motion.div>);
          })}
        </div>
      </div>
    </SlideLayout>
  );

  const slideRiesgos = (
    <SlideLayout key="riesgos" className="bg-white">
      <div className="absolute inset-0 px-[80px] py-[60px]">
        <div className="flex items-center gap-[16px] mb-[40px]"><div className="text-[#999]"><SysdeLogo size={40} /></div>
          <EditableText value={txt("riesgos-title", "Riesgos del Proyecto")} onChange={v => setTxt("riesgos-title", v)} className="text-[44px] font-bold text-[#c0392b]" tag="h2" /></div>
        <div className="space-y-[24px]">
          {riesgoRows.map((risk, i) => {
            const ic = risk.impact === "alto" ? "#c0392b" : risk.impact === "medio" ? "#e67e22" : "#27ae60";
            const sl = risk.status === "abierto" ? "Abierto" : risk.status === "mitigado" ? "Mitigado" : "Cerrado";
            return (<motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
              className="border-[2px] border-[#ddd] rounded-[8px] px-[32px] py-[24px] flex items-start gap-[24px]">
              <div className="w-[80px] h-[80px] rounded-[8px] flex flex-col items-center justify-center shrink-0" style={{ background: ic + "20" }}>
                <span className="text-[14px] font-bold uppercase" style={{ color: ic }}>Impacto</span>
                <span className="text-[24px] font-extrabold capitalize" style={{ color: ic }}>{risk.impact}</span>
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-[16px] mb-[8px]">
                  <span className="text-[16px] font-mono text-[#999]">{risk.id}</span>
                  <span className="px-[12px] py-[4px] rounded-full text-[14px] font-bold" style={{ background: risk.status === "abierto" ? "#fef2f2" : "#f0fdf4", color: risk.status === "abierto" ? "#c0392b" : "#27ae60" }}>{sl}</span>
                </div>
                <p className="text-[22px] text-[#333] leading-[1.4]">{risk.description}</p>
                {risk.mitigation && <p className="text-[18px] text-[#666] mt-[8px] italic">{risk.mitigation}</p>}
              </div>
            </motion.div>);
          })}
        </div>
      </div>
    </SlideLayout>
  );


  const slideCierre = (
    <SlideLayout key="close" className="bg-[#c0392b]">
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-center">
          <EditableText value={txt("cierre-1", "Somos tus aliados para la")} onChange={v => setTxt("cierre-1", v)} className="text-[48px] text-white/80 mb-[16px]" tag="h2" />
          <EditableText value={txt("cierre-2", "Transformación Digital de tu negocio")} onChange={v => setTxt("cierre-2", v)} className="text-[64px] font-extrabold text-white mb-[48px]" tag="h2" />
          <div className="w-[200px] h-[3px] bg-white/30 rounded-full mx-auto mb-[48px]" />
          <img src={sysdeLogo} alt="Sysde" className="h-[100px] object-contain mx-auto mb-[48px]" />
          <EditableText value={txt("cierre-brand", "Sysde")} onChange={v => setTxt("cierre-brand", v)} className="text-[28px] text-white/60 mb-[64px]" tag="p" />
          <button onClick={onContinue} className="px-[56px] py-[20px] rounded-[16px] bg-white text-[#c0392b] text-[28px] font-bold hover:bg-white/90 transition-colors shadow-2xl flex items-center gap-[16px] mx-auto">
            <FileText style={{ width: 28, height: 28 }} />Crear Nueva Minuta<ArrowRight style={{ width: 28, height: 28 }} />
          </button>
        </motion.div>
      </div>
    </SlideLayout>
  );

  const slides = isAurum
    ? [slidePortada, slideAgenda, slideAvance, slideCronograma, slideTimeline, slideProximos, slideCompromisos, slideCoordination, slideEntregables, slideRiesgos, slideCierre]
    : [slidePortada, slideAgenda, slideAvance, slideTimeline, slideProximos, slideCoordination, slideEntregables, slideRiesgos, slideCierre];

  // ── Editor panel content ──
  const editorContent = (() => {
    if (currentSlideName === "Cronograma") return <CronogramaEditor rows={cronograma} onChange={saveCrono} />;
    if (currentSlideName === "Compromisos") return <CompromisosEditor rows={compromisos} onChange={saveComp} />;
    if (currentSlideName === "Coordinación") return <CoordinationEditor rows={coordItems} onChange={saveCoord} />;
    if (currentSlideName === "Próximos Pasos") return <CoordinationEditor rows={proxPasos} onChange={saveProx} />;
    if (currentSlideName === "Línea de Tiempo") return <TimelineEditor rows={timelineRows} onChange={saveTimeline} />;
    if (currentSlideName === "Avance") return <ActivityEditor items={activityItems} onChange={saveActivity} />;
    if (currentSlideName === "Entregables") return <EntregablesEditor rows={entregableRows} onChange={saveEntregables} />;
    if (currentSlideName === "Riesgos") return <RiesgosEditor rows={riesgoRows} onChange={saveRiesgos} />;
    return null;
  })();

  return (
    <AnimatePresence>
      {open && (
        <motion.div ref={wrapperRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          {/* Top bar - hidden in fullscreen */}
          {!isFullscreen && (
            <div className="flex items-center justify-between px-4 py-2 bg-black/50 shrink-0">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/10"><X className="h-5 w-5" /></Button>
                <span className="text-white/50 text-sm">{slideNames[currentSlide]} · {currentSlide + 1}/{totalSlides}</span>
              </div>
              <div className="flex items-center gap-2">
                {hasEditor && (
                  <Button variant="ghost" size="sm" onClick={() => setEditorOpen(!editorOpen)}
                    className={cn("text-xs gap-1.5 transition-colors",
                      editorOpen ? "text-[#ff6b6b] bg-[#c0392b]/20 hover:bg-[#c0392b]/30 hover:text-[#ff6b6b]" : "text-white/70 hover:text-white hover:bg-white/10")}>
                    <Table2 className="h-3.5 w-3.5" /> {editorOpen ? "Cerrar Editor" : "Editar Tabla"}
                  </Button>
                )}
                <span className="text-white/30 text-xs flex items-center gap-1"><Pencil className="h-3 w-3" /> Clic para editar</span>
                <Button variant="ghost" size="sm" onClick={handleExportPdf} className="text-white/70 hover:text-white hover:bg-white/10 text-xs gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Exportar PDF
                </Button>
                <Button variant="ghost" size="sm" onClick={onContinue} className="text-white/70 hover:text-white hover:bg-white/10 text-xs gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" /> Crear Minuta
                </Button>
                <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white/70 hover:text-white hover:bg-white/10">
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          )}

          {/* Slide area */}
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
            {/* Floating Edit Button - hidden in fullscreen */}
            {!isFullscreen && hasEditor && !editorOpen && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={() => setEditorOpen(true)}
                className="absolute bottom-6 right-6 z-20 flex items-center gap-2 px-5 py-3 rounded-2xl bg-[#c0392b] text-white font-bold text-sm shadow-[0_8px_32px_rgba(192,57,43,0.5)] hover:bg-[#a0302b] hover:shadow-[0_8px_40px_rgba(192,57,43,0.7)] transition-all hover:scale-105"
              >
                <Table2 className="h-5 w-5" />
                Editar Tabla
              </motion.button>
            )}
            {/* Fullscreen exit hint */}
            {isFullscreen && (
              <button onClick={toggleFullscreen} className="absolute top-4 right-4 z-20 p-2 rounded-full bg-black/30 hover:bg-black/50 text-white/50 hover:text-white transition-colors">
                <Minimize2 className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Bottom nav - hidden in fullscreen */}
          {!isFullscreen && (
            <div className="flex items-center justify-center gap-1.5 px-4 py-3 bg-black/50 shrink-0 flex-wrap">
              {slideNames.map((name, i) => (
                <button key={i} onClick={() => setCurrentSlide(i)}
                  className={cn("px-2.5 py-1 rounded-lg text-[11px] transition-all", i === currentSlide ? "bg-white/20 text-white font-medium" : "text-white/40 hover:text-white/70 hover:bg-white/5")}>{name}</button>
              ))}
            </div>
          )}

          {/* Side Panel Editor */}
          <TableEditorPanel
            open={editorOpen && hasEditor}
            onClose={() => setEditorOpen(false)}
            title={`Editar: ${currentSlideName}`}
          >
            {editorContent}
          </TableEditorPanel>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
