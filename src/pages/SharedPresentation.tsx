import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import { type Client, type Deliverable, type ClientTask, type ActionItem, type Risk } from "@/data/projectData";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ChevronLeft, ChevronRight, Maximize2, Minimize2,
  TrendingUp, AlertTriangle, Package, ListChecks, DollarSign,
  Clock, CheckCircle2, Circle, Users, FileText, ThumbsUp, ThumbsDown,
  ArrowRight, Star, Send, Loader2, MessageSquare, ArrowUpDown, GripVertical,
  Mic, MicOff, Video, VideoOff, StopCircle, Play, Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";

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

function InlineThumbRating({ id, rating, onRate, compact }: {
  id: string; rating: "up" | "down" | null; onRate: (id: string, r: "up" | "down" | null) => void; compact?: boolean;
}) {
  const size = compact ? 20 : 24;
  const pad = compact ? "p-[6px]" : "p-[10px]";
  return (
    <div className="flex gap-[8px] shrink-0">
      <button onClick={e => { e.stopPropagation(); onRate(id, rating === "up" ? null : "up"); }}
        className={cn(`${pad} rounded-full transition-all`, rating === "up" ? "bg-[hsl(var(--success)/0.2)]" : "hover:bg-[hsl(var(--muted))]")}>
        <ThumbsUp style={{ width: size, height: size, color: rating === "up" ? "hsl(var(--success))" : "hsl(var(--muted-foreground))" }} />
      </button>
      <button onClick={e => { e.stopPropagation(); onRate(id, rating === "down" ? null : "down"); }}
        className={cn(`${pad} rounded-full transition-all`, rating === "down" ? "bg-[hsl(var(--destructive)/0.2)]" : "hover:bg-[hsl(var(--muted))]")}>
        <ThumbsDown style={{ width: size, height: size, color: rating === "down" ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))" }} />
      </button>
    </div>
  );
}

function InlineComment({ id, value, onChange, placeholder }: {
  id: string; value: string; onChange: (id: string, v: string) => void; placeholder?: string;
}) {
  return (
    <textarea value={value} onClick={e => e.stopPropagation()}
      onChange={e => { e.stopPropagation(); onChange(id, e.target.value); }}
      placeholder={placeholder || "Comentario..."}
      className="w-full h-[60px] bg-[hsl(var(--muted)/0.5)] rounded-[12px] p-[12px] text-[18px] text-[hsl(var(--foreground))] resize-none border border-[hsl(var(--border))] outline-none placeholder:text-[hsl(var(--muted-foreground))] focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)]"
    />
  );
}

// Audio/Video recorder component
function MediaRecorderWidget({ onRecorded, sharedId }: { onRecorded: (url: string, type: "audio" | "video") => void; sharedId: string }) {
  const [recording, setRecording] = useState(false);
  const [mediaType, setMediaType] = useState<"audio" | "video">("audio");
  const [recordedUrl, setRecordedUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const startRecording = async (type: "audio" | "video") => {
    try {
      const constraints = type === "video" ? { audio: true, video: { width: 640, height: 480 } } : { audio: true };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      
      if (type === "video" && videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }

      const recorder = new MediaRecorder(stream, { mimeType: type === "video" ? "video/webm" : "audio/webm" });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: type === "video" ? "video/webm" : "audio/webm" });
        const url = URL.createObjectURL(blob);
        setRecordedUrl(url);
        
        // Upload to storage
        setUploading(true);
        const fileName = `${sharedId}/${Date.now()}.webm`;
        const { data, error } = await supabase.storage.from("presentation-media").upload(fileName, blob);
        if (error) { toast.error("Error al subir grabación"); setUploading(false); return; }
        const { data: urlData } = supabase.storage.from("presentation-media").getPublicUrl(fileName);
        onRecorded(urlData.publicUrl, type);
        setUploading(false);
        toast.success(type === "video" ? "Video guardado" : "Audio guardado");
      };

      recorder.start();
      setMediaType(type);
      setRecording(true);
    } catch (err) {
      toast.error("No se pudo acceder al micrófono/cámara");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach(t => t.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    setRecording(false);
  };

  const deleteRecording = () => {
    setRecordedUrl(null);
  };

  return (
    <div className="rounded-[20px] border-[2px] border-[hsl(var(--border))] p-[28px]">
      <h3 className="text-[24px] font-semibold text-[hsl(var(--foreground))] mb-[16px] flex items-center gap-[12px]">
        {recording ? <StopCircle style={{ width: 24, height: 24, color: "hsl(var(--destructive))" }} className="animate-pulse" /> : <Mic style={{ width: 24, height: 24, color: "hsl(var(--primary))" }} />}
        Graba tu feedback
      </h3>
      <p className="text-[18px] text-[hsl(var(--muted-foreground))] mb-[20px]">Deja un mensaje de voz o video con tus comentarios</p>

      {recording && mediaType === "video" && (
        <div className="rounded-[16px] overflow-hidden mb-[16px] bg-black">
          <video ref={videoRef} muted className="w-full h-auto max-h-[300px]" />
        </div>
      )}

      {recording && mediaType === "audio" && (
        <div className="flex items-center gap-[16px] mb-[16px] p-[20px] rounded-[16px] bg-[hsl(var(--destructive)/0.05)] border border-[hsl(var(--destructive)/0.2)]">
          <div className="w-[16px] h-[16px] rounded-full bg-[hsl(var(--destructive))] animate-pulse" />
          <span className="text-[20px] font-medium text-[hsl(var(--destructive))]">Grabando audio...</span>
        </div>
      )}

      {recordedUrl && !recording && (
        <div className="mb-[16px] p-[16px] rounded-[16px] bg-[hsl(var(--success)/0.05)] border border-[hsl(var(--success)/0.2)] flex items-center gap-[16px]">
          <CheckCircle2 style={{ width: 24, height: 24, color: "hsl(var(--success))" }} />
          <span className="text-[18px] text-[hsl(var(--success))] font-medium flex-1">
            {uploading ? "Subiendo..." : "Grabación guardada ✓"}
          </span>
          <button onClick={deleteRecording} className="p-[8px] rounded-full hover:bg-[hsl(var(--muted))]">
            <Trash2 style={{ width: 18, height: 18, color: "hsl(var(--muted-foreground))" }} />
          </button>
        </div>
      )}

      <div className="flex gap-[16px]">
        {!recording ? (
          <>
            <button onClick={() => startRecording("audio")}
              className="flex-1 flex items-center justify-center gap-[12px] py-[18px] rounded-[16px] border-[2px] border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.4)] hover:bg-[hsl(var(--primary)/0.05)] transition-all text-[20px] font-medium text-[hsl(var(--foreground))]">
              <Mic style={{ width: 24, height: 24, color: "hsl(var(--primary))" }} /> Grabar Audio
            </button>
            <button onClick={() => startRecording("video")}
              className="flex-1 flex items-center justify-center gap-[12px] py-[18px] rounded-[16px] border-[2px] border-[hsl(var(--border))] hover:border-[hsl(var(--info)/0.4)] hover:bg-[hsl(var(--info)/0.05)] transition-all text-[20px] font-medium text-[hsl(var(--foreground))]">
              <Video style={{ width: 24, height: 24, color: "hsl(var(--info))" }} /> Grabar Video
            </button>
          </>
        ) : (
          <button onClick={stopRecording}
            className="flex-1 flex items-center justify-center gap-[12px] py-[18px] rounded-[16px] bg-[hsl(var(--destructive))] text-white text-[20px] font-bold hover:opacity-90 transition-all">
            <StopCircle style={{ width: 24, height: 24 }} /> Detener Grabación
          </button>
        )}
      </div>

      {!recording && !recordedUrl && (
        <video ref={videoRef} className="hidden" />
      )}
    </div>
  );
}

interface ItemRating {
  id: string;
  name: string;
  rating: "up" | "down" | null;
  comment: string;
  priority: number;
}

export default function SharedPresentation() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [selectedSlides, setSelectedSlides] = useState<number[]>([]);
  const [title, setTitle] = useState("");
  const [sharedId, setSharedId] = useState<string | null>(null);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [itemRatings, setItemRatings] = useState<ItemRating[]>([]);
  const [serviceQuality, setServiceQuality] = useState<"up" | "down" | null>(null);
  const [sysdeResponseRating, setSysdeResponseRating] = useState<"up" | "down" | null>(null);
  const [feedbackComments, setFeedbackComments] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<{ url: string; type: "audio" | "video" }[]>([]);

  const [activePopup, setActivePopup] = useState<string | null>(null);
  const popupMessages = [
    "👋 ¿Te funciona bien esta gestión?",
    "💡 ¿Necesitas algo más de SYSDE?",
    "📦 ¿Este entregable resuelve tu necesidad?",
    "⚡ ¿La prioridad es correcta?",
    "🎤 Graba un mensaje de voz con tu feedback",
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      if (feedbackSubmitted) return;
      const msg = popupMessages[Math.floor(Math.random() * popupMessages.length)];
      setActivePopup(msg);
      setTimeout(() => setActivePopup(null), 5000);
    }, 20000);
    return () => clearInterval(interval);
  }, [feedbackSubmitted]);

  const rateItem = (id: string, rating: "up" | "down" | null) => {
    setItemRatings(prev => prev.map(r => r.id === id ? { ...r, rating } : r));
  };
  const commentItem = (id: string, comment: string) => {
    setItemRatings(prev => prev.map(r => r.id === id ? { ...r, comment } : r));
  };
  const prioritizeItem = (id: string, direction: "up" | "down") => {
    setItemRatings(prev => {
      const sorted = [...prev];
      const idx = sorted.findIndex(r => r.id === id);
      if (idx === -1) return prev;
      const swap = direction === "up" ? idx - 1 : idx + 1;
      if (swap < 0 || swap >= sorted.length) return prev;
      [sorted[idx], sorted[swap]] = [sorted[swap], sorted[idx]];
      return sorted.map((r, i) => ({ ...r, priority: i + 1 }));
    });
  };

  const onMediaRecorded = (url: string, type: "audio" | "video") => {
    setMediaUrls(prev => [...prev, { url, type }]);
  };

  useEffect(() => {
    const load = async () => {
      if (!token) { setError("Enlace inválido"); setLoading(false); return; }
      const { data, error: err } = await supabase.from("shared_presentations").select("*").eq("token", token).single();
      if (err || !data) { setError("Enlace no encontrado o expirado"); setLoading(false); return; }
      const d = data as any;
      if (new Date(d.expires_at) < new Date()) { setError("Este enlace ha expirado"); setLoading(false); return; }
      const snap = d.presentation_snapshot as Client;
      setClient(snap);
      setSelectedSlides(d.selected_slides);
      setTitle(d.title);
      setSharedId(d.id);
      const ratings: ItemRating[] = [];
      snap.tasks?.forEach(t => ratings.push({ id: `task-${t.id}`, name: t.title, rating: null, comment: "", priority: 0 }));
      snap.deliverables?.forEach(d => ratings.push({ id: `del-${d.id}`, name: d.name, rating: null, comment: "", priority: 0 }));
      snap.actionItems?.forEach(a => ratings.push({ id: `action-${a.id}`, name: a.title, rating: null, comment: "", priority: 0 }));
      snap.risks?.forEach(r => ratings.push({ id: `risk-${r.id}`, name: r.description, rating: null, comment: "", priority: 0 }));
      setItemRatings(ratings);
      setLoading(false);
    };
    load();
  }, [token]);

  const totalSlides = selectedSlides.length + 1;
  const next = useCallback(() => setCurrentSlide(s => Math.min(s + 1, totalSlides - 1)), [totalSlides]);
  const prev = useCallback(() => setCurrentSlide(s => Math.max(s - 1, 0)), []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      if (e.key === "Escape" && isFullscreen) toggleFullscreen();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [next, prev, isFullscreen]);

  const toggleFullscreen = async () => {
    if (!isFullscreen && wrapperRef.current) { await wrapperRef.current.requestFullscreen?.(); setIsFullscreen(true); }
    else { await document.exitFullscreen?.(); setIsFullscreen(false); }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const handleSubmitFeedback = async () => {
    if (!sharedId) return;
    setSubmitting(true);
    try {
      await supabase.from("presentation_feedback").insert({
        shared_presentation_id: sharedId,
        service_quality: serviceQuality,
        overall_sentiment: feedbackComments ? "commented" : serviceQuality === "up" ? "positive" : serviceQuality === "down" ? "negative" : "neutral",
        deliverable_ratings: itemRatings.filter(r => r.rating || r.comment || r.priority > 0),
        sysde_response_rating: sysdeResponseRating,
        comments: feedbackComments,
        media_urls: mediaUrls,
        priority_rankings: itemRatings.map((r, i) => ({ id: r.id, name: r.name, priority: i + 1, rating: r.rating })),
      } as any);
      setFeedbackSubmitted(true);
      toast.success("¡Gracias por tu feedback!");
    } catch {
      toast.error("Error al enviar feedback");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Sonner />
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Cargando presentación...</p>
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Sonner />
        <div className="text-center space-y-4">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto" />
          <h2 className="text-lg font-bold text-foreground">{error}</h2>
          <p className="text-sm text-muted-foreground">Contacta al equipo de SYSDE para obtener un nuevo enlace.</p>
        </div>
      </div>
    );
  }

  const pendingTasks = client.tasks.filter(t => t.status === "pendiente" || t.status === "bloqueada");
  const inProgressTasks = client.tasks.filter(t => t.status === "en-progreso");
  const completedTasks = client.tasks.filter(t => t.status === "completada");
  const blockedTasks = client.tasks.filter(t => t.status === "bloqueada");
  const pendingDeliverables = client.deliverables.filter(d => d.status === "pendiente" || d.status === "en-revision");
  const openRisks = client.risks.filter(r => r.status === "abierto");
  const f = client.financials;
  const getItemRating = (id: string) => itemRatings.find(r => r.id === id);

  const slideMap: Record<number, React.ReactNode> = {
    0: (
      <SlideLayout className="bg-gradient-to-br from-[hsl(var(--primary))] via-[hsl(var(--primary)/0.85)] to-[hsl(var(--primary)/0.7)]">
        <div className="absolute inset-0 flex flex-col justify-center px-[160px]">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}>
            <p className="text-[28px] font-medium text-white/70 tracking-[6px] uppercase mb-[20px]">SYSDE · Gestión de Soporte</p>
            <h1 className="text-[96px] font-extrabold text-white leading-[1.05] mb-[40px]">{client.name}</h1>
            <div className="w-[200px] h-[6px] bg-white/40 rounded-full mb-[40px]" />
            <p className="text-[36px] text-white/80">{title}</p>
            <p className="text-[22px] text-white/50 mt-[24px]">👍👎 Califica cada elemento · 🎤 Graba tu feedback · ↕️ Prioriza lo importante</p>
          </motion.div>
        </div>
      </SlideLayout>
    ),
    1: (
      <SlideLayout className="bg-[hsl(var(--background))]">
        <div className="absolute inset-0 px-[120px] py-[80px]">
          <div className="flex items-center gap-[16px] mb-[60px]">
            <div className="w-[8px] h-[48px] rounded-full bg-[hsl(var(--primary))]" />
            <h2 className="text-[56px] font-bold text-[hsl(var(--foreground))]">Resumen Ejecutivo</h2>
          </div>
          <div className="grid grid-cols-4 gap-[32px] mb-[60px]">
            {[
              { label: "Progreso", value: `${client.progress}%`, icon: TrendingUp, color: "hsl(var(--primary))" },
              { label: "Tareas Activas", value: `${inProgressTasks.length + pendingTasks.length}`, icon: ListChecks, color: "hsl(var(--warning))" },
              { label: "Riesgos Abiertos", value: `${openRisks.length}`, icon: AlertTriangle, color: "hsl(var(--destructive))" },
              { label: "Entregables Pend.", value: `${pendingDeliverables.length}`, icon: Package, color: "hsl(var(--info))" },
            ].map((kpi, i) => (
              <motion.div key={kpi.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="rounded-[24px] border-[2px] border-[hsl(var(--border))] p-[40px]">
                <kpi.icon style={{ color: kpi.color, width: 36, height: 36, marginBottom: 16 }} />
                <p className="text-[64px] font-extrabold text-[hsl(var(--foreground))] leading-none">{kpi.value}</p>
                <p className="text-[24px] text-[hsl(var(--muted-foreground))] mt-[8px] uppercase">{kpi.label}</p>
              </motion.div>
            ))}
          </div>
          <div className="rounded-[20px] border-[2px] border-[hsl(var(--border))] p-[40px]">
            <div className="flex justify-between items-center mb-[16px]">
              <span className="text-[28px] font-semibold text-[hsl(var(--foreground))]">Progreso General</span>
              <span className="text-[36px] font-bold text-[hsl(var(--primary))]">{client.progress}%</span>
            </div>
            <div className="w-full h-[20px] rounded-full bg-[hsl(var(--muted))] overflow-hidden">
              <motion.div className="h-full rounded-full bg-[hsl(var(--primary))]" initial={{ width: 0 }} animate={{ width: `${client.progress}%` }} transition={{ delay: 0.3, duration: 0.8 }} />
            </div>
          </div>
        </div>
      </SlideLayout>
    ),
    2: (
      <SlideLayout className="bg-[hsl(var(--background))]">
        <div className="absolute inset-0 px-[120px] py-[60px]">
          <div className="flex items-center gap-[16px] mb-[36px]">
            <div className="w-[8px] h-[48px] rounded-full bg-[hsl(var(--warning))]" />
            <h2 className="text-[56px] font-bold text-[hsl(var(--foreground))]">Estado de Tareas</h2>
            <span className="text-[20px] text-[hsl(var(--muted-foreground))] ml-auto">👍👎 Califica cada tarea</span>
          </div>
          <div className="grid grid-cols-4 gap-[24px] mb-[32px]">
            {[
              { label: "Completadas", count: completedTasks.length, color: "hsl(var(--success))", icon: CheckCircle2 },
              { label: "En Progreso", count: inProgressTasks.length, color: "hsl(var(--info))", icon: Clock },
              { label: "Pendientes", count: client.tasks.filter(t => t.status === "pendiente").length, color: "hsl(var(--warning))", icon: Circle },
              { label: "Bloqueadas", count: blockedTasks.length, color: "hsl(var(--destructive))", icon: AlertTriangle },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }}
                className="rounded-[20px] p-[24px] text-center border-[2px] border-[hsl(var(--border))]">
                <s.icon style={{ color: s.color, width: 28, height: 28, margin: "0 auto 8px" }} />
                <p className="text-[48px] font-extrabold" style={{ color: s.color }}>{s.count}</p>
                <p className="text-[18px] text-[hsl(var(--muted-foreground))] uppercase">{s.label}</p>
              </motion.div>
            ))}
          </div>
          <div className="space-y-[10px] max-h-[560px] overflow-y-auto pr-[8px]" style={{ scrollbarWidth: "thin" }}>
            {[...pendingTasks, ...inProgressTasks, ...blockedTasks].slice(0, 8).map((t, i) => {
              const sc = t.status === "completada" ? "hsl(var(--success))" : t.status === "en-progreso" ? "hsl(var(--info))" : t.status === "bloqueada" ? "hsl(var(--destructive))" : "hsl(var(--warning))";
              const ir = getItemRating(`task-${t.id}`);
              return (
                <motion.div key={t.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
                  className="rounded-[16px] border-[2px] border-[hsl(var(--border))] px-[28px] py-[16px]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-[16px] min-w-0 flex-1">
                      <span className="text-[18px] font-mono text-[hsl(var(--muted-foreground))]">#{t.id}</span>
                      <p className="text-[22px] font-medium text-[hsl(var(--foreground))] truncate">{t.title}</p>
                    </div>
                    <div className="flex items-center gap-[12px] shrink-0">
                      <span className="px-[14px] py-[5px] rounded-full text-[16px] font-semibold text-white" style={{ background: sc }}>{t.status}</span>
                      <InlineThumbRating id={`task-${t.id}`} rating={ir?.rating || null} onRate={rateItem} compact />
                    </div>
                  </div>
                  {ir?.rating && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="mt-[8px]">
                      <InlineComment id={`task-${t.id}`} value={ir?.comment || ""} onChange={commentItem} placeholder="¿Algún comentario sobre esta tarea?" />
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </SlideLayout>
    ),
    3: (
      <SlideLayout className="bg-[hsl(var(--background))]">
        <div className="absolute inset-0 px-[120px] py-[60px]">
          <div className="flex items-center gap-[16px] mb-[36px]">
            <div className="w-[8px] h-[48px] rounded-full bg-[hsl(var(--info))]" />
            <h2 className="text-[56px] font-bold text-[hsl(var(--foreground))]">Entregables</h2>
            <span className="text-[20px] text-[hsl(var(--muted-foreground))] ml-auto">👍👎 Evalúa cada uno</span>
          </div>
          <div className="grid grid-cols-2 gap-[24px]">
            {client.deliverables.slice(0, 6).map((d, i) => {
              const sc: Record<string, string> = { "aprobado": "hsl(var(--success))", "entregado": "hsl(var(--info))", "en-revision": "hsl(var(--warning))", "pendiente": "hsl(var(--muted-foreground))" };
              const ir = getItemRating(`del-${d.id}`);
              return (
                <motion.div key={d.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="rounded-[20px] border-[2px] border-[hsl(var(--border))] p-[28px] relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-[4px]" style={{ background: sc[d.status] }} />
                  <div className="flex justify-between items-start mb-[8px]">
                    <div className="flex-1 min-w-0">
                      <p className="text-[16px] font-mono text-[hsl(var(--muted-foreground))]">{d.id}</p>
                      <p className="text-[24px] font-semibold text-[hsl(var(--foreground))] leading-tight">{d.name}</p>
                    </div>
                    <InlineThumbRating id={`del-${d.id}`} rating={ir?.rating || null} onRate={rateItem} compact />
                  </div>
                  <div className="flex gap-[12px] items-center mb-[8px]">
                    <span className="px-[12px] py-[4px] rounded-full text-[14px] font-semibold text-white" style={{ background: sc[d.status] }}>{d.status}</span>
                    <span className="text-[16px] text-[hsl(var(--muted-foreground))]">v{d.version}</span>
                  </div>
                  {ir?.rating && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="mt-[8px]">
                      <InlineComment id={`del-${d.id}`} value={ir?.comment || ""} onChange={commentItem} placeholder="¿Qué opinas de este entregable?" />
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </SlideLayout>
    ),
    4: (
      <SlideLayout className="bg-[hsl(var(--background))]">
        <div className="absolute inset-0 px-[120px] py-[60px]">
          <div className="flex items-center gap-[16px] mb-[36px]">
            <div className="w-[8px] h-[48px] rounded-full bg-[hsl(var(--destructive))]" />
            <h2 className="text-[56px] font-bold text-[hsl(var(--foreground))]">Riesgos</h2>
            <span className="text-[20px] text-[hsl(var(--muted-foreground))] ml-auto">👍👎 ¿Están bien gestionados?</span>
          </div>
          <div className="space-y-[16px]">
            {client.risks.slice(0, 5).map((r, i) => {
              const ic = r.impact === "alto" ? "hsl(var(--destructive))" : r.impact === "medio" ? "hsl(var(--warning))" : "hsl(var(--success))";
              const ir = getItemRating(`risk-${r.id}`);
              return (
                <motion.div key={r.id} initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                  className="rounded-[20px] border-[2px] border-[hsl(var(--border))] p-[28px]">
                  <div className="flex items-start gap-[20px]">
                    <div className="w-[12px] h-[12px] rounded-full mt-[10px] shrink-0" style={{ background: ic }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[24px] font-medium text-[hsl(var(--foreground))] leading-tight mb-[6px]">{r.description}</p>
                      {r.mitigation && <p className="text-[20px] text-[hsl(var(--muted-foreground))]">Mitigación: {r.mitigation}</p>}
                    </div>
                    <div className="flex items-center gap-[12px] shrink-0">
                      <span className="px-[14px] py-[5px] rounded-full text-[16px] font-semibold text-white" style={{ background: ic }}>{r.impact}</span>
                      <InlineThumbRating id={`risk-${r.id}`} rating={ir?.rating || null} onRate={rateItem} compact />
                    </div>
                  </div>
                  {ir?.rating && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="mt-[10px] ml-[32px]">
                      <InlineComment id={`risk-${r.id}`} value={ir?.comment || ""} onChange={commentItem} placeholder="¿Algo que agregar sobre este riesgo?" />
                    </motion.div>
                  )}
                </motion.div>
              );
            })}
          </div>
        </div>
      </SlideLayout>
    ),
    5: (
      <SlideLayout className="bg-[hsl(var(--background))]">
        <div className="absolute inset-0 px-[120px] py-[80px]">
          <div className="flex items-center gap-[16px] mb-[48px]">
            <div className="w-[8px] h-[48px] rounded-full bg-[hsl(var(--success))]" />
            <h2 className="text-[56px] font-bold text-[hsl(var(--foreground))]">Financiero & Recursos</h2>
          </div>
          <div className="grid grid-cols-2 gap-[32px] mb-[48px]">
            {[
              { label: "Valor Contrato", value: `$${(f.contractValue / 1000).toFixed(0)}K`, pct: undefined },
              { label: "Facturado", value: `$${(f.billed / 1000).toFixed(0)}K`, pct: f.contractValue > 0 ? Math.round((f.billed / f.contractValue) * 100) : 0 },
              { label: "Cobrado", value: `$${(f.paid / 1000).toFixed(0)}K`, pct: f.contractValue > 0 ? Math.round((f.paid / f.contractValue) * 100) : 0 },
              { label: "Horas", value: `${f.hoursUsed}h / ${f.hoursEstimated}h`, pct: f.hoursEstimated > 0 ? Math.round((f.hoursUsed / f.hoursEstimated) * 100) : 0 },
            ].map((item, i) => (
              <motion.div key={item.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
                className="rounded-[24px] border-[2px] border-[hsl(var(--border))] p-[48px]">
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
        </div>
      </SlideLayout>
    ),
    6: (
      <SlideLayout className="bg-gradient-to-br from-[hsl(var(--primary))] via-[hsl(var(--primary)/0.9)] to-[hsl(var(--primary)/0.7)]">
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <h2 className="text-[72px] font-extrabold text-white mb-[24px]">Próximos Pasos</h2>
            <p className="text-[32px] text-white/70 max-w-[900px]">
              Continuaremos trabajando en las tareas pendientes y mantendremos comunicación constante.
            </p>
          </motion.div>
        </div>
      </SlideLayout>
    ),
  };

  const actualSlides: React.ReactNode[] = selectedSlides.map(id => slideMap[id]).filter(Boolean);

  // Feedback slide with audio/video, prioritization
  const feedbackSlide = (
    <SlideLayout className="bg-[hsl(var(--background))]">
      <div className="absolute inset-0 px-[80px] py-[40px] overflow-y-auto" style={{ scrollbarWidth: "thin" }}>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <div className="flex items-center gap-[16px] mb-[28px]">
            <div className="w-[8px] h-[48px] rounded-full bg-[hsl(var(--primary))]" />
            <h2 className="text-[48px] font-bold text-[hsl(var(--foreground))]">Tu Opinión</h2>
            <span className="text-[20px] text-[hsl(var(--muted-foreground))] ml-auto">Prioriza · Califica · Graba</span>
          </div>

          {feedbackSubmitted ? (
            <div className="flex flex-col items-center justify-center py-[100px]">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                <CheckCircle2 style={{ width: 120, height: 120, color: "hsl(var(--success))" }} />
              </motion.div>
              <h3 className="text-[48px] font-bold text-[hsl(var(--foreground))] mt-[40px]">¡Gracias por tu feedback!</h3>
              <p className="text-[28px] text-[hsl(var(--muted-foreground))] mt-[16px]">Tu opinión nos ayuda a mejorar.</p>
            </div>
          ) : (
            <div className="grid grid-cols-[1fr_1fr] gap-[28px]">
              {/* Left column */}
              <div className="space-y-[20px]">
                {/* Service quality */}
                <div className="rounded-[20px] border-[2px] border-[hsl(var(--border))] p-[28px]">
                  <h3 className="text-[24px] font-semibold text-[hsl(var(--foreground))] mb-[16px]">
                    <Star style={{ width: 24, height: 24, display: "inline", marginRight: 10, color: "hsl(var(--warning))" }} />
                    Calidad del servicio
                  </h3>
                  <div className="flex gap-[16px]">
                    <button onClick={() => setServiceQuality("up")}
                      className={cn("flex-1 rounded-[16px] border-[3px] p-[20px] flex flex-col items-center gap-[10px] transition-all",
                        serviceQuality === "up" ? "border-[hsl(var(--success))] bg-[hsl(var(--success)/0.1)]" : "border-[hsl(var(--border))] hover:border-[hsl(var(--success)/0.5)]")}>
                      <ThumbsUp style={{ width: 44, height: 44, color: serviceQuality === "up" ? "hsl(var(--success))" : "hsl(var(--muted-foreground))" }} />
                      <span className="text-[20px] font-semibold" style={{ color: serviceQuality === "up" ? "hsl(var(--success))" : "hsl(var(--muted-foreground))" }}>Satisfecho</span>
                    </button>
                    <button onClick={() => setServiceQuality("down")}
                      className={cn("flex-1 rounded-[16px] border-[3px] p-[20px] flex flex-col items-center gap-[10px] transition-all",
                        serviceQuality === "down" ? "border-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/0.1)]" : "border-[hsl(var(--border))] hover:border-[hsl(var(--destructive)/0.5)]")}>
                      <ThumbsDown style={{ width: 44, height: 44, color: serviceQuality === "down" ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))" }} />
                      <span className="text-[20px] font-semibold" style={{ color: serviceQuality === "down" ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))" }}>Insatisfecho</span>
                    </button>
                  </div>
                </div>

                {/* SYSDE response */}
                <div className="rounded-[20px] border-[2px] border-[hsl(var(--border))] p-[28px]">
                  <h3 className="text-[24px] font-semibold text-[hsl(var(--foreground))] mb-[16px]">
                    <MessageSquare style={{ width: 24, height: 24, display: "inline", marginRight: 10, color: "hsl(var(--info))" }} />
                    Respuesta de SYSDE
                  </h3>
                  <div className="flex gap-[16px]">
                    <button onClick={() => setSysdeResponseRating("up")}
                      className={cn("flex-1 rounded-[16px] border-[3px] p-[18px] flex flex-col items-center gap-[8px] transition-all",
                        sysdeResponseRating === "up" ? "border-[hsl(var(--success))] bg-[hsl(var(--success)/0.1)]" : "border-[hsl(var(--border))] hover:border-[hsl(var(--success)/0.5)]")}>
                      <ThumbsUp style={{ width: 32, height: 32, color: sysdeResponseRating === "up" ? "hsl(var(--success))" : "hsl(var(--muted-foreground))" }} />
                      <span className="text-[18px] font-semibold" style={{ color: sysdeResponseRating === "up" ? "hsl(var(--success))" : "hsl(var(--muted-foreground))" }}>Buena</span>
                    </button>
                    <button onClick={() => setSysdeResponseRating("down")}
                      className={cn("flex-1 rounded-[16px] border-[3px] p-[18px] flex flex-col items-center gap-[8px] transition-all",
                        sysdeResponseRating === "down" ? "border-[hsl(var(--destructive))] bg-[hsl(var(--destructive)/0.1)]" : "border-[hsl(var(--border))] hover:border-[hsl(var(--destructive)/0.5)]")}>
                      <ThumbsDown style={{ width: 32, height: 32, color: sysdeResponseRating === "down" ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))" }} />
                      <span className="text-[18px] font-semibold" style={{ color: sysdeResponseRating === "down" ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))" }}>Mejorable</span>
                    </button>
                  </div>
                </div>

                {/* Audio/Video recorder */}
                {sharedId && <MediaRecorderWidget onRecorded={onMediaRecorded} sharedId={sharedId} />}

                {/* Comments */}
                <div className="rounded-[20px] border-[2px] border-[hsl(var(--border))] p-[28px]">
                  <h3 className="text-[24px] font-semibold text-[hsl(var(--foreground))] mb-[12px]">Comentarios generales</h3>
                  <textarea value={feedbackComments} onChange={e => setFeedbackComments(e.target.value)}
                    placeholder="Escribe tus comentarios aquí..."
                    className="w-full h-[90px] bg-[hsl(var(--muted))] rounded-[14px] p-[16px] text-[20px] text-[hsl(var(--foreground))] resize-none border-0 outline-none placeholder:text-[hsl(var(--muted-foreground))]"
                  />
                </div>

                {/* Submit */}
                <button onClick={handleSubmitFeedback} disabled={submitting}
                  className="w-full rounded-[16px] bg-[hsl(var(--primary))] text-white py-[18px] text-[24px] font-bold hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-[14px]">
                  {submitting ? <div className="w-[28px] h-[28px] border-[3px] border-white border-t-transparent rounded-full animate-spin" /> : <><Send style={{ width: 24, height: 24 }} /> Enviar Feedback</>}
                </button>
              </div>

              {/* Right: Prioritization list */}
              <div className="rounded-[20px] border-[2px] border-[hsl(var(--border))] p-[28px]">
                <h3 className="text-[24px] font-semibold text-[hsl(var(--foreground))] mb-[8px]">
                  <ArrowUpDown style={{ width: 24, height: 24, display: "inline", marginRight: 10, color: "hsl(var(--primary))" }} />
                  Prioriza lo que más te importa
                </h3>
                <p className="text-[16px] text-[hsl(var(--muted-foreground))] mb-[16px]">Usa las flechas para reordenar según tu prioridad</p>
                <div className="space-y-[6px] max-h-[700px] overflow-y-auto pr-[8px]" style={{ scrollbarWidth: "thin" }}>
                  {itemRatings.map((item, idx) => {
                    const type = item.id.split("-")[0];
                    const typeLabel = type === "task" ? "Tarea" : type === "del" ? "Entregable" : type === "action" ? "Pendiente" : "Riesgo";
                    const typeColor = type === "task" ? "hsl(var(--info))" : type === "del" ? "hsl(var(--primary))" : type === "action" ? "hsl(var(--warning))" : "hsl(var(--destructive))";
                    return (
                      <motion.div key={item.id} layout className="flex items-center gap-[10px] rounded-[14px] border-[2px] border-[hsl(var(--border))] p-[12px] hover:bg-[hsl(var(--muted)/0.5)] transition-colors">
                        <div className="flex flex-col gap-[2px] shrink-0">
                          <button onClick={() => prioritizeItem(item.id, "up")} className="p-[4px] rounded hover:bg-[hsl(var(--muted))] transition-colors" disabled={idx === 0}>
                            <ChevronLeft style={{ width: 16, height: 16, transform: "rotate(90deg)", color: idx === 0 ? "hsl(var(--muted-foreground)/0.3)" : "hsl(var(--foreground))" }} />
                          </button>
                          <button onClick={() => prioritizeItem(item.id, "down")} className="p-[4px] rounded hover:bg-[hsl(var(--muted))] transition-colors" disabled={idx === itemRatings.length - 1}>
                            <ChevronLeft style={{ width: 16, height: 16, transform: "rotate(-90deg)", color: idx === itemRatings.length - 1 ? "hsl(var(--muted-foreground)/0.3)" : "hsl(var(--foreground))" }} />
                          </button>
                        </div>
                        <span className="text-[14px] font-bold text-[hsl(var(--muted-foreground))] w-[28px] text-center shrink-0">#{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[16px] font-medium text-[hsl(var(--foreground))] truncate">{item.name}</p>
                          <span className="text-[12px] font-bold" style={{ color: typeColor }}>{typeLabel}</span>
                        </div>
                        <InlineThumbRating id={item.id} rating={item.rating} onRate={rateItem} compact />
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </SlideLayout>
  );

  actualSlides.push(feedbackSlide);
  const allSlideNames = [...selectedSlides.map(id => ["Portada", "Resumen", "Tareas", "Entregables", "Riesgos", "Financiero", "Cierre"][id] || `Slide ${id}`), "Feedback"];

  return (
    <div ref={wrapperRef} className="h-screen bg-black/95 flex flex-col">
      <Sonner />

      {/* Popup prompt */}
      <AnimatePresence>
        {activePopup && !feedbackSubmitted && (
          <motion.div initial={{ opacity: 0, y: -20, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.9 }}
            className="fixed top-6 right-6 z-50 bg-white dark:bg-card rounded-2xl shadow-2xl border border-border px-6 py-4 max-w-[320px]">
            <div className="flex items-start gap-3">
              <MessageSquare className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-foreground">{activePopup}</p>
                <p className="text-xs text-muted-foreground mt-1">Usa 👍👎 en cada elemento para opinar</p>
              </div>
              <button onClick={() => setActivePopup(null)} className="text-muted-foreground hover:text-foreground text-lg shrink-0">×</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2 bg-black/50 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-white/50 text-sm">{allSlideNames[currentSlide]} · {currentSlide + 1}/{actualSlides.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-white/30 text-xs">SYSDE · {client.name}</span>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="text-white/70 hover:text-white hover:bg-white/10">
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      <div className="flex-1 relative overflow-hidden" ref={containerRef}>
        <AnimatePresence mode="wait">
          <motion.div key={currentSlide} initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -60 }} transition={{ duration: 0.3 }} className="absolute inset-0">
            <ScaledSlide containerRef={containerRef}>{actualSlides[currentSlide]}</ScaledSlide>
          </motion.div>
        </AnimatePresence>

        {currentSlide > 0 && (
          <button onClick={prev} className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"><ChevronLeft className="h-6 w-6" /></button>
        )}
        {currentSlide < actualSlides.length - 1 && (
          <button onClick={next} className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors z-10"><ChevronRight className="h-6 w-6" /></button>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 px-4 py-3 bg-black/50 shrink-0">
        {allSlideNames.map((name, i) => (
          <button key={i} onClick={() => setCurrentSlide(i)}
            className={cn("px-3 py-1.5 rounded-lg text-xs transition-all", i === currentSlide ? "bg-white/20 text-white font-medium" : "text-white/40 hover:text-white/70 hover:bg-white/5")}
          >{name}</button>
        ))}
      </div>
    </div>
  );
}
