import { useMemo, useState } from "react";
import { useRoles, useUpsertRole, useDeleteRole, useRoleCounts, type Role, type RoleScope } from "@/hooks/useRoles";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Lock, ShieldAlert, Briefcase, Eye, Users2, Building2, Crown, Headset, Loader2, Plus, Pencil, Trash2, KeyRound } from "lucide-react";
import { toast } from "sonner";

// Iconos/tonos para los roles de sistema; los personalizados usan un default.
const ROLE_VISUAL: Record<string, { Icon: typeof ShieldAlert; tone: string }> = {
  admin: { Icon: ShieldAlert, tone: "bg-destructive/15 text-destructive border-destructive/30" },
  ceo: { Icon: Crown, tone: "bg-violet-500/15 text-violet-500 border-violet-500/30" },
  pm: { Icon: Briefcase, tone: "bg-primary/15 text-primary border-primary/30" },
  gerente_soporte: { Icon: Headset, tone: "bg-cyan-500/15 text-cyan-500 border-cyan-500/30" },
  colaborador: { Icon: Users2, tone: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30" },
  gerente: { Icon: Eye, tone: "bg-amber-500/15 text-amber-500 border-amber-500/30" },
  cliente: { Icon: Building2, tone: "bg-sky-500/15 text-sky-500 border-sky-500/30" },
};
const DEFAULT_VISUAL = { Icon: KeyRound, tone: "bg-muted text-muted-foreground border-border" };

type Draft = { key: string; label: string; description: string; scope: RoleScope; is_active: boolean; isEdit: boolean };

export function RolesCatalogPanel() {
  const { role: myRole } = useAuth();
  const isAdmin = myRole === "admin";
  const { data: roles = [], isLoading } = useRoles();
  const { data: counts = {} } = useRoleCounts();
  const upsert = useUpsertRole();
  const del = useDeleteRole();

  const [q, setQ] = useState("");
  const [scope, setScope] = useState<"all" | RoleScope>("all");
  const [draft, setDraft] = useState<Draft | null>(null);

  const term = q.trim().toLowerCase();
  const filtered = useMemo(
    () => roles.filter(r => {
      if (scope !== "all" && r.scope !== scope) return false;
      if (!term) return true;
      return [r.label, r.key, r.description || ""].some(f => f.toLowerCase().includes(term));
    }),
    [roles, term, scope],
  );

  const openNew = () => setDraft({ key: "", label: "", description: "", scope: "interno", is_active: true, isEdit: false });
  const openEdit = (r: Role) => setDraft({ key: r.key, label: r.label, description: r.description || "", scope: r.scope, is_active: r.is_active, isEdit: true });

  const save = () => {
    if (!draft) return;
    const key = draft.isEdit ? draft.key : draft.key.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!key) { toast.error("La clave del rol es obligatoria"); return; }
    if (!draft.label.trim()) { toast.error("El nombre del rol es obligatorio"); return; }
    if (!draft.isEdit && roles.some(r => r.key === key)) { toast.error("Ya existe un rol con esa clave"); return; }
    upsert.mutate(
      { key, label: draft.label.trim(), description: draft.description.trim() || null, scope: draft.scope, is_active: draft.is_active, isEdit: draft.isEdit },
      {
        onSuccess: () => { toast.success(draft.isEdit ? "Rol actualizado" : "Rol creado"); setDraft(null); },
        onError: (e: any) => toast.error(e.message || "Error al guardar"),
      },
    );
  };

  const remove = (r: Role) => {
    if (!confirm(`¿Eliminar el rol "${r.label}"?`)) return;
    del.mutate(r.key, {
      onSuccess: () => toast.success("Rol eliminado"),
      onError: (e: any) => toast.error(e.message || "No se pudo eliminar"),
    });
  };

  const scopeBtn = (val: "all" | RoleScope, label: string) => (
    <button
      onClick={() => setScope(val)}
      className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
        scope === val ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-accent"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Lock className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold">Roles de acceso</h2>
          <Badge variant="outline" className="ml-1">{roles.length} roles</Badge>
        </div>
        {isAdmin && (
          <Button size="sm" onClick={openNew} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Nuevo rol</Button>
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar rol por nombre o descripción..."
            value={q}
            onChange={e => setQ(e.target.value)}
            className="h-8 w-[280px] pl-8 text-xs"
          />
        </div>
        {scopeBtn("all", "Todos")}
        {scopeBtn("interno", "Internos")}
        {scopeBtn("externo", "Externos")}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rol</TableHead>
                <TableHead>Ámbito</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Descripción</TableHead>
                <TableHead className="text-right">Usuarios</TableHead>
                {isAdmin && <TableHead className="w-20"></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary inline" /></TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={isAdmin ? 6 : 5} className="text-center py-6 text-muted-foreground text-sm">Sin roles que coincidan</TableCell></TableRow>
              ) : filtered.map(r => {
                const v = ROLE_VISUAL[r.key] || DEFAULT_VISUAL;
                return (
                  <TableRow key={r.key} className={!r.is_active ? "opacity-50" : ""}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className={`gap-1 text-[11px] ${v.tone}`}>
                          <v.Icon className="h-3 w-3" /> {r.label}
                        </Badge>
                        <code className="text-[10px] text-muted-foreground">{r.key}</code>
                      </div>
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{r.scope === "interno" ? "Interno (SYSDE)" : "Externo (cliente)"}</Badge></TableCell>
                    <TableCell>
                      {r.is_system
                        ? <Badge variant="outline" className="text-[10px]">Sistema</Badge>
                        : <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">Personalizado</Badge>}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-md">{r.description}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{counts[r.key] || 0}</TableCell>
                    {isAdmin && (
                      <TableCell>
                        <div className="flex gap-0.5">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(r)} aria-label="Editar rol">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          {!r.is_system && (
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => remove(r)} aria-label="Eliminar rol">
                              <Trash2 className="h-3.5 w-3.5 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground">
        Los roles de <strong>sistema</strong> reflejan el enum <code>app_role</code> y sus políticas RLS (no se eliminan).
        Los roles <strong>personalizados</strong> se gestionan acá; conectar su aplicación de permisos en RLS
        (RBAC dinámico) es la fase siguiente del refactor. La asignación de roles a usuarios se hace desde la
        pestaña <strong>Usuarios</strong>.
      </p>

      {/* Crear / editar rol */}
      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{draft?.isEdit ? "Editar rol" : "Nuevo rol"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">Clave (identificador)</Label>
                <Input
                  value={draft.key}
                  onChange={e => setDraft({ ...draft, key: e.target.value })}
                  disabled={draft.isEdit}
                  placeholder="ej: auditor"
                  className="h-8 text-sm font-mono"
                />
                {!draft.isEdit && <p className="text-[10px] text-muted-foreground">Solo minúsculas, números y guion bajo. No se puede cambiar luego.</p>}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nombre visible *</Label>
                <Input value={draft.label} onChange={e => setDraft({ ...draft, label: e.target.value })} placeholder="ej: Auditor de calidad" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Descripción</Label>
                <Input value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Ámbito</Label>
                <Select value={draft.scope} onValueChange={(v: RoleScope) => setDraft({ ...draft, scope: v })}>
                  <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="interno">Interno (SYSDE)</SelectItem>
                    <SelectItem value="externo">Externo (cliente)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancelar</Button>
            <Button onClick={save} disabled={upsert.isPending} className="gap-1.5">
              {upsert.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              {draft?.isEdit ? "Guardar" : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
