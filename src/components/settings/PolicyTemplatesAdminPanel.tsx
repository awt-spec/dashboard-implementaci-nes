import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, FileText, Package } from "lucide-react";
import { toast } from "sonner";
import {
  usePolicyTemplates, useUpsertPolicyTemplate, useDeletePolicyTemplate,
  usePolicyTemplatePackages, useUpsertTemplatePackage, useDeleteTemplatePackage,
  type PolicyTemplate, type PolicyTemplatePackage,
} from "@/hooks/usePolicyTemplates";

const CURRENCIES = ["USD", "CRC", "EUR", "MXN", "GTQ"];
const CYCLES = [
  { value: "mensual", label: "Mensual" },
  { value: "trimestral", label: "Trimestral" },
  { value: "anual", label: "Anual" },
  { value: "unico", label: "Pago único" },
];

export function PolicyTemplatesAdminPanel() {
  const { data: templates, isLoading } = usePolicyTemplates(true);
  const upsert = useUpsertPolicyTemplate();
  const del = useDeletePolicyTemplate();

  const [editing, setEditing] = useState<Partial<PolicyTemplate> | null>(null);
  const [packagesFor, setPackagesFor] = useState<PolicyTemplate | null>(null);

  const openNew = () => setEditing({ name: "", description: "", policy_version: "v1", is_active: true });

  const handleSave = async () => {
    if (!editing?.name?.trim()) { toast.error("El nombre es obligatorio"); return; }
    try {
      await upsert.mutateAsync({
        id: editing.id, name: editing.name.trim(),
        description: editing.description?.trim() || null,
        policy_version: editing.policy_version?.trim() || "v1",
        is_active: editing.is_active ?? true,
      });
      toast.success(editing.id ? "Plantilla actualizada" : "Plantilla creada");
      setEditing(null);
    } catch (e: any) {
      toast.error(e?.message?.includes("duplicate") ? "Ya existe una plantilla con ese nombre y versión" : (e?.message || "Error al guardar"));
    }
  };

  const handleDelete = (t: PolicyTemplate) => {
    if (!confirm(`¿Eliminar la plantilla "${t.name}"? Se borran sus paquetes.`)) return;
    del.mutate(t.id, { onError: (e: any) => toast.error(e?.message ?? "No se pudo eliminar") });
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Plantillas de pólizas
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Templates reutilizables de pólizas de servicio con paquetes anidados.
          </p>
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Nueva plantilla</Button>
      </div>

      <div className="space-y-2">
        {(templates ?? []).map(t => (
          <Card key={t.id} className={!t.is_active ? "opacity-60" : ""}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{t.name}</span>
                  <Badge variant="outline" className="text-[10px]">{t.policy_version}</Badge>
                  {!t.is_active && <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">inactiva</Badge>}
                </div>
                {t.description && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{t.description}</p>}
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setPackagesFor(t)}>
                <Package className="h-3 w-3" /> Paquetes
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(t)} aria-label="Editar plantilla">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(t)} aria-label="Eliminar plantilla">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {(!templates || templates.length === 0) && (
          <Card className="border-dashed"><CardContent className="p-6 text-center text-xs text-muted-foreground">Sin plantillas de pólizas. Creá la primera.</CardContent></Card>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar plantilla" : "Nueva plantilla de póliza"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2">
                  <Label className="text-xs">Nombre *</Label>
                  <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ej: Póliza Premium SVA" className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Versión</Label>
                  <Input value={editing.policy_version ?? "v1"} onChange={(e) => setEditing({ ...editing, policy_version: e.target.value })} className="h-8 text-xs" />
                </div>
              </div>
              <div>
                <Label className="text-xs">Descripción</Label>
                <Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} className="text-xs" />
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                <Label className="text-xs">Activa</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsert.isPending} className="gap-1.5">
              {upsert.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{editing?.id ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PackagesDialog template={packagesFor} onClose={() => setPackagesFor(null)} />
    </div>
  );
}

function PackagesDialog({ template, onClose }: { template: PolicyTemplate | null; onClose: () => void }) {
  const { data: packages = [], isLoading } = usePolicyTemplatePackages(template?.id);
  const upsert = useUpsertTemplatePackage();
  const del = useDeleteTemplatePackage();
  const [editing, setEditing] = useState<Partial<PolicyTemplatePackage> | null>(null);

  const openNew = () => template && setEditing({
    policy_template_id: template.id, name: "", included_hours: 0, price: 0, currency: "USD", billing_cycle: "mensual",
    sort_order: packages.length * 10 + 10,
  });

  const handleSave = async () => {
    if (!editing?.name?.trim() || !template) { toast.error("El nombre es obligatorio"); return; }
    try {
      await upsert.mutateAsync({
        id: editing.id, policy_template_id: template.id, name: editing.name.trim(),
        description: editing.description ?? null, included_hours: Number(editing.included_hours ?? 0),
        price: Number(editing.price ?? 0), currency: editing.currency ?? "USD",
        billing_cycle: editing.billing_cycle ?? "mensual", sort_order: editing.sort_order ?? 0,
      });
      toast.success(editing.id ? "Paquete actualizado" : "Paquete creado");
      setEditing(null);
    } catch (e: any) { toast.error(e?.message || "Error al guardar"); }
  };

  return (
    <Dialog open={!!template} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Package className="h-4 w-4" /> Paquetes · {template?.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex justify-end">
            <Button size="sm" onClick={openNew} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Nuevo paquete</Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : packages.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4 italic">Sin paquetes en esta plantilla.</p>
          ) : (
            <div className="space-y-2">
              {packages.map(p => (
                <Card key={p.id}>
                  <CardContent className="p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {p.included_hours}h · {Number(p.price).toFixed(2)} {p.currency} · {p.billing_cycle}
                      </p>
                    </div>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(p)} aria-label="Editar paquete">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => template && del.mutate({ id: p.id, templateId: template.id })} aria-label="Eliminar paquete">
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* Sub-dialog crear/editar paquete */}
        <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>{editing?.id ? "Editar paquete" : "Nuevo paquete"}</DialogTitle></DialogHeader>
            {editing && (
              <div className="space-y-3">
                <div>
                  <Label className="text-xs">Nombre *</Label>
                  <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ej: 40h soporte mensual" className="h-8 text-xs" />
                </div>
                <div>
                  <Label className="text-xs">Descripción</Label>
                  <Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} className="text-xs" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">Horas incluidas</Label>
                    <Input type="number" min="0" value={editing.included_hours ?? 0} onChange={(e) => setEditing({ ...editing, included_hours: Number(e.target.value) })} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Precio</Label>
                    <Input type="number" step="0.01" min="0" value={editing.price ?? 0} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} className="h-8 text-xs" />
                  </div>
                  <div>
                    <Label className="text-xs">Moneda</Label>
                    <Select value={editing.currency ?? "USD"} onValueChange={(v) => setEditing({ ...editing, currency: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{CURRENCIES.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs">Ciclo</Label>
                    <Select value={editing.billing_cycle ?? "mensual"} onValueChange={(v) => setEditing({ ...editing, billing_cycle: v })}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>{CYCLES.map(c => <SelectItem key={c.value} value={c.value} className="text-xs">{c.label}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button onClick={handleSave} disabled={upsert.isPending} className="gap-1.5">
                {upsert.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{editing?.id ? "Guardar" : "Crear"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
