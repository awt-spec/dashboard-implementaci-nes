import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Link2, Copy, Check, X, Share2, Loader2,
  BarChart3, FileText, AlertTriangle, CheckSquare, ArrowRight, Headset
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { SupportTicket } from "@/hooks/useSupportTickets";

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
}

const SLIDE_OPTIONS = [
  { id: 0, label: "Portada", icon: Headset, desc: "Logo y cliente" },
  { id: 1, label: "Métricas", icon: BarChart3, desc: "KPIs de la sesión" },
  { id: 2, label: "Casos Críticos", icon: AlertTriangle, desc: "Prioridad alta" },
  { id: 3, label: "Detalle de Casos", icon: FileText, desc: "Todos los casos" },
  { id: 4, label: "Acuerdos", icon: CheckSquare, desc: "Compromisos" },
  { id: 5, label: "Acciones", icon: ArrowRight, desc: "Seguimiento" },
  { id: 6, label: "Cierre", icon: Headset, desc: "Despedida" },
];

export function ShareSupportPresentationDialog({ minuta, tickets, clientName, open, onClose }: Props) {
  const [selectedSlides, setSelectedSlides] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [title, setTitle] = useState(`Soporte ${clientName} - ${new Date(minuta.date).toLocaleDateString("es")}`);
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const toggleSlide = (id: number) => {
    setSelectedSlides(prev =>
      prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id].sort()
    );
  };

  const handleGenerate = async () => {
    if (selectedSlides.length === 0) { toast.error("Selecciona al menos una diapositiva"); return; }
    setIsGenerating(true);
    try {
      const snapshot = {
        minuta,
        tickets: tickets.map(t => ({
          ticket_id: t.ticket_id, asunto: t.asunto, estado: t.estado,
          prioridad: t.prioridad, tipo: t.tipo, producto: t.producto,
          responsable: t.responsable, dias_antiguedad: t.dias_antiguedad,
          case_agreements: t.case_agreements || [],
          case_actions: t.case_actions || [],
        })),
        clientName,
      };
      const { data, error } = await supabase.from("shared_support_presentations").insert({
        client_id: tickets[0]?.client_id || "",
        title,
        selected_slides: selectedSlides,
        presentation_snapshot: snapshot,
      } as any).select("token").single();

      if (error) throw error;
      const link = `${window.location.origin}/shared-support/${(data as any).token}`;
      setShareLink(link);
      toast.success("Enlace generado");
    } catch (e: any) {
      toast.error(e.message || "Error generando enlace");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    toast.success("Enlace copiado");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        onClick={onClose}>
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
          onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold">Compartir con Cliente</span>
            </div>
            <button onClick={onClose} className="p-1 rounded-md hover:bg-muted"><X className="h-4 w-4" /></button>
          </div>

          <div className="p-4 space-y-4">
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Título" className="text-xs" />

            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Diapositivas a incluir</p>
              <div className="space-y-1.5">
                {SLIDE_OPTIONS.map(slide => (
                  <label key={slide.id} className={cn("flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors border",
                    selectedSlides.includes(slide.id) ? "bg-primary/5 border-primary/20" : "border-transparent hover:bg-muted/30")}>
                    <Checkbox checked={selectedSlides.includes(slide.id)} onCheckedChange={() => toggleSlide(slide.id)} />
                    <slide.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="text-xs font-medium">{slide.label}</p>
                      <p className="text-[10px] text-muted-foreground">{slide.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {shareLink ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Enlace generado (válido 7 días):</p>
                <div className="flex gap-2">
                  <Input value={shareLink} readOnly className="text-xs font-mono" />
                  <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={handleCopy}>
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground">El cliente podrá ver la presentación y dejar feedback con priorización en cada slide.</p>
              </div>
            ) : (
              <Button className="w-full gap-2 text-xs" onClick={handleGenerate} disabled={isGenerating || selectedSlides.length === 0}>
                {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                Generar Enlace con Feedback
              </Button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
