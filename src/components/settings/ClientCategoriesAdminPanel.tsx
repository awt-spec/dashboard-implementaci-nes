import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Tag, Lock } from "lucide-react";
import { toast } from "sonner";
import {
  useClientCategoriesAdmin, useUpsertClientCategory, useToggleClientCategory, useDeleteClientCategory,
  type ClientCategory,
} from "@/hooks/useClientCategories";

const PRESET_COLORS = ["#C8200F", "#f59e0b", "#0ea5e9", "#10b981", "#8b5cf6", "#ec4899", "#14b8a6", "#ef4444", "#888880"];

export function ClientCategoriesAdminPanel() {
  const { data: categories, isLoading } = useClientCategoriesAdmin();
  const upsert = useUpsertClientCategory();
  const toggle = useToggleClientCategory();
  const del = useDeleteClientCategory();

  const [editing, setEditing] = useState<Partial<ClientCategory> | null>(null);

  const openNew = () => setEditing({
    code: "", name: "", description: "", color: "#0ea5e9",
    is_active: true, sort_order: (categories?.length ?? 0) * 10 + 10,
  });

  const handleSave = async () => {
    if (!editing?.code?.trim() || !editing?.name?.trim()) {
      toast.error("Código y nombre son obligatorios");
      return;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(editing.code)) {
      toast.error("Código inválido. Solo minúsculas, números y guión bajo. Ej: estrategico");
      return;
    }
    try {
      await upsert.mutateAsync({
        id: editing.id,
        code: editing.code.trim(),
        name: editing.name.trim(),
        description: editing.description?.trim() || null,
        color: editing.color ?? "#0ea5e9",
        is_active: editing.is_active ?? true,
        sort_order: editing.sort_order ?? 0,
      });
      toast.success(editing.id ? "Categoría actualizada" : "Categoría creada");
      setEditing(null);
    } catch (e: any) {
      const msg = e?.message?.includes("duplicate") ? "Ya existe una categoría con ese código" : (e?.message || "Error al guardar");
      toast.error(msg);
    }
  };

  const handleDelete = (c: ClientCategory) => {
    if (c.is_system) {
      toast.error("Las categorías del sistema no se eliminan. Desactivalas en su lugar.");
      return;
    }
    if (!confirm(`¿Eliminar la categoría "${c.name}"? Los clientes que la usen quedarán sin categoría.`)) return;
    del.mutate(c.id, { onError: (e: any) => toast.error(e?.message ?? "No se pudo eliminar") });
  };

  if (isLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" /> Categorías de clientes
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Segmentación de clientes (Estratégico, Premium, En riesgo...). Aparece como selector en el detalle del cliente.
          </p>
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Nueva categoría
        </Button>
      </div>

      <div className="space-y-2">
        {(categories ?? []).map(c => (
          <Card key={c.id} className={!c.is_active ? "opacity-60" : ""}>
            <CardContent className="p-3 flex items-center gap-3">
              <Switch
                checked={c.is_active}
                onCheckedChange={(v) => toggle.mutate(
                  { id: c.id, is_active: v },
                  { onError: (e: any) => toast.error(e?.message ?? "No se pudo cambiar el estado") },
                )}
              />
              <span className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{c.name}</span>
                  <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{c.code}</code>
                  {c.is_system && (
                    <Badge variant="outline" className="text-[10px] gap-1 bg-muted text-muted-foreground">
                      <Lock className="h-2.5 w-2.5" /> sistema
                    </Badge>
                  )}
                  {!c.is_active && <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">inactiva</Badge>}
                </div>
                {c.description && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{c.description}</p>}
              </div>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(c)} aria-label="Editar categoría">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon" variant="ghost" className="h-7 w-7"
                onClick={() => handleDelete(c)} disabled={c.is_system}
                aria-label={c.is_system ? "Categoría del sistema, no eliminable" : "Eliminar categoría"}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {(!categories || categories.length === 0) && (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center text-xs text-muted-foreground">Sin categorías en el catálogo.</CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar categoría" : "Nueva categoría"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Código *</Label>
                  <Input
                    value={editing.code ?? ""}
                    onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                    placeholder="estrategico"
                    disabled={editing.is_system}
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div>
                  <Label className="text-xs">Nombre *</Label>
                  <Input
                    value={editing.name ?? ""}
                    onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                    placeholder="Estratégico"
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Descripción</Label>
                <Textarea
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  rows={2}
                  className="text-xs"
                />
              </div>

              <div>
                <Label className="text-xs">Color</Label>
                <div className="flex items-center gap-2 mt-1">
                  {PRESET_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setEditing({ ...editing, color: c })}
                      className={`h-6 w-6 rounded-full transition-transform ${editing.color === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : ""}`}
                      style={{ backgroundColor: c }}
                      aria-label={`Color ${c}`}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                <Label className="text-xs">Activa (aparece en el selector)</Label>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={upsert.isPending} className="gap-1.5">
              {upsert.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {editing?.id ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
