import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Pencil, Trash2, Package, Lock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  useBilledPackages, useUpsertBilledPackage, useDeleteBilledPackage,
  type BilledPackage, type BilledPackageType, type BilledPackageStatus,
} from "@/hooks/useBilledPackages";
import { useClientContracts } from "@/hooks/useClientContracts";
import { Confidential } from "@/components/common/Confidential";
import { useFinanceAccess } from "@/hooks/useFinanceAccess";

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  bolsa_horas: "Bolsa de horas",
  fee_mensual: "Fee mensual fijo",
  proyecto_cerrado: "Proyecto cerrado",
  tiempo_materiales: "Tiempo y materiales",
};
const NO_CONTRACT = "__none__";

const TYPES: Array<{ value: BilledPackageType; label: string }> = [
  { value: "horas",     label: "Bolsa de horas" },
  { value: "servicio",  label: "Servicio" },
  { value: "licencia",  label: "Licencia" },
  { value: "proyecto",  label: "Proyecto" },
  { value: "otro",      label: "Otro" },
];

const STATUS_META: Record<BilledPackageStatus, { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "bg-muted text-muted-foreground" },
  facturado: { label: "Facturado", className: "bg-info/15 text-info border-info/30" },
  pagado:    { label: "Pagado",    className: "bg-success/15 text-success border-success/30" },
  anulado:   { label: "Anulado",   className: "bg-destructive/10 text-destructive border-destructive/30 line-through" },
};

const CURRENCIES = ["USD", "CRC", "EUR", "MXN", "GTQ"];

export function BilledPackagesTab({ clientId }: { clientId: string }) {
  const { role } = useAuth();
  const canManage = role === "admin" || role === "pm";
  const isAdmin = role === "admin";

  const { data: packages = [], isLoading } = useBilledPackages(clientId);
  const { data: contracts = [] } = useClientContracts(clientId);
  const { canAmounts } = useFinanceAccess();
  const upsert = useUpsertBilledPackage();
  const del = useDeleteBilledPackage();

  const contractLabel = (c: { contract_type: string; currency?: string; monthly_value?: number }) =>
    `${CONTRACT_TYPE_LABELS[c.contract_type] || c.contract_type}${c.monthly_value && canAmounts ? ` · $${Number(c.monthly_value).toLocaleString()} ${c.currency || ""}` : ""}`;
  const contractById = (id?: string | null) => contracts.find(c => c.id === id);

  const [dialog, setDialog] = useState<Partial<BilledPackage> | null>(null);

  const openNew = () => setDialog({
    client_id: clientId, name: "", package_type: "horas",
    quantity: 1, unit_price: 0, currency: "USD", status: "pendiente",
  });

  const handleSave = async () => {
    if (!dialog?.name?.trim()) { toast.error("El nombre es obligatorio"); return; }
    if (!dialog.quantity || dialog.quantity <= 0) { toast.error("Cantidad debe ser > 0"); return; }
    try {
      await upsert.mutateAsync({
        id: dialog.id,
        client_id: clientId,
        contract_id: dialog.contract_id ?? null,
        name: dialog.name.trim(),
        description: dialog.description ?? null,
        package_type: dialog.package_type ?? "horas",
        quantity: Number(dialog.quantity),
        unit_price: Number(dialog.unit_price ?? 0),
        currency: dialog.currency ?? "USD",
        status: dialog.status ?? "pendiente",
        invoice_number: dialog.invoice_number ?? null,
        billed_date: dialog.billed_date ?? null,
        paid_date: dialog.paid_date ?? null,
        notes: dialog.notes ?? null,
      });
      toast.success(dialog.id ? "Paquete actualizado" : "Paquete creado");
      setDialog(null);
    } catch (e: any) {
      toast.error(e?.message || "Error al guardar");
    }
  };

  const handleDelete = (p: BilledPackage) => {
    if (!confirm(`¿Eliminar el paquete "${p.name}"?`)) return;
    del.mutate({ id: p.id, clientId }, { onError: (e: any) => toast.error(e?.message ?? "No se pudo eliminar") });
  };

  const totalFacturado = packages.filter(p => p.status === "facturado" || p.status === "pagado")
    .reduce((s, p) => s + Number(p.total_amount), 0);
  const totalPendiente = packages.filter(p => p.status === "pendiente")
    .reduce((s, p) => s + Number(p.total_amount), 0);

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-4">
      {!canManage && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Vista de solo lectura. Solo admin/PM gestionan paquetes facturados.
        </div>
      )}

      <div className="grid grid-cols-3 gap-3">
        <Card><CardContent className="p-4">
          <p className="text-[10px] uppercase text-muted-foreground">Facturado / Pagado</p>
          <p className="text-2xl font-bold mt-1 tabular-nums"><Confidential show={canAmounts}>${totalFacturado.toLocaleString()}</Confidential></p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-[10px] uppercase text-muted-foreground">Pendiente de facturar</p>
          <p className="text-2xl font-bold mt-1 tabular-nums text-warning"><Confidential show={canAmounts}>${totalPendiente.toLocaleString()}</Confidential></p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <p className="text-[10px] uppercase text-muted-foreground">Total paquetes</p>
          <p className="text-2xl font-bold mt-1 tabular-nums">{packages.length}</p>
        </CardContent></Card>
      </div>

      <div className="flex justify-between items-center">
        <h3 className="font-semibold flex items-center gap-2 text-sm"><Package className="h-4 w-4" /> Paquetes facturados individualmente</h3>
        {canManage && (
          <Button size="sm" onClick={openNew} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Nuevo paquete</Button>
        )}
      </div>

      {packages.length === 0 ? (
        <Card className="border-dashed"><CardContent className="p-6 text-center text-xs text-muted-foreground">
          Sin paquetes facturados. Creá uno para cobrar servicios fuera del contrato recurrente.
        </CardContent></Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">Paquete</TableHead>
                <TableHead className="text-xs">Tipo</TableHead>
                <TableHead className="text-xs">Contrato</TableHead>
                <TableHead className="text-xs text-right">Cant.</TableHead>
                <TableHead className="text-xs text-right">Total</TableHead>
                <TableHead className="text-xs">Estado</TableHead>
                <TableHead className="text-xs">Factura</TableHead>
                {canManage && <TableHead className="text-xs w-20"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs font-medium">{p.name}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{TYPES.find(t => t.value === p.package_type)?.label}</Badge></TableCell>
                  <TableCell className="text-[10px] text-muted-foreground">
                    {p.contract_id && contractById(p.contract_id)
                      ? CONTRACT_TYPE_LABELS[contractById(p.contract_id)!.contract_type] || contractById(p.contract_id)!.contract_type
                      : "—"}
                  </TableCell>
                  <TableCell className="text-xs text-right tabular-nums">{Number(p.quantity)}</TableCell>
                  <TableCell className="text-xs text-right tabular-nums font-medium"><Confidential show={canAmounts}>{Number(p.total_amount).toFixed(2)} {p.currency}</Confidential></TableCell>
                  <TableCell><Badge variant="outline" className={`text-[10px] ${STATUS_META[p.status].className}`}>{STATUS_META[p.status].label}</Badge></TableCell>
                  <TableCell className="text-[10px] text-muted-foreground">{p.invoice_number || "—"}</TableCell>
                  {canManage && (
                    <TableCell>
                      <div className="flex gap-0.5">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setDialog(p)} aria-label="Editar paquete">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {isAdmin && (
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(p)} aria-label="Eliminar paquete">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={!!dialog} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{dialog?.id ? "Editar paquete" : "Nuevo paquete facturado"}</DialogTitle>
          </DialogHeader>
          {dialog && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Nombre *</Label>
                <Input value={dialog.name ?? ""} onChange={(e) => setDialog({ ...dialog, name: e.target.value })}
                  placeholder="Ej: Bolsa adicional 50h Q2" className="h-8 text-xs" />
              </div>
              {/* Asociación a póliza/contrato (ERP-066) */}
              <div>
                <Label className="text-xs">Asociar a contrato / póliza</Label>
                <Select
                  value={dialog.contract_id ?? NO_CONTRACT}
                  onValueChange={(v) => setDialog({ ...dialog, contract_id: v === NO_CONTRACT ? null : v })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sin asociar (paquete individual)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_CONTRACT} className="text-xs">Sin asociar (paquete individual)</SelectItem>
                    {contracts.map(c => (
                      <SelectItem key={c.id} value={c.id} className="text-xs">{contractLabel(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {contracts.length === 0 && (
                  <p className="text-[10px] text-muted-foreground mt-1">Este cliente no tiene contratos registrados aún.</p>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Tipo</Label>
                  <Select value={dialog.package_type ?? "horas"} onValueChange={(v) => setDialog({ ...dialog, package_type: v as BilledPackageType })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{TYPES.map(t => <SelectItem key={t.value} value={t.value} className="text-xs">{t.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Moneda</Label>
                  <Select value={dialog.currency ?? "USD"} onValueChange={(v) => setDialog({ ...dialog, currency: v })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Cantidad</Label>
                  <Input type="number" step="0.5" min="0" value={dialog.quantity ?? 1}
                    onChange={(e) => setDialog({ ...dialog, quantity: Number(e.target.value) })} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Precio unitario</Label>
                  <Input type="number" step="0.01" min="0" value={dialog.unit_price ?? 0}
                    onChange={(e) => setDialog({ ...dialog, unit_price: Number(e.target.value) })} className="h-8 text-xs" />
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground">
                Total: <span className="font-bold text-foreground tabular-nums">
                  {(Number(dialog.quantity ?? 0) * Number(dialog.unit_price ?? 0)).toFixed(2)} {dialog.currency ?? "USD"}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Estado</Label>
                  <Select value={dialog.status ?? "pendiente"} onValueChange={(v) => setDialog({ ...dialog, status: v as BilledPackageStatus })}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_META) as BilledPackageStatus[]).map(s => (
                        <SelectItem key={s} value={s} className="text-xs">{STATUS_META[s].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Nº de factura</Label>
                  <Input value={dialog.invoice_number ?? ""} onChange={(e) => setDialog({ ...dialog, invoice_number: e.target.value })}
                    placeholder="FAC-..." className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Fecha facturado</Label>
                  <Input type="date" value={dialog.billed_date ?? ""} onChange={(e) => setDialog({ ...dialog, billed_date: e.target.value })} className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Fecha pagado</Label>
                  <Input type="date" value={dialog.paid_date ?? ""} onChange={(e) => setDialog({ ...dialog, paid_date: e.target.value })} className="h-8 text-xs" />
                </div>
              </div>

              <div>
                <Label className="text-xs">Descripción / notas</Label>
                <Textarea value={dialog.description ?? ""} onChange={(e) => setDialog({ ...dialog, description: e.target.value })} rows={2} className="text-xs" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsert.isPending} className="gap-1.5">
              {upsert.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {dialog?.id ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
