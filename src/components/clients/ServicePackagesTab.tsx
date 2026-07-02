import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Plus, Pencil, Trash2, Lock, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import {
  useServicePackages, useUpsertServicePackage, useDeleteServicePackage,
  type ServicePackage, type ServicePackageInput,
} from "@/hooks/useServicePackages";

const fmtDate = (d?: string | null) => (d ? d.slice(0, 10).split("-").reverse().join("/") : "—");
const n2 = (v: number) => Number(v || 0).toLocaleString("es-CR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const emptyPkg = (clientId: string): ServicePackageInput => ({
  client_id: clientId,
  policy_number: 0,
  package_number: 0,
  product: "SYSDE SAF",
  hours_contracted: 24,
  start_date: "",
  end_date: "",
});

export function ServicePackagesTab({ clientId }: { clientId: string }) {
  const { role } = useAuth();
  const canManage = role === "admin" || role === "pm";
  const { data: packages = [], isLoading } = useServicePackages(clientId);
  const upsert = useUpsertServicePackage(clientId);
  const del = useDeleteServicePackage(clientId);

  const [dialog, setDialog] = useState<ServicePackageInput | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const save = () => {
    if (!dialog) return;
    if (!dialog.policy_number || !dialog.package_number) { toast.error("Póliza y paquete son requeridos"); return; }
    if (!dialog.start_date || !dialog.end_date) { toast.error("Fechas de vigencia requeridas"); return; }
    if (dialog.end_date < dialog.start_date) { toast.error("La fecha de vencimiento no puede ser anterior al inicio"); return; }
    upsert.mutate(dialog, {
      onSuccess: () => { toast.success(dialog.id ? "Paquete actualizado" : "Paquete creado"); setDialog(null); },
      onError: (e: any) => toast.error(e?.message || "Error al guardar"),
    });
  };

  const remove = (p: ServicePackage) => {
    if (!confirm(`¿Eliminar la póliza ${p.policy_number} / paquete ${p.package_number}?`)) return;
    del.mutate(p.id, {
      onSuccess: () => toast.success("Paquete eliminado"),
      onError: (e: any) => toast.error(e?.message || "Error al eliminar"),
    });
  };

  return (
    <div className="space-y-4">
      {!canManage && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border text-xs text-muted-foreground">
          <Lock className="h-3.5 w-3.5" /> Vista de solo lectura. Solo admin/PM gestionan pólizas de servicio.
        </div>
      )}

      <div className="flex justify-between items-center">
        <h3 className="font-semibold flex items-center gap-2 text-sm"><ShieldCheck className="h-4 w-4" /> Pólizas de servicio</h3>
        {canManage && (
          <Button size="sm" onClick={() => setDialog(emptyPkg(clientId))}>
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Nueva póliza
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-8 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Póliza</TableHead>
                  <TableHead>Paquete</TableHead>
                  <TableHead>Producto</TableHead>
                  <TableHead className="text-right">Horas</TableHead>
                  <TableHead>Vigencia</TableHead>
                  <TableHead>Estado</TableHead>
                  {canManage && <TableHead className="w-[90px]"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {packages.length === 0 ? (
                  <TableRow><TableCell colSpan={canManage ? 7 : 6} className="text-center py-6 text-muted-foreground text-sm">Sin pólizas registradas</TableCell></TableRow>
                ) : packages.map(p => {
                  const activo = p.end_date >= today;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium tabular-nums">{p.policy_number}</TableCell>
                      <TableCell className="tabular-nums">{p.package_number}</TableCell>
                      <TableCell className="text-xs">{p.product || "—"}</TableCell>
                      <TableCell className="text-right tabular-nums">{n2(p.hours_contracted)}</TableCell>
                      <TableCell className="text-xs">{fmtDate(p.start_date)} → {fmtDate(p.end_date)}</TableCell>
                      <TableCell>
                        <Badge variant={activo ? "default" : "secondary"} className="text-[10px]">{activo ? "Activo" : "Vencido"}</Badge>
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDialog({ ...p })}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(p)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!dialog} onOpenChange={o => !o && setDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{dialog?.id ? "Editar póliza" : "Nueva póliza"}</DialogTitle></DialogHeader>
          {dialog && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Póliza *</Label>
                <Input type="number" value={dialog.policy_number || ""} onChange={e => setDialog({ ...dialog, policy_number: parseInt(e.target.value, 10) || 0 })} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Paquete *</Label>
                <Input type="number" value={dialog.package_number || ""} onChange={e => setDialog({ ...dialog, package_number: parseInt(e.target.value, 10) || 0 })} className="h-9" />
              </div>
              <div className="col-span-2">
                <Label className="text-xs">Producto</Label>
                <Input value={dialog.product || ""} onChange={e => setDialog({ ...dialog, product: e.target.value })} className="h-9" placeholder="SYSDE SAF" />
              </div>
              <div>
                <Label className="text-xs">Horas contratadas *</Label>
                <Input type="number" step="0.5" value={dialog.hours_contracted || ""} onChange={e => setDialog({ ...dialog, hours_contracted: parseFloat(e.target.value) || 0 })} className="h-9" />
              </div>
              <div />
              <div>
                <Label className="text-xs">Fecha inicial *</Label>
                <Input type="date" value={dialog.start_date} onChange={e => setDialog({ ...dialog, start_date: e.target.value })} className="h-9" />
              </div>
              <div>
                <Label className="text-xs">Fecha vencimiento *</Label>
                <Input type="date" value={dialog.end_date} onChange={e => setDialog({ ...dialog, end_date: e.target.value })} className="h-9" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)}>Cancelar</Button>
            <Button onClick={save} disabled={upsert.isPending}>
              {upsert.isPending && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />} Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
