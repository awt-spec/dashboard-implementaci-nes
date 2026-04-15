import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ChevronLeft, ChevronRight, Maximize2, Minimize2, X,
  FileText, ArrowRight, Download, Users, CheckSquare,
  AlertTriangle, BarChart3, Headset, Clock, Target,
  Pencil, Plus, Trash2, Save, Loader2
} from "lucide-react";
import sysdeLogo from "@/assets/sysde_default_logo.png";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  SlideLayout, ScaledSlide, SysdeLogo, EditDisabledContext,
} from "@/components/clients/presentation/slideHelpers";
import type { SupportTicket } from "@/hooks/useSupportTickets";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Minuta {
  id: string;
  title: string;
  date: string;
  summary: string;
  cases_referenced: string[];
  action_items: string[];
  agreements: string[];
  attendees: string[];
}

interface Props {
  minuta: Minuta;
  tickets: SupportTicket[];
  clientName: string;
  open: boolean;
  onClose: () => void;
  onMinutaUpdated?: () => void;
}

const ACCENT = "#c0392b";
const ACCENT_DARK = "#922b21";

export function SupportMinutaPresentation({ minuta, tickets, clientName, open, onClose, onMinutaUpdated }: Props) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorType, setEditorType] = useState<"agreements" | "actions" | "summary" | "title">("agreements");
  const [editItems, setEditItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);
  const [editSummary, setEditSummary] = useState(minuta.summary);
  const [editTitle, setEditTitle] = useState(minuta.title);
  const [editAttendees, setEditAttendees] = useState(minuta.attendees.join(", "));
  const containerRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Local state for live editing
  const [localAgreements, setLocalAgreements] = useState(minuta.agreements);
  const [localActions, setLocalActions] = useState(minuta.action_items);
  const [localSummary, setLocalSummary] = useState(minuta.summary);
  const [localTitle, setLocalTitle] = useState(minuta.title);
  const [localAttendees, setLocalAttendees] = useState(minuta.attendees);

  useEffect(() => {
    setLocalAgreements(minuta.agreements);
    setLocalActions(minuta.action_items);
    setLocalSummary(minuta.summary);
    setLocalTitle(minuta.title);
    setLocalAttendees(minuta.attendees);
  }, [minuta]);

  // Match by ticket_id OR by uuid id
  const refCases = tickets.filter(t =>
    minuta.cases_referenced.includes(t.ticket_id) || minuta.cases_referenced.includes(t.id)
  );
  const effectiveCases = refCases.length > 0 ? refCases : tickets.filter(t => !["CERRADA", "ANULADA"].includes(t.estado));
  const criticalCases = effectiveCases.filter(t => t.prioridad.includes("Critica") || t.prioridad === "Alta")
    .sort((a, b) => b.dias_antiguedad - a.dias_antiguedad);

  const totalCases = effectiveCases.length;
  const openCases = effectiveCases.filter(t => !["CERRADA", "ANULADA"].includes(t.estado)).length;
  const criticalCount = criticalCases.length;
  const avgDays = effectiveCases.length > 0 ? Math.round(effectiveCases.reduce((s, t) => s + t.dias_antiguedad, 0) / effectiveCases.length) : 0;
  const byEstado: Record<string, number> = {};
  effectiveCases.forEach(t => { byEstado[t.estado] = (byEstado[t.estado] || 0) + 1; });
  const byProducto: Record<string, number> = {};
  effectiveCases.forEach(t => { byProducto[t.producto] = (byProducto[t.producto] || 0) + 1; });

  const slideNames = ["Portada", "Métricas", "Casos Críticos", "Detalle de Casos", "Acuerdos", "Acciones", "Cierre"];
  const totalSlides = slideNames.length;

  const next = useCallback(() => setCurrentSlide(s => Math.min(s + 1, totalSlides - 1)), [totalSlides]);
  const prev = useCallback(() => setCurrentSlide(s => Math.max(s - 1, 0)), []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (editorOpen) return;
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      if (e.key === "Escape") { if (isFullscreen) toggleFullscreen(); else onClose(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, next, prev, isFullscreen, editorOpen]);

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

  const openEditor = (type: "agreements" | "actions") => {
    setEditorType(type);
    setEditItems(type === "agreements" ? [...localAgreements] : [...localActions]);
    setNewItem("");
    setEditorOpen(true);
  };

  const handleAddItem = () => {
    if (!newItem.trim()) return;
    setEditItems(prev => [...prev, newItem.trim()]);
    setNewItem("");
  };

  const handleRemoveItem = (idx: number) => {
    setEditItems(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSaveEditor = async () => {
    setSaving(true);
    const updates = editorType === "agreements"
      ? { agreements: editItems }
      : { action_items: editItems };
    const { error } = await supabase.from("support_minutes").update(updates).eq("id", minuta.id);
    if (error) {
      toast.error("Error al guardar");
    } else {
      toast.success(editorType === "agreements" ? "Acuerdos actualizados" : "Acciones actualizadas");
      if (editorType === "agreements") setLocalAgreements(editItems);
      else setLocalActions(editItems);
      onMinutaUpdated?.();
    }
    setSaving(false);
    setEditorOpen(false);
  };

  const handleExportPdf = async () => {
    const html2canvas = (await import("html2canvas")).default;
    const jsPDF = (await import("jspdf")).default;
    const doc = new jsPDF({ orientation: "landscape", unit: "px", format: [1920, 1080] });
    const savedSlide = currentSlide;
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
    doc.save(`Minuta_Soporte_${clientName.replace(/\s+/g, "_")}_${minuta.date}.pdf`);
  };

  if (!open) return null;

  // ═══ SLIDES ═══

  const slidePortada = (
    <SlideLayout key="cover" className="bg-white">
      <div className="absolute inset-0 flex">
        <div className="w-[520px] h-full" style={{ background: ACCENT }} >
          <div className="flex flex-col justify-between py-[80px] px-[60px] h-full">
            <div>
              <img src={sysdeLogo} alt="Sysde" className="h-[64px] object-contain brightness-0 invert" />
              <p className="text-[18px] text-white/60 uppercase tracking-[3px] mt-[20px]">Sysde</p>
            </div>
            <div>
              <div className="flex items-center gap-[12px] mb-[20px]">
                <Headset className="text-white/60" style={{ width: 24, height: 24 }} />
                <span className="text-[18px] text-white/60 uppercase tracking-[2px]">Soporte Técnico</span>
              </div>
              <p className="text-[22px] text-white font-bold">Sesión de Seguimiento</p>
              <p className="text-[18px] text-white/60 mt-[4px]">{new Date(minuta.date).toLocaleDateString("es", { day: "2-digit", month: "long", year: "numeric" })}</p>
            </div>
          </div>
        </div>
        <div className="flex-1 flex flex-col justify-center px-[120px] bg-white">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <p className="text-[20px] text-[#999] uppercase tracking-[4px] mb-[16px]">MINUTA DE SOPORTE</p>
            <h1 className="text-[56px] font-bold text-[#333] leading-[1.1] mb-[32px]">{minuta.title}</h1>
            <h2 className="text-[52px] font-extrabold mb-[40px]" style={{ color: ACCENT }}>{clientName}</h2>
            <div className="w-[80px] h-[4px] mb-[40px]" style={{ background: ACCENT }} />
            {minuta.attendees.length > 0 && (
              <div className="flex items-center gap-[12px]">
                <Users className="text-[#999]" style={{ width: 24, height: 24 }} />
                <p className="text-[22px] text-[#666]">{minuta.attendees.join(", ")}</p>
              </div>
            )}
          </motion.div>
        </div>
      </div>
    </SlideLayout>
  );

  const slideMetricas = (
    <SlideLayout key="metrics" className="bg-white">
      <div className="absolute left-0 top-0 bottom-0 w-[12px]" style={{ background: ACCENT }} />
      <div className="absolute inset-0 px-[100px] py-[60px]">
        <div className="flex items-center gap-[20px] mb-[48px]">
          <div className="h-[56px] w-[56px] rounded-[14px] flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})` }}>
            <BarChart3 className="text-white" style={{ width: 28, height: 28 }} />
          </div>
          <div>
            <p className="text-[14px] font-bold uppercase tracking-[3px]" style={{ color: ACCENT }}>RESUMEN</p>
            <h2 className="text-[44px] font-extrabold text-[#1a1a2e]">Métricas de la Sesión</h2>
          </div>
        </div>
        <div className="grid grid-cols-4 gap-[32px] mb-[48px]">
          {[
            { label: "Casos Referenciados", value: totalCases, color: ACCENT, icon: FileText },
            { label: "Casos Abiertos", value: openCases, color: "#e67e22", icon: Clock },
            { label: "Casos Críticos", value: criticalCount, color: "#c0392b", icon: AlertTriangle },
            { label: "Prom. Días Antigüedad", value: avgDays, color: "#8e44ad", icon: Target },
          ].map((kpi, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.1 }}
              className="rounded-[16px] border-[2px] border-[#eee] p-[32px] relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[4px]" style={{ background: kpi.color }} />
              <kpi.icon style={{ width: 32, height: 32, color: kpi.color }} className="mb-[16px]" />
              <p className="text-[56px] font-extrabold" style={{ color: kpi.color }}>{kpi.value}</p>
              <p className="text-[20px] text-[#666] mt-[8px]">{kpi.label}</p>
            </motion.div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-[48px]">
          <div>
            <p className="text-[20px] font-bold text-[#1a1a2e] mb-[16px]">Por Estado</p>
            <div className="space-y-[12px]">
              {Object.entries(byEstado).sort((a, b) => b[1] - a[1]).map(([estado, count], i) => (
                <div key={i} className="flex items-center gap-[16px]">
                  <span className="text-[18px] text-[#666] w-[250px] truncate">{estado}</span>
                  <div className="flex-1 h-[24px] bg-[#e8e8e8] rounded-[4px] overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(count / totalCases) * 100}%` }} transition={{ duration: 0.6, delay: 0.1 * i }}
                      className="h-full rounded-[4px]" style={{ background: ACCENT }} />
                  </div>
                  <span className="text-[18px] font-bold text-[#333] w-[40px] text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[20px] font-bold text-[#1a1a2e] mb-[16px]">Por Producto</p>
            <div className="space-y-[12px]">
              {Object.entries(byProducto).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([prod, count], i) => (
                <div key={i} className="flex items-center gap-[16px]">
                  <span className="text-[18px] text-[#666] w-[250px] truncate">{prod}</span>
                  <div className="flex-1 h-[24px] bg-[#e8e8e8] rounded-[4px] overflow-hidden">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${(count / totalCases) * 100}%` }} transition={{ duration: 0.6, delay: 0.1 * i }}
                      className="h-full rounded-[4px] bg-[#8e44ad]" />
                  </div>
                  <span className="text-[18px] font-bold text-[#333] w-[40px] text-right">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </SlideLayout>
  );

  const slideCriticos = (
    <SlideLayout key="critical" className="bg-white">
      <div className="absolute left-0 top-0 bottom-0 w-[12px]" style={{ background: ACCENT }} />
      <div className="absolute inset-0 px-[80px] py-[50px]">
        <div className="flex items-center gap-[20px] mb-[36px]">
          <div className="h-[56px] w-[56px] rounded-[14px] flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})` }}>
            <AlertTriangle className="text-white" style={{ width: 28, height: 28 }} />
          </div>
          <div>
            <p className="text-[14px] font-bold uppercase tracking-[3px]" style={{ color: ACCENT }}>ATENCIÓN</p>
            <h2 className="text-[40px] font-extrabold text-[#1a1a2e]">Casos Críticos y Alta Prioridad</h2>
          </div>
        </div>
        <div className="rounded-[16px] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-[#eee]">
          <div className="flex" style={{ background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_DARK})` }}>
            <div className="w-[120px] px-[16px] py-[16px] text-[16px] font-bold text-white">ID</div>
            <div className="flex-1 px-[16px] py-[16px] text-[18px] font-bold text-white">Asunto</div>
            <div className="w-[180px] px-[16px] py-[16px] text-[18px] font-bold text-white border-l border-white/10">Responsable</div>
            <div className="w-[150px] px-[16px] py-[16px] text-[18px] font-bold text-white border-l border-white/10">Producto</div>
            <div className="w-[100px] px-[16px] py-[16px] text-[18px] font-bold text-white border-l border-white/10 text-center">Días</div>
            <div className="w-[130px] px-[16px] py-[16px] text-[18px] font-bold text-white border-l border-white/10">Estado</div>
          </div>
          {(criticalCases.length > 0 ? criticalCases : effectiveCases).slice(0, 10).map((t, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className={cn("flex border-b border-[#f0f0f0] hover:bg-[#c0392b]/[0.02] transition-colors", i % 2 === 0 ? "bg-white" : "bg-[#fafafa]")}>
              <div className="w-[120px] px-[16px] py-[16px] text-[16px] font-mono font-bold" style={{ color: ACCENT }}>{t.ticket_id}</div>
              <div className="flex-1 px-[16px] py-[16px] text-[18px] text-[#333] truncate">{t.asunto}</div>
              <div className="w-[180px] px-[16px] py-[16px] text-[18px] font-semibold text-[#1a1a2e] border-l border-[#f0f0f0]">{t.responsable || "—"}</div>
              <div className="w-[150px] px-[16px] py-[16px] text-[16px] text-[#666] border-l border-[#f0f0f0] truncate">{t.producto}</div>
              <div className="w-[100px] px-[16px] py-[16px] text-center border-l border-[#f0f0f0]">
                <span className={cn("text-[20px] font-extrabold", t.dias_antiguedad > 365 ? "text-[#c0392b]" : t.dias_antiguedad > 90 ? "text-[#e67e22]" : "text-[#333]")}>{t.dias_antiguedad}</span>
              </div>
              <div className="w-[130px] px-[16px] py-[16px] border-l border-[#f0f0f0]">
                <span className="text-[14px] px-[10px] py-[4px] rounded-full font-medium" style={{ background: ACCENT + "15", color: ACCENT }}>{t.estado}</span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </SlideLayout>
  );

  const slideDetalle = (
    <SlideLayout key="detail" className="bg-white">
      <div className="absolute left-0 top-0 bottom-0 w-[12px]" style={{ background: ACCENT }} />
      <div className="absolute inset-0 px-[80px] py-[50px]">
        <div className="flex items-center gap-[20px] mb-[36px]">
          <div className="h-[56px] w-[56px] rounded-[14px] flex items-center justify-center shadow-lg" style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT_DARK})` }}>
            <FileText className="text-white" style={{ width: 28, height: 28 }} />
          </div>
          <div>
            <p className="text-[14px] font-bold uppercase tracking-[3px]" style={{ color: ACCENT }}>DETALLE</p>
            <h2 className="text-[40px] font-extrabold text-[#1a1a2e]">Todos los Casos Referenciados</h2>
          </div>
        </div>
        <div className="rounded-[16px] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-[#eee]">
          <div className="flex" style={{ background: `linear-gradient(90deg, ${ACCENT}, ${ACCENT_DARK})` }}>
            <div className="w-[100px] px-[12px] py-[14px] text-[16px] font-bold text-white">ID</div>
            <div className="flex-1 px-[12px] py-[14px] text-[16px] font-bold text-white">Asunto</div>
            <div className="w-[140px] px-[12px] py-[14px] text-[16px] font-bold text-white border-l border-white/10">Tipo</div>
            <div className="w-[150px] px-[12px] py-[14px] text-[16px] font-bold text-white border-l border-white/10">Prioridad</div>
            <div className="w-[140px] px-[12px] py-[14px] text-[16px] font-bold text-white border-l border-white/10">Responsable</div>
            <div className="w-[130px] px-[12px] py-[14px] text-[16px] font-bold text-white border-l border-white/10">Estado</div>
            <div className="w-[80px] px-[12px] py-[14px] text-[16px] font-bold text-white border-l border-white/10 text-center">Días</div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: "800px" }}>
            {effectiveCases.slice(0, 14).map((t, i) => {
              const prioColor = t.prioridad.includes("Critica") ? "#c0392b" : t.prioridad === "Alta" ? "#e67e22" : ACCENT;
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                  className={cn("flex border-b border-[#f0f0f0] text-[16px]", i % 2 === 0 ? "bg-white" : "bg-[#f8f9fc]")}>
                  <div className="w-[100px] px-[12px] py-[12px] font-mono font-bold" style={{ color: ACCENT }}>{t.ticket_id}</div>
                  <div className="flex-1 px-[12px] py-[12px] text-[#333] truncate">{t.asunto}</div>
                  <div className="w-[140px] px-[12px] py-[12px] text-[#666] border-l border-[#f0f0f0]">{t.tipo}</div>
                  <div className="w-[150px] px-[12px] py-[12px] border-l border-[#f0f0f0]">
                    <span className="text-[14px] font-semibold px-[8px] py-[2px] rounded-full" style={{ background: prioColor + "15", color: prioColor }}>
                      {t.prioridad.replace(", Impacto Negocio", "")}
                    </span>
                  </div>
                  <div className="w-[140px] px-[12px] py-[12px] font-medium text-[#1a1a2e] border-l border-[#f0f0f0]">{t.responsable || "—"}</div>
                  <div className="w-[130px] px-[12px] py-[12px] border-l border-[#f0f0f0]">
                    <span className="text-[14px] px-[8px] py-[2px] rounded-full font-medium" style={{ background: ACCENT + "15", color: ACCENT }}>{t.estado}</span>
                  </div>
                  <div className="w-[80px] px-[12px] py-[12px] text-center border-l border-[#f0f0f0] font-bold">{t.dias_antiguedad}</div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </SlideLayout>
  );

  // Gather case-level agreements/actions
  const caseAgreements = effectiveCases.flatMap(t =>
    (t.case_agreements || []).map(a => ({ text: a.text, responsible: a.responsible, date: a.date, priority: a.priority, ticketId: t.ticket_id }))
  );
  const caseActions = effectiveCases.flatMap(t =>
    (t.case_actions || []).map(a => ({ text: a.text, responsible: a.responsible, date: a.date, priority: a.priority, ticketId: t.ticket_id }))
  );

  const slideAcuerdos = (
    <SlideLayout key="agreements" className="bg-white">
      <div className="absolute left-0 top-0 bottom-0 w-[12px] bg-[#27ae60]" />
      <div className="absolute right-0 top-0 w-[600px] h-[600px] rounded-full bg-[#27ae60]/[0.03] -translate-y-[200px] translate-x-[200px]" />
      <div className="absolute inset-0 px-[100px] py-[60px]">
        <div className="flex items-center gap-[20px] mb-[40px]">
          <div className="h-[56px] w-[56px] rounded-[14px] bg-gradient-to-br from-[#27ae60] to-[#1e8449] flex items-center justify-center shadow-lg">
            <CheckSquare className="text-white" style={{ width: 28, height: 28 }} />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-bold text-[#27ae60] uppercase tracking-[3px]">COMPROMISOS</p>
            <h2 className="text-[44px] font-extrabold text-[#1a1a2e]">Acuerdos de la Sesión</h2>
          </div>
          {!isFullscreen && (
            <button onClick={() => openEditor("agreements")}
              className="h-[48px] w-[48px] rounded-[12px] bg-[#27ae60]/10 hover:bg-[#27ae60]/20 flex items-center justify-center transition-colors cursor-pointer">
              <Pencil style={{ width: 22, height: 22, color: "#27ae60" }} />
            </button>
          )}
        </div>
        <div className="space-y-[16px]">
          {localAgreements.length > 0 ? localAgreements.map((a, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.08 }}
              className="flex items-start gap-[20px] bg-white rounded-[16px] px-[32px] py-[20px] shadow-[0_2px_16px_rgba(0,0,0,0.06)] border border-[#eee]">
              <div className="h-[40px] w-[40px] rounded-[10px] bg-[#27ae60]/15 flex items-center justify-center shrink-0">
                <CheckSquare style={{ width: 20, height: 20, color: "#27ae60" }} />
              </div>
              <p className="text-[22px] text-[#333] leading-[1.4] flex-1">{a}</p>
              <span className="text-[14px] font-bold text-[#27ae60]/40 mt-[4px]">#{i + 1}</span>
            </motion.div>
          )) : (
            <div className="text-center py-[40px]">
              <p className="text-[24px] text-[#999]">Sin acuerdos de minuta</p>
            </div>
          )}
        </div>
        {caseAgreements.length > 0 && (
          <div className="mt-[32px]">
            <p className="text-[18px] font-bold text-[#27ae60]/60 uppercase tracking-[2px] mb-[16px]">Acuerdos por Caso</p>
            <div className="space-y-[12px]">
              {caseAgreements.slice(0, 6).map((ca, i) => (
                <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 + i * 0.05 }}
                  className="flex items-center gap-[16px] bg-[#27ae60]/[0.04] rounded-[12px] px-[24px] py-[16px] border border-[#27ae60]/10">
                  <span className="text-[14px] font-mono font-bold text-[#27ae60]">{ca.ticketId}</span>
                  <p className="text-[18px] text-[#333] flex-1">{ca.text}</p>
                  {ca.responsible && <span className="text-[14px] text-[#666] font-medium">{ca.responsible}</span>}
                  {ca.date && <span className="text-[14px] text-[#999]">{new Date(ca.date).toLocaleDateString("es")}</span>}
                </motion.div>
              ))}
            </div>
          </div>
        )}
        {minuta.summary && localAgreements.length + caseAgreements.length < 4 && (
          <div className="mt-[40px] border-t-[2px] border-[#eee] pt-[24px]">
            <p className="text-[16px] font-bold text-[#999] uppercase tracking-[2px] mb-[12px]">Resumen Ejecutivo</p>
            <p className="text-[20px] text-[#666] leading-[1.6] line-clamp-3">{minuta.summary}</p>
          </div>
        )}
      </div>
    </SlideLayout>
  );

  const slideAcciones = (
    <SlideLayout key="actions" className="bg-white">
      <div className="absolute left-0 top-0 bottom-0 w-[12px] bg-[#e67e22]" />
      <div className="absolute inset-0 px-[100px] py-[60px]">
        <div className="flex items-center gap-[20px] mb-[40px]">
          <div className="h-[56px] w-[56px] rounded-[14px] bg-gradient-to-br from-[#e67e22] to-[#d35400] flex items-center justify-center shadow-lg">
            <ArrowRight className="text-white" style={{ width: 28, height: 28 }} />
          </div>
          <div className="flex-1">
            <p className="text-[14px] font-bold text-[#e67e22] uppercase tracking-[3px]">SEGUIMIENTO</p>
            <h2 className="text-[44px] font-extrabold text-[#1a1a2e]">Acciones a Seguir</h2>
          </div>
          {!isFullscreen && (
            <button onClick={() => openEditor("actions")}
              className="h-[48px] w-[48px] rounded-[12px] bg-[#e67e22]/10 hover:bg-[#e67e22]/20 flex items-center justify-center transition-colors cursor-pointer">
              <Pencil style={{ width: 22, height: 22, color: "#e67e22" }} />
            </button>
          )}
        </div>
        <div className="rounded-[16px] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-[#eee]">
          <div className="flex bg-gradient-to-r from-[#e67e22] to-[#d35400]">
            <div className="w-[60px] px-[16px] py-[14px] text-[16px] font-bold text-white/80">#</div>
            <div className="flex-1 px-[20px] py-[14px] text-[18px] font-bold text-white">Acción</div>
          </div>
          {localActions.length > 0 ? localActions.map((item, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
              className={cn("flex border-b border-[#f0f0f0] hover:bg-[#e67e22]/[0.02] transition-colors", i % 2 === 0 ? "bg-white" : "bg-[#fafafa]")}>
              <div className="w-[60px] px-[16px] py-[16px] text-[18px] font-bold text-[#e67e22]">{i + 1}</div>
              <div className="flex-1 px-[20px] py-[16px] flex items-center gap-[16px]">
                <ArrowRight style={{ width: 20, height: 20, color: "#e67e22" }} className="shrink-0" />
                <span className="text-[20px] text-[#333]">{item}</span>
              </div>
            </motion.div>
          )) : (
            <div className="text-center py-[40px]">
              <p className="text-[20px] text-[#999]">Sin acciones de minuta</p>
            </div>
          )}
        </div>
        {caseActions.length > 0 && (
          <div className="mt-[32px]">
            <p className="text-[18px] font-bold text-[#e67e22]/60 uppercase tracking-[2px] mb-[16px]">Acciones por Caso</p>
            <div className="space-y-[12px]">
              {caseActions.slice(0, 6).map((ca, i) => (
                <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 + i * 0.05 }}
                  className="flex items-center gap-[16px] bg-[#e67e22]/[0.04] rounded-[12px] px-[24px] py-[16px] border border-[#e67e22]/10">
                  <span className="text-[14px] font-mono font-bold text-[#e67e22]">{ca.ticketId}</span>
                  <p className="text-[18px] text-[#333] flex-1">{ca.text}</p>
                  {ca.responsible && <span className="text-[14px] text-[#666] font-medium">{ca.responsible}</span>}
                  {ca.date && <span className="text-[14px] text-[#999]">{new Date(ca.date).toLocaleDateString("es")}</span>}
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </SlideLayout>
  );

  const slideCierre = (
    <SlideLayout key="close" className="bg-[#c0392b]">
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#c0392b]">
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="text-center">
          <Headset className="text-white/40 mx-auto mb-[32px]" style={{ width: 80, height: 80 }} />
          <h2 className="text-[48px] text-white/80 mb-[16px]">Gracias por su confianza</h2>
          <h2 className="text-[64px] font-extrabold text-white mb-[48px]">{clientName}</h2>
          <div className="w-[200px] h-[3px] bg-white/30 rounded-full mx-auto mb-[48px]" />
          <img src={sysdeLogo} alt="Sysde" className="h-[100px] object-contain mx-auto mb-[48px]" />
          <p className="text-[28px] text-white/60">Sysde — Soporte Técnico</p>
        </motion.div>
      </div>
    </SlideLayout>
  );

  const slides = [slidePortada, slideMetricas, slideCriticos, slideDetalle, slideAcuerdos, slideAcciones, slideCierre];

  const editorColor = editorType === "agreements" ? "#27ae60" : "#e67e22";
  const editorTitle = editorType === "agreements" ? "Editar Acuerdos" : "Editar Acciones";

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
                {(currentSlide === 4 || currentSlide === 5) && (
                  <Button variant="ghost" size="sm" onClick={() => openEditor(currentSlide === 4 ? "agreements" : "actions")}
                    className="text-white/70 hover:text-white hover:bg-white/10 text-xs gap-1.5">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={handleExportPdf} className="text-white/70 hover:text-white hover:bg-white/10 text-xs gap-1.5">
                  <Download className="h-3.5 w-3.5" /> Exportar PDF
                </Button>
                <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white/70 hover:text-white hover:bg-white/10">
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
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

          {/* Editor Side Panel */}
          <AnimatePresence>
            {editorOpen && (
              <>
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="fixed inset-0 z-[55]" onClick={() => setEditorOpen(false)} />
                <motion.div
                  initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
                  transition={{ type: "spring", damping: 30, stiffness: 300 }}
                  className="fixed right-0 top-0 bottom-0 w-[420px] bg-[#1a1a2e] border-l border-white/10 z-[60] flex flex-col shadow-2xl"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg flex items-center justify-center" style={{ background: editorColor }}>
                        {editorType === "agreements" ? <CheckSquare className="h-4 w-4 text-white" /> : <ArrowRight className="h-4 w-4 text-white" />}
                      </div>
                      <span className="text-white font-semibold text-sm">{editorTitle}</span>
                    </div>
                    <button onClick={() => setEditorOpen(false)} className="h-8 w-8 rounded-lg hover:bg-white/10 flex items-center justify-center text-white/50 hover:text-white transition-colors">
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {editItems.map((item, idx) => (
                      <div key={idx} className="flex items-start gap-2 bg-white/5 rounded-lg p-3 group">
                        <span className="text-white/30 text-xs font-mono mt-1 shrink-0 w-5 text-right">{idx + 1}</span>
                        <p className="text-white/90 text-sm flex-1 leading-relaxed">{item}</p>
                        <button onClick={() => handleRemoveItem(idx)} className="shrink-0 h-6 w-6 rounded hover:bg-red-500/20 flex items-center justify-center text-white/30 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    ))}

                    <div className="flex gap-2 mt-3">
                      <Input
                        value={newItem}
                        onChange={e => setNewItem(e.target.value)}
                        placeholder={editorType === "agreements" ? "Nuevo acuerdo..." : "Nueva acción..."}
                        className="bg-white/5 border-white/10 text-white text-sm placeholder:text-white/30"
                        onKeyDown={e => { if (e.key === "Enter") handleAddItem(); }}
                      />
                      <Button size="icon" variant="ghost" className="shrink-0 text-white/50 hover:text-white hover:bg-white/10" onClick={handleAddItem}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="border-t border-white/10 p-4">
                    <Button className="w-full gap-2" style={{ background: editorColor }} onClick={handleSaveEditor} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                      Guardar cambios
                    </Button>
                  </div>
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
