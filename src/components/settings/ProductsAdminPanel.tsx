import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Boxes, Package, GitBranch } from "lucide-react";
import { toast } from "sonner";
import {
  useProducts, useUpsertProduct, useDeleteProduct,
  useProductModules, useUpsertProductModule, useDeleteProductModule,
  useProductVersions, useUpsertProductVersion, useDeleteProductVersion,
  useVersionModules, useSetVersionModules,
  type Product, type ProductModule, type ProductVersion,
} from "@/hooks/useProducts";

export function ProductsAdminPanel() {
  const { data: products, isLoading } = useProducts(true);
  const upsert = useUpsertProduct();
  const del = useDeleteProduct();

  const [editing, setEditing] = useState<Partial<Product> | null>(null);
  const [manageFor, setManageFor] = useState<Product | null>(null);

  const openNew = () => setEditing({ code: "", name: "", description: "", is_active: true, sort_order: (products?.length ?? 0) * 10 + 10 });

  const handleSave = async () => {
    if (!editing?.code?.trim() || !editing?.name?.trim()) { toast.error("Código y nombre son obligatorios"); return; }
    if (!/^[a-z][a-z0-9_]*$/.test(editing.code)) { toast.error("Código inválido (minúsculas, números, _)"); return; }
    try {
      await upsert.mutateAsync({ id: editing.id, code: editing.code.trim(), name: editing.name.trim(), description: editing.description ?? null, is_active: editing.is_active ?? true, sort_order: editing.sort_order ?? 0 });
      toast.success(editing.id ? "Producto actualizado" : "Producto creado");
      setEditing(null);
    } catch (e: any) {
      toast.error(e?.message?.includes("duplicate") ? "Ya existe un producto con ese código" : (e?.message || "Error al guardar"));
    }
  };

  const handleDelete = (p: Product) => {
    if (!confirm(`¿Eliminar el producto "${p.name}"? Se borran sus módulos y versiones.`)) return;
    del.mutate(p.id, { onError: (e: any) => toast.error(e?.message ?? "No se pudo eliminar") });
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2"><Boxes className="h-4 w-4 text-primary" /> Productos de software</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Catálogo maestro del portafolio: productos, módulos y versiones.</p>
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Nuevo producto</Button>
      </div>

      <div className="space-y-2">
        {(products ?? []).map(p => (
          <Card key={p.id} className={!p.is_active ? "opacity-60" : ""}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{p.name}</span>
                  <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{p.code}</code>
                  {!p.is_active && <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">inactivo</Badge>}
                </div>
                {p.description && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{p.description}</p>}
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setManageFor(p)}>
                <Package className="h-3 w-3" /> Módulos & versiones
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(p)} aria-label="Editar producto"><Pencil className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(p)} aria-label="Eliminar producto"><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
            </CardContent>
          </Card>
        ))}
        {(!products || products.length === 0) && (
          <Card className="border-dashed"><CardContent className="p-6 text-center text-xs text-muted-foreground">Sin productos en el catálogo.</CardContent></Card>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar producto" : "Nuevo producto"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div><Label className="text-xs">Código *</Label><Input value={editing.code ?? ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} disabled={!!editing.id} placeholder="saf_plus" className="h-8 text-xs font-mono" /></div>
                <div className="col-span-2"><Label className="text-xs">Nombre *</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="SAF+" className="h-8 text-xs" /></div>
              </div>
              <div><Label className="text-xs">Descripción</Label><Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} className="text-xs" /></div>
              <div className="flex items-center gap-2 pt-1"><Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} /><Label className="text-xs">Activo</Label></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsert.isPending} className="gap-1.5">{upsert.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}{editing?.id ? "Guardar" : "Crear"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ManageDialog product={manageFor} onClose={() => setManageFor(null)} />
    </div>
  );
}

function ManageDialog({ product, onClose }: { product: Product | null; onClose: () => void }) {
  return (
    <Dialog open={!!product} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><Package className="h-4 w-4" /> {product?.name} — módulos & versiones</DialogTitle></DialogHeader>
        {product && (
          <Tabs defaultValue="modules">
            <TabsList>
              <TabsTrigger value="modules" className="gap-1.5"><Package className="h-3.5 w-3.5" /> Módulos</TabsTrigger>
              <TabsTrigger value="versions" className="gap-1.5"><GitBranch className="h-3.5 w-3.5" /> Versiones</TabsTrigger>
            </TabsList>
            <TabsContent value="modules" className="mt-3"><ModulesSection product={product} /></TabsContent>
            <TabsContent value="versions" className="mt-3"><VersionsSection product={product} /></TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ModulesSection({ product }: { product: Product }) {
  const { data: modules = [], isLoading } = useProductModules(product.id);
  const upsert = useUpsertProductModule();
  const del = useDeleteProductModule();
  const [editing, setEditing] = useState<Partial<ProductModule> | null>(null);

  const openNew = () => setEditing({ product_id: product.id, code: "", name: "", is_active: true, sort_order: modules.length * 10 + 10 });

  const handleSave = async () => {
    if (!editing?.code?.trim() || !editing?.name?.trim()) { toast.error("Código y nombre obligatorios"); return; }
    try {
      await upsert.mutateAsync({ id: editing.id, product_id: product.id, code: editing.code.trim(), name: editing.name.trim(), description: editing.description ?? null, is_active: editing.is_active ?? true, sort_order: editing.sort_order ?? 0 });
      toast.success("Módulo guardado"); setEditing(null);
    } catch (e: any) { toast.error(e?.message?.includes("duplicate") ? "Código duplicado en este producto" : (e?.message || "Error")); }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end"><Button size="sm" onClick={openNew} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Nuevo módulo</Button></div>
      {isLoading ? <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        : modules.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4 italic">Sin módulos.</p>
        : modules.map(m => (
          <Card key={m.id} className={!m.is_active ? "opacity-60" : ""}><CardContent className="p-2.5 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2"><span className="text-xs font-medium">{m.name}</span><code className="text-[9px] bg-muted px-1 rounded">{m.code}</code></div>
              {m.description && <p className="text-[10px] text-muted-foreground truncate">{m.description}</p>}
            </div>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditing(m)} aria-label="Editar módulo"><Pencil className="h-3 w-3" /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => del.mutate({ id: m.id, productId: product.id })} aria-label="Eliminar módulo"><Trash2 className="h-3 w-3 text-destructive" /></Button>
          </CardContent></Card>
        ))}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar módulo" : "Nuevo módulo"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div><Label className="text-xs">Código *</Label><Input value={editing.code ?? ""} onChange={(e) => setEditing({ ...editing, code: e.target.value })} disabled={!!editing.id} className="h-8 text-xs font-mono" /></div>
                <div className="col-span-2"><Label className="text-xs">Nombre *</Label><Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className="h-8 text-xs" /></div>
              </div>
              <div><Label className="text-xs">Descripción</Label><Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} className="text-xs" /></div>
            </div>
          )}
          <DialogFooter><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button onClick={handleSave} disabled={upsert.isPending}>{upsert.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function VersionsSection({ product }: { product: Product }) {
  const { data: versions = [], isLoading } = useProductVersions(product.id);
  const { data: modules = [] } = useProductModules(product.id);
  const upsert = useUpsertProductVersion();
  const del = useDeleteProductVersion();
  const [editing, setEditing] = useState<Partial<ProductVersion> | null>(null);
  const [assocFor, setAssocFor] = useState<ProductVersion | null>(null);

  const openNew = () => setEditing({ product_id: product.id, version_label: "", is_active: true });

  const handleSave = async () => {
    if (!editing?.version_label?.trim()) { toast.error("La versión es obligatoria"); return; }
    try {
      await upsert.mutateAsync({ id: editing.id, product_id: product.id, version_label: editing.version_label.trim(), release_date: editing.release_date ?? null, notes: editing.notes ?? null, is_active: editing.is_active ?? true });
      toast.success("Versión guardada"); setEditing(null);
    } catch (e: any) { toast.error(e?.message?.includes("duplicate") ? "Versión duplicada" : (e?.message || "Error")); }
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end"><Button size="sm" onClick={openNew} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Nueva versión</Button></div>
      {isLoading ? <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        : versions.length === 0 ? <p className="text-xs text-muted-foreground text-center py-4 italic">Sin versiones.</p>
        : versions.map(v => (
          <Card key={v.id} className={!v.is_active ? "opacity-60" : ""}><CardContent className="p-2.5 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2"><span className="text-xs font-medium tabular-nums">{v.version_label}</span>{v.release_date && <span className="text-[10px] text-muted-foreground">{v.release_date}</span>}</div>
              {v.notes && <p className="text-[10px] text-muted-foreground truncate">{v.notes}</p>}
            </div>
            <Button size="sm" variant="outline" className="h-6 text-[10px] gap-1" onClick={() => setAssocFor(v)} disabled={modules.length === 0}>Módulos</Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditing(v)} aria-label="Editar versión"><Pencil className="h-3 w-3" /></Button>
            <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => del.mutate({ id: v.id, productId: product.id })} aria-label="Eliminar versión"><Trash2 className="h-3 w-3 text-destructive" /></Button>
          </CardContent></Card>
        ))}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar versión" : "Nueva versión"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Versión *</Label><Input value={editing.version_label ?? ""} onChange={(e) => setEditing({ ...editing, version_label: e.target.value })} placeholder="2024.4.1" className="h-8 text-xs" /></div>
                <div><Label className="text-xs">Fecha release</Label><Input type="date" value={editing.release_date ?? ""} onChange={(e) => setEditing({ ...editing, release_date: e.target.value })} className="h-8 text-xs" /></div>
              </div>
              <div><Label className="text-xs">Notas</Label><Textarea value={editing.notes ?? ""} onChange={(e) => setEditing({ ...editing, notes: e.target.value })} rows={2} className="text-xs" /></div>
            </div>
          )}
          <DialogFooter><Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button><Button onClick={handleSave} disabled={upsert.isPending}>{upsert.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}Guardar</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <VersionModulesDialog version={assocFor} modules={modules} onClose={() => setAssocFor(null)} />
    </div>
  );
}

function VersionModulesDialog({ version, modules, onClose }: { version: ProductVersion | null; modules: ProductModule[]; onClose: () => void }) {
  const { data: assigned = [], isLoading } = useVersionModules(version?.id);
  const setMods = useSetVersionModules();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Hidratar selección con los módulos ya asignados cuando se abre / cargan datos
  useEffect(() => {
    if (version && !isLoading) setSelected(new Set(assigned));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version?.id, isLoading]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleSave = () => {
    if (!version) return;
    setMods.mutate({ versionId: version.id, moduleIds: Array.from(selected) }, {
      onSuccess: () => { toast.success("Módulos de la versión actualizados"); onClose(); },
      onError: (e: any) => toast.error(e?.message ?? "Error"),
    });
  };

  return (
    <Dialog open={!!version} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><GitBranch className="h-4 w-4" /> Módulos de la versión {version?.version_label}</DialogTitle></DialogHeader>
        {isLoading ? <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : (
          <div className="space-y-1 max-h-72 overflow-y-auto">
            {modules.map(m => (
              <label key={m.id} className="flex items-center gap-2 p-2 rounded-md hover:bg-accent/30 cursor-pointer">
                <Checkbox checked={selected.has(m.id)} onCheckedChange={() => toggle(m.id)} />
                <div className="flex-1 min-w-0"><p className="text-xs font-medium">{m.name}</p><code className="text-[9px] text-muted-foreground">{m.code}</code></div>
              </label>
            ))}
            {modules.length === 0 && <p className="text-xs text-muted-foreground text-center py-4 italic">Este producto no tiene módulos. Creá módulos primero.</p>}
          </div>
        )}
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} disabled={setMods.isPending} className="gap-1.5">{setMods.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}Guardar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
