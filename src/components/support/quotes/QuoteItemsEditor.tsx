import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import type { QuoteItemType } from "@/hooks/useQuotes";

export interface DraftItem {
  id?: string;
  item_type: QuoteItemType;
  description: string;
  quantity: number;
  unit_price: number;
}

const TYPE_OPTIONS: Array<{ value: QuoteItemType; label: string }> = [
  { value: "horas",       label: "Horas" },
  { value: "consultoria", label: "Consultoría" },
  { value: "servicios",   label: "Servicios" },
  { value: "licencias",   label: "Licencias" },
  { value: "otros",       label: "Otros" },
];

interface Props {
  items: DraftItem[];
  onChange: (items: DraftItem[]) => void;
  currency: string;
  readOnly?: boolean;
}

export function QuoteItemsEditor({ items, onChange, currency, readOnly }: Props) {
  const updateItem = (idx: number, patch: Partial<DraftItem>) => {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  const removeItem = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  const addItem = () => {
    onChange([
      ...items,
      { item_type: "horas", description: "", quantity: 1, unit_price: 0 },
    ]);
  };

  const subtotal = items.reduce((s, it) => s + Number(it.quantity || 0) * Number(it.unit_price || 0), 0);

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-2 text-[10px] uppercase font-semibold text-muted-foreground px-1">
        <div className="col-span-3">Tipo</div>
        <div className="col-span-5">Descripción</div>
        <div className="col-span-1 text-right">Cant.</div>
        <div className="col-span-2 text-right">Precio U.</div>
        <div className="col-span-1 text-right">Subtotal</div>
      </div>

      {items.map((it, i) => {
        const itemSubtotal = Number(it.quantity || 0) * Number(it.unit_price || 0);
        return (
          <div key={i} className="grid grid-cols-12 gap-2 items-center">
            <div className="col-span-3">
              <Select
                value={it.item_type}
                onValueChange={(v) => updateItem(i, { item_type: v as QuoteItemType })}
                disabled={readOnly}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPE_OPTIONS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-5">
              <Input
                value={it.description}
                onChange={(e) => updateItem(i, { description: e.target.value })}
                placeholder="Ej: Configuración módulo X"
                className="h-8 text-xs"
                disabled={readOnly}
              />
            </div>
            <div className="col-span-1">
              <Input
                type="number"
                step="0.5"
                min="0"
                value={it.quantity}
                onChange={(e) => updateItem(i, { quantity: Number(e.target.value) })}
                className="h-8 text-xs text-right"
                disabled={readOnly}
              />
            </div>
            <div className="col-span-2">
              <Input
                type="number"
                step="0.01"
                min="0"
                value={it.unit_price}
                onChange={(e) => updateItem(i, { unit_price: Number(e.target.value) })}
                className="h-8 text-xs text-right"
                disabled={readOnly}
              />
            </div>
            <div className="col-span-1 flex items-center justify-end gap-1">
              <span className="text-xs font-medium tabular-nums">{itemSubtotal.toFixed(2)}</span>
              {!readOnly && (
                <Button size="icon" variant="ghost" onClick={() => removeItem(i)} className="h-6 w-6 shrink-0" aria-label="Eliminar línea">
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        );
      })}

      {!readOnly && (
        <Button size="sm" variant="outline" onClick={addItem} className="w-full gap-1.5 mt-2">
          <Plus className="h-3.5 w-3.5" /> Agregar línea
        </Button>
      )}

      <div className="flex justify-end pt-2 mt-2 border-t">
        <div className="text-right">
          <p className="text-[10px] uppercase text-muted-foreground">Subtotal items</p>
          <p className="text-base font-bold tabular-nums">
            {subtotal.toFixed(2)} <span className="text-xs font-normal text-muted-foreground">{currency}</span>
          </p>
        </div>
      </div>
    </div>
  );
}
