import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Headset, Calendar, AlertTriangle, FileText, CheckSquare, ArrowRight,
  Loader2, ChevronLeft, ChevronRight, BarChart3, ThumbsUp, ThumbsDown, Send,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Snapshot {
  minuta: {
    title: string;
    date: string;
    summary: string;
    attendees: string[];
    agreements: string[];
    action_items: string[];
    cases_referenced: string[];
  };
  tickets: Array<{
    ticket_id: string; asunto: string; estado: string; prioridad: string;
    tipo: string; producto: string; responsable?: string; dias_antiguedad: number;
    case_agreements?: any[]; case_actions?: any[];
  }>;
  clientName: string;
}

interface SharedRow {
  id: string;
  title: string;
  selected_slides: number[];
  presentation_snapshot: Snapshot;
  expires_at: string;
}

export default function SharedSupportPresentation() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const [feedbackSentiment, setFeedbackSentiment] = useState<"up" | "down" | null>(null);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("shared_support_presentations")
        .select("id, title, selected_slides, presentation_snapshot, expires_at")
        .eq("token", token)
        .maybeSingle();
      if (error || !data) {
        setError("Presentación no encontrada o expirada.");
        setLoading(false);
        return;
      }
      if (new Date(data.expires_at) < new Date()) {
        setError("Esta presentación ha expirado.");
        setLoading(false);
        return;
      }
      setData(data as any);
      setLoading(false);
    })();
  }, [token]);

  const handleSubmitFeedback = async () => {
    if (!data) return;
    if (!feedbackSentiment) {
      toast.error("Por favor califica la presentación");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from("support_presentation_feedback").insert({
        shared_presentation_id: data.id,
        overall_sentiment: feedbackSentiment,
        comments: feedbackComment || null,
      });
      if (error) throw error;
      setSubmitted(true);
      toast.success("¡Gracias por tu feedback!");
    } catch (e: any) {
      toast.error(e.message || "Error enviando feedback");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-6 text-center">
            <AlertTriangle className="h-10 w-10 text-warning mx-auto mb-3" />
            <h1 className="text-lg font-bold mb-1">No disponible</h1>
            <p className="text-sm text-muted-foreground">{error || "Esta presentación no existe."}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { minuta, tickets, clientName } = data.presentation_snapshot;
  const selected = data.selected_slides || [0, 1, 2, 3, 4, 5, 6];
  const totalSlides = selected.length + 1; // +1 feedback
  const isFeedbackSlide = activeSlide === selected.length;
  const currentSlideId = selected[activeSlide];

  const criticalTickets = tickets.filter(t => t.prioridad?.toLowerCase().includes("critica"));
  const openTickets = tickets.filter(t => !["CERRADA", "ENTREGADA", "ANULADA"].includes(t.estado));

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20 flex flex-col">
      {/* Header */}
      <header className="border-b border-border bg-card/80 backdrop-blur-sm sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Headset className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Soporte Sysde · {clientName}</p>
              <h1 className="text-sm font-bold truncate">{data.title}</h1>
            </div>
          </div>
          <Badge variant="outline" className="text-[10px] shrink-0">
            {activeSlide + 1} / {totalSlides}
          </Badge>
        </div>
        <div className="h-1 bg-muted">
          <motion.div
            initial={false}
            animate={{ width: `${((activeSlide + 1) / totalSlides) * 100}%` }}
            transition={{ duration: 0.4 }}
            className="h-full bg-primary"
          />
        </div>
      </header>

      {/* Slide content */}
      <main className="flex-1 max-w-5xl mx-auto w-full px-4 py-6 md:py-10">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeSlide}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25 }}
          >
            {!isFeedbackSlide && currentSlideId === 0 && (
              <SlidePortada minuta={minuta} clientName={clientName} />
            )}
            {!isFeedbackSlide && currentSlideId === 1 && (
              <SlideMetricas tickets={tickets} openCount={openTickets.length} criticalCount={criticalTickets.length} />
            )}
            {!isFeedbackSlide && currentSlideId === 2 && (
              <SlideCriticos tickets={criticalTickets} />
            )}
            {!isFeedbackSlide && currentSlideId === 3 && (
              <SlideCasos tickets={tickets} />
            )}
            {!isFeedbackSlide && currentSlideId === 4 && (
              <SlideAcuerdos items={minuta.agreements} title="Acuerdos" icon={CheckSquare} color="success" />
            )}
            {!isFeedbackSlide && currentSlideId === 5 && (
              <SlideAcuerdos items={minuta.action_items} title="Acciones de Seguimiento" icon={ArrowRight} color="info" />
            )}
            {!isFeedbackSlide && currentSlideId === 6 && (
              <SlideCierre clientName={clientName} />
            )}
            {isFeedbackSlide && (
              <SlideFeedback
                submitted={submitted}
                sentiment={feedbackSentiment}
                onSentimentChange={setFeedbackSentiment}
                comment={feedbackComment}
                onCommentChange={setFeedbackComment}
                onSubmit={handleSubmitFeedback}
                submitting={submitting}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Footer nav */}
      <footer className="border-t border-border bg-card/80 backdrop-blur-sm sticky bottom-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={activeSlide === 0}
            onClick={() => setActiveSlide(s => Math.max(0, s - 1))}
            className="gap-1"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </Button>
          <div className="flex gap-1.5">
            {Array.from({ length: totalSlides }).map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveSlide(i)}
                className={cn(
                  "h-2 rounded-full transition-all",
                  i === activeSlide ? "w-6 bg-primary" : "w-2 bg-muted hover:bg-muted-foreground/40"
                )}
                aria-label={`Ir a slide ${i + 1}`}
              />
            ))}
          </div>
          <Button
            size="sm"
            disabled={activeSlide === totalSlides - 1}
            onClick={() => setActiveSlide(s => Math.min(totalSlides - 1, s + 1))}
            className="gap-1"
          >
            Siguiente <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </footer>
    </div>
  );
}

// ── Slide components ────────────────────────────
function SlidePortada({ minuta, clientName }: { minuta: any; clientName: string }) {
  return (
    <div className="text-center py-12 md:py-20">
      <div className="inline-flex h-20 w-20 rounded-3xl bg-primary/10 items-center justify-center mb-6">
        <Headset className="h-10 w-10 text-primary" />
      </div>
      <p className="text-xs uppercase tracking-widest text-muted-foreground font-bold mb-2">Sesión de Soporte</p>
      <h1 className="text-3xl md:text-5xl font-black mb-3">{clientName}</h1>
      <p className="text-base md:text-lg text-muted-foreground mb-6">{minuta.title}</p>
      <Badge variant="outline" className="text-sm gap-2 px-3 py-1.5">
        <Calendar className="h-3.5 w-3.5" />
        {new Date(minuta.date).toLocaleDateString("es", { day: "2-digit", month: "long", year: "numeric" })}
      </Badge>
    </div>
  );
}

function SlideMetricas({ tickets, openCount, criticalCount }: { tickets: any[]; openCount: number; criticalCount: number }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-black">Métricas de la sesión</h2>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Total casos" value={tickets.length} />
        <MetricCard label="Abiertos" value={openCount} tone="warning" />
        <MetricCard label="Críticos" value={criticalCount} tone="destructive" />
        <MetricCard label="Cerrados" value={tickets.length - openCount} tone="success" />
      </div>
    </div>
  );
}

function MetricCard({ label, value, tone }: { label: string; value: number; tone?: "warning" | "destructive" | "success" }) {
  return (
    <Card>
      <CardContent className="p-5 text-center">
        <p className={cn(
          "text-4xl font-black tabular-nums mb-1",
          tone === "warning" && "text-warning",
          tone === "destructive" && "text-destructive",
          tone === "success" && "text-success",
        )}>{value}</p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      </CardContent>
    </Card>
  );
}

function SlideCriticos({ tickets }: { tickets: any[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <h2 className="text-2xl font-black">Casos Críticos</h2>
      </div>
      {tickets.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No hay casos críticos en esta sesión.</CardContent></Card>
      ) : (
        tickets.map(t => (
          <Card key={t.ticket_id} className="border-destructive/30">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-3 mb-2">
                <p className="text-sm font-bold">{t.asunto}</p>
                <Badge variant="destructive" className="text-[10px] shrink-0">Crítica</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{t.ticket_id} · {t.producto} · {t.dias_antiguedad}d</p>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

function SlideCasos({ tickets }: { tickets: any[] }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <h2 className="text-2xl font-black">Detalle de Casos</h2>
        <Badge variant="outline" className="text-[10px]">{tickets.length}</Badge>
      </div>
      <div className="space-y-2 max-h-[60vh] overflow-y-auto">
        {tickets.map(t => (
          <Card key={t.ticket_id}>
            <CardContent className="p-3">
              <div className="flex items-start justify-between gap-3 mb-1">
                <p className="text-sm font-semibold leading-tight">{t.asunto}</p>
                <Badge variant="outline" className="text-[9px] shrink-0">{t.estado}</Badge>
              </div>
              <p className="text-[10px] text-muted-foreground">{t.ticket_id} · {t.producto} · {t.prioridad}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

function SlideAcuerdos({ items, title, icon: Icon, color }: { items: string[]; title: string; icon: any; color: "success" | "info" }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-5 w-5", color === "success" ? "text-success" : "text-info")} />
        <h2 className="text-2xl font-black">{title}</h2>
        <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
      </div>
      {items.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">No hay {title.toLowerCase()} registrados.</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {items.map((it, i) => (
            <Card key={i}><CardContent className="p-3 text-sm">{it}</CardContent></Card>
          ))}
        </div>
      )}
    </div>
  );
}

function SlideCierre({ clientName }: { clientName: string }) {
  return (
    <div className="text-center py-12 md:py-20">
      <div className="inline-flex h-20 w-20 rounded-3xl bg-primary/10 items-center justify-center mb-6">
        <Headset className="h-10 w-10 text-primary" />
      </div>
      <h2 className="text-3xl md:text-4xl font-black mb-3">¡Gracias, {clientName}!</h2>
      <p className="text-base md:text-lg text-muted-foreground max-w-xl mx-auto">
        El equipo de Soporte Sysde está disponible para apoyarte en cualquier consulta. Contáctanos cuando lo necesites.
      </p>
    </div>
  );
}

function SlideFeedback({ submitted, sentiment, onSentimentChange, comment, onCommentChange, onSubmit, submitting }: {
  submitted: boolean;
  sentiment: "up" | "down" | null;
  onSentimentChange: (s: "up" | "down") => void;
  comment: string;
  onCommentChange: (s: string) => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  if (submitted) {
    return (
      <div className="text-center py-16">
        <div className="inline-flex h-16 w-16 rounded-full bg-success/15 items-center justify-center mb-4">
          <ThumbsUp className="h-7 w-7 text-success" />
        </div>
        <h2 className="text-2xl font-bold mb-2">¡Feedback recibido!</h2>
        <p className="text-sm text-muted-foreground">Gracias por tu evaluación.</p>
      </div>
    );
  }
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-black mb-2">¿Cómo evalúas esta sesión?</h2>
        <p className="text-sm text-muted-foreground">Tu feedback nos ayuda a mejorar el servicio</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={() => onSentimentChange("up")}
          className={cn(
            "p-6 rounded-2xl border-2 transition-all",
            sentiment === "up" ? "border-success bg-success/10" : "border-border hover:border-success/40"
          )}
        >
          <ThumbsUp className={cn("h-10 w-10 mx-auto mb-2", sentiment === "up" ? "text-success" : "text-muted-foreground")} />
          <p className="font-bold text-sm">Satisfecho</p>
        </button>
        <button
          onClick={() => onSentimentChange("down")}
          className={cn(
            "p-6 rounded-2xl border-2 transition-all",
            sentiment === "down" ? "border-destructive bg-destructive/10" : "border-border hover:border-destructive/40"
          )}
        >
          <ThumbsDown className={cn("h-10 w-10 mx-auto mb-2", sentiment === "down" ? "text-destructive" : "text-muted-foreground")} />
          <p className="font-bold text-sm">Mejorable</p>
        </button>
      </div>
      <textarea
        value={comment}
        onChange={(e) => onCommentChange(e.target.value)}
        placeholder="Comentarios opcionales..."
        rows={4}
        className="w-full rounded-xl border border-border bg-background p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
      />
      <Button
        onClick={onSubmit}
        disabled={submitting || !sentiment}
        className="w-full h-11 gap-2"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        Enviar feedback
      </Button>
    </div>
  );
}
