import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { FileText, Calendar, CheckCircle2, XCircle, Loader2, ChevronDown, ChevronUp, Paperclip, Download } from "lucide-react";
import { toast } from "sonner";
import { useQuote, useApproveQuote, useRejectQuote, getQuoteAttachmentUrl } from "@/hooks/useQuotes";

interface Props {
  quoteId: string;
  /** Si true, renderiza expandido por default. */
  defaultOpen?: boolean;
}

export function QuoteApprovalCard({ quoteId, defaultOpen = false }: Props) {
  const { data: quote, isLoading } = useQuote(quoteId);
  const approve = useApproveQuote();
  const reject = useRejectQuote();

  const [expanded, setExpanded] = useState(defaultOpen);
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  if (isLoading || !quote) {
    return (
      <Card>
        <CardContent className="p-4 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const handleApprove = async () => {
    try {
      await approve.mutateAsync(quote.id);
      toast.success("Cotización aprobada. El equipo SVA continuará con la ejecución.");
      setShowApproveConfirm(false);
    } catch (e: any) {
      toast.error(e?.message || "Error al aprobar");
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      toast.error("Por favor indicá un motivo del rechazo");
      return;
    }
    try {
      await reject.mutateAsync({ id: quote.id, reason: rejectReason.trim() });
      toast.success("Cotización rechazada. El equipo será notificado.");
      setShowRejectDialog(false);
      setRejectReason("");
    } catch (e: any) {
      toast.error(e?.message || "Error al rechazar");
    }
  };

  const handleDownload = async (filePath: string, fileName: string) => {
    const url = await getQuoteAttachmentUrl(filePath);
    if (!url) {
      toast.error("No se pudo obtener el archivo");
      return;
    }
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.target = "_blank";
    a.click();
  };

  const expired = quote.valid_until && new Date(quote.valid_until) < new Date();
  const isPendingDecision = quote.status === "sent" && !expired;

  return (
    <>
      <Card className={isPendingDecision ? "border-info/40 shadow-sm" : ""}>
        <CardContent className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className="h-9 w-9 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-info" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold tabular-nums">{quote.quote_number}</p>
                <p className="text-sm font-medium truncate">{quote.title}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xl font-bold tabular-nums">{Number(quote.total_amount).toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground">{quote.currency}</p>
            </div>
          </div>

          {/* Vence */}
          {quote.valid_until && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              <span>
                {expired ? "Esta cotización venció el " : "Válida hasta "}
                {new Date(quote.valid_until).toLocaleDateString()}
              </span>
            </div>
          )}

          {/* Expandible: descripción + items + términos + adjuntos */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setExpanded(!expanded)}
            className="w-full justify-start gap-1.5 text-xs h-7"
          >
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {expanded ? "Ocultar detalle" : "Ver detalle"}
          </Button>

          {expanded && (
            <div className="space-y-3 pt-1 border-t">
              {quote.description && (
                <div>
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Descripción</p>
                  <p className="text-xs whitespace-pre-wrap">{quote.description}</p>
                </div>
              )}

              {/* Items */}
              <div>
                <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1.5">Líneas</p>
                <div className="space-y-1">
                  {quote.items.map(it => (
                    <div key={it.id} className="flex justify-between gap-2 text-xs py-1 border-b last:border-b-0">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium">{it.description}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {it.item_type} · {Number(it.quantity)} × {Number(it.unit_price).toFixed(2)} {quote.currency}
                        </p>
                      </div>
                      <p className="font-medium tabular-nums shrink-0">
                        {Number(it.subtotal).toFixed(2)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totales */}
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="tabular-nums">{Number(quote.subtotal).toFixed(2)} {quote.currency}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Impuesto ({quote.tax_rate}%)</span>
                  <span className="tabular-nums">{Number(quote.tax_amount).toFixed(2)} {quote.currency}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span className="tabular-nums">{Number(quote.total_amount).toFixed(2)} {quote.currency}</span>
                </div>
              </div>

              {quote.terms && (
                <div>
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1">Términos y condiciones</p>
                  <p className="text-xs whitespace-pre-wrap text-muted-foreground">{quote.terms}</p>
                </div>
              )}

              {quote.attachments.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase font-semibold text-muted-foreground mb-1.5 flex items-center gap-1">
                    <Paperclip className="h-3 w-3" /> Adjuntos
                  </p>
                  <div className="space-y-1">
                    {quote.attachments.map(a => (
                      <div key={a.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md border bg-muted/30">
                        <p className="text-xs truncate flex-1">{a.file_name}</p>
                        <Button
                          size="icon" variant="ghost" className="h-6 w-6 shrink-0"
                          onClick={() => handleDownload(a.file_path, a.file_name)}
                        >
                          <Download className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          {isPendingDecision && (
            <div className="grid grid-cols-2 gap-2 pt-2 border-t">
              <Button
                onClick={() => setShowRejectDialog(true)}
                variant="outline"
                className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10"
              >
                <XCircle className="h-3.5 w-3.5" /> Rechazar
              </Button>
              <Button
                onClick={() => setShowApproveConfirm(true)}
                className="gap-1.5 bg-success hover:bg-success/90"
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Aprobar
              </Button>
            </div>
          )}

          {expired && quote.status === "sent" && (
            <p className="text-xs text-amber-600 dark:text-amber-400 italic text-center">
              Esta cotización venció. Solicitá al equipo SVA una nueva si todavía la necesitás.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Approve confirm */}
      <Dialog open={showApproveConfirm} onOpenChange={setShowApproveConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Aprobar cotización {quote.quote_number}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <p>Vas a aprobar una cotización por <strong>{Number(quote.total_amount).toFixed(2)} {quote.currency}</strong>.</p>
            <p className="text-muted-foreground">
              Al aprobar, autorizás al equipo SVA a comenzar la ejecución del alcance descrito.
              Esta decisión queda registrada con tu firma digital y fecha.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowApproveConfirm(false)}>Volver</Button>
            <Button onClick={handleApprove} disabled={approve.isPending} className="gap-1.5 bg-success hover:bg-success/90">
              {approve.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Confirmar aprobación
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rechazar cotización {quote.quote_number}</DialogTitle>
          </DialogHeader>
          <p className="text-sm">Por favor indicá el motivo del rechazo para que el equipo SVA pueda ajustar la propuesta.</p>
          <Textarea
            placeholder="Ej: el alcance no contempla X, el precio supera el presupuesto aprobado, necesitamos un desglose por mes..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={4}
            autoFocus
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowRejectDialog(false)}>Volver</Button>
            <Button onClick={handleReject} disabled={reject.isPending || !rejectReason.trim()} variant="destructive" className="gap-1.5">
              {reject.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Confirmar rechazo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
