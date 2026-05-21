import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, FilePlus2 } from "lucide-react";
import { toast } from "sonner";
import { useCreateQuote } from "@/hooks/useQuotes";
import { QuoteItemsEditor, type DraftItem } from "./QuoteItemsEditor";

interface Props {
  ticketId?: string;
  clientId: string;
  trigger?: React.ReactNode;
}

const CURRENCIES = ["USD", "CRC", "EUR", "MXN", "GTQ"];

export function CreateQuoteDialog({ ticketId, clientId, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [terms, setTerms] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [taxRate, setTaxRate] = useState(0);
  const [validUntil, setValidUntil] = useState("");
  const [items, setItems] = useState<DraftItem[]>([
    { item_type: "horas", description: "", quantity: 1, unit_price: 0 },
  ]);

  const create = useCreateQuote();

  const reset = () => {
    setTitle(""); setDescription(""); setTerms(""); setCurrency("USD");
    setTaxRate(0); setValidUntil("");
    setItems([{ item_type: "horas", description: "", quantity: 1, unit_price: 0 }]);
  };

  const canSubmit = title.trim().length > 0
    && items.length > 0
    && items.every(it => it.description.trim() && it.quantity > 0 && it.unit_price >= 0);

  const handleSubmit = async () => {
    try {
      await create.mutateAsync({
        ticket_id: ticketId,
        client_id: clientId,
        title: title.trim(),
        description: description.trim() || null,
        terms: terms.trim() || null,
        currency,
        tax_rate: taxRate,
        valid_until: validUntil || null,
        items: items.map((it, i) => ({ ...it, position: i })),
      });
      toast.success("Cotización creada como borrador");
      reset();
      setOpen(false);
    } catch (e: any) {
      toast.error(e?.message || "Error al crear cotización");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button size="sm" className="gap-1.5">
            <FilePlus2 className="h-3.5 w-3.5" /> Nueva cotización
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-4 w-4 text-primary" /> Nueva cotización
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="md:col-span-2">
              <Label className="text-xs">Título *</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Cotización implementación módulo X"
                className="h-8 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs">Moneda</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Impuesto (%)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value))}
                className="h-8 text-xs"
              />
            </div>

            <div className="md:col-span-2">
              <Label className="text-xs">Válida hasta (opcional)</Label>
              <Input
                type="date"
                value={validUntil}
                onChange={(e) => setValidUntil(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="md:col-span-2">
              <Label className="text-xs">Descripción (visible al cliente)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Resumen del alcance, objetivos, contexto..."
                rows={3}
                className="text-xs"
              />
            </div>

            <div className="md:col-span-2">
              <Label className="text-xs">Términos y condiciones</Label>
              <Textarea
                value={terms}
                onChange={(e) => setTerms(e.target.value)}
                placeholder="Condiciones comerciales, plazos, restricciones..."
                rows={3}
                className="text-xs"
              />
            </div>
          </div>

          <div className="border-t pt-3">
            <Label className="text-xs font-semibold mb-2 block">Líneas de cotización</Label>
            <QuoteItemsEditor
              items={items}
              onChange={setItems}
              currency={currency}
            />
          </div>
        </div>

        <DialogFooter className="border-t pt-3">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!canSubmit || create.isPending} className="gap-1.5">
            {create.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Crear borrador
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
