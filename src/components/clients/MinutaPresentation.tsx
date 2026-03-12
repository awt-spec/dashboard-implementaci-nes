import { useState, useEffect, useCallback, useRef } from "react";
import { type Client, type ClientTask, type Phase } from "@/data/projectData";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Maximize2, Minimize2, X,
  FileText, Sparkles, ArrowRight, Pencil
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ensureTaskInDb } from "@/lib/ensureTaskInDb";
import {
  SlideLayout, ScaledSlide, SysdeLogo, EditableText, EditableCell,
  loadSlideTexts, saveSlideTexts, extractProgress,
  getMonthRange, getPhaseBarStyle, getCurrentDatePosition,
  type SlideTexts,
} from "./presentation/slideHelpers";
import { aurumCronogramaRows, aurumCompromisosRows, type CronogramaRow, type CompromisoRow } from "./presentation/aurumCronogramaData";

interface MinutaPresentationProps {
  client: Client;
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
}

// ── Activity Groups ─────────────────────────────────────

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
    const completedPhases = client.phases.filter(p => p.status === "completado");
    if (completedPhases.length > 0) {
      groups.push({ title: "FASES COMPLETADAS", items: completedPhases.map(p => ({ label: p.name, progress: 100, status: "completed" as const })) });
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

// ── Editable Progress Bar ───────────────────────────────

function EditableProgressBar({ item, clientId, onUpdate }: { item: ActivityItem; clientId: string; onUpdate: (taskId: number, newProgress: number) => void }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(item.progress.toString());
  const barColor = item.progress === 100 ? "#27ae60" : item.status === "in-progress" ? "#c0392b" : "#e67e22";
  const handleSave = () => {
    const num = Math.min(100, Math.max(0, parseInt(val, 10) || 0));
    setEditing(false);
    if (item.taskId) onUpdate(item.taskId, num);
  };
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
          <button onClick={() => { if (item.taskId) { setVal(item.progress.toString()); setEditing(true); } }}
            className={cn("text-[18px] font-bold w-[60px] text-right", item.taskId ? "cursor-pointer hover:text-[#c0392b] transition-colors" : "cursor-default",
              item.status === "in-progress" ? "text-[#c0392b]" : "text-[#e67e22]")}
            title={item.taskId ? "Clic para editar" : ""}>{item.progress}%</button>
        )
      )}
    </div>
  );
}

// ── Status Badge ────────────────────────────────────────

function StatusBadge({ status, onChange }: { status: string; onChange: (s: string) => void }) {
  const [editing, setEditing] = useState(false);
  const colors: Record<string, { bg: string; text: string }> = {
    "Hecho": { bg: "#dcfce7", text: "#16a34a" },
    "En progreso": { bg: "#fef3c7", text: "#d97706" },
    "Pendiente": { bg: "#fee2e2", text: "#dc2626" },
    "Vencido": { bg: "#fee2e2", text: "#dc2626" },
  };
  const c = colors[status] || colors["Pendiente"];
  if (editing) {
    return (
      <select autoFocus value={status} onChange={e => { onChange(e.target.value); setEditing(false); }}
        onBlur={() => setEditing(false)}
        className="text-[16px] border-2 border-[#c0392b] rounded px-[8px] py-[4px] outline-none">
        <option>Hecho</option><option>En progreso</option><option>Pendiente</option>
      </select>
    );
  }
  return (
    <span onClick={() => setEditing(true)} className="cursor-pointer inline-block px-[16px] py-[6px] rounded-full text-[16px] font-semibold"
      style={{ background: c.bg, color: c.text }} title="Clic para cambiar">{status}</span>
  );
}

// ══════════════════════════════════════════════════════════
// ── MAIN COMPONENT ──────────────────────────────────────
// ══════════════════════════════════════════════════════════

export function MinutaPresentation({ client, open, onClose, onContinue }: MinutaPresentationProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  // Editable text state
  const [texts, setTexts] = useState<SlideTexts>(() => loadSlideTexts(client.id));
  useEffect(() => { setTexts(loadSlideTexts(client.id)); }, [client.id]);
  const txt = (key: string, fallback: string): string => texts[key] ?? fallback;
  const setTxt = (key: string, value: string) => {
    const next = { ...texts, [key]: value };
    setTexts(next);
    saveSlideTexts(client.id, next);
    toast.success("Guardado");
  };

  // Editable table data (cronograma + compromisos) in localStorage
  const [cronograma, setCronograma] = useState<CronogramaRow[]>(() => {
    try { const r = localStorage.getItem(`ppt-crono-${client.id}`); return r ? JSON.parse(r) : aurumCronogramaRows; } catch { return aurumCronogramaRows; }
  });
  const [compromisos, setCompromisos] = useState<CompromisoRow[]>(() => {
    try { const r = localStorage.getItem(`ppt-comp-${client.id}`); return r ? JSON.parse(r) : aurumCompromisosRows; } catch { return aurumCompromisosRows; }
  });

  const updateCrono = (idx: number, field: keyof CronogramaRow, val: string) => {
    const next = [...cronograma];
    (next[idx] as any)[field] = val;
    setCronograma(next);
    localStorage.setItem(`ppt-crono-${client.id}`, JSON.stringify(next));
    toast.success("Guardado");
  };

  const updateComp = (idx: number, field: keyof CompromisoRow, val: string) => {
    const next = [...compromisos];
    (next[idx] as any)[field] = field === "num" ? parseInt(val) || idx + 1 : val;
    setCompromisos(next);
    localStorage.setItem(`ppt-comp-${client.id}`, JSON.stringify(next));
    toast.success("Guardado");
  };

  // Build data
  const activityGroups = buildActivityGroups(client);
  const months = getMonthRange(client.phases, client.contractStart, client.contractEnd);
  const currentDatePos = getCurrentDatePosition(months);
  const pendingTasks = client.tasks.filter(t => t.status === "pendiente" || t.status === "bloqueada");

  const coordinationItems = client.actionItems.map((item, i) => ({
    num: i + 1, subject: item.title, owner: item.assignee, start: item.dueDate, end: item.dueDate,
    status: item.status === "completado" ? "Hecho" : item.status === "vencido" ? "Vencido" : "Pendiente",
    statusColor: item.status === "completado" ? "#22c55e" : item.status === "vencido" ? "#ef4444" : "#f59e0b",
    fup: item.source?.replace("FUP Semanal ", "") || "",
  }));

  const proximosPasos = pendingTasks.map((task, i) => ({
    id: `F${i + 1}`, activity: task.title, responsible: task.owner, date: task.dueDate,
    dependency: i === 0 ? "N/A" : `F${i}`,
  }));

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

  const ganttRows = client.phases.map(p => ({ label: p.name.length > 40 ? p.name.substring(0, 37) + "..." : p.name, phase: p }));
  const managementPhase: Phase = { name: "Gestión de proyecto", status: "en-progreso", progress: client.progress, startDate: client.contractStart, endDate: client.contractEnd };

  // ── Determine slides based on client ──
  const isAurum = client.id === "aurum";

  const slideNames = isAurum
    ? ["Portada", "Agenda", "Avance", "Cronograma", "Línea de Tiempo", "Próximos Pasos", "Compromisos", "Coordinación", "Entregables", "Riesgos", "Cierre"]
    : ["Portada", "Agenda", "Avance", "Línea de Tiempo", "Próximos Pasos", "Coordinación", "Entregables", "Riesgos", "Cierre"];
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

  const slideAgenda = (
    <SlideLayout key="agenda" className="bg-white">
      <div className="absolute inset-0 px-[120px] py-[80px]">
        <div className="flex items-center gap-[16px] mb-[80px]">
          <div className="text-[#999]"><SysdeLogo size={48} /></div>
        </div>
        <div className="grid grid-cols-2 gap-[80px]">
          <motion.div initial={{ opacity: 0, x: -40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}>
            <EditableText value={txt("agenda-sync", "Sincronización")} onChange={v => setTxt("agenda-sync", v)} className="text-[48px] font-bold text-[#c0392b] mb-[40px]" tag="h2" />
            <ul className="space-y-[20px]">
              <li className="flex items-start gap-[16px]"><span className="text-[28px] text-[#c0392b]">•</span>
                <EditableText value={txt("agenda-s1", "Actividades ejecutadas")} onChange={v => setTxt("agenda-s1", v)} className="text-[28px] text-[#333]" /></li>
              <li className="flex items-start gap-[16px]"><span className="text-[28px] text-[#c0392b]">•</span>
                <EditableText value={txt("agenda-s2", "Actividades en curso")} onChange={v => setTxt("agenda-s2", v)} className="text-[28px] text-[#333]" /></li>
            </ul>
          </motion.div>
          <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }}>
            <EditableText value={txt("agenda-coord", "Coordinación")} onChange={v => setTxt("agenda-coord", v)} className="text-[48px] font-bold text-[#c0392b] mb-[40px]" tag="h2" />
            <ul className="space-y-[20px]">
              <li className="flex items-start gap-[16px]"><span className="text-[28px] text-[#c0392b]">•</span>
                <EditableText value={txt("agenda-c1", "Compromisos y entregables del proyecto")} onChange={v => setTxt("agenda-c1", v)} className="text-[28px] text-[#333]" /></li>
            </ul>
          </motion.div>
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
            {activityGroups.filter((_, i) => i % 2 === 0).map((group, gi) => (
              <div key={gi}>
                <p className="text-[18px] font-bold text-[#c0392b] uppercase tracking-[1px] mb-[8px] border-b border-[#eee] pb-[4px]">{group.title}</p>
                {group.items.map((item, ii) => <EditableProgressBar key={ii} item={item} clientId={client.id} onUpdate={handleProgressUpdate} />)}
              </div>
            ))}
          </div>
          <div className="space-y-[24px]">
            {activityGroups.filter((_, i) => i % 2 === 1).map((group, gi) => (
              <div key={gi}>
                <p className="text-[18px] font-bold text-[#c0392b] uppercase tracking-[1px] mb-[8px] border-b border-[#eee] pb-[4px]">{group.title}</p>
                {group.items.map((item, ii) => <EditableProgressBar key={ii} item={item} clientId={client.id} onUpdate={handleProgressUpdate} />)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </SlideLayout>
  );

  // ═══ CRONOGRAMA DETALLADO (AURUM only) ═══
  const slideCronograma = (
    <SlideLayout key="cronograma" className="bg-white">
      <div className="absolute inset-0 px-[60px] py-[40px] flex flex-col">
        <div className="flex items-start justify-between mb-[16px]">
          <div>
            <p className="text-[20px] font-bold text-[#c0392b] uppercase tracking-[2px]">SINCRONIZACIÓN</p>
            <EditableText value={txt("crono-title", 'Cronograma detallado "Arrendamiento y préstamos"')} onChange={v => setTxt("crono-title", v)} className="text-[38px] font-bold text-[#333] mt-[8px]" tag="h2" />
          </div>
          <div className="text-right text-[16px] text-[#333] space-y-[4px]">
            <p>Planificado: <strong>{client.progress}%</strong></p>
            <p>Real: <strong>{client.progress}%</strong></p>
            <p><strong>SPI: 1</strong></p>
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
            {cronograma.map((row, i) => {
              const pct = parseInt(row.percent) || 0;
              const pctColor = pct === 100 ? "#16a34a" : pct > 0 ? "#c0392b" : "#999";
              return (
                <div key={i} className={cn("flex border-b border-[#eee] text-[14px]",
                  row.isRed ? "bg-[#fef2f2]" : row.isBold ? "bg-[#f8f8f8]" : i % 2 === 0 ? "bg-white" : "bg-[#fafafa]"
                )}>
                  <div className="flex-1 px-[12px] py-[6px] truncate" style={{ paddingLeft: `${12 + row.indent * 24}px` }}>
                    <EditableCell value={row.name} onChange={v => updateCrono(i, "name", v)}
                      className={cn("text-[14px]", row.isBold && "font-bold", row.isItalic && "italic", row.isRed && "text-[#c0392b]")} />
                  </div>
                  <div className="w-[100px] px-[8px] py-[6px] text-center border-l border-[#eee]">
                    <EditableCell value={row.duration} onChange={v => updateCrono(i, "duration", v)} className="text-[14px]" />
                  </div>
                  <div className="w-[80px] px-[8px] py-[6px] text-center border-l border-[#eee]">
                    <EditableCell value={row.percent} onChange={v => updateCrono(i, "percent", v)}
                      className={cn("text-[14px] font-bold")} />
                  </div>
                  <div className="w-[100px] px-[8px] py-[6px] text-center border-l border-[#eee]">
                    <EditableCell value={row.start} onChange={v => updateCrono(i, "start", v)} className="text-[14px]" />
                  </div>
                  <div className="w-[100px] px-[8px] py-[6px] text-center border-l border-[#eee]">
                    <EditableCell value={row.end} onChange={v => updateCrono(i, "end", v)} className="text-[14px]" />
                  </div>
                </div>
              );
            })}
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
          <div className="flex">
            <div className="w-[360px] shrink-0" />
            <div className="flex-1 flex">
              {months.map((m, i) => {
                const isCur = new Date().getFullYear() === m.date.getFullYear() && new Date().getMonth() === m.date.getMonth();
                return <div key={i} className={cn("flex-1 text-center py-[12px] text-[16px] font-semibold", isCur ? "bg-[#c0392b] text-white" : "bg-[#666] text-white")}>{m.label}</div>;
              })}
            </div>
          </div>
          <div className="flex items-center border-b border-[#e0e0e0]">
            <div className="w-[360px] shrink-0 py-[20px] pr-[16px]"><span className="text-[20px] font-semibold text-[#333]">Gestión de proyecto</span></div>
            <div className="flex-1 relative h-[48px]">
              {(() => { const s = getPhaseBarStyle(managementPhase, months); return <div className="absolute top-[10px] bottom-[10px] rounded-[4px]" style={{ left: s.left, width: s.width, background: "#999" }} />; })()}
            </div>
          </div>
          {ganttRows.map((row, i) => {
            const s = getPhaseBarStyle(row.phase, months);
            return (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className={cn("flex items-center border-b border-[#e0e0e0]", i % 2 === 0 ? "bg-white" : "bg-[#f8f8f8]")}>
                <div className="w-[360px] shrink-0 py-[20px] pr-[16px]"><span className="text-[18px] text-[#333] font-medium">{row.label}</span></div>
                <div className="flex-1 relative h-[48px]"><div className="absolute top-[12px] bottom-[12px] rounded-[4px]" style={{ left: s.left, width: s.width, background: s.color }} /></div>
              </motion.div>
            );
          })}
          {currentDatePos && (
            <div className="absolute top-0 bottom-0 z-10" style={{ left: `calc(360px + (100% - 360px) * ${parseFloat(currentDatePos)} / 100)` }}><div className="w-[3px] h-full bg-[#c0392b]" /></div>
          )}
        </div>
      </div>
    </SlideLayout>
  );

  const slideProximos = (
    <SlideLayout key="proximos" className="bg-white">
      <div className="absolute inset-0 px-[80px] py-[60px]">
        <div className="flex items-center gap-[16px] mb-[20px]">
          <div className="text-[#999]"><SysdeLogo size={40} /></div>
          <h2 className="text-[44px] font-bold text-[#c0392b]">Coordinación</h2>
        </div>
        <EditableText value={txt("proximos-title", "Próximos pasos")} onChange={v => setTxt("proximos-title", v)} className="text-[36px] font-bold text-[#333] mb-[32px]" tag="h3" />
        <div className="border-[2px] border-[#ccc] rounded-[8px] overflow-hidden">
          <div className="flex bg-white border-b-[2px] border-[#ccc]">
            <div className="flex-1 px-[24px] py-[16px] text-[24px] font-bold text-[#333]">Actividad</div>
            <div className="w-[200px] px-[24px] py-[16px] text-[24px] font-bold text-[#333] text-center border-l-[2px] border-[#ccc]">Dependencia</div>
          </div>
          {proximosPasos.slice(0, 7).map((paso, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
              className="flex border-b border-[#ddd] last:border-b-0">
              <div className="flex-1 px-[24px] py-[16px] border-r-[2px] border-[#ccc]">
                <p className="text-[20px] text-[#333]"><span className="font-bold">{paso.id})</span> {paso.activity}</p>
                <p className="text-[18px] mt-[4px]">Responsable: <span className="font-bold text-[#c0392b]">{paso.responsible}</span></p>
                <p className="text-[18px] text-[#666] italic">Fecha: {paso.date}</p>
              </div>
              <div className="w-[200px] px-[24px] py-[16px] flex items-center justify-center"><span className="text-[20px] text-[#333]">{paso.dependency}</span></div>
            </motion.div>
          ))}
        </div>
      </div>
    </SlideLayout>
  );

  // ═══ COMPROMISOS Y ENTREGABLES (AURUM only) ═══
  const slideCompromisos = (
    <SlideLayout key="compromisos" className="bg-white">
      <div className="absolute inset-0 px-[60px] py-[40px]">
        <p className="text-[20px] font-bold text-[#c0392b] uppercase tracking-[2px]">COORDINACIÓN</p>
        <EditableText value={txt("comp-title", "Compromisos y entregables")} onChange={v => setTxt("comp-title", v)} className="text-[44px] font-bold text-[#333] mt-[8px] mb-[24px]" tag="h2" />
        <div className="border border-[#ccc] rounded-[4px] overflow-hidden">
          <div className="flex bg-[#c0392b] text-white text-[16px] font-bold">
            <div className="w-[50px] px-[12px] py-[12px] border-r border-white/20">#</div>
            <div className="flex-1 px-[12px] py-[12px] border-r border-white/20">Descripción</div>
            <div className="w-[160px] px-[12px] py-[12px] border-r border-white/20">Responsable</div>
            <div className="w-[120px] px-[12px] py-[12px] border-r border-white/20">Fecha</div>
            <div className="w-[120px] px-[12px] py-[12px] border-r border-white/20">Estado</div>
            <div className="flex-1 px-[12px] py-[12px]">Comentarios</div>
          </div>
          {compromisos.map((row, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className={cn("flex border-b border-[#eee] text-[16px]", i % 2 === 0 ? "bg-white" : "bg-[#fafafa]")}>
              <div className="w-[50px] px-[12px] py-[10px] text-[#333] border-r border-[#eee]">{row.num}</div>
              <div className="flex-1 px-[12px] py-[10px] border-r border-[#eee]">
                <EditableCell value={row.description} onChange={v => updateComp(i, "description", v)} className="text-[16px] text-[#333]" />
              </div>
              <div className="w-[160px] px-[12px] py-[10px] border-r border-[#eee]">
                <EditableCell value={row.responsible} onChange={v => updateComp(i, "responsible", v)} className="text-[16px] font-semibold text-[#c0392b]" />
              </div>
              <div className="w-[120px] px-[12px] py-[10px] border-r border-[#eee]">
                <EditableCell value={row.date} onChange={v => updateComp(i, "date", v)} className="text-[16px] text-[#333]" />
              </div>
              <div className="w-[120px] px-[12px] py-[10px] border-r border-[#eee] flex items-center justify-center">
                <StatusBadge status={row.status} onChange={v => updateComp(i, "status", v)} />
              </div>
              <div className="flex-1 px-[12px] py-[10px]">
                <EditableCell value={row.comments} onChange={v => updateComp(i, "comments", v)} className="text-[16px] text-[#666]" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </SlideLayout>
  );

  const slideCoordination = (
    <SlideLayout key="coordination" className="bg-white">
      <div className="absolute inset-0 px-[80px] py-[60px]">
        <div className="flex items-center gap-[16px] mb-[40px]">
          <div className="text-[#999]"><SysdeLogo size={40} /></div>
          <EditableText value={txt("coord-title", "Coordinación")} onChange={v => setTxt("coord-title", v)} className="text-[44px] font-bold text-[#c0392b]" tag="h2" />
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
              className={cn("flex border-b border-[#ddd]", i % 2 === 0 ? "bg-[#d6e4f0]" : "bg-white")}>
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
    </SlideLayout>
  );

  const slideEntregables = (
    <SlideLayout key="entregables" className="bg-white">
      <div className="absolute inset-0 px-[80px] py-[60px]">
        <div className="flex items-center gap-[16px] mb-[40px]">
          <div className="text-[#999]"><SysdeLogo size={40} /></div>
          <EditableText value={txt("entregables-title", "Entregables")} onChange={v => setTxt("entregables-title", v)} className="text-[44px] font-bold text-[#c0392b]" tag="h2" />
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
                className={cn("flex border-b border-[#ddd]", i % 2 === 0 ? "bg-[#fdf2f2]" : "bg-white")}>
                <div className="w-[120px] px-[16px] py-[14px] text-[18px] text-[#666] font-mono border-r border-[#ddd]">{d.id}</div>
                <div className="flex-1 px-[16px] py-[14px] text-[18px] text-[#333] border-r border-[#ddd]">{d.name}</div>
                <div className="w-[160px] px-[16px] py-[14px] text-[18px] text-[#666] border-r border-[#ddd]">{d.deliveredDate || d.dueDate}</div>
                <div className="w-[160px] px-[16px] py-[14px]"><span className="text-[18px] font-semibold" style={{ color }}>{label}</span></div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </SlideLayout>
  );

  const slideRiesgos = (
    <SlideLayout key="riesgos" className="bg-white">
      <div className="absolute inset-0 px-[80px] py-[60px]">
        <div className="flex items-center gap-[16px] mb-[40px]">
          <div className="text-[#999]"><SysdeLogo size={40} /></div>
          <EditableText value={txt("riesgos-title", "Riesgos del Proyecto")} onChange={v => setTxt("riesgos-title", v)} className="text-[44px] font-bold text-[#c0392b]" tag="h2" />
        </div>
        <div className="space-y-[24px]">
          {client.risks.map((risk, i) => {
            const impactColor = risk.impact === "alto" ? "#c0392b" : risk.impact === "medio" ? "#e67e22" : "#27ae60";
            const statusLabel = risk.status === "abierto" ? "Abierto" : risk.status === "mitigado" ? "Mitigado" : "Cerrado";
            return (
              <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
                className="border-[2px] border-[#ddd] rounded-[8px] px-[32px] py-[24px] flex items-start gap-[24px]">
                <div className="w-[80px] h-[80px] rounded-[8px] flex flex-col items-center justify-center shrink-0" style={{ background: impactColor + "20" }}>
                  <span className="text-[14px] font-bold uppercase" style={{ color: impactColor }}>Impacto</span>
                  <span className="text-[24px] font-extrabold capitalize" style={{ color: impactColor }}>{risk.impact}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-[16px] mb-[8px]">
                    <span className="text-[16px] font-mono text-[#999]">{risk.id}</span>
                    <span className="px-[12px] py-[4px] rounded-full text-[14px] font-bold" style={{ background: risk.status === "abierto" ? "#fef2f2" : "#f0fdf4", color: risk.status === "abierto" ? "#c0392b" : "#27ae60" }}>{statusLabel}</span>
                  </div>
                  <EditableText value={txt(`risk-${i}`, risk.description)} onChange={v => setTxt(`risk-${i}`, v)} className="text-[22px] text-[#333] leading-[1.4]" tag="p" multiline />
                  {risk.mitigation && <EditableText value={txt(`risk-m-${i}`, risk.mitigation)} onChange={v => setTxt(`risk-m-${i}`, v)} className="text-[18px] text-[#666] mt-[8px] italic" tag="p" />}
                </div>
              </motion.div>
            );
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
          <div className="text-white mb-[48px]"><SysdeLogo size={80} /></div>
          <EditableText value={txt("cierre-brand", "Sysde")} onChange={v => setTxt("cierre-brand", v)} className="text-[28px] text-white/60 mb-[64px]" tag="p" />
          <button onClick={onContinue}
            className="px-[56px] py-[20px] rounded-[16px] bg-white text-[#c0392b] text-[28px] font-bold hover:bg-white/90 transition-colors shadow-2xl flex items-center gap-[16px] mx-auto">
            <FileText style={{ width: 28, height: 28 }} />Crear Nueva Minuta<ArrowRight style={{ width: 28, height: 28 }} />
          </button>
        </motion.div>
      </div>
    </SlideLayout>
  );

  // ── Assemble slides ──
  const slides = isAurum
    ? [slidePortada, slideAgenda, slideAvance, slideCronograma, slideTimeline, slideProximos, slideCompromisos, slideCoordination, slideEntregables, slideRiesgos, slideCierre]
    : [slidePortada, slideAgenda, slideAvance, slideTimeline, slideProximos, slideCoordination, slideEntregables, slideRiesgos, slideCierre];

  return (
    <AnimatePresence>
      {open && (
        <motion.div ref={wrapperRef} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-black/50 shrink-0">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={onClose} className="text-white/70 hover:text-white hover:bg-white/10"><X className="h-5 w-5" /></Button>
              <span className="text-white/50 text-sm">{slideNames[currentSlide]} · {currentSlide + 1}/{totalSlides}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/30 text-xs flex items-center gap-1"><Pencil className="h-3 w-3" /> Clic en cualquier texto para editar</span>
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
            {currentSlide > 0 && <button onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"><ChevronLeft className="h-6 w-6" /></button>}
            {currentSlide < totalSlides - 1 && <button onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"><ChevronRight className="h-6 w-6" /></button>}
          </div>
          <div className="flex items-center justify-center gap-1.5 px-4 py-3 bg-black/50 shrink-0 flex-wrap">
            {slideNames.map((name, i) => (
              <button key={i} onClick={() => setCurrentSlide(i)}
                className={cn("px-2.5 py-1 rounded-lg text-[11px] transition-all", i === currentSlide ? "bg-white/20 text-white font-medium" : "text-white/40 hover:text-white/70 hover:bg-white/5")}>{name}</button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
