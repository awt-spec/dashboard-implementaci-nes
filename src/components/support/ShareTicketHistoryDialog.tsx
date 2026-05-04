import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Share2, X, Link2, Copy, Check, Loader2, Lock, Eye, EyeOff, CalendarClock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTicketHistory } from "@/hooks/useTicketHistory";
import type { SupportTicket } from "@/hooks/useSupportTickets";

// ─── Opciones de expiración ──────────────────────────────────────────────

const EXPIRATION_OPTIONS = [
  { value: "7",  label: "7 días" },
  { value: "14", label: "14 días" },
  { value: "30", label: "30 días (default)" },
  { value: "90", label: "90 días" },
];

// ─── Props ────────────────────────────────────────────────────────────────

interface Props {
  ticket: SupportTicket;
  clientName: string | null;
  open: boolean;
  onClose: () => void;
}

// ─── Componente ──────────────────────────────────────────────────────────

export function ShareTicketHistoryDialog({ ticket, clientName, open, onClose }: Props) {
  const { user } = useAuth();
  const { data: events = [] } = useTicketHistory(ticket.id);

  const [title, setTitle] = useState(`Historial · ${ticket.ticket_id} · ${ticket.asunto}`);
  const [includeInternalNotes, setIncludeInternalNotes] = useState(false);
  const [includeSystemViews, setIncludeSystemViews] = useState(false);
  const [expirationDays, setExpirationDays] = useState("30");
  const [isGenerating, setIsGenerating] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Preview: cuántos eventos vería el cliente con los filtros actuales.
  const filteredPreview = useMemo(() => {
    return events.filter((e) => {
      if (!includeSystemViews && e.kind === "view") return false;
      if (!includeInternalNotes && e.kind === "note" && e.metadata?.visibility === "interna") return false;
      return true;
    });
  }, [events, includeInternalNotes, includeSystemViews]);

  const hiddenCount = events.length - filteredPreview.length;

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const now = new Date();
      const expiresAt = new Date(now.getTime() + Number(expirationDays) * 24 * 60 * 60 * 1000);

      const ticketSnapshot = {
        ticket_id: ticket.ticket_id,
        asunto: ticket.asunto,
        estado: ticket.estado,
        prioridad: ticket.prioridad,
        responsable: ticket.responsable,
        producto: ticket.producto,
        tipo: ticket.tipo,
        created_at: ticket.created_at,
        updated_at: (ticket as any).updated_at ?? null,
        fecha_entrega: (ticket as any).fecha_entrega ?? null,
      };

      const { data, error } = await (supabase.from("shared_ticket_history" as any).insert({
        ticket_id: ticket.id,
        title,
        client_name: clientName,
        include_internal_notes: includeInternalNotes,
        include_system_views: includeSystemViews,
        history_snapshot: filteredPreview,
        ticket_snapshot: ticketSnapshot,
        expires_at: expiresAt.toISOString(),
        created_by: user?.id ?? null,
      }).select("token").single() as any);

      if (error) throw error;
      const link = `${window.location.origin}/historial-caso/${data.token}`;
      setShareLink(link);
      toast.success("Enlace generado");
    } catch (e: any) {
      toast.error(e?.message || "No se pudo generar el enlace");
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

  const handleClose = () => {
    // Reset state al cerrar para que al reabrir empiece limpio
    setShareLink(null);
    setCopied(false);
    onClose();
  };

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-card rounded-xl border border-border shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-2">
              <Share2 className="h-4 w-4 text-primary" />
              <span className="text-sm font-bold">Compartir historial con cliente</span>
            </div>
            <button onClick={handleClose} className="p-1 rounded-md hover:bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="p-4 space-y-4">
            {/* Título */}
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide block mb-1">
                Título
              </label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-xs"
                disabled={!!shareLink}
              />
            </div>

            {/* Expiración */}
            <div>
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide flex items-center gap-1 mb-1">
                <CalendarClock className="h-3 w-3" /> Validez del enlace
              </label>
              <Select value={expirationDays} onValueChange={setExpirationDays} disabled={!!shareLink}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EXPIRATION_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filtros de contenido */}
            <div className="space-y-2">
              <label className="text-[10px] uppercase font-bold text-muted-foreground tracking-wide block">
                Qué incluir
              </label>

              <label className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                includeInternalNotes ? "bg-warning/5 border-warning/30" : "border-border hover:bg-muted/30"
              } ${shareLink ? "opacity-60 pointer-events-none" : ""}`}>
                <Checkbox
                  checked={includeInternalNotes}
                  onCheckedChange={(v) => setIncludeInternalNotes(v === true)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold flex items-center gap-1">
                    {includeInternalNotes ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    Incluir notas internas
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {includeInternalNotes
                      ? "⚠ El cliente verá las notas privadas (🔒 interna)"
                      : "Solo se compartirán notas marcadas como 'externa'"}
                  </p>
                </div>
              </label>

              <label className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${
                includeSystemViews ? "bg-info/5 border-info/30" : "border-border hover:bg-muted/30"
              } ${shareLink ? "opacity-60 pointer-events-none" : ""}`}>
                <Checkbox
                  checked={includeSystemViews}
                  onCheckedChange={(v) => setIncludeSystemViews(v === true)}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">Incluir accesos de visualización</p>
                  <p className="text-[10px] text-muted-foreground">
                    {includeSystemViews
                      ? "Se mostrará cuándo se abrió el caso (puede ser ruido)"
                      : "Se ocultan los eventos tipo 'vista' (recomendado)"}
                  </p>
                </div>
              </label>
            </div>

            {/* Preview counter */}
            <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border/50 text-xs">
              <span className="text-muted-foreground">El cliente verá:</span>
              <span className="font-mono tabular-nums font-bold">
                {filteredPreview.length} {filteredPreview.length === 1 ? "evento" : "eventos"}
                {hiddenCount > 0 && (
                  <span className="ml-1 text-muted-foreground font-normal">
                    ({hiddenCount} {hiddenCount === 1 ? "oculto" : "ocultos"})
                  </span>
                )}
              </span>
            </div>

            {/* Resultado: link */}
            {shareLink ? (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Enlace generado (válido {EXPIRATION_OPTIONS.find(o => o.value === expirationDays)?.label}):
                </p>
                <div className="flex gap-2">
                  <Input value={shareLink} readOnly className="text-xs font-mono" />
                  <Button size="sm" variant="outline" className="shrink-0 gap-1" onClick={handleCopy}>
                    {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                </div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <Lock className="h-3 w-3" /> El cliente accede sin necesidad de login ni cuenta.
                </p>
              </div>
            ) : (
              <Button
                className="w-full gap-2 text-xs"
                onClick={handleGenerate}
                disabled={isGenerating || events.length === 0 || !title.trim()}
              >
                {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                Generar enlace
              </Button>
            )}

            {events.length === 0 && !shareLink && (
              <p className="text-[11px] text-center text-muted-foreground italic">
                Este caso todavía no tiene eventos en su historial.
              </p>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
