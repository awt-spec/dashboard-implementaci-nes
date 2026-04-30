import { useState, useMemo } from "react";
import { AlertTriangle, RotateCcw, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useSysdeTeamMembers } from "@/hooks/useTeamMembers";
import { useReopenTicket } from "@/hooks/useReopenTicket";
import { useToast } from "@/hooks/use-toast";
import type { ReopenType } from "@/hooks/useTicketReopens";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ticketId: string;
  ticketCode: string;                  // ticket_id legible (ej "T-001234")
  fromState: string;                   // ENTREGADA | APROBADA
  toState: string;                     // EN ATENCIÓN | PENDIENTE | ...
  currentReopenCount: number;          // antes de incrementar
  currentResponsable: string | null;
  /** Llamado solo si la mutación tuvo éxito */
  onSuccess?: () => void;
}

const TYPE_OPTIONS: Array<{ value: ReopenType; label: string; hint: string }> = [
  {
    value: "cliente_rechazo",
    label: "Cliente rechazó la entrega",
    hint: "Inconformidad real del cliente — el caso volvió por su pedido",
  },
  {
    value: "qa_falla",
    label: "Falla detectada por QA / soporte",
    hint: "Lo encontramos nosotros antes/después del cierre — falla del entregable",
  },
  {
    value: "solicitud_relacionada",
    label: "Caso relacionado, no es la misma falla",
    hint: "Cliente reabrió por algo relacionado pero no por la misma falla",
  },
  {
    value: "otro",
    label: "Otro motivo",
    hint: "Solo si nada de lo anterior aplica — explicá en el motivo",
  },
];

export function ReopenReasonDialog({
  open,
  onOpenChange,
  ticketId,
  ticketCode,
  fromState,
  toState,
  currentReopenCount,
  currentResponsable,
  onSuccess,
}: Props) {
  const { toast } = useToast();
  const { data: members } = useSysdeTeamMembers();
  const reopenMutation = useReopenTicket();

  const [reason, setReason] = useState("");
  const [reopenType, setReopenType] = useState<ReopenType>("cliente_rechazo");
  const [newResponsible, setNewResponsible] = useState<string>(currentResponsable || "__keep__");

  const nextIteration = currentReopenCount + 1;
  const isCritical = nextIteration >= 3;
  const isSecond = nextIteration === 2;

  const reasonValid = reason.trim().length >= 10;
  const canSubmit = reasonValid && !!reopenType && !reopenMutation.isPending;

  // Lista de responsables disponibles (filtrar inactivos)
  const responsableOptions = useMemo(() => {
    return (members || [])
      .filter((m: any) => m.is_active !== false)
      .map((m: any) => m.name || m.email)
      .filter((v: string, i: number, arr: string[]) => v && arr.indexOf(v) === i);
  }, [members]);

  const handleSubmit = async () => {
    try {
      await reopenMutation.mutateAsync({
        ticketId,
        newState: toState,
        reason: reason.trim(),
        reopenType,
        newResponsible: newResponsible === "__keep__" ? undefined : newResponsible,
      });
      toast({
        title: `Reincidencia #${nextIteration} registrada`,
        description: `${ticketCode} volvió a ${toState}. Motivo guardado en el historial interno.`,
      });
      // Reset state
      setReason("");
      setReopenType("cliente_rechazo");
      setNewResponsible(currentResponsable || "__keep__");
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "No se pudo registrar la reincidencia",
        description: err?.message || "Error desconocido",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RotateCcw className="h-5 w-5 text-warning" />
            Reincidencia #{nextIteration} · {ticketCode}
          </DialogTitle>
          <DialogDescription>
            El caso pasa de <span className="font-mono font-semibold">{fromState}</span> a{" "}
            <span className="font-mono font-semibold">{toState}</span>. Esto cuenta como una vuelta interna —
            cliente sigue viendo el estado actual.
          </DialogDescription>
        </DialogHeader>

        {(isSecond || isCritical) && (
          <Alert variant={isCritical ? "destructive" : "default"} className="border-warning/50 bg-warning/5">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              {isCritical ? (
                <>
                  <strong>Es la {nextIteration}ª vuelta.</strong> Patrón crítico — se notificará a gerencia
                  de soporte y PM. Considerá reasignar al técnico o agendar revisión QA.
                </>
              ) : (
                <>
                  Es la <strong>2ª vez</strong> que regresa. Asegurate de que el motivo sea preciso para
                  detectar patrones después.
                </>
              )}
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4 py-2">
          {/* Tipo */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider">Tipo de reincidencia *</Label>
            <Select value={reopenType} onValueChange={(v) => setReopenType(v as ReopenType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex flex-col items-start">
                      <span className="font-medium text-sm">{opt.label}</span>
                      <span className="text-[10px] text-muted-foreground">{opt.hint}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Motivo */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider">
              Motivo (mín 10 caracteres) *
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ej: Cliente reportó que el reporte de Crédito no muestra los créditos castigados — falta filtro en el query del módulo Cartera."
              rows={4}
              className="resize-none"
            />
            <p className="text-[10px] text-muted-foreground">
              {reason.trim().length}/10 caracteres mínimos
            </p>
          </div>

          {/* Responsable */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider">Reasignar a</Label>
            <Select value={newResponsible} onValueChange={setNewResponsible}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__keep__">
                  Mantener: <strong>{currentResponsable || "(sin asignar)"}</strong>
                </SelectItem>
                {responsableOptions.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-[10px] text-muted-foreground">
              Si la falla fue del técnico actual, conviene reasignar para fresh eyes.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={reopenMutation.isPending}>
            Cancelar
          </Button>
          <Button
            variant={isCritical ? "destructive" : "default"}
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {reopenMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Confirmar reincidencia #{nextIteration}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
