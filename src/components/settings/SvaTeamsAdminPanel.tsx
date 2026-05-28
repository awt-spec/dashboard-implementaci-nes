import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, Trash2, Users, CalendarOff } from "lucide-react";
import { toast } from "sonner";
import {
  useSvaTeams, useUpsertSvaTeam, useDeleteSvaTeam,
  useSvaTeamHolidays, useAddSvaTeamHoliday, useDeleteSvaTeamHoliday,
  type SvaTeam,
} from "@/hooks/useSvaTeams";

const PRESET_COLORS = ["#C8200F", "#f59e0b", "#0ea5e9", "#10b981", "#8b5cf6", "#ec4899", "#14b8a6"];

export function SvaTeamsAdminPanel() {
  const { data: teams, isLoading } = useSvaTeams(true);
  const upsert = useUpsertSvaTeam();
  const del = useDeleteSvaTeam();

  const [editing, setEditing] = useState<Partial<SvaTeam> | null>(null);
  const [holidaysFor, setHolidaysFor] = useState<SvaTeam | null>(null);

  const openNew = () => setEditing({ name: "", description: "", color: "#C8200F", is_active: true });

  const handleSave = async () => {
    if (!editing?.name?.trim()) { toast.error("El nombre es obligatorio"); return; }
    try {
      await upsert.mutateAsync({
        id: editing.id, name: editing.name.trim(),
        description: editing.description?.trim() || null,
        color: editing.color ?? "#C8200F", is_active: editing.is_active ?? true,
      });
      toast.success(editing.id ? "Equipo actualizado" : "Equipo creado");
      setEditing(null);
    } catch (e: any) {
      toast.error(e?.message?.includes("duplicate") ? "Ya existe un equipo con ese nombre" : (e?.message || "Error al guardar"));
    }
  };

  const handleDelete = (t: SvaTeam) => {
    if (!confirm(`¿Eliminar el equipo SVA "${t.name}"? Se borran sus días no laborables y asignaciones.`)) return;
    del.mutate(t.id, { onError: (e: any) => toast.error(e?.message ?? "No se pudo eliminar") });
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" /> Equipos SVA
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Equipos de servicios de valor agregado con su calendario de días no laborables.
          </p>
        </div>
        <Button size="sm" onClick={openNew} className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Nuevo equipo</Button>
      </div>

      <div className="space-y-2">
        {(teams ?? []).map(t => (
          <Card key={t.id} className={!t.is_active ? "opacity-60" : ""}>
            <CardContent className="p-3 flex items-center gap-3">
              <span className="h-4 w-4 rounded-full shrink-0" style={{ backgroundColor: t.color }} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium">{t.name}</span>
                  {!t.is_active && <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground">inactivo</Badge>}
                </div>
                {t.description && <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{t.description}</p>}
              </div>
              <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setHolidaysFor(t)}>
                <CalendarOff className="h-3 w-3" /> Días no laborables
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditing(t)} aria-label="Editar equipo">
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDelete(t)} aria-label="Eliminar equipo">
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </CardContent>
          </Card>
        ))}
        {(!teams || teams.length === 0) && (
          <Card className="border-dashed"><CardContent className="p-6 text-center text-xs text-muted-foreground">Sin equipos SVA. Creá el primero.</CardContent></Card>
        )}
      </div>

      {/* Dialog crear/editar equipo */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editing?.id ? "Editar equipo SVA" : "Nuevo equipo SVA"}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Nombre *</Label>
                <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Ej: Customer Success Fintech" className="h-8 text-xs" />
              </div>
              <div>
                <Label className="text-xs">Descripción</Label>
                <Textarea value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={2} className="text-xs" />
              </div>
              <div>
                <Label className="text-xs">Color</Label>
                <div className="flex items-center gap-2 mt-1">
                  {PRESET_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setEditing({ ...editing, color: c })}
                      className={`h-6 w-6 rounded-full transition-transform ${editing.color === c ? "ring-2 ring-offset-2 ring-foreground scale-110" : ""}`}
                      style={{ backgroundColor: c }} aria-label={`Color ${c}`} />
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Switch checked={editing.is_active ?? true} onCheckedChange={(v) => setEditing({ ...editing, is_active: v })} />
                <Label className="text-xs">Activo</Label>
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

      {/* Dialog días no laborables */}
      <HolidaysDialog team={holidaysFor} onClose={() => setHolidaysFor(null)} />
    </div>
  );
}

function HolidaysDialog({ team, onClose }: { team: SvaTeam | null; onClose: () => void }) {
  const { data: holidays = [], isLoading } = useSvaTeamHolidays(team?.id);
  const add = useAddSvaTeamHoliday();
  const del = useDeleteSvaTeamHoliday();
  const [date, setDate] = useState("");
  const [desc, setDesc] = useState("");

  const handleAdd = () => {
    if (!team || !date) { toast.error("Seleccioná una fecha"); return; }
    add.mutate({ teamId: team.id, date, description: desc.trim() || undefined }, {
      onSuccess: () => { toast.success("Día agregado"); setDate(""); setDesc(""); },
      onError: (e: any) => toast.error(e?.message?.includes("duplicate") ? "Esa fecha ya está registrada" : (e?.message ?? "Error")),
    });
  };

  return (
    <Dialog open={!!team} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><CalendarOff className="h-4 w-4" /> Días no laborables · {team?.name}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <Label className="text-xs">Fecha</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 text-xs" />
            </div>
            <div className="flex-1">
              <Label className="text-xs">Descripción</Label>
              <Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Ej: Feriado nacional" className="h-8 text-xs" />
            </div>
            <Button size="sm" onClick={handleAdd} disabled={add.isPending} className="gap-1"><Plus className="h-3.5 w-3.5" /></Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
          ) : holidays.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4 italic">Sin días no laborables cargados.</p>
          ) : (
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {holidays.map(h => (
                <div key={h.id} className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-md border bg-card text-xs">
                  <div>
                    <span className="font-medium tabular-nums">{h.holiday_date}</span>
                    {h.description && <span className="text-muted-foreground ml-2">{h.description}</span>}
                  </div>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => team && del.mutate({ id: h.id, teamId: team.id })} aria-label="Eliminar día">
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
