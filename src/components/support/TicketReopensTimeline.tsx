import { useMemo, useState } from "react";
import { RotateCcw, ArrowRight, User, Clock, Pencil, Loader2, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { useTicketReopens, type TicketReopen, type ReopenType } from "@/hooks/useTicketReopens";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const TYPE_LABELS: Record<ReopenType, { label: string; tone: string }> = {
  cliente_rechazo:        { label: "Cliente rechazó",      tone: "bg-destructive/15 text-destructive border-destructive/40" },
  qa_falla:               { label: "Falla QA",             tone: "bg-warning/15 text-warning border-warning/40" },
  solicitud_relacionada:  { label: "Caso relacionado",     tone: "bg-blue-500/15 text-blue-600 border-blue-500/40" },
  otro:                   { label: "Otro",                 tone: "bg-muted text-muted-foreground border-border" },
  historico:              { label: "Histórico (backfill)", tone: "bg-muted text-muted-foreground border-border italic" },
};

interface Props {
  ticketId: string;
  ticketCode: string;
}

export function TicketReopensTimeline({ ticketId, ticketCode }: Props) {
  const { data: reopens, isLoading } = useTicketReopens(ticketId);
  const { role } = useAuth();
  const canEdit = role === "admin" || role === "gerente_soporte";

  const [editing, setEditing] = useState<TicketReopen | null>(null);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!reopens || reopens.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <RotateCcw className="h-8 w-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Este caso no tiene reincidencias.</p>
        <p className="text-xs opacity-60 mt-1">
          Una reincidencia se crea cuando el caso vuelve de ENTREGADA/APROBADA a un estado activo.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reopens.map((r, idx) => (
        <ReopenCard
          key={r.id}
          reopen={r}
          isLast={idx === reopens.length - 1}
          canEdit={canEdit}
          onEdit={() => setEditing(r)}
        />
      ))}

      {editing && (
        <EditReopenDialog
          reopen={editing}
          ticketCode={ticketCode}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function ReopenCard({
  reopen: r,
  isLast,
  canEdit,
  onEdit,
}: {
  reopen: TicketReopen;
  isLast: boolean;
  canEdit: boolean;
  onEdit: () => void;
}) {
  const typeInfo = TYPE_LABELS[r.reopen_type] || TYPE_LABELS.otro;
  const isOpen = !r.resolved_at;
  const duration = useMemo(() => {
    if (!r.resolved_at) return null;
    const start = new Date(r.reopened_at).getTime();
    const end = new Date(r.resolved_at).getTime();
    const days = Math.round((end - start) / (1000 * 60 * 60 * 24));
    return days;
  }, [r.reopened_at, r.resolved_at]);

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleString("es-PA", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  const isCritical = r.iteration_number >= 3 && r.reopen_type !== "historico";

  return (
    <Card className={cn(
      "p-3 relative",
      isOpen && "border-warning/40 bg-warning/[0.02]",
      isCritical && "border-destructive/40 bg-destructive/[0.02]",
    )}>
      {!isLast && (
        <div className="absolute left-[19px] top-12 bottom-[-12px] w-px bg-border" />
      )}

      <div className="flex items-start gap-3">
        {/* Iteration number circle */}
        <div className={cn(
          "shrink-0 h-8 w-8 rounded-full border-2 flex items-center justify-center font-bold text-sm tabular-nums",
          isCritical ? "border-destructive text-destructive bg-destructive/10"
            : isOpen ? "border-warning text-warning bg-warning/10"
            : "border-border text-muted-foreground bg-muted",
        )}>
          {r.iteration_number}
        </div>

        <div className="flex-1 min-w-0">
          {/* Header row */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold">
                Iteración #{r.iteration_number}
              </span>
              <Badge variant="outline" className={cn("text-[10px] h-5", typeInfo.tone)}>
                {typeInfo.label}
              </Badge>
              {isOpen && (
                <Badge variant="outline" className="text-[10px] h-5 bg-warning/10 text-warning border-warning/40">
                  Abierta
                </Badge>
              )}
              {isCritical && (
                <Badge variant="outline" className="text-[10px] h-5 bg-destructive/10 text-destructive border-destructive/40">
                  <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                  Crítico
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground tabular-nums">
                {fmtDate(r.reopened_at)}
              </span>
              {canEdit && r.reopen_type !== "historico" && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={onEdit}
                  title="Editar motivo/tipo"
                >
                  <Pencil className="h-3 w-3" />
                </Button>
              )}
            </div>
          </div>

          {/* State transition */}
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground font-mono mt-1">
            <span>{r.reopened_from_state}</span>
            <ArrowRight className="h-3 w-3" />
            <span>{r.reopened_to_state}</span>
          </div>

          {/* Reason */}
          <p className="text-sm mt-2 leading-relaxed text-foreground/90">
            {r.reason}
          </p>

          {/* Footer row: responsables + duración */}
          <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground flex-wrap">
            {(r.responsible_at_reopen || r.new_responsible) && (
              <span className="flex items-center gap-1">
                <User className="h-3 w-3" />
                {r.responsible_at_reopen || "(sin asignar)"}
                {r.new_responsible && r.new_responsible !== r.responsible_at_reopen && (
                  <>
                    <ArrowRight className="h-3 w-3" />
                    <span className="font-semibold text-foreground">{r.new_responsible}</span>
                  </>
                )}
              </span>
            )}
            {duration !== null && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {duration} {duration === 1 ? "día" : "días"} hasta resolver
              </span>
            )}
            {r.triggered_by_name && (
              <span className="opacity-70">
                Disparada por <span className="font-medium">{r.triggered_by_name}</span>
              </span>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

/** Modal pequeño para editar reason+reopen_type — admin/gerente_soporte únicamente */
function EditReopenDialog({
  reopen,
  ticketCode,
  onClose,
}: {
  reopen: TicketReopen;
  ticketCode: string;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [reason, setReason] = useState(reopen.reason);
  const [reopenType, setReopenType] = useState<ReopenType>(reopen.reopen_type);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (reason.trim().length < 10) {
      toast({ variant: "destructive", title: "Motivo muy corto", description: "Mínimo 10 caracteres." });
      return;
    }
    setSaving(true);
    try {
      const { error } = await (supabase
        .from("support_ticket_reopens" as any)
        .update({ reason: reason.trim(), reopen_type: reopenType } as any) as any)
        .eq("id", reopen.id);
      if (error) throw error;
      toast({ title: "Reincidencia actualizada", description: `Iteración #${reopen.iteration_number} de ${ticketCode}` });
      qc.invalidateQueries({ queryKey: ["ticket-reopens", reopen.ticket_id] });
      qc.invalidateQueries({ queryKey: ["reopens-summary"] });
      onClose();
    } catch (err: any) {
      toast({ variant: "destructive", title: "No se pudo actualizar", description: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar reincidencia #{reopen.iteration_number}</DialogTitle>
          <DialogDescription>
            Solo gerente de soporte y admin pueden corregir el motivo o tipo de una reincidencia ya registrada.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1">
            <Label className="text-xs uppercase">Tipo</Label>
            <Select value={reopenType} onValueChange={(v) => setReopenType(v as ReopenType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cliente_rechazo">Cliente rechazó</SelectItem>
                <SelectItem value="qa_falla">Falla QA</SelectItem>
                <SelectItem value="solicitud_relacionada">Caso relacionado</SelectItem>
                <SelectItem value="otro">Otro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs uppercase">Motivo</Label>
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-3 w-3 mr-2 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
