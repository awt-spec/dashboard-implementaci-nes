import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, DollarSign, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useClientsWithoutFinancials, useBulkCreateClientFinancials } from "@/hooks/useSVAStrategy";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Draft = Record<string, string>;

export function ClientFinancialsWizard({ open, onOpenChange }: Props) {
  const { data: clients = [], isLoading } = useClientsWithoutFinancials();
  const bulk = useBulkCreateClientFinancials();
  const [draft, setDraft] = useState<Draft>({});

  useEffect(() => {
    if (!open) setDraft({});
  }, [open]);

  const parsed = Object.entries(draft)
    .map(([id, v]) => ({ id, monthly_value: parseFloat(v) }))
    .filter(e => !isNaN(e.monthly_value) && e.monthly_value >= 0);

  const totalMonthly = parsed.reduce((s, p) => s + p.monthly_value, 0);

  const handleSave = async () => {
    const entries = parsed.map(p => ({ client_id: p.id, monthly_value: p.monthly_value }));
    if (entries.length === 0) {
      toast.error("Ingresa al menos un valor");
      return;
    }
    try {
      await bulk.mutateAsync(entries);
      toast.success(`${entries.length} clientes actualizados · ${totalMonthly.toLocaleString()} USD/mes`);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Error al guardar");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Completar datos de facturación
          </DialogTitle>
          <DialogDescription className="text-xs">
            Los clientes de soporte no tienen registro en <code className="text-[11px] bg-muted px-1 py-0.5 rounded">client_financials</code>.
            Sin estos valores, la IA no puede priorizar clientes por ingresos y los dashboards reportan $0 de revenue.
            Ingresa el <strong>valor mensual en USD</strong> — el contrato anual se calcula automáticamente (×12).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-auto space-y-2 py-2">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : clients.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center flex flex-col items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-sm font-semibold">Todos los clientes de soporte tienen datos financieros</p>
                  <p className="text-xs text-muted-foreground mt-1">No hay nada que completar.</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="flex items-center gap-2 p-2 rounded bg-warning/5 border border-warning/20 text-xs">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                <span>
                  <strong>{clients.length}</strong> clientes de soporte sin registro financiero.
                  Puedes dejar en blanco los que no sepas y completarlos después.
                </span>
              </div>

              <div className="space-y-1.5">
                {clients.map(c => {
                  const v = draft[c.id] || "";
                  const isValid = v === "" || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0);
                  return (
                    <div key={c.id} className="flex items-center gap-2 p-2.5 rounded-lg border border-border/60 hover:bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{c.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="text-[10px]">{c.id}</Badge>
                          <Badge variant="outline" className={
                            c.status === "activo" ? "text-[10px] bg-success/10 text-success border-success/30" :
                            c.status === "en-riesgo" ? "text-[10px] bg-warning/10 text-warning border-warning/30" :
                            "text-[10px]"
                          }>{c.status}</Badge>
                        </div>
                      </div>
                      <div className="shrink-0 flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">USD/mes</span>
                        <Input
                          type="number"
                          step="100"
                          min="0"
                          placeholder="0"
                          value={v}
                          onChange={e => setDraft({ ...draft, [c.id]: e.target.value })}
                          className={`h-9 w-28 text-sm text-right tabular-nums ${!isValid ? "border-destructive" : ""}`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {parsed.length > 0 && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1">
                      <p className="text-xs uppercase tracking-wide font-bold text-primary">Resumen</p>
                      <p className="text-sm mt-0.5">
                        Vas a crear <strong>{parsed.length}</strong> registros con un valor mensual total de{" "}
                        <strong className="tabular-nums">${totalMonthly.toLocaleString()} USD</strong>.
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Contrato anual estimado: ${(totalMonthly * 12).toLocaleString()} USD
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button
            onClick={handleSave}
            disabled={clients.length === 0 || parsed.length === 0 || bulk.isPending}
            className="gap-1.5"
          >
            {bulk.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Guardar {parsed.length > 0 && `(${parsed.length})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
