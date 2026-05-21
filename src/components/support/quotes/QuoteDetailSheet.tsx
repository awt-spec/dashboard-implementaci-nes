import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Loader2, Save, Send, Ban, Trash2, FileText, Calendar, DollarSign,
  Paperclip, Download, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  useQuote, useUpdateQuote, useSendQuote, useCancelQuote, useDeleteQuote,
  useUpsertQuoteItem, useDeleteQuoteItem,
  useUploadQuoteAttachment, useDeleteQuoteAttachment, getQuoteAttachmentUrl,
} from "@/hooks/useQuotes";
import { QuoteStatusBadge } from "./QuoteStatusBadge";
import { QuoteItemsEditor, type DraftItem } from "./QuoteItemsEditor";

interface Props {
  quoteId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QuoteDetailSheet({ quoteId, open, onOpenChange }: Props) {
  const { role } = useAuth();
  const isStaff = role && role !== "cliente";

  const { data: quote, isLoading } = useQuote(quoteId);
  const updateQuote = useUpdateQuote();
  const sendQuote = useSendQuote();
  const cancelQuote = useCancelQuote();
  const deleteQuote = useDeleteQuote();
  const upsertItem = useUpsertQuoteItem();
  const deleteItem = useDeleteQuoteItem();
  const uploadAttachment = useUploadQuoteAttachment();
  const deleteAttachment = useDeleteQuoteAttachment();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [terms, setTerms] = useState("");
  const [taxRate, setTaxRate] = useState(0);
  const [validUntil, setValidUntil] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [showSendConfirm, setShowSendConfirm] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    if (quote) {
      setTitle(quote.title);
      setDescription(quote.description ?? "");
      setTerms(quote.terms ?? "");
      setTaxRate(quote.tax_rate);
      setValidUntil(quote.valid_until ?? "");
      setItems(
        quote.items.map(it => ({
          id: it.id,
          item_type: it.item_type,
          description: it.description,
          quantity: Number(it.quantity),
          unit_price: Number(it.unit_price),
        })),
      );
    }
  }, [quote?.id]);

  if (!quote && !isLoading) return null;

  const isDraft = quote?.status === "draft";
  const isEditable = isStaff && isDraft;

  const handleSaveHeader = async () => {
    if (!quote) return;
    try {
      await updateQuote.mutateAsync({
        id: quote.id,
        title: title.trim(),
        description: description.trim() || null,
        terms: terms.trim() || null,
        tax_rate: taxRate,
        valid_until: validUntil || null,
      });
      toast.success("Cotización actualizada");
    } catch (e: any) {
      toast.error(e?.message || "Error al actualizar");
    }
  };

  const handleSyncItems = async () => {
    if (!quote) return;
    try {
      // Delete removed items (existed in DB but not in current state)
      const currentIds = items.filter(i => i.id).map(i => i.id!);
      const removedItems = quote.items.filter(it => !currentIds.includes(it.id));
      for (const it of removedItems) {
        await deleteItem.mutateAsync({ id: it.id, quoteId: quote.id });
      }
      // Upsert remaining items
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (!it.description.trim()) continue;
        await upsertItem.mutateAsync({
          id: it.id,
          quote_id: quote.id,
          item_type: it.item_type,
          description: it.description,
          quantity: it.quantity,
          unit_price: it.unit_price,
          position: i,
        });
      }
      toast.success("Líneas sincronizadas");
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar líneas");
    }
  };

  const handleSend = async () => {
    if (!quote) return;
    const validItems = items.filter(i => i.description.trim() && i.quantity > 0);
    if (validItems.length === 0) {
      toast.error("La cotización necesita al menos una línea con descripción y cantidad > 0 antes de enviarse");
      return;
    }
    if (!title.trim()) {
      toast.error("El título es obligatorio");
      return;
    }
    try {
      // Save first
      await handleSaveHeader();
      await handleSyncItems();
      await sendQuote.mutateAsync(quote.id);
      toast.success("Cotización enviada al cliente");
      setShowSendConfirm(false);
    } catch (e: any) {
      toast.error(e?.message || "Error al enviar");
    }
  };

  const handleCancel = async () => {
    if (!quote) return;
    try {
      await cancelQuote.mutateAsync({ id: quote.id, reason: cancelReason.trim() || undefined });
      toast.success("Cotización cancelada");
      setShowCancelDialog(false);
      setCancelReason("");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Error al cancelar");
    }
  };

  const handleDelete = async () => {
    if (!quote) return;
    if (!confirm(`¿Eliminar definitivamente la cotización ${quote.quote_number}? Esta acción no se puede deshacer.`)) return;
    try {
      await deleteQuote.mutateAsync(quote.id);
      toast.success("Cotización eliminada");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar");
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !quote) return;
    try {
      await uploadAttachment.mutateAsync({ quoteId: quote.id, file });
      toast.success("Archivo adjuntado");
      e.target.value = "";
    } catch (err: any) {
      toast.error(err?.message || "Error al subir archivo");
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        {isLoading || !quote ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <>
            <SheetHeader className="space-y-3 pb-4 border-b">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <SheetTitle className="text-base">{quote.quote_number}</SheetTitle>
                    <QuoteStatusBadge status={quote.status} />
                  </div>
                  <SheetDescription className="text-xs">
                    Creada {new Date(quote.created_at).toLocaleDateString()}
                    {quote.sent_at && ` · Enviada ${new Date(quote.sent_at).toLocaleDateString()}`}
                    {quote.approved_at && ` · Aprobada ${new Date(quote.approved_at).toLocaleDateString()}`}
                  </SheetDescription>
                </div>
                <div className="text-right">
                  <p className="text-[10px] uppercase text-muted-foreground">Total</p>
                  <p className="text-xl font-bold tabular-nums">
                    {Number(quote.total_amount).toFixed(2)}
                    <span className="text-xs font-normal text-muted-foreground ml-1">{quote.currency}</span>
                  </p>
                </div>
              </div>
            </SheetHeader>

            <div className="space-y-4 py-4">
              {/* Header fields */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="md:col-span-2">
                  <Label className="text-xs">Título</Label>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    disabled={!isEditable}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1"><DollarSign className="h-3 w-3" /> Impuesto (%)</Label>
                  <Input
                    type="number" step="0.01" min="0" max="100"
                    value={taxRate}
                    onChange={(e) => setTaxRate(Number(e.target.value))}
                    disabled={!isEditable}
                    className="h-8 text-xs"
                  />
                </div>
                <div>
                  <Label className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" /> Válida hasta</Label>
                  <Input
                    type="date"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                    disabled={!isEditable}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Descripción</Label>
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    disabled={!isEditable}
                    rows={3}
                    className="text-xs"
                  />
                </div>
                <div className="md:col-span-2">
                  <Label className="text-xs">Términos y condiciones</Label>
                  <Textarea
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                    disabled={!isEditable}
                    rows={3}
                    className="text-xs"
                  />
                </div>
              </div>

              {isEditable && (
                <Button onClick={handleSaveHeader} size="sm" variant="outline" className="gap-1.5">
                  <Save className="h-3.5 w-3.5" /> Guardar cabecera
                </Button>
              )}

              <Separator />

              {/* Items */}
              <div>
                <Label className="text-xs font-semibold mb-2 block">Líneas</Label>
                <QuoteItemsEditor
                  items={items}
                  onChange={setItems}
                  currency={quote.currency}
                  readOnly={!isEditable}
                />
                {isEditable && (
                  <Button onClick={handleSyncItems} size="sm" variant="outline" className="gap-1.5 mt-3">
                    <Save className="h-3.5 w-3.5" /> Guardar líneas
                  </Button>
                )}
              </div>

              <Separator />

              {/* Totales */}
              <Card>
                <CardContent className="p-4 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-medium tabular-nums">{Number(quote.subtotal).toFixed(2)} {quote.currency}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Impuesto ({quote.tax_rate}%)</span>
                    <span className="font-medium tabular-nums">{Number(quote.tax_amount).toFixed(2)} {quote.currency}</span>
                  </div>
                  <Separator className="my-1.5" />
                  <div className="flex justify-between text-sm font-bold">
                    <span>Total</span>
                    <span className="tabular-nums">{Number(quote.total_amount).toFixed(2)} {quote.currency}</span>
                  </div>
                </CardContent>
              </Card>

              <Separator />

              {/* Attachments */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-xs font-semibold flex items-center gap-1.5">
                    <Paperclip className="h-3.5 w-3.5" /> Adjuntos ({quote.attachments.length})
                  </Label>
                  {isStaff && isDraft && (
                    <label className="cursor-pointer">
                      <input type="file" className="hidden" onChange={handleUpload} disabled={uploadAttachment.isPending} />
                      <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border hover:bg-accent">
                        {uploadAttachment.isPending
                          ? <Loader2 className="h-3 w-3 animate-spin" />
                          : <Upload className="h-3 w-3" />}
                        Subir
                      </span>
                    </label>
                  )}
                </div>
                {quote.attachments.length === 0 ? (
                  <p className="text-[11px] text-muted-foreground italic">Sin adjuntos.</p>
                ) : (
                  <div className="space-y-1">
                    {quote.attachments.map(a => (
                      <div key={a.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md border bg-card">
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-medium truncate">{a.file_name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {a.file_size ? `${(a.file_size / 1024).toFixed(1)} KB` : ""}
                            {a.mime_type ? ` · ${a.mime_type}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <Button
                            size="icon" variant="ghost" className="h-7 w-7"
                            onClick={() => handleDownload(a.file_path, a.file_name)}
                            aria-label={`Descargar ${a.file_name}`}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                          {isStaff && isDraft && (
                            <Button
                              size="icon" variant="ghost" className="h-7 w-7"
                              onClick={() => deleteAttachment.mutate(
                                { id: a.id, filePath: a.file_path, quoteId: quote.id },
                                { onError: (e: any) => toast.error(e?.message ?? "No se pudo eliminar el adjunto") },
                              )}
                              aria-label={`Eliminar ${a.file_name}`}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Status info (cuando ya pasó draft) */}
              {!isDraft && (
                <Card className="bg-muted/40">
                  <CardContent className="p-3 text-xs space-y-1">
                    {quote.status === "rejected" && quote.rejection_reason && (
                      <div>
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground">Motivo de rechazo</p>
                        <p>{quote.rejection_reason}</p>
                      </div>
                    )}
                    {quote.status === "cancelled" && quote.cancellation_reason && (
                      <div>
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground">Motivo de cancelación</p>
                        <p>{quote.cancellation_reason}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Actions footer */}
            {isStaff && (
              <div className="sticky bottom-0 bg-background border-t pt-3 flex flex-wrap gap-2">
                {isDraft && (
                  <>
                    <Button onClick={() => setShowSendConfirm(true)} className="gap-1.5">
                      <Send className="h-3.5 w-3.5" /> Enviar al cliente
                    </Button>
                    <Button variant="outline" onClick={() => setShowCancelDialog(true)} className="gap-1.5">
                      <Ban className="h-3.5 w-3.5" /> Cancelar
                    </Button>
                  </>
                )}
                {quote.status === "sent" && (
                  <Button variant="outline" onClick={() => setShowCancelDialog(true)} className="gap-1.5">
                    <Ban className="h-3.5 w-3.5" /> Cancelar
                  </Button>
                )}
                {role === "admin" && (
                  <Button variant="ghost" onClick={handleDelete} className="gap-1.5 text-destructive ml-auto">
                    <Trash2 className="h-3.5 w-3.5" /> Eliminar
                  </Button>
                )}
              </div>
            )}

            {/* Send confirm dialog */}
            <Dialog open={showSendConfirm} onOpenChange={setShowSendConfirm}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Enviar cotización al cliente</DialogTitle>
                </DialogHeader>
                <p className="text-sm">
                  La cotización pasará a estado <strong>Enviada</strong>. El cliente podrá verla, aprobarla o rechazarla.
                  Una vez enviada, ya no podrás modificar líneas ni montos.
                </p>
                <p className="text-xs text-muted-foreground">
                  ¿Confirmás? Si necesitás más cambios, cancelá esta acción y editá primero.
                </p>
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setShowSendConfirm(false)}>Volver</Button>
                  <Button onClick={handleSend} disabled={sendQuote.isPending} className="gap-1.5">
                    {sendQuote.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Confirmar envío
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* Cancel dialog */}
            <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Cancelar cotización</DialogTitle>
                </DialogHeader>
                <Textarea
                  placeholder="Motivo (opcional)"
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                />
                <DialogFooter>
                  <Button variant="ghost" onClick={() => setShowCancelDialog(false)}>Volver</Button>
                  <Button variant="destructive" onClick={handleCancel} disabled={cancelQuote.isPending} className="gap-1.5">
                    {cancelQuote.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Confirmar cancelación
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
