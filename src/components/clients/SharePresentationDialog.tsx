import { useState } from "react";
import { type Client } from "@/data/projectData";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Link2, Copy, Check, X, Share2, Eye, Loader2,
  TrendingUp, ListChecks, Package, AlertTriangle, DollarSign, Sparkles, FileText
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SharePresentationDialogProps {
  client: Client;
  open: boolean;
  onClose: () => void;
}

const SLIDE_OPTIONS = [
  { id: 0, label: "Portada", icon: FileText, desc: "Logo, nombre y fecha" },
  { id: 1, label: "Resumen Ejecutivo", icon: TrendingUp, desc: "KPIs y progreso" },
  { id: 2, label: "Tareas", icon: ListChecks, desc: "Estado de todas las tareas" },
  { id: 3, label: "Entregables", icon: Package, desc: "Documentos y versiones" },
  { id: 4, label: "Riesgos", icon: AlertTriangle, desc: "Riesgos abiertos y mitigaciones" },
  { id: 5, label: "Financiero", icon: DollarSign, desc: "Facturación y horas" },
  { id: 6, label: "Siguiente Paso", icon: Sparkles, desc: "CTA y cierre" },
];

export function SharePresentationDialog({ client, open, onClose }: SharePresentationDialogProps) {
  const [selectedSlides, setSelectedSlides] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [title, setTitle] = useState(`Informe ${client.name} - ${new Date().toLocaleDateString("es")}`);
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
      const snapshot = JSON.parse(JSON.stringify(client));
      // Always include feedback slide (id 7) - it will be appended by the viewer
      const { data, error } = await supabase.from("shared_presentations").insert({
        client_id: client.id,
        title,
        selected_slides: selectedSlides,
        presentation_snapshot: snapshot,
      } as any).select("token").single();

      if (error) throw error;
      const link = `${window.location.origin}/shared/${(data as any).token}`;
      setShareLink(link);
      toast.success("Enlace generado correctamente");
    } catch (e: any) {
      toast.error(e.message || "Error al generar enlace");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    toast.success("Enlace copiado al portapapeles");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setShareLink(null);
    setCopied(false);
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg flex flex-col"
          style={{ maxHeight: "85vh" }}
        >
          {/* Header */}
          <div className="px-5 py-4 border-b border-border flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                <Share2 className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-foreground">Compartir Presentación</h2>
                <p className="text-[11px] text-muted-foreground">{client.name}</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose} className="h-8 w-8 rounded-lg">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto min-h-0 p-5 space-y-4">
            {!shareLink ? (
              <>
                {/* Title */}
                <div>
                  <label className="text-xs font-semibold text-foreground mb-1.5 block">Título del enlace</label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} className="text-sm h-9 rounded-xl" />
                </div>

                {/* Slide selector */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-foreground">Diapositivas a incluir</label>
                    <button
                      onClick={() => setSelectedSlides(selectedSlides.length === SLIDE_OPTIONS.length ? [] : SLIDE_OPTIONS.map(s => s.id))}
                      className="text-[10px] text-primary hover:underline font-medium"
                    >
                      {selectedSlides.length === SLIDE_OPTIONS.length ? "Deseleccionar todo" : "Seleccionar todo"}
                    </button>
                  </div>
                  <div className="space-y-1">
                    {SLIDE_OPTIONS.map(slide => {
                      const isSelected = selectedSlides.includes(slide.id);
                      const SlideIcon = slide.icon;
                      return (
                        <motion.div
                          key={slide.id}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => toggleSlide(slide.id)}
                          className={cn(
                            "flex items-center gap-3 p-2.5 rounded-xl border cursor-pointer transition-all",
                            isSelected ? "border-primary/30 bg-primary/5" : "border-border hover:border-border/80"
                          )}
                        >
                          <Checkbox checked={isSelected} className="pointer-events-none" />
                          <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                            isSelected ? "bg-primary/10" : "bg-muted"
                          )}>
                            <SlideIcon className={cn("h-3.5 w-3.5", isSelected ? "text-primary" : "text-muted-foreground")} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={cn("text-xs font-medium", isSelected ? "text-foreground" : "text-muted-foreground")}>{slide.label}</p>
                            <p className="text-[10px] text-muted-foreground/70">{slide.desc}</p>
                          </div>
                          <Badge variant="secondary" className="text-[9px] shrink-0">{slide.id + 1}</Badge>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>

                {/* Info */}
                <div className="rounded-xl bg-info/5 border border-info/15 p-3">
                  <p className="text-[11px] text-info font-medium mb-0.5">📋 El cliente podrá:</p>
                  <ul className="text-[10px] text-muted-foreground space-y-0.5">
                    <li>• Ver las diapositivas seleccionadas de forma interactiva</li>
                    <li>• Calificar la calidad del servicio con 👍/👎</li>
                    <li>• Evaluar cada entregable y respuesta de SYSDE</li>
                    <li>• El enlace expira en 7 días</li>
                  </ul>
                </div>
              </>
            ) : (
              /* Link generated */
              <div className="space-y-4 text-center py-4">
                <div className="mx-auto h-14 w-14 rounded-2xl bg-success/10 flex items-center justify-center">
                  <Check className="h-7 w-7 text-success" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground mb-1">¡Enlace generado!</h3>
                  <p className="text-xs text-muted-foreground">Comparte este enlace con tu cliente para que vea la presentación y deje feedback.</p>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-muted border border-border">
                  <Link2 className="h-4 w-4 text-muted-foreground shrink-0" />
                  <Input value={shareLink} readOnly className="text-xs border-0 bg-transparent h-7 focus-visible:ring-0" />
                  <Button size="sm" variant="outline" onClick={handleCopy} className="h-7 gap-1 text-xs shrink-0 rounded-lg">
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {copied ? "Copiado" : "Copiar"}
                  </Button>
                </div>
                <div className="flex gap-2 justify-center">
                  <Button variant="outline" size="sm" onClick={() => window.open(shareLink!, "_blank")} className="gap-1 text-xs h-8 rounded-lg">
                    <Eye className="h-3 w-3" /> Vista previa
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-3 border-t border-border flex items-center justify-between shrink-0">
            <Button variant="ghost" onClick={handleClose} className="text-xs h-8">
              {shareLink ? "Cerrar" : "Cancelar"}
            </Button>
            {!shareLink && (
              <Button onClick={handleGenerate} disabled={isGenerating || selectedSlides.length === 0} className="gap-2 h-8 text-xs rounded-lg">
                {isGenerating ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Generando...</> : <><Link2 className="h-3.5 w-3.5" /> Generar Enlace</>}
              </Button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
