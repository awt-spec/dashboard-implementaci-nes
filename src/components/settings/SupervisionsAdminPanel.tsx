import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Trash2, UserCheck, Users, Pause, Search } from "lucide-react";
import { toast } from "sonner";
import {
  useUserSupervisions, useTeamSupervisions,
  useUpsertUserSupervision, useEndUserSupervision, useDeleteUserSupervision,
  useUpsertTeamSupervision, useEndTeamSupervision, useDeleteTeamSupervision,
  useDepartments, useStaffProfiles,
  type SupervisionScope, type UserSupervision, type TeamSupervision,
} from "@/hooks/useSupervisions";

const SCOPE_OPTIONS: Array<{ value: SupervisionScope; label: string }> = [
  { value: "general",  label: "General (todo)" },
  { value: "tickets",  label: "Tickets / Soporte" },
  { value: "tasks",    label: "Tareas / Proyectos" },
  { value: "quality",  label: "Calidad (QA)" },
  { value: "time",     label: "Registro de tiempos" },
];

const SCOPE_TONE: Record<SupervisionScope, string> = {
  general: "bg-primary/15 text-primary border-primary/30",
  tickets: "bg-info/15 text-info border-info/30",
  tasks:   "bg-warning/15 text-warning border-warning/30",
  quality: "bg-success/15 text-success border-success/30",
  time:    "bg-violet-500/15 text-violet-500 border-violet-500/30",
};

export function SupervisionsAdminPanel() {
  return (
    <div className="space-y-3">
      <div>
        <h3 className="text-base font-semibold flex items-center gap-2">
          <UserCheck className="h-4 w-4 text-primary" /> Supervisiones formales
        </h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Declarar relaciones supervisor↔supervisado fuera del organigrama implícito por rol.
          Útil para escenarios donde un gerente de un equipo supervisa a alguien de otro equipo
          durante un proyecto puntual o para coaching.
        </p>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users" className="gap-1.5">
            <UserCheck className="h-3.5 w-3.5" /> Personas
          </TabsTrigger>
          <TabsTrigger value="teams" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Equipos (department)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-3">
          <UserSupervisionsTab />
        </TabsContent>

        <TabsContent value="teams" className="mt-3">
          <TeamSupervisionsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Tab: supervisión persona↔persona
// ────────────────────────────────────────────────────────────────────────────

function UserSupervisionsTab() {
  const { data: supervisions, isLoading } = useUserSupervisions();
  const { data: profiles } = useStaffProfiles();
  const upsert = useUpsertUserSupervision();
  const endSup = useEndUserSupervision();
  const del = useDeleteUserSupervision();

  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Partial<UserSupervision> | null>(null);

  const profilesById = useMemo(() => {
    const m = new Map<string, { full_name: string | null; email: string | null; role: string | null }>();
    for (const p of profiles ?? []) m.set(p.user_id, { full_name: p.full_name, email: p.email, role: p.role });
    return m;
  }, [profiles]);

  const nameFor = (id: string) => {
    const p = profilesById.get(id);
    return p?.full_name || p?.email || id.slice(0, 8);
  };

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return supervisions ?? [];
    return (supervisions ?? []).filter(sup => {
      const supName = nameFor(sup.supervisor_id).toLowerCase();
      const subName = nameFor(sup.supervised_user_id).toLowerCase();
      return supName.includes(s) || subName.includes(s);
    });
  }, [supervisions, search, profilesById]);

  const handleSave = async () => {
    if (!editing?.supervisor_id || !editing?.supervised_user_id) {
      toast.error("Supervisor y supervisado son obligatorios");
      return;
    }
    if (editing.supervisor_id === editing.supervised_user_id) {
      toast.error("Un usuario no puede supervisarse a sí mismo");
      return;
    }
    try {
      await upsert.mutateAsync({
        id: editing.id,
        supervisor_id: editing.supervisor_id,
        supervised_user_id: editing.supervised_user_id,
        scope: editing.scope ?? "general",
        started_at: editing.started_at,
        ended_at: editing.ended_at ?? null,
        is_active: editing.is_active ?? true,
        notes: editing.notes ?? null,
      });
      toast.success(editing.id ? "Supervisión actualizada" : "Supervisión creada");
      setEditing(null);
    } catch (e: any) {
      const msg = e?.message?.includes("duplicate")
        ? "Ya existe esa combinación supervisor/supervisado/scope/fecha"
        : (e?.message || "Error al guardar");
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre del supervisor o supervisado..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-8 text-xs"
          />
        </div>
        <Button
          size="sm"
          onClick={() => setEditing({ scope: "general", is_active: true, started_at: new Date().toISOString().slice(0, 10) })}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Nueva supervisión
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-xs text-muted-foreground">
            {search ? "Sin resultados para la búsqueda." : "Aún no hay supervisiones registradas."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(sup => (
            <Card key={sup.id} className={!sup.is_active ? "opacity-60" : ""}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{nameFor(sup.supervisor_id)}</span>
                    <span className="text-xs text-muted-foreground">supervisa a</span>
                    <span className="text-sm font-medium">{nameFor(sup.supervised_user_id)}</span>
                    <Badge variant="outline" className={`text-[10px] ${SCOPE_TONE[sup.scope]}`}>{sup.scope}</Badge>
                    {!sup.is_active && (
                      <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">inactiva</Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Desde {sup.started_at}
                    {sup.ended_at && ` · Hasta ${sup.ended_at}`}
                    {sup.notes && ` · ${sup.notes}`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {sup.is_active && (
                    <Button
                      size="sm" variant="outline"
                      onClick={() => endSup.mutate(sup.id, {
                        onError: (e: any) => toast.error(e?.message ?? "No se pudo finalizar"),
                      })}
                      className="h-7 text-xs gap-1"
                    >
                      <Pause className="h-3 w-3" /> Finalizar
                    </Button>
                  )}
                  <Button
                    size="icon" variant="ghost" className="h-7 w-7"
                    onClick={() => {
                      if (!confirm("¿Eliminar definitivamente esta supervisión? Si era histórica considerá Finalizar en su lugar.")) return;
                      del.mutate(sup.id, {
                        onError: (e: any) => toast.error(e?.message ?? "No se pudo eliminar"),
                      });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar supervisión" : "Nueva supervisión"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Supervisor *</Label>
                <Select
                  value={editing.supervisor_id ?? ""}
                  onValueChange={(v) => setEditing({ ...editing, supervisor_id: v })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {(profiles ?? []).map(p => (
                      <SelectItem key={p.user_id} value={p.user_id} className="text-xs">
                        {p.full_name || p.email} ({p.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Supervisado *</Label>
                <Select
                  value={editing.supervised_user_id ?? ""}
                  onValueChange={(v) => setEditing({ ...editing, supervised_user_id: v })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {(profiles ?? []).map(p => (
                      <SelectItem key={p.user_id} value={p.user_id} className="text-xs">
                        {p.full_name || p.email} ({p.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Scope</Label>
                  <Select
                    value={editing.scope ?? "general"}
                    onValueChange={(v) => setEditing({ ...editing, scope: v as SupervisionScope })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SCOPE_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Desde</Label>
                  <Input
                    type="date"
                    value={editing.started_at ?? ""}
                    onChange={(e) => setEditing({ ...editing, started_at: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Notas</Label>
                <Textarea
                  value={editing.notes ?? ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  placeholder="Ej: cubre vacaciones de Ana hasta Q3 / coaching técnico módulo X"
                  rows={2}
                  className="text-xs"
                />
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

// ────────────────────────────────────────────────────────────────────────────
// Tab: supervisión persona↔equipo (department)
// ────────────────────────────────────────────────────────────────────────────

function TeamSupervisionsTab() {
  const { data: supervisions, isLoading } = useTeamSupervisions();
  const { data: profiles } = useStaffProfiles();
  const { data: departments } = useDepartments();
  const upsert = useUpsertTeamSupervision();
  const endSup = useEndTeamSupervision();
  const del = useDeleteTeamSupervision();

  const [editing, setEditing] = useState<Partial<TeamSupervision> | null>(null);

  const profilesById = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of profiles ?? []) m.set(p.user_id, p.full_name || p.email || p.user_id.slice(0, 8));
    return m;
  }, [profiles]);

  const handleSave = async () => {
    if (!editing?.supervisor_id || !editing?.team_department) {
      toast.error("Supervisor y equipo son obligatorios");
      return;
    }
    try {
      await upsert.mutateAsync({
        id: editing.id,
        supervisor_id: editing.supervisor_id,
        team_department: editing.team_department,
        scope: editing.scope ?? "general",
        started_at: editing.started_at,
        ended_at: editing.ended_at ?? null,
        is_active: editing.is_active ?? true,
        notes: editing.notes ?? null,
      });
      toast.success(editing.id ? "Supervisión actualizada" : "Supervisión creada");
      setEditing(null);
    } catch (e: any) {
      const msg = e?.message?.includes("duplicate")
        ? "Ya existe esa combinación supervisor/equipo/scope/fecha"
        : (e?.message || "Error al guardar");
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <p className="text-xs text-muted-foreground">
          Equipos modelados como <code className="bg-muted px-1 rounded">department</code> en sysde_team_members.
          Si necesitás un equipo nuevo, agregalo primero al directorio.
        </p>
        <Button
          size="sm"
          onClick={() => setEditing({ scope: "general", is_active: true, started_at: new Date().toISOString().slice(0, 10) })}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" /> Nueva supervisión
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
      ) : !supervisions || supervisions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-6 text-center text-xs text-muted-foreground">
            Aún no hay supervisiones de equipos registradas.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {supervisions.map(sup => (
            <Card key={sup.id} className={!sup.is_active ? "opacity-60" : ""}>
              <CardContent className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{profilesById.get(sup.supervisor_id) ?? sup.supervisor_id.slice(0,8)}</span>
                    <span className="text-xs text-muted-foreground">supervisa al equipo</span>
                    <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{sup.team_department}</code>
                    <Badge variant="outline" className={`text-[10px] ${SCOPE_TONE[sup.scope]}`}>{sup.scope}</Badge>
                    {!sup.is_active && (
                      <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">inactiva</Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    Desde {sup.started_at}
                    {sup.ended_at && ` · Hasta ${sup.ended_at}`}
                    {sup.notes && ` · ${sup.notes}`}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  {sup.is_active && (
                    <Button
                      size="sm" variant="outline"
                      onClick={() => endSup.mutate(sup.id, {
                        onError: (e: any) => toast.error(e?.message ?? "No se pudo finalizar"),
                      })}
                      className="h-7 text-xs gap-1"
                    >
                      <Pause className="h-3 w-3" /> Finalizar
                    </Button>
                  )}
                  <Button
                    size="icon" variant="ghost" className="h-7 w-7"
                    onClick={() => {
                      if (!confirm("¿Eliminar definitivamente?")) return;
                      del.mutate(sup.id, {
                        onError: (e: any) => toast.error(e?.message ?? "No se pudo eliminar"),
                      });
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar supervisión de equipo" : "Nueva supervisión de equipo"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Supervisor *</Label>
                <Select
                  value={editing.supervisor_id ?? ""}
                  onValueChange={(v) => setEditing({ ...editing, supervisor_id: v })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {(profiles ?? []).map(p => (
                      <SelectItem key={p.user_id} value={p.user_id} className="text-xs">
                        {p.full_name || p.email} ({p.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Equipo (department) *</Label>
                <Select
                  value={editing.team_department ?? ""}
                  onValueChange={(v) => setEditing({ ...editing, team_department: v })}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    {(departments ?? []).map(d => (
                      <SelectItem key={d} value={d} className="text-xs">{d}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Scope</Label>
                  <Select
                    value={editing.scope ?? "general"}
                    onValueChange={(v) => setEditing({ ...editing, scope: v as SupervisionScope })}
                  >
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SCOPE_OPTIONS.map(o => (
                        <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Desde</Label>
                  <Input
                    type="date"
                    value={editing.started_at ?? ""}
                    onChange={(e) => setEditing({ ...editing, started_at: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Notas</Label>
                <Textarea
                  value={editing.notes ?? ""}
                  onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                  rows={2}
                  className="text-xs"
                />
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
