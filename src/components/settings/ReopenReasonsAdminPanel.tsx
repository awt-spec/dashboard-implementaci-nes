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
import { Loader2, Plus, Pencil, Trash2, RotateCcw, Lock, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import {
  useReopenReasonsAdmin,
  useUpsertReopenReason,
  useToggleReopenReason,
  useDeleteReopenReason,
  useReorderReopenReasons,
  type ReopenReason,
  type ReopenReasonSeverity,
} from "@/hooks/useReopenReasons";

const SEVERITY_OPTIONS: Array<{ value: ReopenReasonSeverity; label: string; color: string }> = [
  { value: "alta",   label: "Alta",   color: "bg-destructive/15 text-destructive border-destructive/30" },
  { value: "media",  label: "Media",  color: "bg-warning/15 text-warning border-warning/30" },
  { value: "baja",   label: "Baja",   color: "bg-info/15 text-info border-info/30" },
  { value: "neutra", label: "Neutra", color: "bg-muted text-muted-foreground border-border" },
];

const severityClass = (s: ReopenReasonSeverity) =>
  SEVERITY_OPTIONS.find(o => o.value === s)?.color ?? SEVERITY_OPTIONS[3].color;

export function ReopenReasonsAdminPanel() {
  const { data: reasons, isLoading } = useReopenReasonsAdmin();
  const upsert = useUpsertReopenReason();
  const toggle = useToggleReopenReason();
  const del = useDeleteReopenReason();
  const reorder = useReorderReopenReasons();

  const [editing, setEditing] = useState<Partial<ReopenReason> | null>(null);

  const openNew = () => setEditing({
    code: "",
    name: "",
    hint: "",
    severity: "media",
    is_active: true,
    sort_order: (reasons?.length ?? 0) * 10 + 10,
  });

  const openEdit = (r: ReopenReason) => setEditing({ ...r });

  const handleSave = async () => {
    if (!editing) return;
    if (!editing.code?.trim() || !editing.name?.trim()) {
      toast.error("Código y nombre son obligatorios");
      return;
    }
    // Validar code: solo lowercase + underscore
    if (!/^[a-z][a-z0-9_]*$/.test(editing.code)) {
      toast.error("Código inválido. Solo minúsculas, números y guión bajo. Debe empezar con letra. Ej: cliente_rechazo");
      return;
    }
    try {
      await upsert.mutateAsync({
        id: editing.id,
        code: editing.code.trim(),
        name: editing.name.trim(),
        hint: editing.hint?.trim() || null,
        severity: editing.severity ?? "media",
        is_active: editing.is_active ?? true,
        sort_order: editing.sort_order ?? 0,
      });
      toast.success(editing.id ? "Motivo actualizado" : "Motivo creado");
      setEditing(null);
    } catch (e: any) {
      const msg = e?.message?.includes("duplicate")
        ? "Ya existe un motivo con ese código"
        : (e?.message || "Error al guardar");
      toast.error(msg);
    }
  };

  const handleDelete = async (r: ReopenReason) => {
    if (r.is_system) {
      toast.error("Los motivos del sistema no se pueden eliminar. Desactivalos en su lugar.");
      return;
    }
    if (!confirm(`¿Eliminar definitivamente el motivo "${r.name}"? Si está referenciado en reaperturas históricas, esos registros conservan el código pero perderán el nombre legible.`)) return;
    try {
      await del.mutateAsync(r.id);
      toast.success("Motivo eliminado");
    } catch (e: any) {
      toast.error(e?.message || "Error al eliminar");
    }
  };

  const handleMove = async (r: ReopenReason, direction: "up" | "down") => {
    if (!reasons) return;
    const idx = reasons.findIndex(x => x.id === r.id);
    if (idx < 0) return;
    const swapWith = direction === "up" ? idx - 1 : idx + 1;
    if (swapWith < 0 || swapWith >= reasons.length) return;
    const other = reasons[swapWith];
    try {
      await reorder.mutateAsync([
        { id: r.id, sort_order: other.sort_order },
        { id: other.id, sort_order: r.sort_order },
      ]);
    } catch (e: any) {
      toast.error(e?.message || "Error al reordenar");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <RotateCcw className="h-4 w-4 text-primary" /> Motivos de reapertura / incidencia
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Catálogo que se usa cuando un caso se reabre. Cambios se reflejan en el dialog "Reabrir caso" sin redeploy.
          </p>
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Nuevo motivo
        </Button>
      </div>

      <div className="space-y-2">
        {(reasons ?? []).map((r, i) => (
          <Card key={r.id} className={!r.is_active ? "opacity-60" : ""}>
            <CardContent className="p-3 flex items-center gap-3">
              <div className="flex flex-col gap-0.5">
                <Button
                  size="icon" variant="ghost" className="h-5 w-5"
                  onClick={() => handleMove(r, "up")}
                  disabled={i === 0 || reorder.isPending}
                >
                  <ArrowUp className="h-3 w-3" />
                </Button>
                <Button
                  size="icon" variant="ghost" className="h-5 w-5"
                  onClick={() => handleMove(r, "down")}
                  disabled={i === (reasons?.length ?? 1) - 1 || reorder.isPending}
                >
                  <ArrowDown className="h-3 w-3" />
                </Button>
              </div>

              <Switch
                checked={r.is_active}
                onCheckedChange={(v) => toggle.mutate({ id: r.id, is_active: v })}
              />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{r.name}</span>
                  <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded font-mono">{r.code}</code>
                  <Badge variant="outline" className={`text-[10px] ${severityClass(r.severity)}`}>
                    {r.severity}
                  </Badge>
                  {r.is_system && (
                    <Badge variant="outline" className="text-[10px] gap-1 bg-muted text-muted-foreground">
                      <Lock className="h-2.5 w-2.5" /> sistema
                    </Badge>
                  )}
                  {!r.is_active && (
                    <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">
                      inactivo
                    </Badge>
                  )}
                </div>
                {r.hint && (
                  <p className="text-[11px] text-muted-foreground mt-1 truncate">{r.hint}</p>
                )}
              </div>

              <div className="flex items-center gap-0.5">
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(r)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon" variant="ghost" className="h-7 w-7"
                  onClick={() => handleDelete(r)}
                  disabled={r.is_system}
                  title={r.is_system ? "Motivo del sistema, no eliminable" : "Eliminar"}
                >
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {(!reasons || reasons.length === 0) && (
          <Card className="border-dashed">
            <CardContent className="p-6 text-center text-xs text-muted-foreground">
              Sin motivos en el catálogo.
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar motivo" : "Nuevo motivo"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Código *</Label>
                <Input
                  value={editing.code ?? ""}
                  onChange={(e) => setEditing({ ...editing, code: e.target.value })}
                  placeholder="cliente_rechazo"
                  disabled={editing.is_system}
                  className="h-8 text-xs font-mono"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Identificador estable. Solo minúsculas, números y guión bajo.
                  {editing.is_system && " No editable en motivos del sistema."}
                </p>
              </div>

              <div>
                <Label className="text-xs">Nombre visible *</Label>
                <Input
                  value={editing.name ?? ""}
                  onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                  placeholder="Cliente rechazó la entrega"
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs">Hint (descripción corta)</Label>
                <Textarea
                  value={editing.hint ?? ""}
                  onChange={(e) => setEditing({ ...editing, hint: e.target.value })}
                  placeholder="Cuándo usar este motivo..."
                  rows={2}
                  className="text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Severidad</Label>
                  <Select
                    value={editing.severity ?? "media"}
                    onValueChange={(v) => setEditing({ ...editing, severity: v as ReopenReasonSeverity })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SEVERITY_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Orden</Label>
                  <Input
                    type="number"
                    value={editing.sort_order ?? 0}
                    onChange={(e) => setEditing({ ...editing, sort_order: Number(e.target.value) })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Switch
                  checked={editing.is_active ?? true}
                  onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                />
                <Label className="text-xs">Activo (aparece en el selector)</Label>
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
